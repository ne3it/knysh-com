import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
/**
 * Импорты идут из КОНКРЕТНЫХ модулей, а не из барреля `@/lib/frame`.
 *
 * Причина: баррель реэкспортирует и этот стор тоже (см. `frame/index.ts`).
 * Если бы стор тянул баррель, получился бы цикл `frame/index → frameStore →
 * frame/index`. Цикл в ESM обычно «прощает», но порядок инициализации при этом
 * становится зависимым от того, кто импортирован первым, — и в dev-режиме
 * это даёт `Cannot access 'X' before initialization` при определённом порядке
 * модулей. Прямые импорты делают граф зависимостей ациклическим по построению.
 */
import {
  DEFAULT_STOREY_HEIGHT_M,
  ELEMENT_SPECS,
  FRAME_STEPS,
  HOUSE_MAX_HEIGHT_M,
  HOUSE_MAX_SIDE_M,
  HOUSE_MIN_SIDE_M,
  INSULATION_DEFAULT_MM,
  INSULATION_PRODUCTS,
  PILE_SIZES,
  ROOF_SLOPES,
  STUD_SIZES,
  WALL_HIT_TOLERANCE_MM,
  WALL_SNAP_M,
  type FrameElementKind,
  type FrameStepId,
  type InsulationId,
  type PileSizeId,
  type StudSizeId,
} from '@/lib/frame/constants';
import { computeFrameEstimate, type FrameEstimateResult } from '@/lib/frame/estimate';
import type { ConstructionRegionKey } from '@/lib/store/constructionStore';

/**
 * СОСТОЯНИЕ КОНСТРУКТОРА КАРКАСНЫХ ДОМОВ (/frame).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО СТОРА: РАЗДЕЛЕНИЕ ЧАСТОТЫ ЗАПИСИ И ЧАСТОТЫ ПЕРЕСЧЁТА
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Перетаскивание элемента по экрану порождает 40–120 событий указателя в
 * секунду. Если писать координаты в Zustand на каждое событие, то:
 *   - каждый кадр пересчитывается `computeFrameEstimate` (дёшево, но это всё
 *     равно создаёт новый объект `lines`, и подписчики сравнивают его по
 *     ссылке → перерендер всей панели сметы);
 *   - `persist` с дебаунсом всё равно сериализует стор целиком каждый раз,
 *     даже если изменение — это «куда сейчас показан курсор».
 *
 * Поэтому стор пишется ТОЛЬКО на значимых событиях:
 *   - отпускание перетаскивания (commit);
 *   - смена размера дома, шага, марки утеплителя;
 *   - удаление элемента, отмена действия.
 *
 * Курсор при перетаскивании НЕ хранится здесь вообще. Его ведёт локальный
 * `useState` компонента `FrameCanvas` (см. `useDragController`). Это единственное
 * место, где допустим частый ререндер, и он затрагивает только сам SVG, а не
 * панель сметы.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЧТО ПЕРСИСТИТСЯ, А ЧТО НЕТ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Персистится: габариты дома, выбор типоразмера стойки/сваи/утеплителя/кровли,
 * расставленные элементы, активный шаг, история действий (в пределах 30 шагов).
 *
 * НЕ персистится: `hydrated` (флаг), производные величины (`estimate`), счётчик
 * `historyIndex`. Если сохранить `hydrated: true`, то на серверном рендере Next
 * попытается прочитать его из localStorage и получит `true`, хотя на клиенте
 * гидрация ещё не завершена, — и получим расхождение разметки.
 */

/* ========================================================================== */
/*                                 ТИПЫ                                        */
/* ========================================================================== */

/** Стена дома — элементы привязываются к стенам, а не к «просто точке» */
export type WallId = 'front' | 'back' | 'left' | 'right';

/** Элемент, расставленный на схеме */
export interface PlacedElement {
  /** Уникальный id: нужен для ключа React и для undo */
  id: string;
  kind: FrameElementKind;
  /** К какой стене привязан */
  wall: WallId;
  /** Позиция вдоль стены от её начала, м */
  positionM: number;
  /** Поворот (градусы): терраса может стоять «наружу» */
  rotation: 0 | 90;
}

/**
 * Стек отмены и стек повтора.
 *
 * Реализация на ДВУХ стеках, а не на указателе в один массив снимков. Причина:
 * при хранении только «состояний до действия» повтор восстановить нельзя —
 * «состояние после действия i» есть только в голове того, кто действие выполнил.
 * Со стеками элементарно: undo = достать верхний из `past` в `future`,
 * redo = обратно. И невозможно рассинхронизировать индекс с массивом.
 *
 * `past` хранит снимок списка элементов на МОМЕНТ ДО действия, `future` — на
 * момент ПОСЛЕ (то есть то, куда мы вернёмся при redo).
 */
export interface FrameHistory {
  past: PlacedElement[][];
  future: PlacedElement[][];
}

/** Форма конструктора */
export interface FrameForm {
  /** Габарит по X, м */
  lengthM: string;
  /** Габарит по Y, м */
  depthM: string;
  /** Высота стены, м */
  heightM: string;
  /** Число этажей */
  storeys: string;
  /** Типоразмер стойки */
  studId: StudSizeId;
  /** Типоразмер сваи */
  pileId: PileSizeId;
  /** Марка утеплителя */
  insulationId: InsulationId;
  /** Толщина утеплителя, мм */
  insulationMm: string;
  /** Уклон кровли, % */
  roofSlope: string;
  /** Тип кровельного материала (id из ROOF_SLOPES) */
  roofMaterial: string;
  /** Регион цен */
  region: ConstructionRegionKey;
}

export interface FrameState {
  /** Форма конструктора (значения — строками, как в /const) */
  form: FrameForm;
  /** Обновить часть формы */
  setForm: (patch: Partial<FrameForm>) => void;

  /** Расставленные на схеме элементы */
  elements: PlacedElement[];
  /** Добавить элемент (id генерируется внутри) */
  addElement: (element: Omit<PlacedElement, 'id'>) => string;
  /** Переместить элемент (id + позиция) */
  moveElement: (id: string, wall: WallId, positionM: number) => void;
  /** Удалить элемент */
  removeElement: (id: string) => void;
  /** Очистить все элементы */
  clearElements: () => void;

  /** Выбранный элемент (для панели свойств справа) */
  selectedId: string | null;
  selectElement: (id: string | null) => void;

  /** Активный шаг конструктора */
  activeStep: FrameStepId;
  setActiveStep: (step: FrameStepId) => void;

  /** true после чтения localStorage */
  hydrated: boolean;

  /** Стек отмены: снимки списка элементов ДО каждого действия */
  past: PlacedElement[][];
  /** Стек повтора: снимки, которые вернёт redo */
  future: PlacedElement[][];
  /** Отмена и повтор действий над элементами */
  undo: () => void;
  redo: () => void;

  /** Полный сброс раздела */
  reset: () => void;
}

/* ========================================================================== */
/*                              НАЧАЛЬНОЕ СОСТОЯНИЕ                            */
/* ========================================================================== */

const INITIAL_FORM: FrameForm = {
  lengthM: '10',
  depthM: '8',
  heightM: String(DEFAULT_STOREY_HEIGHT_M),
  storeys: '1',
  studId: '50x150',
  pileId: '300x300',
  insulationId: 'beltep-100',
  insulationMm: String(INSULATION_DEFAULT_MM),
  roofSlope: '25',
  roofMaterial: 'metalTile',
  region: 'minsk',
};

/** Глубина истории: 30 — достаточно для сессии, но не раздувает localStorage */
const MAX_HISTORY = 30;

const INITIAL_STATE = {
  form: INITIAL_FORM,
  elements: [] as PlacedElement[],
  selectedId: null as string | null,
  activeStep: 'foundation' as FrameStepId,
  past: [] as PlacedElement[][],
  future: [] as PlacedElement[][],
};

/**
 * Добавить снимок «до действия» в стек отмены и очистить стек повтора.
 *
 * Вынесено в отдельную функцию, потому что правило одно и то же для всех
 * экшенов: новое действие всегда «забывает» ветку redo. Забыть это в одном
 * из шести экшенов — и «повторить» начнёт возвращать элемент в место,
 * откуда его уже переставили.
 */
function pushHistory(state: FrameState): { past: PlacedElement[][]; future: PlacedElement[][] } {
  return {
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
  };
}

/* ========================================================================== */
/*                              ХЕЛПЕРЫ: СТЕНЫ                                 */
/* ========================================================================== */

/** Порядок стен в схеме: важен для правильной ориентации террасы */
export const WALL_ORDER: WallId[] = ['front', 'back', 'left', 'right'];

/** Подписи стен для интерфейса */
export const WALL_LABELS: Record<WallId, string> = {
  front: 'Фасад (юг)',
  back: 'Зад (север)',
  left: 'Запад',
  right: 'Восток',
};

/**
 * Длина стены, м. Фронт и зад равны длине по X, боковые — глубине по Y.
 */
export function wallLengthM(wall: WallId, lengthM: number, depthM: number): number {
  return wall === 'front' || wall === 'back' ? lengthM : depthM;
}

/**
 * Главный баг предыдущих версий: стены считались одинаковыми. При доме 10×8
 * фронт 10 м, а бок 8 м — 20 % стен не попадали ни в какую сумму.
 * Эта функция — единственное место, где длина стены вычисляется, и она
 * обязана учитывать ориентацию.
 */
export function wallRunM(wall: WallId, lengthM: number, depthM: number): number {
  return wallLengthM(wall, lengthM, depthM);
}

/** Нормализация позиции вдоль стены: не выходит за пределы стены с учётом проёма */
export function clampPosition(
  positionM: number,
  wall: WallId,
  lengthM: number,
  depthM: number,
  kind: FrameElementKind
): number {
  const run = wallRunM(wall, lengthM, depthM);
  const spec = ELEMENT_SPECS[kind];
  const halfWidthM = spec.widthMm / 2000; // половина ширины в метрах
  const min = halfWidthM;
  const max = Math.max(min, run - halfWidthM);
  return Math.min(max, Math.max(min, positionM));
}

/**
 * Определить стену по координате на схеме (в метрах от центра дома).
 *
 * Используется при drop: элемент «прилипает» к ближайшей стене в пределах
 * `WALL_HIT_TOLERANCE_MM`. Если бы стена определялась точно, проём, поставленный
 * пальцем чуть мимо, отвалился бы в пустоту.
 */
export function nearestWall(
  x: number,
  y: number,
  lengthM: number,
  depthM: number,
  toleranceM = WALL_HIT_TOLERANCE_MM / 1000
): { wall: WallId; positionM: number } | null {
  const halfL = lengthM / 2;
  const halfD = depthM / 2;
  const distTop = halfD - y;    // y отрицателен вверху → положительное расстояние до верха
  const distBottom = halfD + y;
  const distLeft = halfL + x;   // x отрицателен слева
  const distRight = halfL - x;

  // Явная аннотация на элементе нужна из-за сортировки: без неё TypeScript
  // расширяет строковые литералы до `string`, и `wall` перестаёт быть `WallId`.
  const candidates: Array<{ wall: WallId; dist: number }> = ([
    { wall: 'front', dist: distTop },
    { wall: 'back', dist: distBottom },
    { wall: 'left', dist: distLeft },
    { wall: 'right', dist: distRight },
  ] as Array<{ wall: WallId; dist: number }>).sort((a, b) => a.dist - b.dist);

  const nearest = candidates[0];
  if (!nearest || nearest.dist > toleranceM) return null;

  // Позиция вдоль стены считается по координате, ПАРАЛЛЕЛЬНОЙ стене.
  const positionM =
    nearest.wall === 'front' || nearest.wall === 'back'
      ? x + halfL // вдоль X, от левого края
      : y + halfD; // вдоль Y, от верхнего края

  return { wall: nearest.wall, positionM };
}

/**
 * Притянуть элемент к стене при перетаскивании (snap).
 *
 * Элемент «прилипает» к стене, если он ближе `WALL_SNAP_M` от неё. Это то, что
 * делает перетаскивание приятным: прораб тянет окно вдоль всей длины стены, и
 * оно едет по стене, а не прыгает по координатам.
 */
export function snapToWall(
  x: number,
  y: number,
  lengthM: number,
  depthM: number
): { wall: WallId; positionM: number } | null {
  return nearestWall(x, y, lengthM, depthM, WALL_SNAP_M);
}

/* ========================================================================== */
/*                              ХЕЛПЕРЫ: ЗНАЧЕНИЯ                               */
/* ========================================================================== */

/**
 * Безопасный разбор строки в число с клампом.
 *
 * Пустая строка → дефолт. Это критично: инпут остаётся строкой, пока прораб
 * не допечатает цифру, и `Number('')` = 0 дала бы дом нулевого размера
 * и «бесконечную» смету в нулевых объёмов.
 */
export function safeNum(raw: string | number | undefined, fallback: number, min?: number, max?: number): number {
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  let value = Number.isFinite(parsed) ? parsed : fallback;
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  return value;
}

/** Генерация id элемента без crypto (работает в SSR и в старых браузерах) */
let idCounter = 0;
export function generateElementId(): string {
  idCounter += 1;
  return `el-${Date.now().toString(36)}-${idCounter}`;
}

/* ========================================================================== */
/*                                 СТОР                                        */
/* ========================================================================== */

/**
 * Создание стора.
 *
 * Отдельная функция (а не `create()` на верхнем уровне) — стандартный приём
 * zustand для локальных сторов в тестах: можно создать изолированный инстанс.
 */
export const useFrameStore = create<FrameState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      hydrated: false,

      setForm: (patch) =>
        set((state) => {
          const next = { ...state.form, ...patch };
          return { form: next };
        }),

      addElement: (element) => {
        const id = generateElementId();
        const state = get();
        const lengthM = safeNum(state.form.lengthM, 10);
        const depthM = safeNum(state.form.depthM, 8);
        const positionM = clampPosition(element.positionM, element.wall, lengthM, depthM, element.kind);
        const newElement: PlacedElement = { ...element, id, positionM };

        set((s) => ({
          ...pushHistory(s),
          elements: [...s.elements, newElement],
          selectedId: id,
        }));
        return id;
      },

      moveElement: (id, wall, positionM) =>
        set((state) => {
          const target = state.elements.find((el) => el.id === id);
          if (!target) return {};
          const lengthM = safeNum(state.form.lengthM, 10);
          const depthM = safeNum(state.form.depthM, 8);
          const clamped = clampPosition(positionM, wall, lengthM, depthM, target.kind);
          // Не пишем историю, если элемент не сдвинулся: перетаскивание,
          // которое закончилось там же, где началось, не должно занимать
          // слот undo (иначе «отменить» ничего не меняет).
          if (target.wall === wall && Math.abs(target.positionM - clamped) < 0.01) return {};

          return {
            ...pushHistory(state),
            elements: state.elements.map((el) =>
              el.id === id ? { ...el, wall, positionM: clamped } : el
            ),
          };
        }),

      removeElement: (id) =>
        set((state) => {
          if (!state.elements.some((el) => el.id === id)) return {};
          return {
            ...pushHistory(state),
            elements: state.elements.filter((el) => el.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
          };
        }),

      clearElements: () =>
        set((state) => {
          if (state.elements.length === 0) return {};
          return {
            ...pushHistory(state),
            elements: [],
            selectedId: null,
          };
        }),

      selectElement: (id) => set({ selectedId: id }),

      setActiveStep: (step) => set({ activeStep: step }),

      /**
       * Отмена: верхний снимок из `past` возвращается в текущее состояние,
       * а ТЕКУЩЕЕ состояние уходит в `future` — это и есть то, куда вернёт
       * следующий `redo`.
       */
      undo: () =>
        set((state) => {
          if (state.past.length === 0) return {};
          const previous = state.past[state.past.length - 1];
          return {
            elements: previous,
            past: state.past.slice(0, -1),
            future: [state.elements, ...state.future].slice(0, MAX_HISTORY),
            selectedId: null,
          };
        }),

      /** Повтор: обратный обмен верхушками `past` и `future`. */
      redo: () =>
        set((state) => {
          if (state.future.length === 0) return {};
          const next = state.future[0];
          return {
            elements: next,
            past: [...state.past, state.elements].slice(-MAX_HISTORY),
            future: state.future.slice(1),
            selectedId: null,
          };
        }),

      reset: () =>
        set({
          ...INITIAL_STATE,
          // hydrated НЕ сбрасываем: он означает «localStorage прочитан»,
          // и после reset он по-прежнему true
        }),
    }),
    {
      name: 'knysh-frame-store',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        form: state.form,
        elements: state.elements,
        activeStep: state.activeStep,
      }),
      onRehydrateStorage: () => (state) => {
        // Ставим hydrated после чтения. Если чтения не было (приватный режим),
        // состояние всё равно придёт — флаг поднимется здесь.
        if (state) state.hydrated = true;
      },
    }
  )
);

/* ========================================================================== */
/*                              СЕЛЕКТОРЫ (МЕМО)                               */
/* ========================================================================== */

/**
 * Можно ли отменить / повторить.
 *
 * Читаются прямо из стеков, а не из отдельных булевых полей. Отдельные поля
 * требовали бы обновления в каждом из шести экшенов; забытое поле даёт
 * «вечно активную» кнопку отмены, и прораб жмёт её в пустоту.
 */
export function useFrameCanUndo(): boolean {
  return useFrameStore((s) => s.past.length > 0);
}

export function useFrameCanRedo(): boolean {
  return useFrameStore((s) => s.future.length > 0);
}

/* ========================================================================== */
/*                          ХУК: ПЕРЕСЧЁТ СМЕТЫ                                 */
/* ========================================================================== */

/**
 * ГЛАВНЫЙ ХУК РАЗДЕЛА: мгновенный пересчёт сметы и ТЗ.
 *
 * Возвращает готовый `FrameEstimateResult`, пересчитанный через `useMemo` по
 * ключу `[form, elements, region]`. Когда прораб отпускает окно — стор меняет
 * `elements`, зависимость меняется, `computeFrameEstimate` пересчитывает всё
 * (обвязка, стойки, утеплитель, кровля, проёмы, элементы) и возвращает новый
 * объект. Панель сметы подписана на этот объект и перерисовывается.
 *
 * ПОЧЕМУ НЕТ ОТДЕЛЬНОГО `estimate` В СТОРЕ (очевидное, но неверное решение):
 *   - estimate — ПРОИЗВОДНОЕ значение. Если хранить его в сторе, придётся
 *     синхронизировать вручную в каждом экшене: забыл → смета показывает
 *     цифры по старому размеру дома;
 *   - `useMemo` даёт ту же реактивность для бесплатно и короче по коду;
 *   - при перетаскивании мыши по схеме `elements` не меняется (меняется только
 *     локальный курсор), значит `useMemo` даже не пересчитывает — а с
 *     estimate-в-сторе пересчёт шёл бы на каждый пиксель.
 */
export function useFrameEstimate(): FrameEstimateResult {
  const form = useFrameStore((s) => s.form);
  const elements = useFrameStore((s) => s.elements);

  return useMemo(() => {
    const lengthM = safeNum(form.lengthM, 10, 1, 60);
    const depthM = safeNum(form.depthM, 8, 1, 60);
    const heightM = safeNum(form.heightM, DEFAULT_STOREY_HEIGHT_M, 2, HOUSE_MAX_HEIGHT_M);
    const storeys = Math.max(1, Math.min(3, Math.round(safeNum(form.storeys, 1))));

    const stud = STUD_SIZES.find((s) => s.id === form.studId) ?? STUD_SIZES[0];
    const pile = PILE_SIZES.find((p) => p.id === form.pileId) ?? PILE_SIZES[0];
    const insulation = INSULATION_PRODUCTS.find((i) => i.id === form.insulationId) ?? INSULATION_PRODUCTS[0];
    const thicknessMm = safeNum(
      form.insulationMm,
      insulation.defaultMm,
      50,
      Math.max(100, ...insulation.thicknessesMm)
    );
    const slopePercent = safeNum(form.roofSlope, 25, 2, 60);
    const roofMaterial = ROOF_SLOPES.find((r) => r.id === form.roofMaterial) ?? ROOF_SLOPES[0];
    // Шаг обрешётки: 333 мм для металлочерепицы, 300 мм для профнастила.
    const battenStepM = roofMaterial.id === 'metalTile' ? 0.333 : 0.3;

    return computeFrameEstimate({
      geo: { lengthM, depthM, heightM, storeys },
      region: form.region,
      studSize: {
        thicknessMm: stud.thicknessMm,
        depthMm: stud.depthMm,
        label: stud.label,
      },
      beamMm: heightM > 2.7 ? 200 : 150,
      pile: {
        widthMm: pile.widthMm,
        stepM: pile.stepM,
        depthM: pile.depthM,
        rebarMm: pile.rebarMm,
        label: pile.label,
      },
      insulation: {
        id: insulation.id,
        thicknessMm,
        brand: insulation.brand,
        lambda: insulation.lambda,
        densityKgM3: insulation.densityKgM3,
      },
      roof: {
        slopePercent,
        materialLabel: roofMaterial.label,
        battenStepM,
      },
      elements: elements.map((el) => ({ kind: el.kind, positionM: el.positionM })),
    });
  }, [form, elements]);
}

/**
 * Флаг гидратации для SSR-безопасного рендера.
 *
 * Компонент-обёртка рендерит скелетон, пока `hydrated === false`. Это нужно не
 * для красоты: сервер отдаст пустую схему, клиент — полную, и React выдаст
 * ошибку гидрации, которая на проде выглядит как «разъехавшийся» экран.
 */
export function useFrameHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useFrameStore.persist.hasHydrated());
  useEffect(() => {
    if (useFrameStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useFrameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

/**
 * Значения формы с клампом по максимуму (габарит не может превысить
 * HOUSE_MAX_SIDE_M — это осознанное ограничение, а не артефакт).
 */
export function useFrameFormMax(): { maxSide: number; minSide: number } {
  return { maxSide: HOUSE_MAX_SIDE_M, minSide: HOUSE_MIN_SIDE_M };
}

/** Реэкспорт для удобства: индекс шага по id — для прокрутки на шаг */
export function frameStepIndex(stepId: FrameStepId): number {
  return FRAME_STEPS.findIndex((s) => s.id === stepId);
}
