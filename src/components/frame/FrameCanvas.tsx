'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DRAG_THRESHOLD_PX,
  ELEMENT_SPECS,
  MOUNT_GAP_MM,
  MIN_TOUCH_TARGET_PX,
  type FrameElementKind,
} from '@/lib/frame';
import {
  snapToWall,
  wallRunM,
  safeNum,
  useFrameStore,
  WALL_LABELS,
  type PlacedElement,
  type WallId,
} from '@/lib/store/frameStore';

/**
 * ИНТЕРАКТИВНАЯ SVG-СХЕМА КАРКАСА С DRAG-AND-DROP.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ПОЧЕМУ POINTER EVENTS, А НЕ HTML5 DRAG-AND-DROP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * HTML5-события (`dragstart`/`dragover`/`drop`) на iOS Safari и Android Chrome
 * НЕ РАБОТАЮТ для переноса пользовательских элементов: там работает только
 * перенос текста и картинок. То есть на телефоне (а это половина аудитории
 * раздела) схема была бы просто «картинкой». Pointer Events (`pointerdown`,
 * `pointermove`, `pointerup`) единым кодом покрывают мышь, палец и перо —
 * ровно то, что нужно прорабу в поле.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ТРИ КООРДИНАТНЫЕ СИСТЕМЫ, КОТОРЫЕ НЕЛЬЗЯ ПУТАТЬ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. `clientX/clientY` — пиксели экрана (CSS px).
 *   2. `getBoundingClientRect()` — пиксели видимой области SVG.
 *   3. `viewBox` — внутренние единицы чертежа (миллиметры дома).
 *
 * Преобразование делается ОДНОЙ функцией `clientToPlan()` через `getScreenCTM()`
 * SVG-элемента: матрица учитывает и масштаб, и `preserveAspectRatio`, и
 * поворот/перекос контейнера. Ручная формула «(clientX - rect.left) / rect.width
 * * viewBoxWidth» работает только при `preserveAspectRatio="none"` и ломается
 * на iOS, где Safari подгоняет aspect по высоте.
 */

/* ========================================================================== */
/*                              ГЕОМЕТРИЯ СХЕМЫ                                 */
/* ========================================================================== */

/** Отступ от края viewBox до «нуля» дома, внутренние единицы */
const VIEW_PADDING = 2200;

/** Цвета чертежа — палитра раздела, три цвета без четвёртого */
const STROKE = '#FFFFFF';
const KHAKI = '#A8B48C';
const GRID = 'rgba(255,255,255,0.12)';
const DROP_HINT = 'rgba(168,180,140,0.35)';

/** Размеры элементов на чертеже, мм (для читаемости крупнее проёма) */
const DRAW_MIN_SIZE_MM = 500;

/* ========================================================================== */
/*                        ХУК ПЕРЕТАСКИВАНИЯ (ЯДРО)                             */
/* ========================================================================== */

/**
 * Что именно сейчас тянут: из палитры (kind) или с самой схемы (kind + id).
 *
 * Разделение источников принципиально: элемент из палитры при сбросе СОЗДАЁТСЯ,
 * а элемент со схемы ПЕРЕМЕЩАЕТСЯ. Если бы разницы не было, перенос окна по
 * схеме каждый раз плодил бы копию — типичный баг «после двух перетаскиваний
 * на плане шесть окон».
 */
export type DragPayload =
  | { source: 'palette'; kind: FrameElementKind }
  | { source: 'canvas'; kind: FrameElementKind; id: string };

/** Обработчик начала переноса — общий тип для палитры и схемы */
export type DragBeginFn = (payload: DragPayload, x: number, y: number) => void;

interface DragState {
  payload: DragPayload;
  /** Экранные координаты указателя (px) — для «резиновой рамки» под пальцем */
  clientX: number;
  clientY: number;
  /** Куда прилипнет элемент: стена и позиция вдоль неё */
  wall: WallId | null;
  positionM: number;
  /** Начальная точка жеста — по ней определяется «клик или перенос» */
  startX: number;
  startY: number;
  /** true после превышения DRAG_THRESHOLD_PX */
  moved: boolean;
}

/**
 * Хук перетаскивания.
 *
 * ГЛАВНОЕ РЕШЕНИЕ: в сторе лежит только ЗАВЕРШЁННОЕ действие (`moveElement`
 * вызывается на `pointerup`), а курсор живёт в локальном `useState` этого хука.
 * Если писать координаты в стор на каждом `pointermove` (40–120 событий в
 * секунду), то панель сметы пересчитывалась бы на каждом кадре движения мыши —
 * и на телефоне это означает заметное подтормаживание интерфейса.
 *
 * ОТМЕНА: `pointercancel` (системный жест — входящий звонок, уведомление,
 * «домой» на Android) и `pointerup` вне зоны схемы отменяют перенос. Элемент
 * остаётся там, где был. Это важно: без обработки `pointercancel` элемент
 * «приклеивался» к месту, где палец был в момент прерывания.
 */
export function useDragController(svgRef: React.RefObject<SVGSVGElement>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Колбэк для завершения переноса — хранится в ref, чтобы обработчики
  // pointermove не пересоздавались на каждый кадр (иначе React переподписывается
  // 60 раз в секунду).
  const finishRef = useRef<((payload: DragPayload, wall: WallId, positionM: number) => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const form = useFrameStore((s) => s.form);
  const addElement = useFrameStore((s) => s.addElement);
  const moveElement = useFrameStore((s) => s.moveElement);

  const lengthM = safeNum(form.lengthM, 10, 3, 30);
  const depthM = safeNum(form.depthM, 8, 3, 30);

  /**
   * Экранные координаты → координаты дома (метры от центра).
   *
   * `getScreenCTM()` даёт матрицу SVG-пиксели → user units. Это единственный
   * способ, который переживает `preserveAspectRatio`, трансформации и разные
   * плотности экрана. Функция НЕ бросает, если CTM недоступен (старый WebView):
   * возвращает null, и вызывающий код просто не срабатывает.
   */
  const clientToPlan = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(ctm.inverse());
    return {
      // User units чертежа — миллиметры; дом в них центрирован в (0, 0).
      x: local.x / 1000,
      y: local.y / 1000,
    };
  }, [svgRef]);

  const beginDrag = useCallback(
    (payload: DragPayload, clientX: number, clientY: number) => {
      const next: DragState = {
        payload,
        clientX,
        clientY,
        wall: null,
        positionM: 0,
        startX: clientX,
        startY: clientY,
        moved: false,
      };
      dragRef.current = next;
      setDrag(next);
    },
    []
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current;
      if (!current) return;

      const dx = clientX - current.startX;
      const dy = clientY - current.startY;
      const moved = current.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;

      const plan = clientToPlan(clientX, clientY);
      const snapped = plan ? snapToWall(plan.x, plan.y, lengthM, depthM) : null;

      const next: DragState = {
        ...current,
        clientX,
        clientY,
        moved,
        wall: snapped?.wall ?? null,
        positionM: snapped?.positionM ?? current.positionM,
      };
      dragRef.current = next;
      setDrag(next);
    },
    [clientToPlan, lengthM, depthM]
  );

  const endDrag = useCallback(() => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current || !current.moved) return;

    const payload = current.payload;
    // Если элемент не «прилип» к стене — отмена. Без этого элемент остался бы
    // с последним валидным положением, и прораб не понимал бы, почему окно
    // «не туда» приземлилось.
    if (!current.wall) return;
    if (finishRef.current) finishRef.current(payload, current.wall, current.positionM);
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  /**
   * Глобальные слушатели pointermove/pointerup.
   *
   * Вешаются на `window`, а не на SVG: палец, ушедший за пределы схемы,
   * всё равно должен «дотягивать» элемент (иначе он залипает у края), а
   * отпускание вне окна браузера обязано корректно отменяться.
   *
   * `pointermove` с `{ passive: false }` + `preventDefault` на touch — без этого
   * телефон прокручивает страницу вместо переноса. Современный вариант —
   * `touch-action: none` на самом SVG, он применён в стилях ниже; preventDefault
   * оставлен как страховка для старых WebView.
   */
  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      if (event.cancelable) event.preventDefault();
      updateDrag(event.clientX, event.clientY);
    };
    const handleUp = () => endDrag();
    const handleCancel = () => cancelDrag();

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('blur', handleCancel);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('blur', handleCancel);
    };
  }, [drag, updateDrag, endDrag, cancelDrag]);

  // Курсор «схватили» — глобальный класс на body, чтобы весь интерфейс знал,
  // что идёт перенос (важно: без него iOS подсвечивает выделение текста).
  useEffect(() => {
    if (!drag) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [drag]);

  /** Завершение переноса: единственное место, где пишется в стор. */
  useEffect(() => {
    finishRef.current = (payload, wall, positionM) => {
      if (payload.source === 'palette') {
        addElement({ kind: payload.kind, wall, positionM, rotation: 0 });
      } else {
        moveElement(payload.id, wall, positionM);
      }
    };
    cancelRef.current = cancelDrag;
    return () => {
      finishRef.current = null;
      cancelRef.current = null;
    };
  }, [addElement, moveElement, cancelDrag]);

  return { drag, beginDrag, updateDrag, endDrag, cancelDrag };
}

/* ========================================================================== */
/*                              ЭЛЕМЕНТ-ПАЛИТРА                                 */
/* ========================================================================== */

const PALETTE_ICONS: Record<FrameElementKind, string> = {
  window: '▭',
  door: '▯',
  terrace: '▤',
};

/**
 * Палитра элементов: три кнопки, которые перетаскиваются на схему.
 *
 * Кнопки `draggable={false}` — это важно. Нативный HTML5-перенос мы здесь
 * НЕ используем, и если оставить атрибут, браузер запустит свой drag-старт
 * (с картинкой-призраком и остановкой pointer-событий), который на тач-устройствах
 * всё равно заблокирован системой. Отключаем явно.
 *
 * Дублирующее поведение (КРИТИЧНО ДЛЯ ДОСТУПНОСТИ): нажатие добавляет элемент
 * в середину выбранной стены. Без этого схема недоступна с клавиатуры и
 * неудобна, когда тянуть пальцем по маленькому экрану неудобно.
 */
export function ElementPalette({
  onAdd,
  beginDragRef,
  className,
}: {
  /** Нажатие (не перенос): добавить элемент в центр выбранной стены */
  onAdd: (kind: FrameElementKind) => void;
  /**
   * Ссылка на обработчик начала переноса ИЗ ХУКА `useDragController`.
   *
   * Именно ref, а не колбэк в пропсах: обработчик меняет identity при каждом
   * изменении габаритов дома, и если передавать его обычной функцией, палитра
   * перерисовывалась бы вместе со схемой. Ref разрывает эту связь — палитра
   * всегда читает актуальный обработчик.
   */
  beginDragRef: React.MutableRefObject<DragBeginFn | null>;
  className?: string;
}) {
  const [activeKind, setActiveKind] = useState<FrameElementKind | null>(null);

  return (
    <div className={cn('flex gap-2', className)} role="group" aria-label="Элементы для переноса на схему">
      {(Object.keys(ELEMENT_SPECS) as FrameElementKind[]).map((kind) => {
        const spec = ELEMENT_SPECS[kind];
        const isActive = activeKind === kind;
        return (
          <button
            key={kind}
            type="button"
            draggable={false}
            onPointerDown={(event) => {
              event.preventDefault();
              setActiveKind(kind);
              beginDragRef.current?.({ source: 'palette', kind }, event.clientX, event.clientY);
            }}
            onClick={() => onAdd(kind)}
            onPointerUp={() => setActiveKind(null)}
            onPointerCancel={() => setActiveKind(null)}
            className={cn(
              'flex flex-1 select-none flex-col items-center gap-0.5 border-2 px-2 py-2 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
              'touch-none active:cursor-grabbing',
              isActive
                ? 'border-white bg-[var(--kc-khaki)] text-white'
                : 'border-[var(--kc-border-strong)] bg-[var(--kc-bg)] text-white hover:border-[var(--kc-khaki-text)]'
            )}
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            aria-label={`${spec.label}: перетащите на схему или нажмите, чтобы добавить в центр`}
          >
            <span className="font-mono text-lg leading-none" aria-hidden="true">
              {PALETTE_ICONS[kind]}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide">{spec.label}</span>
            <span className="font-mono text-[9px] text-[var(--kc-faint)]">
              {spec.widthMm}×{spec.heightMm}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ========================================================================== */
/*                            ГЛАВНЫЙ КОМПОНЕНТ СХЕМЫ                           */
/* ========================================================================== */

export interface FrameCanvasProps {
  className?: string;
  /**
   * Ref, в который кладётся обработчик начала переноса.
   *
   * Схема владеет хуком переноса, а палитра — соседний компонент. Связь идёт
   * через ref, который создаёт родитель (конструктор) и передаёт обоим: так
   * палитра может начать перенос, зная хук, и при этом не ререндерится сама.
   */
  beginDragRef: React.MutableRefObject<DragBeginFn | null>;
}

/**
 * Схема дома: прямоугольник стен, расставленные элементы, зона сброса.
 *
 * Чертёж рисуется в МИЛЛИМЕТРАХ (`viewBox`), и дом центрирован в (0, 0).
 * Так координаты элементов в сторе (метры от начала стены) превращаются в
 * координаты схемы одним сложением, без пересчёта масштаба.
 */
export function FrameCanvas({ className, beginDragRef }: FrameCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { drag, beginDrag, updateDrag, endDrag, cancelDrag } = useDragController(svgRef);

  const form = useFrameStore((s) => s.form);
  const elements = useFrameStore((s) => s.elements);
  const selectedId = useFrameStore((s) => s.selectedId);
  const selectElement = useFrameStore((s) => s.selectElement);
  const removeElement = useFrameStore((s) => s.removeElement);

  const lengthM = safeNum(form.lengthM, 10, 3, 30);
  const depthM = safeNum(form.depthM, 8, 3, 30);
  const heightM = safeNum(form.heightM, 2.7, 2, 3.5);

  // Пробрасываем обработчик начала переноса в ref, который держит конструктор:
  // палитра и схема — соседние компоненты, и поднимать состояние переноса наверх
  // (в конструктор) было бы лишним ререндером всех четырёх шагов на каждый кадр.
  useEffect(() => {
    beginDragRef.current = beginDrag;
  }, [beginDrag, beginDragRef]);

  /** Размер viewBox под текущий дом с запасом на подписи стен */
  const viewBox = useMemo(() => {
    const w = lengthM * 1000 + VIEW_PADDING * 2;
    const h = depthM * 1000 + VIEW_PADDING * 2;
    return `${-w / 2} ${-h / 2} ${w} ${h}`;
  }, [lengthM, depthM]);

  /** Подпись размера по оси X (снизу) и Y (слева) */
  const dimensionLines = useMemo(() => {
    const halfL = (lengthM * 1000) / 2;
    const halfD = (depthM * 1000) / 2;
    const off = 700;
    return {
      x: { x1: -halfL, y1: halfD + off, x2: halfL, y2: halfD + off, labelY: halfD + off + 320, labelX: 0 },
      y: { x1: -halfL - off, y1: -halfD, x2: -halfL - off, y2: halfD, labelX: -halfL - off - 260, labelY: 0 },
    };
  }, [lengthM, depthM]);

  /** Начало переноса с самого элемента */
  const handleElementPointerDown = useCallback(
    (event: React.PointerEvent, element: PlacedElement) => {
      event.preventDefault();
      event.stopPropagation();
      selectElement(element.id);
      beginDrag({ source: 'canvas', kind: element.kind, id: element.id }, event.clientX, event.clientY);
    },
    [beginDrag, selectElement]
  );

  /** Нажатие по пустой схеме — снимает выделение */
  const handleBackgroundPointerDown = useCallback(
    (event: React.PointerEvent) => {
      selectElement(null);
      updateDrag(event.clientX, event.clientY);
    },
    [selectElement, updateDrag]
  );

  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const wallThickness = 150 * heightM; // условная толщина стены на чертеже

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="h-auto w-full select-none"
        style={{ touchAction: 'none' }}
        role="img"
        aria-label={`Схема каркасного дома ${lengthM} на ${depthM} метров, проёмов: ${elements.length}`}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        {/* Фон чертежа */}
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="var(--kc-bg)" />

        {/* Сетка 1 м — читается масштаб и сразу видно, что дом 10×8, а не «большой» */}
        <g aria-hidden="true">
          {Array.from({ length: Math.floor(lengthM) + 1 }).map((_, i) => {
            const x = -halfL + i * 1000;
            return (
              <line key={`gx-${i}`} x1={x} y1={-halfD} x2={x} y2={halfD} stroke={GRID} strokeWidth="8" />
            );
          })}
          {Array.from({ length: Math.floor(depthM) + 1 }).map((_, i) => {
            const y = -halfD + i * 1000;
            return (
              <line key={`gy-${i}`} x1={-halfL} y1={y} x2={halfL} y2={y} stroke={GRID} strokeWidth="8" />
            );
          })}
        </g>

        {/* Зона сброса: подсвечивается, когда элемент «прилип» к стене */}
        {drag?.wall && (
          <DropHighlight
            wall={drag.wall}
            positionM={drag.positionM}
            lengthM={lengthM}
            depthM={depthM}
            kind={drag.payload.kind}
            thickness={wallThickness}
          />
        )}

        {/* Стены: четыре прямоугольных пояса */}
        <Walls lengthM={lengthM} depthM={depthM} thickness={wallThickness} />

        {/* Заливка пола — читается как «внутри дома», а не как пустота */}
        <rect x={-halfL} y={-halfD} width={halfL * 2} height={halfD * 2} fill="rgba(255,255,255,0.02)" />

        {/* Размерные линии */}
        <g aria-hidden="true">
          <DimensionLine {...dimensionLines.x} />
          <DimensionLine {...dimensionLines.y} vertical />
        </g>

        {/* Подписи стен */}
        <WallLabels lengthM={lengthM} depthM={depthM} offset={wallThickness / 2 + 300} />

        {/* Расставленные элементы */}
        {elements.map((element) => (
          <PlacedElementShape
            key={element.id}
            element={element}
            selected={selectedId === element.id}
            onPointerDown={handleElementPointerDown}
            lengthM={lengthM}
            depthM={depthM}
            thickness={wallThickness}
          />
        ))}

        {/* Индикатор переноса: элемент следует за пальцем */}
        {drag && drag.moved && drag.wall && (
          <DragGhost kind={drag.payload.kind} wall={drag.wall} positionM={drag.positionM} lengthM={lengthM} depthM={depthM} thickness={wallThickness} />
        )}
      </svg>

      {/* Подсказка снизу — только на мобильных, где нет места для тултипа */}
      <p className="mt-2 text-center text-[10px] leading-snug text-[var(--kc-faint)] sm:hidden">
        Тяните элемент из палитры на стену. Нажать на схему пустое место — снять выделение.
      </p>
    </div>
  );
}

/* ========================================================================== */
/*                            ЭЛЕМЕНТЫ ЧЕРТЕЖА                                  */
/* ========================================================================== */

/** Четыре стены как прямоугольные пояса вокруг пустого пола */
function Walls({ lengthM, depthM, thickness }: { lengthM: number; depthM: number; thickness: number }) {
  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const t = thickness;
  return (
    <g aria-hidden="true">
      <rect x={-halfL} y={-halfD - t / 2} width={halfL * 2} height={t} fill="var(--kc-surface-3)" stroke={STROKE} strokeWidth="16" />
      <rect x={-halfL} y={halfD - t / 2} width={halfL * 2} height={t} fill="var(--kc-surface-3)" stroke={STROKE} strokeWidth="16" />
      <rect x={-halfL - t / 2} y={-halfD + t / 2} width={t} height={halfD * 2 - t} fill="var(--kc-surface-3)" stroke={STROKE} strokeWidth="16" />
      <rect x={halfL - t / 2} y={-halfD + t / 2} width={t} height={halfD * 2 - t} fill="var(--kc-surface-3)" stroke={STROKE} strokeWidth="16" />
    </g>
  );
}

/**
 * Подсветка места сброса на выбранной стене.
 *
 * Раньше здесь были зашиты «1000 мм» вместо реальных габаритов дома — на схеме
 * 6×5 м подсветка уезжала бы за пределы стены. Теперь позиция и размер берутся
 * из той же арифметики, что и сам элемент (начало стены + positionM), иначе
 * подсветка и призрак разъезжались бы при любом размере дома.
 */
function DropHighlight({
  wall,
  positionM,
  kind,
  lengthM,
  depthM,
  thickness,
}: {
  wall: WallId;
  positionM: number;
  kind: FrameElementKind;
  lengthM: number;
  depthM: number;
  thickness: number;
}) {
  const spec = ELEMENT_SPECS[kind];
  const w = Math.max(spec.widthMm, DRAW_MIN_SIZE_MM) + MOUNT_GAP_MM * 2;
  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const run = wallRunM(wall, lengthM, depthM);
  const t = thickness;
  // Зазор 90 мм, как у призрака: подсветка должна быть чуть крупнее и «под».
  const g = 90;
  const posMm = (Math.min(Math.max(0, positionM), Math.max(0, run - w / 2000)) * 1000);

  const props = {
    fill: DROP_HINT,
    stroke: KHAKI,
    strokeWidth: 12,
    strokeDasharray: '60 40',
    pointerEvents: 'none' as const,
  };

  switch (wall) {
    case 'front':
      return (
        <rect
          x={-halfL + posMm - w / 2}
          y={-halfD - t / 2 - g}
          width={w}
          height={t + g * 2}
          {...props}
        />
      );
    case 'back':
      return (
        <rect
          x={-halfL + posMm - w / 2}
          y={halfD + t / 2 - g}
          width={w}
          height={t + g * 2}
          {...props}
        />
      );
    case 'left':
      return (
        <rect
          x={-halfL - t / 2 - g}
          y={-halfD + posMm - w / 2}
          width={t + g * 2}
          height={w}
          {...props}
        />
      );
    case 'right':
      return (
        <rect
          x={halfL + t / 2 - g}
          y={-halfD + posMm - w / 2}
          width={t + g * 2}
          height={w}
          {...props}
        />
      );
    default:
      return null;
  }
}

/**
 * Расставленный элемент на схеме.
 *
 * Геометрия считается от `wall` и `positionM`: позиция — это расстояние от
 * начала стены в метрах, поэтому координата = начало стены + позиция. Это
 * позволяет элементу «прилипать» к стене при изменении размера дома без
 * пересчёта в сторе (positionM остаётся в метрах, а не в пикселях).
 *
 * Размер на чертеже увеличен минимум до 500 мм: окно 1200×1400 в масштабе дома
 * 10×8 м на экране телефона — это 3 пикселя, в которые невозможно попасть
 * пальцем. Увеличение не влияет на смету (она считается от миллиметров).
 */
function PlacedElementShape({
  element,
  selected,
  onPointerDown,
  lengthM,
  depthM,
  thickness,
}: {
  element: PlacedElement;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent, element: PlacedElement) => void;
  lengthM: number;
  depthM: number;
  thickness: number;
}) {
  const spec = ELEMENT_SPECS[element.kind];
  const w = Math.max(spec.widthMm, DRAW_MIN_SIZE_MM);
  const h = Math.max(spec.heightMm, DRAW_MIN_SIZE_MM);
  const run = wallRunM(element.wall, lengthM, depthM);
  const pos = Math.min(Math.max(0, element.positionM), run - w / 2000) * 1000;

  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const t = thickness;

  const fill = selected ? KHAKI : STROKE;
  const stroke = selected ? '#FFFFFF' : KHAKI;

  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 24 : 14,
    onPointerDown: (event: React.PointerEvent) => onPointerDown(event, element),
    className: 'cursor-grab active:cursor-grabbing touch-none',
    style: { cursor: 'grab' as const },
  };

  switch (element.wall) {
    case 'front':
      return <rect x={-halfL + pos - w / 2} y={-halfD - t / 2 - 60} width={w} height={t + 120} {...common} />;
    case 'back':
      return <rect x={-halfL + pos - w / 2} y={halfD + t / 2 - 60} width={w} height={t + 120} {...common} />;
    case 'left':
      return <rect x={-halfL - t / 2 - 60} y={-halfD + pos - w / 2} width={t + 120} height={w} {...common} />;
    case 'right':
      return <rect x={halfL + t / 2 - 60} y={-halfD + pos - w / 2} width={t + 120} height={w} {...common} />;
    default:
      return null;
  }
}

/** «Резиновый» элемент, следующий за пальцем, — показывает, куда он встанет */
function DragGhost({
  kind,
  wall,
  positionM,
  lengthM,
  depthM,
  thickness,
}: {
  kind: FrameElementKind;
  wall: WallId;
  positionM: number;
  lengthM: number;
  depthM: number;
  thickness: number;
}) {
  const spec = ELEMENT_SPECS[kind];
  const w = Math.max(spec.widthMm, DRAW_MIN_SIZE_MM);
  const h = Math.max(spec.heightMm, DRAW_MIN_SIZE_MM);
  const run = wallRunM(wall, lengthM, depthM);
  const pos = Math.min(Math.max(0, positionM), run - w / 2000) * 1000;
  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const t = thickness;

  const ghost = {
    fill: 'rgba(168,180,140,0.55)',
    stroke: '#FFFFFF',
    strokeWidth: 20,
    strokeDasharray: '50 30',
    pointerEvents: 'none' as const,
  };

  switch (wall) {
    case 'front':
      return <rect x={-halfL + pos - w / 2} y={-halfD - t / 2 - 90} width={w} height={t + 180} {...ghost} />;
    case 'back':
      return <rect x={-halfL + pos - w / 2} y={halfD + t / 2 - 90} width={w} height={t + 180} {...ghost} />;
    case 'left':
      return <rect x={-halfL - t / 2 - 90} y={-halfD + pos - w / 2} width={t + 180} height={w} {...ghost} />;
    case 'right':
      return <rect x={halfL + t / 2 - 90} y={-halfD + pos - w / 2} width={t + 180} height={w} {...ghost} />;
    default:
      return null;
  }
}

/** Линия размера со засечками и подписью */
function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  labelX,
  labelY,
  vertical,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  vertical?: boolean;
}) {
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={KHAKI} strokeWidth="12" />
      <line
        x1={x1}
        y1={y1 - (vertical ? 0 : 180)}
        x2={x1}
        y2={y1 + (vertical ? 180 : 0)}
        stroke={KHAKI}
        strokeWidth="12"
      />
      <line
        x1={x2}
        y1={y2 - (vertical ? 0 : 180)}
        x2={x2}
        y2={y2 + (vertical ? 180 : 0)}
        stroke={KHAKI}
        strokeWidth="12"
      />
      <text
        x={labelX}
        y={labelY}
        fill={KHAKI}
        fontSize="200"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {vertical ? `${Math.abs(y2 - y1)} мм` : `${Math.abs(x2 - x1)} мм`}
      </text>
    </g>
  );
}

/** Подписи стен с размерами по центру каждой стены */
function WallLabels({ lengthM, depthM, offset }: { lengthM: number; depthM: number; offset: number }) {
  const halfL = (lengthM * 1000) / 2;
  const halfD = (depthM * 1000) / 2;
  const label = (x: number, y: number, text: string) => (
    <text x={x} y={y} fill={KHAKI} fontSize="170" fontWeight="700" textAnchor="middle" aria-hidden="true">
      {text}
    </text>
  );
  return (
    <g>
      {label(0, -halfD - offset - 120, `${WALL_LABELS.front} · ${lengthM} м`)}
      {label(0, halfD + offset + 120, `${WALL_LABELS.back} · ${lengthM} м`)}
      {label(-halfL - offset - 120, 0, `${WALL_LABELS.left} · ${depthM} м`)}
      {label(halfL + offset + 120, 0, `${WALL_LABELS.right} · ${depthM} м`)}
    </g>
  );
}

/**
 * Список элементов с кнопкой удаления — доступный «список» к схеме.
 *
 * Без него схема была бы недоступна с клавиатуры: экранному ридеру не из чего
 * прочитать, что на ней нарисовано. Список решает и вторую задачу: показать
 * цену каждого элемента, которая на самом чертеже не помещается.
 */
export function ElementList({
  elements,
  onRemove,
  onSelect,
  selectedId,
}: {
  elements: PlacedElement[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (elements.length === 0) {
    return (
      <p className="border-2 border-dashed border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3 text-[11px] leading-snug text-[var(--kc-muted)]">
        Проёмов пока нет. Перетащите «Окно», «Дверь» или «Террасу» из палитры на
        любую стену — смета пересчитается мгновенно.
      </p>
    );
  }

  return (
    <ul className="space-y-1" aria-label="Расставленные элементы">
      {elements.map((element) => {
        const spec = ELEMENT_SPECS[element.kind];
        const isSelected = selectedId === element.id;
        return (
          <li
            key={element.id}
            className={cn(
              'flex items-center gap-2 border-2 px-2 py-1.5',
              isSelected
                ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/15'
                : 'border-[var(--kc-border)] bg-[var(--kc-bg)]'
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(element.id)}
              className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ minHeight: 32 }}
            >
              <span className="block text-[11px] font-bold text-white">
                {spec.label} {spec.widthMm}×{spec.heightMm}
              </span>
              <span className="block text-[10px] text-[var(--kc-faint)]">
                {WALL_LABELS[element.wall]} · {element.positionM.toFixed(2)} м от края
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(element.id)}
              className="border-2 border-transparent px-2 py-1 text-[10px] font-bold text-[var(--kc-muted)] hover:border-red-500/60 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
              aria-label={`Удалить ${spec.label} на стене ${WALL_LABELS[element.wall]}`}
              title="Удалить элемент"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Клик по кнопке «удалить выделенное» — обработчик, вынесенный для удобства конструктора */
export function useRemoveSelected() {
  const selectedId = useFrameStore((s) => s.selectedId);
  const removeElement = useFrameStore((s) => s.removeElement);
  return useCallback(() => {
    if (selectedId) removeElement(selectedId);
  }, [selectedId, removeElement]);
}
