import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Состояние раздела «Строительный» (/const) — калькуляторы РБ.
 *
 * Раздел решает две задачи, и обе живут здесь:
 *
 *  1. Автосохранение. Прораб работает на объекте с телефона, в перчатках, и часто
 *     сворачивает вкладку (звонок, заказ материала, перекур). `drafts` хранит
 *     значения форм по id инструмента, поэтому расчёт открывается на том же
 *     месте, где его остановили.
 *
 *  2. Регион и область. Сметы считаются в BYN, а цены в Минске и в областях
 *     разные, поэтому `region` — переключатель «Минск / Регионы», который
 *     умножает прайс (коэффициенты в `@/lib/construction/prices`).
 *     `district` — отдельная величина: по ней берётся глубина промерзания
 *     грунта из СН 2.01.01-2019 в фундаментном калькуляторе.
 *
 * ЧЕГО В СТОРЕ НЕТ И ПОЧЕМУ:
 *   - поиска инструментов — его держит локальное состояние сайдбара, он живёт
 *     дольше любого стора и не должен переживать перезагрузку страницы
 *     (возвращаться в раздел с активным фильтром неудобно);
 *   - истории недавних инструментов — она уже есть в `sectionStore`
 *     (`recentFeatures`) и работает для обоих разделов; второй такой же
 *     список был бы дублированием.
 *
 * Значения форм хранятся строго строками: инпут не должен терять недописанное
 * значение («12,») из-за округления на лету.
 */
export type DraftValue = string | boolean;

/** Поля одного инструмента: ключ — id поля, значение — как в инпуте */
export type DraftMap = Record<string, DraftValue>;

/** Переключатель стоимости работ и материалов */
export type ConstructionRegionKey = 'minsk' | 'region';

/** Область РБ — нужна для глубины промерзания грунта (СН 2.01.01-2019) */
export type ConstructionDistrictKey =
  | 'minsk'
  | 'minskRegion'
  | 'brest'
  | 'vitebsk'
  | 'gomel'
  | 'grodno'
  | 'mogilev';

export interface ConstructionState {
  /** Минск или регионы — множитель к ценам из прайса */
  region: ConstructionRegionKey;
  setRegion: (region: ConstructionRegionKey) => void;

  /** Область для СН 2.01.01-2019 (глубина промерзания грунта) */
  district: ConstructionDistrictKey;
  setDistrict: (district: ConstructionDistrictKey) => void;

  /** Черновики форм по id инструмента: drafts[toolId][field] */
  drafts: Record<string, DraftMap>;
  setValues: (toolId: string, patch: DraftMap) => void;
  clearDraft: (toolId: string) => void;
  clearAllDrafts: () => void;

  /** Метка времени последнего сохранения по инструменту, мс */
  savedAt: Record<string, number>;

  /** Сбросить раздел к исходному состоянию */
  reset: () => void;
}

/**
 * Та часть состояния, которая реально попадает в localStorage.
 *
 * Отдельный тип нужен самому `createJSONStorage`: он параметризуется НЕ полным
 * состоянием с экшенами, а ровно тем, что переживает перезагрузку. Если указать
 * здесь `ConstructionState`, компилятор справедливо потребует от хранилища
 * уметь сериализовать функции.
 */
type PersistedConstructionState = Pick<
  ConstructionState,
  'region' | 'district' | 'drafts' | 'savedAt'
>;

/* ========================================================================== */
/*          Хранилище с дебаунсом и гарантированным сбросом при уходе          */
/* ========================================================================== */

/**
 * Задержка записи, мс.
 *
 * 400 мс — это время, за которое прораб допечатывает слово или цифру: за это
 * время все нажатия схлопываются в одну запись. Ввод перестаёт «дёргать» I/O,
 * а данные всё равно оказываются в памяти телефона за доли секунды.
 */
const WRITE_DELAY_MS = 400;

/** Ключи, ожидающие записи, и таймер на их общий сброс */
const pendingWrites = new Map<string, string>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/**
 * Квота исчерпана (обычно это 5 МБ на весь домен). Раздел продолжает работать
 * на памяти, но честно предупреждает — молча терять введённые данные нельзя,
 * прораб ушёл бы уверенный, что всё записано.
 *
 * Это флаг только для предупреждения, а не «защёлка»: он НЕ отключает запись
 * навсегда. Как только прораб нажмёт «Сбросить» и освободит место, следующая
 * попытка пройдёт, и сохранение восстановится само.
 */
let warnedAboutQuota = false;

function warnQuotaOnce() {
  if (warnedAboutQuota) return;
  warnedAboutQuota = true;
  console.warn(
    '[Knysh /const] Не удалось сохранить данные: в localStorage закончилось место. ' +
      'Расчёты продолжают работать, но после закрытия вкладки введённые значения будут потеряны. ' +
      'Освободите место в браузере или удалите черновики кнопкой «Сбросить».'
  );
}

/**
 * Немедленная запись всего, что накопилось.
 *
 * Вызывается по таймеру и при уходе со страницы — второй случай и есть то,
 * ради которого существует дебаунс: без него последние цифры, набранные за
 * 400 мс до сворачивания вкладки, исчезали бы бесследно.
 */
function flushPendingWrites() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (pendingWrites.size === 0) return;

  let failed = false;
  pendingWrites.forEach((value, key) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      failed = true;
    }
  });

  if (failed) {
    // QuotaExceededError или приватный режим Safari: очередь НЕ очищаем, чтобы
    // данные не потерялись молча. Как только место освободится (например, после
    // «Сбросить»), следующая попытка запишет всё
    warnQuotaOnce();
    return;
  }
  pendingWrites.clear();
}

function bindFlushListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  // pagehide — единственное событие, которое гарантированно приходит при
  // закрытии вкладки и на iOS при сворачивании Safari
  window.addEventListener('pagehide', flushPendingWrites);
  // visibilitychange — подстраховка для мобильных браузеров, которые
  // не присылают pagehide при уходе в фон
  window.addEventListener('visibilitychange', () => {
    // Проверка окружения обязательна: обработчик может быть вызван не только
    // в браузере, а персист цепляется и к серверному рендеру
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      flushPendingWrites();
    }
  });
  window.addEventListener('beforeunload', flushPendingWrites);
}

/**
 * Обёртка над localStorage: чтение синхронное (гидратация должна быть точной),
 * запись отложенная. Возвращается только `setItem` с задержкой — остальные
 * методы passthrough.
 */
function createDebouncedStorage() {
  return createJSONStorage<PersistedConstructionState>(() => {
    /*
     * Обращение к window сделано ЗДЕСЬ, а не внутри методов, и это не стилистика.
     * `createJSONStorage` вызывает фабрику на сервере и ловит исключение
     * try/catch: если фабрика падает — хранилище возвращается как undefined и
     * гидратация не запускается. Именно на этом держится безопасный SSR.
     * Фабрика, возвращающая объект-обёртку и не трогающая window, исключения бы
     * не бросила — и персист пытался бы читать localStorage на сервере.
     */
    const store = window.localStorage;
    return {
      getItem: (name: string) => store.getItem(name),
      setItem: (name: string, value: string) => {
        pendingWrites.set(name, value);
        bindFlushListeners();
        if (writeTimer) return; // таймер уже тикает, новые данные просто перезапишут очередь
        writeTimer = setTimeout(flushPendingWrites, WRITE_DELAY_MS);
      },
      removeItem: (name: string) => {
        pendingWrites.delete(name);
        store.removeItem(name);
      },
    };
  });
}

const INITIAL_STATE = {
  region: 'minsk' as ConstructionRegionKey,
  district: 'minsk' as ConstructionDistrictKey,
  drafts: {} as Record<string, DraftMap>,
  savedAt: {} as Record<string, number>,
};

export const useConstructionStore = create<ConstructionState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setRegion: (region: ConstructionRegionKey) => set({ region }),

      setDistrict: (district: ConstructionDistrictKey) => set({ district }),

      setValues: (toolId: string, patch: DraftMap) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [toolId]: { ...(state.drafts[toolId] ?? {}), ...patch },
          },
          // Отметка времени обновляется вместе с данными: она и означает
          // момент последнего автосохранения, отдельного действия не нужно
          savedAt: { ...state.savedAt, [toolId]: Date.now() },
        })),

      clearDraft: (toolId: string) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[toolId];
          const savedAt = { ...state.savedAt };
          delete savedAt[toolId];
          return { drafts, savedAt };
        }),

      clearAllDrafts: () => set({ drafts: {}, savedAt: {} }),

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'knysh-construction-store',
      storage: createDebouncedStorage(),
      version: 1,
      partialize: (state) => ({
        region: state.region,
        district: state.district,
        drafts: state.drafts,
        savedAt: state.savedAt,
      }),
      /**
       * Черновики переживают смену версии: если поле у калькулятора
       * переименовалось, оно просто не попадёт в форму (useConstructionForm
       * берёт только свои ключи), а мусорные ключи не мешают расчёту.
       */
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        return {
          region: state.region === 'region' ? ('region' as const) : ('minsk' as const),
          district: (state.district as ConstructionDistrictKey) ?? 'minsk',
          drafts:
            state.drafts && typeof state.drafts === 'object'
              ? (state.drafts as Record<string, DraftMap>)
              : {},
          savedAt:
            state.savedAt && typeof state.savedAt === 'object'
              ? (state.savedAt as Record<string, number>)
              : {},
        };
      },
    }
  )
);

/* -------------------------------------------------------------------------- */
/*                              Selector hooks                                 */
/* -------------------------------------------------------------------------- */

export const useConstructionRegion = () => useConstructionStore((state) => state.region);
export const useConstructionDistrict = () => useConstructionStore((state) => state.district);

/* -------------------------------------------------------------------------- */
/*                                  Хуки форм                                  */
/* -------------------------------------------------------------------------- */

/**
 * true после того, как localStorage прочитан.
 *
 * До гидратации значение поля отдаётся пустой строкой: на сервере стора ещё нет,
 * и если отдать сразу сохранённое значение, React получит расхождение разметки
 * между сервером и клиентом. Поэтому форма сначала рисуется пустой и заполняется
 * сразу после гидратации — на глаз это незаметно, зато без hydration mismatch.
 */
export function useConstructionHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useConstructionStore.persist.hasHydrated()
  );

  useEffect(() => {
    // postRehydrationCallback вызывается только если чтение ещё не случилось,
    // поэтому состояние проверяем отдельно — на повторном маунте уже true.
    if (useConstructionStore.persist.hasHydrated()) setHydrated(true);
    const unsubscribe = useConstructionStore.persist.onFinishHydration(() => setHydrated(true));
    return unsubscribe;
  }, []);

  return hydrated;
}

/**
 * Форма калькулятора с автосохранением.
 *
 * `defaults` обязан быть стабильным (объявлен константой модуля, а не внутри
 * компонента) — от его идентичности зависит пересчёт мемоизированных значений.
 *
 *   const DEFAULTS = { length: '10', width: '8' };
 *   const { values, set, reset, hydrated } = useConstructionForm('foundation', DEFAULTS);
 *
 * Возвращает:
 *   values   — значения полей (сохранённые поверх defaults);
 *   set      — записать патч в черновик (с автосохранением в localStorage);
 *   reset    — очистить черновик инструмента и вернуться к defaults;
 *   hydrated — признак того, что сохранённые значения уже прочитаны.
 */
export function useConstructionForm<T extends DraftMap>(
  toolId: string,
  defaults: T
): { values: T; set: (patch: Partial<T>) => void; reset: () => void; hydrated: boolean } {
  const hydrated = useConstructionHydrated();
  const stored = useConstructionStore((state) => state.drafts[toolId]);
  const setValues = useConstructionStore((state) => state.setValues);
  const clearDraft = useConstructionStore((state) => state.clearDraft);

  const values = useMemo<T>(() => {
    // До гидратации отдаём defaults, чтобы разметка сервера и клиента совпала.
    if (!hydrated || !stored) return defaults;
    // Собираем в Record<string, DraftValue>: дженерик T по контракту доступен
    // только для чтения, а нам нужно наложить сохранённые значения поверх defaults.
    const merged: Record<string, DraftValue> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const saved = stored[key];
      if (saved !== undefined) merged[key] = saved;
    }
    return merged as T;
  }, [hydrated, stored, defaults]);

  const set = useCallback(
    (patch: Partial<T>) => setValues(toolId, patch as DraftMap),
    [toolId, setValues]
  );

  const reset = useCallback(() => clearDraft(toolId), [toolId, clearDraft]);

  return { values, set, reset, hydrated };
}