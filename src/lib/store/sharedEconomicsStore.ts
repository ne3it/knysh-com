import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PVZ_CONFIG } from '@/lib/services/pvzBreakEven';

/**
 * Сквозные переменные WB (РБ).
 *
 * Калькуляторы собраны в 5 бизнес-блоков, внутри блока инструменты переключаются
 * горизонтальными вкладками. Чтобы при переключении вкладок поля не сбрасывались,
 * а экономика пересчитывалась сквозным образом, общие переменные вынесены в
 * отдельное персистентное хранилище:
 *
 *   товар · себестоимость · количество партии · цена · комиссия · категория · габариты · вес
 *
 * Инструмент объявляет свои поля через `useLinkedForm` (см. src/lib/hooks/useLinkedForm.ts):
 * значения общих полей читаются из этого стора, а правка поля сразу пишется туда же,
 * поэтому все вкладки блока считают от одних и тех же чисел.
 *
 * Панель «↔ СКВОЗНЫЕ ПЕРЕМЕННЫЕ» (src/components/layout/SharedVariablesPanel.tsx)
 * показывает ровно 4 параметра, которые подставляются во все формы проекта:
 *
 *   1) Товар       — полная база категорий Постановления № 713, сгруппированная
 *                     по секторам в <optgroup> (см. src/lib/services/productCatalog.ts);
 *   2) Себестоимость — BYN за 1 единицу;
 *   3) Количество   — объём партии, шт;
 *   4) параметры, которые зависят от выбранного товара:
 *        • обычная категория Постановления № 713 → себестоимость, количество
 *          и процент выкупа: экономика единицы товара;
 *        • «Франшиза ПВЗ» из каталога → трафик, аренда и средний чек:
 *          окупаемость пункта выдачи.
 *
 * Выбор товара в панели — это id из справочника 713, поэтому он уходит сразу и в
 * `category` (формы «Контроль цен Пост. 713» и мега-калькулятор читают его через
 * ссылки MEGA_LINKS/PRICE_CONTROL_LINKS), и в мосты категорий сплит-калькулятора
 * и планировщика старта: предельная надбавка 713 подставляется в формы мгновенно.
 *
 * Связь двусторонняя: правка панели уходит во все инструменты, а правка того же поля
 * в форме обновляет панель. Все денежные значения — строго BYN.
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
  /** Товар панели: id из каталога productCatalog (позиция 713 либо GLOBAL_PVZ_CATEGORY_ID) */
  productCategory: 'productCategory',
  /** Поток клиентов ПВЗ, чел/день */
  traffic: 'traffic',
  /** Ежемесячная аренда помещения ПВЗ, BYN */
  rent: 'rent',
  /** Средний чек одного заказа на WB, BYN */
  avgCheck: 'avgCheck',
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

/** Описание числового поля панели: подпись, единица, шаг и дефолт */
export interface GlobalFieldMeta {
  key: SharedKey;
  label: string;
  unit: string;
  step: string;
  min: string;
  fallback: string;
}

/** 2-е и 3-е поля панели — они одинаковы во всех блоках */
export const GLOBAL_COST_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.cost,
  label: 'Себестоимость',
  unit: 'BYN',
  step: '0.01',
  min: '0',
  fallback: '25',
};

export const GLOBAL_QTY_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.batchVolume,
  label: 'Количество',
  unit: 'шт',
  step: '1',
  min: '1',
  fallback: '300',
};

/** Процент выкупа панели */
export const GLOBAL_BUYOUT_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.buyoutRate,
  label: 'Выкуп',
  unit: '%',
  step: '1',
  min: '1',
  fallback: '30',
};

/** Поток клиентов ПВЗ, чел/день */
export const GLOBAL_TRAFFIC_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.traffic,
  label: 'Трафик',
  unit: 'чел/день',
  step: '1',
  min: '0',
  fallback: String(PVZ_CONFIG.DEFAULT_TRAFFIC),
};

/** Аренда помещения ПВЗ за месяц, BYN */
export const GLOBAL_RENT_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.rent,
  label: 'Аренда',
  unit: 'BYN/мес',
  step: '1',
  min: '0',
  fallback: String(PVZ_CONFIG.DEFAULT_RENT),
};

/** Средний чек заказа, BYN */
export const GLOBAL_AVG_CHECK_FIELD: GlobalFieldMeta = {
  key: SHARED_KEYS.avgCheck,
  label: 'Средний чек',
  unit: 'BYN',
  step: '0.5',
  min: '0',
  fallback: String(PVZ_CONFIG.DEFAULT_AVG_CHECK),
};

/**
 * Набор числовых полей панели зависит от выбранного товара:
 *  - обычная категория Постановления № 713 → экономика единицы товара:
 *    себестоимость, количество партии и процент выкупа;
 *  - «Франшиза ПВЗ» → окупаемость пункта выдачи: поток клиентов, аренда
 *    и средний чек заказа (лимита 713 у услуги нет).
 */
export const GLOBAL_PANEL_FIELDS: Record<'product' | 'pvz', GlobalFieldMeta[]> = {
  product: [GLOBAL_COST_FIELD, GLOBAL_QTY_FIELD, GLOBAL_BUYOUT_FIELD],
  pvz: [GLOBAL_TRAFFIC_FIELD, GLOBAL_RENT_FIELD, GLOBAL_AVG_CHECK_FIELD],
};

/** Блок «Аналитика ПВЗ и Логистика» — вкладка калькулятора ПВЗ открывается сюда */
export const PVZ_BLOCK_ID = 'pvz-logistics';

/**
 * Санитайзер глобальных инпутов панели: оставляет только цифры и одну точку
 * (запятая превращается в точку). Буквы, «e», минус и мусор не попадают в стор.
 *
 * Защита двухуровневая: инпуты панели имеют `type="number"` (браузер сам не пускает
 * буквы) и проходят через этот санитайзер при записи, а любое чтение значения —
 * в сервисах и компонентах — идёт через `parseFloat(value) || 0`, поэтому пустое
 * поле считается нулём и не ломает расчёт.
 */
export function sanitizeSharedInput(raw: string): string {
  const cleaned = String(raw ?? '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [head, ...tail] = cleaned.split('.');
  return tail.length > 0 ? `${head}.${tail.join('')}` : head;
}

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
    }
  )
);

/** Значение общего поля (пустая строка, если поле ещё не заполняли) */
export function readSharedValue(key: string): string {
  return useSharedEconomics.getState().values[key] ?? '';
}
