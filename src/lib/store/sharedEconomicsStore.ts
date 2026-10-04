import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Сквозная экономика WB (РБ).
 *
 * Ключевая идея рефакторинга: калькуляторы собраны в 5 бизнес-блоков, внутри блока
 * инструменты переключаются горизонтальными вкладками. Чтобы при переключении вкладок
 * поля не сбрасывались, а экономика пересчитывалась СКВОЗНЫМ образом, общие переменные
 * вынесены в отдельное персистентное хранилище:
 *
 *   себестоимость · габариты · вес · партия · цена · комиссия · категория · реквизиты
 *
 * Инструмент объявляет свои поля через `useLinkedForm` (см. src/lib/hooks/useLinkedForm.ts):
 * значения общих полей читаются из этого стора, а любое изменение сразу пишется туда же,
 * поэтому все вкладки одного блока всегда считают от одних и тех же чисел.
 * Сюда же симулятор «Быстрый Старт» переносит результат обучения — реальные
 * калькуляторы открываются уже с введёнными новичком числами.
 *
 * Все денежные значения — строго BYN.
 */
export interface SharedEconomicsState {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  setValues: (patch: Record<string, string>) => void;
  clearValues: (keys: string[]) => void;
  resetShared: () => void;
}

/** Канонические имена общих переменных (используются во всех инструментах) */
export const SHARED_KEYS = {
  /** Себестоимость закупки 1 единицы, BYN */
  cost: 'cost',
  /** Розничная цена продажи на WB, BYN */
  retailPrice: 'retailPrice',
  /** Комиссия маркетплейса, % */
  commissionRate: 'commissionRate',
  /** Ставка налога (УСН РБ), % */
  taxRate: 'taxRate',
  /** Габариты упаковки, см */
  length: 'length',
  width: 'width',
  height: 'height',
  /** Вес упаковки 1 единицы, г */
  weight: 'weight',
  /** Объём партии, шт */
  batchVolume: 'batchVolume',
  /** Процент выкупа, % */
  buyoutRate: 'buyoutRate',
  /** Транзит РБ → РФ, BYN */
  transit: 'transit',
  /** Итог взносов ФСЗН + Белгосстрах за период, BYN (публикует вкладка «Расчет ФСЗН») */
  fsznQuarter: 'fsznQuarter',
  /** Категория товара по Постановлению № 713 (id из справочника priceControl713) */
  category: 'category',
  /** СПП WB, % */
  spp: 'spp',
  /** Маржа, % */
  marginPercent: 'marginPercent',
  /** Продажи в сутки, шт */
  dailySales: 'dailySales',
  /** Наименование товара */
  productName: 'productName',
  /** Реквизиты продавца */
  organization: 'organization',
  unp: 'unp',
  /** Адрес продавца */
  address: 'address',
  /** Руководитель / подписант */
  director: 'director',
} as const;

export type SharedKey = (typeof SHARED_KEYS)[keyof typeof SHARED_KEYS];

/** Порядок полей в сводке «сквозных переменных» над вкладками */
export const SHARED_SUMMARY_FIELDS: Array<{ key: SharedKey; label: string; unit: string }> = [
  { key: SHARED_KEYS.cost, label: 'Себестоимость', unit: 'BYN' },
  { key: SHARED_KEYS.retailPrice, label: 'Цена продажи', unit: 'BYN' },
  { key: SHARED_KEYS.length, label: 'Габариты', unit: 'см' },
  { key: SHARED_KEYS.weight, label: 'Вес', unit: 'г' },
  { key: SHARED_KEYS.batchVolume, label: 'Партия', unit: 'шт' },
];

export const useSharedEconomics = create<SharedEconomicsState>()(
  persist(
    (set) => ({
      values: {},
      setValue: (key: string, value: string) =>
        set((state) => ({ values: { ...state.values, [key]: value } })),
      setValues: (patch: Record<string, string>) =>
        set((state) => ({ values: { ...state.values, ...patch } })),
      clearValues: (keys: string[]) =>
        set((state) => {
          const values = { ...state.values };
          keys.forEach((key) => {
            delete values[key];
          });
          return { values };
        }),
      resetShared: () => set({ values: {} }),
    }),
    {
      name: 'knysh-shared-economics',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ values: state.values }),
    }
  )
);

/** Значение общего поля (пустая строка, если поле ещё не заполняли) */
export function readSharedValue(key: string): string {
  return useSharedEconomics.getState().values[key] ?? '';
}