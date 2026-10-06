'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import {
  ClearSchemeButton,
  FrameButton,
  FrameCard,
  FrameStat,
  FrameStatGrid,
  HistoryButtons,
} from '@/components/frame/ui';
import {
  ELEMENT_SPECS,
  countByKind,
  openingAreaWithGapM2,
  totalOpeningsAreaM2,
  type FrameElementKind,
} from '@/lib/frame';
import {
  clampPosition,
  safeNum,
  useFrameStore,
  WALL_LABELS,
  WALL_ORDER,
  type PlacedElement,
  type WallId,
} from '@/lib/store/frameStore';
import { ElementList, ElementPalette, FrameCanvas, type DragBeginFn } from './FrameCanvas';
import { formatByn } from '@/lib/construction';

/**
 * БЛОК СХЕМЫ: палитра элементов + интерактивная SVG + список + статистика.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ ЧАСТЬ КОНСТРУКТОРА
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Схема живёт в соседнем рендер-проходе с четырьмя шагами. Если поднять её в
 * конструктор, любое движение пальца перерендерило бы весь раздел (четыре
 * карточки с десятками полей). Здесь состояние переноса локализовано, а
 * конструктор получает только готовые цифры.
 *
 * ЭКОНОМИЯ ПАЛЬЦА — ПРИОРИТЕТ ПРОЕКТА
 * -----------------------------------
 * На телефоне палец закрывает нижнюю часть экрана, поэтому палитра элементов
 * стоит НАД схемой, а не под ней: тянуть сверху вниз удобно, снизу вверх —
 * нет (пришлось бы задирать руку и попадать мимо). На десктопе порядок не
 * важен, но единый код проще, чем два.
 *
 * ДОСТУПНОСТЬ БЕЗ МЫШИ
 * ---------------------
 * Нажатие на элемент палитры добавляет его в центр ВЫБРАННОЙ стены. Выбранная
 * стена хранится в `activeWall` и переключается кнопками. Это не «костыль»:
 * на узком экране точно попасть пальцем в стену толщиной 15 мм невозможно,
 * и без этого конструктор был бы нерабочим на телефоне.
 */

type ActiveWall = WallId;

/*
 * `export type`, а не `export`: при isolatedModules обычный re-export типа
 * запрещён — компилятор не может знать, тип это или значение, и требует
 * явного указания. Без этого tsc останавливал сборку всего проекта.
 */
export type { ActiveWall };

export function FramePlan() {
  const form = useFrameStore((s) => s.form);
  const elements = useFrameStore((s) => s.elements);
  const selectedId = useFrameStore((s) => s.selectedId);
  const selectElement = useFrameStore((s) => s.selectElement);
  const addElement = useFrameStore((s) => s.addElement);
  const removeElement = useFrameStore((s) => s.removeElement);
  const clearElements = useFrameStore((s) => s.clearElements);
  const undo = useFrameStore((s) => s.undo);
  const redo = useFrameStore((s) => s.redo);
  const pastLength = useFrameStore((s) => s.past.length);
  const futureLength = useFrameStore((s) => s.future.length);

  const beginDragRef = useRef<DragBeginFn | null>(null);

  /**
   * Активная стена — та, в которую попадёт элемент при ТАПЕ по палитре.
   *
   * Не локальный `useState`, а часть расчёта: стена выбирается кнопками над
   * палитрой, и по умолчанию берётся та, на которой уже стоит больше всего
   * проёмов (прораб достраивает рядом с существующими, а не разбрасывает по
   * дому). Это дефолт, а не правило — пользователь в любой момент выбирает
   * другую стену явно.
   */
  const [activeWall, setActiveWall] = useState<WallId>('front');

  const lengthM = safeNum(form.lengthM, 10, 3, 30);
  const depthM = safeNum(form.depthM, 8, 3, 30);

  const counts = useMemo(() => countByKind(elements.map((el) => ({ kind: el.kind, positionM: el.positionM }))), [elements]);
  const openingsAreaM2 = useMemo(
    () => totalOpeningsAreaM2(elements.map((el) => ({ kind: el.kind, positionM: el.positionM }))),
    [elements]
  );

  /**
   * Добавление элемента тапом (без переноса) — в центр активной стены.
   *
   * Середина стены — единственная позиция, которая гарантированно свободна:
   * проёмы ставят от краёв (чтобы ригель стоял в проёме), а центр обычно
   * остаётся свободным. Это убирает класс ошибок «элемент прилип к краю и
   * наполовину висит на улице».
   */
  const handleQuickAdd = useCallback(
    (kind: FrameElementKind) => {
      const run = activeWall === 'front' || activeWall === 'back' ? lengthM : depthM;
      addElement({ kind, wall: activeWall, positionM: run / 2, rotation: 0 });
    },
    [activeWall, lengthM, depthM, addElement]
  );

  const handleSelect = useCallback((id: string) => selectElement(id), [selectElement]);
  const handleRemove = useCallback((id: string) => removeElement(id), [removeElement]);

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const elementCost = selectedElement
    ? ELEMENT_SPECS[selectedElement.kind].priceByn + ELEMENT_SPECS[selectedElement.kind].workPriceByn
    : 0;

  return (
    <FrameCard
      title="Схема и проёмы"
      subtitle="Перетащите окно, дверь или террасу на любую стену — смета пересчитается мгновенно"
      icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
      action={
        <div className="flex flex-wrap gap-1.5">
          <HistoryButtons
            canUndo={pastLength > 0}
            canRedo={futureLength > 0}
            onUndo={undo}
            onRedo={redo}
          />
          <ClearSchemeButton onClear={clearElements} count={elements.length} />
        </div>
      }
    >
      <div className="space-y-3">
        {/* Выбор стены для тапа — нужен, потому что в стену толщиной 15 мм
            пальцем на телефоне попасть невозможно */}
        <div>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
            Стена для добавления тапом
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Выбор стены">
            {WALL_ORDER.map((wall) => {
              const isActive = activeWall === wall;
              const onWall = elements.filter((el) => el.wall === wall).length;
              const run = wall === 'front' || wall === 'back' ? lengthM : depthM;
              return (
                <button
                  key={wall}
                  type="button"
                  onClick={() => setActiveWall(wall)}
                  aria-pressed={isActive}
                  className={`flex flex-1 flex-col items-center border-2 px-1 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)] text-white'
                      : 'border-[var(--kc-border-strong)] bg-[var(--kc-bg)] text-[var(--kc-muted)] hover:text-white'
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <span className="text-[9px] font-bold uppercase leading-tight">{WALL_LABELS[wall].split(' (')[0]}</span>
                  <span className="font-mono text-[9px] opacity-80">
                    {run.toFixed(1)} м{onWall > 0 ? ` · ${onWall}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Палитра — НАД схемой (см. комментарий про палец) */}
        <ElementPalette onAdd={handleQuickAdd} beginDragRef={beginDragRef} />

        {/* Схема */}
        <FrameCanvas beginDragRef={beginDragRef} />

        {/* Статистика проёмов */}
        <FrameStatGrid columns={4}>
          <FrameStat label="Проёмов всего" value={String(elements.length)} unit="шт" accent />
          <FrameStat label="Окна" value={String(counts.window)} unit="шт" />
          <FrameStat label="Двери" value={String(counts.door)} unit="шт" />
          <FrameStat label="Террасы" value={String(counts.terrace)} unit="шт" />
        </FrameStatGrid>

        {/* Вычет проёмов из утеплителя и стены — видимое следствие drag-and-drop */}
        <div className="border-2 border-[var(--kc-border)] bg-[var(--kc-bg)] p-2.5 text-[11px] leading-snug text-[var(--kc-muted)]">
          Проёмы вычтены из площади стен и утеплителя:{' '}
          <span className="font-mono font-bold text-[var(--kc-khaki-text)]">
            {openingsAreaM2.toFixed(2)} м²
          </span>
          . Каждое окно и дверь добавлены в смету отдельной позицией с монтажом.
        </div>

        {/* Список элементов (доступность + цена, которой нет на чертеже) */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
            <Plus className="h-3 w-3" aria-hidden="true" />
            Расставленные элементы
          </h4>
          <ElementList
            elements={elements}
            onRemove={handleRemove}
            onSelect={handleSelect}
            selectedId={selectedId}
          />
        </div>

        {/* Свойства выделенного элемента */}
        {selectedElement && (
          <SelectedElementPanel element={selectedElement} cost={elementCost} onRemove={handleRemove} />
        )}
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                       ПАНЕЛЬ ВЫДЕЛЕННОГО ЭЛЕМЕНТА                           */
/* ========================================================================== */

/**
 * Свойства выделенного элемента: стена, позиция, цена, удаление.
 *
 * Позиция показывается и ПРАВИТСЯ числовым полем. Это не альтернатива
 * перетаскиванию, а страховка для двух случаев: прораб не может попасть пальцем
 * в нужные 10 мм на маленьком экране, и ему нужно поставить окно точно в
 * середину фасада (например, симметрично двум другим).
 */
function SelectedElementPanel({
  element,
  cost,
  onRemove,
}: {
  element: PlacedElement;
  cost: number;
  onRemove: (id: string) => void;
}) {
  const moveElement = useFrameStore((s) => s.moveElement);
  const form = useFrameStore((s) => s.form);
  const lengthM = safeNum(form.lengthM, 10, 3, 30);
  const depthM = safeNum(form.depthM, 8, 3, 30);
  const run = element.wall === 'front' || element.wall === 'back' ? lengthM : depthM;
  const spec = ELEMENT_SPECS[element.kind];

  return (
    <div className="border-2 border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
            Выбрано
          </span>
          <span className="mt-0.5 block text-sm font-bold text-white">
            {spec.label} {spec.widthMm}×{spec.heightMm} мм
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[9px] uppercase tracking-wide text-[var(--kc-muted)]">с монтажом</span>
          <span className="block font-mono text-base font-bold tabular-nums text-white">{formatByn(cost)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--kc-khaki-text)]">
            Стена
          </span>
          <p className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] px-3 py-2.5 text-[12px] text-white">
            {WALL_LABELS[element.wall]} ({run.toFixed(2)} м)
          </p>
        </div>
        <div>
          <label htmlFor={`pos-${element.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--kc-khaki-text)]">
            Позиция от края
          </label>
          <div className="relative">
            <input
              id={`pos-${element.id}`}
              type="text"
              inputMode="decimal"
              value={String(element.positionM)}
              onChange={(event) => {
                const next = safeNum(event.target.value, element.positionM, 0, run);
                moveElement(
                  element.id,
                  element.wall,
                  clampPosition(next, element.wall, lengthM, depthM, element.kind)
                );
              }}
              className="w-full border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] px-3 py-2.5 pr-12 font-mono text-sm tabular-nums text-white focus:border-[var(--kc-khaki-text)] focus:outline-none"
              style={{ minHeight: 44 }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--kc-muted)]">
              м
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FrameButton variant="danger" onClick={() => onRemove(element.id)}>
          Удалить
        </FrameButton>
        <span className="text-[10px] text-[var(--kc-faint)]">
          Проём в стене: {openingAreaWithGapM2(spec).toFixed(2)} м² с зазором 20 мм
        </span>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          КЛАВИАТУРНАЯ НАВИГАЦИЯ                              */
/* ========================================================================== */

/**
 * Горячие клавиши конструктора: Ctrl+Z / Ctrl+Shift+Z для отмены,
 * Delete — удалить выделенное.
 *
 * На объекте прораб работает в перчатках с телефоном, но на рабочем месте в
 * офисе уже клавиатура — и «отменить» там должно работать как в любом
 * редакторе, без подсказок.
 */
export function useFrameHotkeys() {
  const undo = useFrameStore((s) => s.undo);
  const redo = useFrameStore((s) => s.redo);
  const removeElement = useFrameStore((s) => s.removeElement);
  const selectedId = useFrameStore((s) => s.selectedId);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // В полях ввода Ctrl+Z должен отменять правку текста, а не элемент
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeElement(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, removeElement, selectedId]);
}

/** Реэкспорт типов, которые нужны конструктору для подсказок */
export type { PlacedElement };
export { ELEMENT_SPECS };
