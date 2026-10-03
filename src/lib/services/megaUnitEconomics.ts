import { RUB_TO_BYN_WITH_BUFFER } from './wbConfig';
import {
  PRICE_CONTROL_CUSTOM_ID,
  getPriceControlCategory,
  type PriceControlCategory,
} from './priceControl713';

/**
 * Сквозной мега-калькулятор юнит-экономики WB (РБ → РФ).
 *
 * Блоки:
 *  1–2. Закупка, комиссия WB, налог, желаемая прибыль.
 *   3. Экосбор РБ + фиксированные взносы ФСЗН и Белгосстрах (в расходы на 1 единицу).
 *   4. Оптимизация тары: объём, лимит WB 5 л, доплата за лишний литр, учёт покатушек.
 *   5. Постановление № 713 КГК РБ: контроль чистой надбавки импортёра.
 *   6. Математический финал: точка безубыточности (обратное раскручивание уравнения).
 *
 * Все расчёты ведутся в BYN, RUB получается делением на курс. Любые нулевые и
 * некорректные значения инпутов не ломают расчёт (защита через `parseFloat(value) || 0`).
 */

export const MEGA_CONFIG = {
  /** Ставка налога по умолчанию (УСН РБ), % */
  TAX_RATE: 6,
  /** Комиссия WB по умолчанию, % */
  COMMISSION_RATE: 23,
  /** Базовый лимит объёма одной посылки WB, литры */
  WB_VOLUME_LIMIT_L: 5,
  /** Базовый тариф логистики за первые 5 литров, BYN */
  WB_BASE_TARIFF_5L_BYN: 2.0,
  /** Стоимость каждого избыточного литра сверх лимита WB, BYN */
  WB_OVERLITER_COST_BYN: 0.1,
  /** Повышающий коэффициент логистики для одежды */
  WB_CLOTHING_COEFFICIENT: 1.5,
  /** Коэффициент стоимости холостой поездки (возврат на склад) */
  BUYOUT_TRIP_FACTOR: 1.5,
  /** Процент выкупа по умолчанию, % */
  DEFAULT_BUYOUT_RATE: 30,
  /** Экосбор: пластик / плёнка зип-лок, BYN за тонну */
  ECO_PLASTIC_BYN_PER_TON: 90,
  /** Экосбор: картон / бумага, BYN за тонну */
  ECO_PAPER_BYN_PER_TON: 60,
  /** На сколько сантиметров предлагает уменьшить каждую грань «умный оптимизатор», см */
  OPTIMIZER_SHRINK_CM: 2,
  /** Объём партии по умолчанию, шт */
  DEFAULT_BATCH_VOLUME: 1000,
  /** Курс 1 RUB → BYN, если официальный недоступен */
  FALLBACK_RUB_TO_BYN: RUB_TO_BYN_WITH_BUFFER,
} as const;

/**
 * Округление денежных величин до копеек с защитой от багов плавающей точки JS.
 * Number.EPSILON компенсирует погрешность вида 1.005 * 100 = 100.49999999999999.
 */
export const roundMoney = (num: number): number => {
  const safe = Number.isFinite(num) ? num : 0;
  return Math.round((safe + Number.EPSILON) * 100) / 100;
};

/** Округление неденежных величин (объёмы, проценты, коэффициенты) */
export const roundTo = (num: number, digits = 2): number => {
  const safe = Number.isFinite(num) ? num : 0;
  const factor = Math.pow(10, digits);
  return Math.round(safe * factor) / factor;
};

/** Точка Безубыточности: знаменатель ≤ 0 → расчёт невозможен, возвращаем 0 */
export const BREAK_EVEN_ERROR_MESSAGE = 'Ошибка: Комиссия и Налог превышают 100%!';

export type EcoFeeKind = 'none' | 'plastic' | 'paper' | 'custom';

export interface EcoFeeOption {
  id: EcoFeeKind;
  label: string;
  /** Ставка сбора, BYN за тонну */
  rate: number;
}

export const ECO_FEE_OPTIONS: EcoFeeOption[] = [
  { id: 'none', label: 'Без экосбора', rate: 0 },
  {
    id: 'plastic',
    label: `Пластик / Плёнка зип-лок (${MEGA_CONFIG.ECO_PLASTIC_BYN_PER_TON} BYN/т)`,
    rate: MEGA_CONFIG.ECO_PLASTIC_BYN_PER_TON,
  },
  {
    id: 'paper',
    label: `Картон / Бумага (${MEGA_CONFIG.ECO_PAPER_BYN_PER_TON} BYN/т)`,
    rate: MEGA_CONFIG.ECO_PAPER_BYN_PER_TON,
  },
  { id: 'custom', label: 'Кастомный тариф (ручной ввод)', rate: 0 },
];

export interface MegaUnitForm {
  cost_price: string;
  currency: 'BYN' | 'RUB';
  /** Розничная цена на WB, BYN. Пустая строка = использовать рекомендованную РРЦ */
  retail_price: string;
  /** Комиссия маркетплейса, % */
  commission_rate: string;
  /** Ставка налога (УСН), % */
  tax_rate: string;
  /** Желаемая прибыль с 1 единицы, BYN */
  desired_profit: string;

  eco_fee: EcoFeeKind;
  eco_weight: string;
  eco_custom_rate: string;

  fszn_enabled: boolean;
  fszn_quarter: string;
  /** Объём всей партии, шт (делит взносы ФСЗН и множит экономию оптимизатора) */
  batch_volume: string;

  length: string;
  width: string;
  height: string;
  transit: string;
  buyout_rate: string;

  /** Инженерные настройки тарифов WB */
  base_tariff_5l: string;
  over_liter_cost: string;
  clothing_coefficient: string;

  p713_enabled: boolean;
  p713_category: string;
  p713_custom_limit: string;
}

export const DEFAULT_MEGA_FORM: MegaUnitForm = {
  cost_price: '15',
  currency: 'BYN',
  retail_price: '',
  commission_rate: String(MEGA_CONFIG.COMMISSION_RATE),
  tax_rate: String(MEGA_CONFIG.TAX_RATE),
  desired_profit: '5',

  eco_fee: 'none',
  eco_weight: '40',
  eco_custom_rate: '90',

  fszn_enabled: false,
  fszn_quarter: '720',
  batch_volume: String(MEGA_CONFIG.DEFAULT_BATCH_VOLUME),

  length: '30',
  width: '20',
  height: '10',
  transit: '3.67',
  buyout_rate: String(MEGA_CONFIG.DEFAULT_BUYOUT_RATE),

  base_tariff_5l: String(MEGA_CONFIG.WB_BASE_TARIFF_5L_BYN),
  over_liter_cost: String(MEGA_CONFIG.WB_OVERLITER_COST_BYN),
  clothing_coefficient: String(MEGA_CONFIG.WB_CLOTHING_COEFFICIENT),

  p713_enabled: false,
  p713_category: 'clothes_top',
  p713_custom_limit: '30',
};

export interface TripDelivery {
  volumeLiters: number;
  /** Объём сверх базового лимита WB (5 л) */
  excessLiters: number;
  /** Тариф за первые 5 литров, BYN */
  tariffByn: number;
  /** Доплата за избыточные литры, BYN */
  excessFeeByn: number;
  /** Тариф с учётом повышающего коэффициента (одежда), BYN */
  weightedTariffByn: number;
  /** Транзит РБ → РФ, BYN */
  transitByn: number;
  /** Стоимость одной поездки (туда), BYN */
  totalByn: number;
}

export interface OptimizerAdvice {
  length: number;
  width: number;
  height: number;
  /** Оптимальный объём без учёта порога лимита, л */
  volumeLiters: number;
  /** Объём после оптимизации с учётом порога 5 л, л */
  appliedVolumeLiters: number;
  /** Сколько литров реально выводится из-под лимита, л */
  excessLitersSaved: number;
  /** Экономия на 1 единицу товара, BYN */
  perItemSavingByn: number;
  /** Экономия на объёме всей партии, BYN */
  batchSavingByn: number;
  /** Экономия на объёме всей партии, RUB */
  batchSavingRub: number;
}

export interface PriceControlStatus {
  enabled: boolean;
  category: PriceControlCategory;
  limitPercent: number;
  markupPercent: number;
  exceeded: boolean;
  maxRetailPriceByn: number;
  maxRetailPriceRub: number;
}

export interface MegaUnitResult {
  rate: number;

  costByn: number;
  costRub: number;
  ecoRateBynPerTon: number;
  ecoFeeKopecks: number;
  ecoFeeByn: number;
  costWithEcoByn: number;
  fsznPerUnitByn: number;
  fsznTotalByn: number;
  batchVolume: number;

  trip: TripDelivery;
  tripsPerSale: number;
  idleTripsPerSale: number;
  deliveryPerSaleByn: number;
  deliveryPerSaleRub: number;

  fixedPerUnitByn: number;
  totalCostByn: number;

  commissionPercent: number;
  taxPercent: number;
  commissionByn: number;
  taxByn: number;

  /** Знаменатель (1 − комиссия − налог) корректен */
  denominatorValid: boolean;
  /** Сообщение об ошибке знаменателя, если он ≤ 0 */
  denominatorError: string | null;
  breakEvenByn: number;
  breakEvenRub: number;

  recommendedPriceByn: number;
  recommendedPriceRub: number;

  retailPriceByn: number;
  retailPriceRub: number;
  netProfitByn: number;
  roiPercent: number;
  /** Чистый остаток «на жизнь» с 1 продажи (прибыль уже за вычетом доли ФСЗН), BYN */
  netToLiveByn: number;

  priceControl: PriceControlStatus;
  optimizer: OptimizerAdvice | null;
}

/** Неуязвимое приведение строки инпута к числу: пустое поле → 0 */
export const toNumber = (value: string | number | undefined | null): number =>
  parseFloat(String(value ?? '')) || 0;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Объём упаковки в литрах: (Д × Ш × В) / 1000 */
export function calculateVolumeLiters(length: number, width: number, height: number): number {
  const l = Math.max(0, toNumber(length));
  const w = Math.max(0, toNumber(width));
  const h = Math.max(0, toNumber(height));
  return (l * w * h) / 1000;
}

interface TripDeliveryInput {
  volumeLiters: number;
  baseTariff5lByn: number;
  overLiterCostByn: number;
  clothingCoefficient: number;
  transitByn: number;
}

/**
 * Стоимость одной поездки WB:
 * тариф за первые 5 л + доплата за каждый избыточный литр + транзит РБ → РФ.
 * Повышающий коэффициент (одежда) применяется к тарифной части.
 */
export function calculateTripDelivery(input: TripDeliveryInput): TripDelivery {
  const volumeLiters = Math.max(0, toNumber(input.volumeLiters));
  const baseTariff = Math.max(0, toNumber(input.baseTariff5lByn));
  const overLiterCost = Math.max(0, toNumber(input.overLiterCostByn));
  const coefficient = Math.max(0, toNumber(input.clothingCoefficient));
  const transit = Math.max(0, toNumber(input.transitByn));

  const excessLiters = Math.max(0, volumeLiters - MEGA_CONFIG.WB_VOLUME_LIMIT_L);
  const excessFeeByn = excessLiters * overLiterCost;
  const tariffByn = baseTariff + excessFeeByn;
  const weightedTariffByn = tariffByn * coefficient;

  return {
    volumeLiters: roundTo(volumeLiters, 3),
    excessLiters: roundTo(excessLiters, 3),
    tariffByn: roundMoney(tariffByn),
    excessFeeByn: roundMoney(excessFeeByn),
    weightedTariffByn: roundMoney(weightedTariffByn),
    transitByn: roundMoney(transit),
    totalByn: roundMoney(weightedTariffByn + transit),
  };
}

/** Ставка экосбора по выбранному материалу, BYN за тонну */
export function resolveEcoRate(form: MegaUnitForm): number {
  const option = ECO_FEE_OPTIONS.find((item) => item.id === form.eco_fee) ?? ECO_FEE_OPTIONS[0];
  if (form.eco_fee === 'custom') return Math.max(0, toNumber(form.eco_custom_rate));
  return Math.max(0, option.rate);
}

export function calculateMegaUnitEconomics(form: MegaUnitForm, rate: number): MegaUnitResult {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : MEGA_CONFIG.FALLBACK_RUB_TO_BYN;
  const toByn = (rub: number) => (Number.isFinite(rub) ? rub : 0) * safeRate;
  const toRub = (byn: number) => (safeRate > 0 ? (Number.isFinite(byn) ? byn : 0) / safeRate : 0);

  // ─── Закупка ───────────────────────────────────────────────────────────────
  const rawCost = Math.max(0, toNumber(form.cost_price));
  const costByn = form.currency === 'RUB' ? toByn(rawCost) : rawCost;

  // ─── Блок 3: экосбор РБ ───────────────────────────────────────────────────
  const ecoWeightGrams = Math.max(0, toNumber(form.eco_weight));
  const ecoRateBynPerTon = resolveEcoRate(form);
  const ecoFeeByn = (ecoWeightGrams / 1_000_000) * ecoRateBynPerTon;
  const ecoFeeKopecks = roundMoney(ecoFeeByn * 100);
  const costWithEcoByn = roundMoney(costByn + ecoFeeByn);

  // ─── Блок 3: ФСЗН и Белгосстрах за квартал ───────────────────────────────
  const batchVolume = Math.max(0, toNumber(form.batch_volume));
  const fsznTotalByn = form.fszn_enabled ? Math.max(0, toNumber(form.fszn_quarter)) : 0;
  const fsznPerUnitByn = batchVolume > 0 ? fsznTotalByn / batchVolume : 0;

  // ─── Блок 4: объём, тарифы WB и покатушки ────────────────────────────────
  const length = Math.max(0, toNumber(form.length));
  const width = Math.max(0, toNumber(form.width));
  const height = Math.max(0, toNumber(form.height));
  const volumeLiters = calculateVolumeLiters(length, width, height);

  const baseTariff5lByn = Math.max(0, toNumber(form.base_tariff_5l));
  const overLiterCostByn = Math.max(0, toNumber(form.over_liter_cost));
  const clothingCoefficient = Math.max(0, toNumber(form.clothing_coefficient));

  const trip = calculateTripDelivery({
    volumeLiters,
    baseTariff5lByn,
    overLiterCostByn,
    clothingCoefficient,
    transitByn: Math.max(0, toNumber(form.transit)),
  });

  const buyoutPercent = clamp(
    toNumber(form.buyout_rate) || MEGA_CONFIG.DEFAULT_BUYOUT_RATE,
    1,
    100
  );
  const tripsPerSale =
    1 + ((100 - buyoutPercent) / buyoutPercent) * MEGA_CONFIG.BUYOUT_TRIP_FACTOR;
  const idleTripsPerSale = Math.max(0, tripsPerSale - 1);
  const deliveryPerSaleByn = trip.totalByn * tripsPerSale;

  // ─── Свод расходов на 1 единицу ───────────────────────────────────────────
  const fixedPerUnitByn = deliveryPerSaleByn + fsznPerUnitByn;
  const totalCostByn = costWithEcoByn + fixedPerUnitByn;

  // ─── Блок 6: обратное раскручивание уравнения юнит-экономики ─────────────
  const commissionPercent = clamp(toNumber(form.commission_rate), 0, 100);
  const taxPercent = clamp(toNumber(form.tax_rate), 0, 100);
  const desiredProfitByn = Math.max(0, toNumber(form.desired_profit));

  // Комиссия WB и налог берутся от ИТОГОВОЙ цены продажи, поэтому «цена минус расходы»
  // делится на (1 - комиссия - налог). При знаменателе ≤ 0 расчёт физически невозможен.
  const denominator = 1 - commissionPercent / 100 - taxPercent / 100;
  const denominatorValid = denominator > 0;
  const breakEvenByn = denominatorValid ? totalCostByn / denominator : 0;
  const recommendedPriceByn = denominatorValid
    ? (totalCostByn + desiredProfitByn) / denominator
    : 0;

  const commissionByn = recommendedPriceByn * (commissionPercent / 100);
  const taxByn = recommendedPriceByn * (taxPercent / 100);

  // ─── Фактическая розничная цена и прибыль ────────────────────────────────
  const retailPriceByn =
    form.retail_price.trim() === ''
      ? recommendedPriceByn
      : Math.max(0, toNumber(form.retail_price));
  const netProfitByn = denominatorValid
    ? retailPriceByn * denominator - totalCostByn
    : -totalCostByn;
  const roiPercent = costWithEcoByn > 0 ? (netProfitByn / costWithEcoByn) * 100 : 0;

  // ─── Блок 5: Постановление № 713 ─────────────────────────────────────────
  const category = getPriceControlCategory(form.p713_category);
  const limitPercent =
    form.p713_category === PRICE_CONTROL_CUSTOM_ID
      ? Math.max(0, toNumber(form.p713_custom_limit))
      : category.limit;
  const markupPercent =
    costWithEcoByn > 0 ? ((retailPriceByn - costWithEcoByn) / costWithEcoByn) * 100 : 0;

  const priceControl: PriceControlStatus = {
    enabled: form.p713_enabled,
    category,
    limitPercent,
    markupPercent: roundTo(markupPercent, 1),
    exceeded: form.p713_enabled && markupPercent > limitPercent,
    maxRetailPriceByn: roundMoney(costWithEcoByn * (1 + limitPercent / 100)),
    maxRetailPriceRub: roundMoney(toRub(costWithEcoByn * (1 + limitPercent / 100))),
  };

  // ─── Блок 4: умный оптимизатор тары ──────────────────────────────────────
  let optimizer: OptimizerAdvice | null = null;
  if (volumeLiters > MEGA_CONFIG.WB_VOLUME_LIMIT_L) {
    const shrink = MEGA_CONFIG.OPTIMIZER_SHRINK_CM;
    const optimized = {
      length: Math.max(1, roundTo(length - shrink, 1)),
      width: Math.max(1, roundTo(width - shrink, 1)),
      height: Math.max(1, roundTo(height - shrink, 1)),
    };
    // V_opt = (Length − 2) × (Width − 2) × (Height − 2) / 1000
    const optimizedVolume = calculateVolumeLiters(
      optimized.length,
      optimized.width,
      optimized.height
    );
    // Объём после оптимизации не может опуститься ниже базового лимита WB
    const appliedVolume = Math.max(MEGA_CONFIG.WB_VOLUME_LIMIT_L, optimizedVolume);
    const excessLitersSaved = Math.max(0, volumeLiters - appliedVolume);
    // Экономия = (V_текущий − max(5, V_opt)) × стоимость избыточного литра × объём партии
    const perItemSavingByn = excessLitersSaved * overLiterCostByn;
    const batchSavingByn = perItemSavingByn * batchVolume;

    optimizer = {
      ...optimized,
      volumeLiters: roundTo(optimizedVolume, 2),
      appliedVolumeLiters: roundTo(appliedVolume, 2),
      excessLitersSaved: roundTo(excessLitersSaved, 2),
      perItemSavingByn: roundMoney(perItemSavingByn),
      batchSavingByn: roundMoney(batchSavingByn),
      batchSavingRub: roundMoney(toRub(batchSavingByn)),
    };
  }

  return {
    rate: safeRate,

    costByn: roundMoney(costByn),
    costRub: roundMoney(toRub(costByn)),
    ecoRateBynPerTon: roundMoney(ecoRateBynPerTon),
    ecoFeeKopecks,
    ecoFeeByn: roundMoney(ecoFeeByn),
    costWithEcoByn,
    fsznPerUnitByn: roundMoney(fsznPerUnitByn),
    fsznTotalByn: roundMoney(fsznTotalByn),
    batchVolume,

    trip,
    tripsPerSale: roundTo(tripsPerSale, 3),
    idleTripsPerSale: roundTo(idleTripsPerSale, 3),
    deliveryPerSaleByn: roundMoney(deliveryPerSaleByn),
    deliveryPerSaleRub: roundMoney(toRub(deliveryPerSaleByn)),

    fixedPerUnitByn: roundMoney(fixedPerUnitByn),
    totalCostByn: roundMoney(totalCostByn),

    commissionPercent,
    taxPercent,
    commissionByn: roundMoney(commissionByn),
    taxByn: roundMoney(taxByn),

    denominatorValid,
    denominatorError: denominatorValid ? null : BREAK_EVEN_ERROR_MESSAGE,
    breakEvenByn: roundMoney(breakEvenByn),
    breakEvenRub: roundMoney(toRub(breakEvenByn)),

    recommendedPriceByn: roundMoney(recommendedPriceByn),
    recommendedPriceRub: roundMoney(toRub(recommendedPriceByn)),

    retailPriceByn: roundMoney(retailPriceByn),
    retailPriceRub: roundMoney(toRub(retailPriceByn)),
    netProfitByn: roundMoney(netProfitByn),
    roiPercent: roundTo(roiPercent, 1),
    netToLiveByn: roundMoney(netProfitByn),

    priceControl,
    optimizer,
  };
}
