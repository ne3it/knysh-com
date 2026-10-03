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
 * некорректные значения инпутов не ломают расчёт (защита через `|| 0`).
 */

export const MEGA_CONFIG = {
  /** Ставка налога по умолчанию (УСН РБ), % */
  TAX_RATE: 6,
  /** Комиссия WB по умолчанию, % */
  COMMISSION_RATE: 23,
  /** Базовый лимит объёма одной посылки WB, литры */
  WB_VOLUME_LIMIT_L: 5,
  /** Доплата за каждый литр сверх лимита WB, BYN */
  WB_OVERVOLUME_BYN_PER_L: 0.1,
  /** Базовый порог тарифа WB, до которого объём не тарифицируется, литры */
  WB_BASE_LIMIT_L: 1,
  /** Тариф WB за литр сверх базового порога, BYN (≈7 ₽) */
  WB_PRE_LIMIT_BYN_PER_L: 0.21,
  /** Коэффициент стоимости холостой поездки (возврат на склад) */
  BUYOUT_TRIP_FACTOR: 1.5,
  /** Экосбор: пластик / плёнка зип-лок, BYN за тонну */
  ECO_PLASTIC_BYN_PER_TON: 90,
  /** Экосбор: картон / бумага, BYN за тонну */
  ECO_PAPER_BYN_PER_TON: 60,
  /** Процент выкупа по умолчанию, % */
  DEFAULT_BUYOUT_RATE: 30,
  /** На сколько сантиметров предлагает уменьшить каждую грань «умный оптимизатор», см */
  OPTIMIZER_SHRINK_CM: 2,
  /** Курс 1 RUB → BYN, если официальный недоступен */
  FALLBACK_RUB_TO_BYN: RUB_TO_BYN_WITH_BUFFER,
} as const;

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
  fszn_batch: string;

  length: string;
  width: string;
  height: string;
  base_delivery: string;
  transit: string;
  buyout_rate: string;
  warehouse_coefficient: string;

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
  fszn_batch: '1000',

  length: '30',
  width: '20',
  height: '10',
  base_delivery: '1.53',
  transit: '3.67',
  buyout_rate: '30',
  warehouse_coefficient: '1',

  p713_enabled: false,
  p713_category: 'clothes_mw',
  p713_custom_limit: '30',
};

export interface TripDelivery {
  volumeLiters: number;
  /** Объём сверх базового лимита WB (5 л) */
  overLimitLiters: number;
  /** Доплата за лишние литры, BYN */
  overLimitFeeByn: number;
  /** Тариф за объём сверх базового порога (1 л), BYN */
  preLimitFeeByn: number;
  /** Базовая стоимость доставки WB с учётом объёма, BYN */
  baseDeliveryByn: number;
  /** Транзит РБ → РФ, BYN */
  transitByn: number;
  /** Стоимость одной поездки (туда), BYN */
  totalByn: number;
}

export interface OptimizerAdvice {
  length: number;
  width: number;
  height: number;
  volumeLiters: number;
  savingByn: number;
  savingRub: number;
}

export interface PriceControlStatus {
  enabled: boolean;
  category: PriceControlCategory;
  limitPercent: number;
  markupPercent: number;
  exceeded: boolean;
  maxRetailPriceByn: number;
}

export interface MegaUnitResult {
  rate: number;

  costByn: number;
  ecoRateBynPerTon: number;
  ecoFeeKopecks: number;
  ecoFeeByn: number;
  costWithEcoByn: number;
  fsznPerUnitByn: number;
  fsznTotalByn: number;

  trip: TripDelivery;
  tripsPerSale: number;
  idleTripsPerSale: number;
  deliveryPerSaleByn: number;

  fixedPerUnitByn: number;
  totalCostByn: number;

  commissionPercent: number;
  taxPercent: number;
  commissionByn: number;
  taxByn: number;

  breakEvenValid: boolean;
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

export const toNumber = (value: string | number | undefined | null): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2): number => {
  const safe = Number.isFinite(value) ? value : 0;
  const factor = Math.pow(10, digits);
  return Math.round(safe * factor) / factor;
};

/** Объём упаковки в литрах: (Д × Ш × В) / 1000 */
export function calculateVolumeLiters(length: number, width: number, height: number): number {
  const l = Math.max(0, toNumber(length));
  const w = Math.max(0, toNumber(width));
  const h = Math.max(0, toNumber(height));
  return (l * w * h) / 1000;
}

interface TripDeliveryInput {
  volumeLiters: number;
  baseDeliveryByn: number;
  transitByn: number;
  warehouseCoefficient: number;
}

/**
 * Стоимость одной поездки WB: базовый тариф + надбавки за объём + транзит РБ → РФ.
 * За каждый литр сверх лимита WB (5 л) начисляется +0.10 BYN.
 */
export function calculateTripDelivery(input: TripDeliveryInput): TripDelivery {
  const volumeLiters = Math.max(0, toNumber(input.volumeLiters));
  const baseDelivery = Math.max(0, toNumber(input.baseDeliveryByn));
  const transit = Math.max(0, toNumber(input.transitByn));
  const coefficient = Math.max(0, toNumber(input.warehouseCoefficient));

  const overPreLimitLiters = Math.max(0, volumeLiters - MEGA_CONFIG.WB_BASE_LIMIT_L);
  const overLimitLiters = Math.max(0, volumeLiters - MEGA_CONFIG.WB_VOLUME_LIMIT_L);

  const preLimitFeeByn = overPreLimitLiters * MEGA_CONFIG.WB_PRE_LIMIT_BYN_PER_L;
  const overLimitFeeByn = overLimitLiters * MEGA_CONFIG.WB_OVERVOLUME_BYN_PER_L;

  const volumeAwareBase = baseDelivery + preLimitFeeByn + overLimitFeeByn;
  const baseDeliveryByn = volumeAwareBase * (coefficient > 0 ? coefficient : 1);

  return {
    volumeLiters: round(volumeLiters, 3),
    overLimitLiters: round(overLimitLiters, 3),
    overLimitFeeByn: round(overLimitFeeByn, 4),
    preLimitFeeByn: round(preLimitFeeByn, 4),
    baseDeliveryByn: round(baseDeliveryByn, 4),
    transitByn: round(transit, 4),
    totalByn: round(baseDeliveryByn + transit, 4),
  };
}

/** Ставка экосбора по выбранному материалу, BYN за тонну */
export function resolveEcoRate(form: MegaUnitForm): number {
  const option = ECO_FEE_OPTIONS.find((item) => item.id === form.eco_fee) ?? ECO_FEE_OPTIONS[0];
  if (form.eco_fee === 'custom') return Math.max(0, toNumber(form.eco_custom_rate));
  return Math.max(0, option.rate);
}

export function calculateMegaUnitEconomics(form: MegaUnitForm, rate: number): MegaUnitResult {
  const safeRate = rate > 0 ? rate : MEGA_CONFIG.FALLBACK_RUB_TO_BYN;
  const toByn = (rub: number) => (Number.isFinite(rub) ? rub : 0) * safeRate;
  const toRub = (byn: number) => (safeRate > 0 ? (Number.isFinite(byn) ? byn : 0) / safeRate : 0);

  // ─── Закупка ───────────────────────────────────────────────────────────────
  const rawCost = Math.max(0, toNumber(form.cost_price));
  const costByn = form.currency === 'RUB' ? toByn(rawCost) : rawCost;

  // ─── Блок 3: экосбор РБ ───────────────────────────────────────────────────
  const ecoWeightGrams = Math.max(0, toNumber(form.eco_weight));
  const ecoRateBynPerTon = resolveEcoRate(form);
  const ecoFeeByn = (ecoWeightGrams / 1_000_000) * ecoRateBynPerTon;
  const ecoFeeKopecks = ecoFeeByn * 100;
  const costWithEcoByn = costByn + ecoFeeByn;

  // ─── Блок 3: ФСЗН и Белгосстрах за квартал ───────────────────────────────
  const fsznBatch = Math.max(0, toNumber(form.fszn_batch));
  const fsznTotalByn = form.fszn_enabled ? Math.max(0, toNumber(form.fszn_quarter)) : 0;
  const fsznPerUnitByn = fsznBatch > 0 ? fsznTotalByn / fsznBatch : 0;

  // ─── Блок 4: объём, тарифы WB и покатушки ────────────────────────────────
  const length = Math.max(0, toNumber(form.length));
  const width = Math.max(0, toNumber(form.width));
  const height = Math.max(0, toNumber(form.height));
  const volumeLiters = calculateVolumeLiters(length, width, height);

  const trip = calculateTripDelivery({
    volumeLiters,
    baseDeliveryByn: toNumber(form.base_delivery),
    transitByn: toNumber(form.transit),
    warehouseCoefficient: toNumber(form.warehouse_coefficient),
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
  const commissionPercent = clamp(toNumber(form.commission_rate), 0, 99);
  const taxPercent = clamp(toNumber(form.tax_rate), 0, 50);
  const desiredProfitByn = Math.max(0, toNumber(form.desired_profit));

  // Комиссия WB и налог берутся от ИТОГОВОЙ цены продажи, поэтому «цена минус расходы»
  // делится на (1 - комиссия - налог).
  const denominator = 1 - commissionPercent / 100 - taxPercent / 100;
  const breakEvenValid = denominator > 0;
  const breakEvenByn = breakEvenValid ? totalCostByn / denominator : 0;
  const recommendedPriceByn = breakEvenValid
    ? (totalCostByn + desiredProfitByn) / denominator
    : 0;

  const commissionByn = recommendedPriceByn * (commissionPercent / 100);
  const taxByn = recommendedPriceByn * (taxPercent / 100);

  // ─── Фактическая розничная цена и прибыль ────────────────────────────────
  const retailPriceByn =
    form.retail_price.trim() === ''
      ? recommendedPriceByn
      : Math.max(0, toNumber(form.retail_price));
  const netProfitByn = retailPriceByn * denominator - totalCostByn;
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
    markupPercent: round(markupPercent, 1),
    exceeded: form.p713_enabled && markupPercent > limitPercent,
    maxRetailPriceByn: round(costWithEcoByn * (1 + limitPercent / 100), 2),
  };

  // ─── Блок 4: умный оптимизатор тары ──────────────────────────────────────
  let optimizer: OptimizerAdvice | null = null;
  if (volumeLiters > MEGA_CONFIG.WB_VOLUME_LIMIT_L) {
    const shrink = MEGA_CONFIG.OPTIMIZER_SHRINK_CM;
    const optimized = {
      length: Math.max(1, round(length - shrink, 1)),
      width: Math.max(1, round(width - shrink, 1)),
      height: Math.max(1, round(height - shrink, 1)),
    };
    const optimizedVolume = calculateVolumeLiters(
      optimized.length,
      optimized.width,
      optimized.height
    );
    const optimizedTrip = calculateTripDelivery({
      volumeLiters: optimizedVolume,
      baseDeliveryByn: toNumber(form.base_delivery),
      transitByn: toNumber(form.transit),
      warehouseCoefficient: toNumber(form.warehouse_coefficient),
    });
    const savingByn = Math.max(0, (trip.totalByn - optimizedTrip.totalByn) * tripsPerSale);

    optimizer = {
      ...optimized,
      volumeLiters: round(optimizedVolume, 2),
      savingByn: round(savingByn, 4),
      savingRub: round(toRub(savingByn), 2),
    };
  }

  return {
    rate: safeRate,

    costByn: round(costByn, 2),
    ecoRateBynPerTon: round(ecoRateBynPerTon, 2),
    ecoFeeKopecks: round(ecoFeeKopecks, 2),
    ecoFeeByn: round(ecoFeeByn, 4),
    costWithEcoByn: round(costWithEcoByn, 4),
    fsznPerUnitByn: round(fsznPerUnitByn, 4),
    fsznTotalByn: round(fsznTotalByn, 2),

    trip,
    tripsPerSale: round(tripsPerSale, 3),
    idleTripsPerSale: round(idleTripsPerSale, 3),
    deliveryPerSaleByn: round(deliveryPerSaleByn, 4),

    fixedPerUnitByn: round(fixedPerUnitByn, 4),
    totalCostByn: round(totalCostByn, 4),

    commissionPercent,
    taxPercent,
    commissionByn: round(commissionByn, 4),
    taxByn: round(taxByn, 4),

    breakEvenValid,
    breakEvenByn: round(breakEvenByn, 2),
    breakEvenRub: round(toRub(breakEvenByn), 2),

    recommendedPriceByn: round(recommendedPriceByn, 2),
    recommendedPriceRub: round(toRub(recommendedPriceByn), 2),

    retailPriceByn: round(retailPriceByn, 2),
    retailPriceRub: round(toRub(retailPriceByn), 2),
    netProfitByn: round(netProfitByn, 2),
    roiPercent: round(roiPercent, 1),
    netToLiveByn: round(netProfitByn, 2),

    priceControl,
    optimizer,
  };
}
