/**
 * Интерактивный калькулятор окупаемости пункта выдачи заказов (ПВЗ) Wildberries в РБ.
 *
 * Логика обратного расчёта точки безубыточности:
 *  1) FixedExpenses = аренда + ФОТ + коммуналка (+ штрафы «плохого месяца»).
 *  2) Минимально необходимый доход ПВЗ для работы в ноль = FixedExpenses.
 *  3) Необходимый оборот выданных заказов (BYN) = FixedExpenses ÷ процент выплат зоны.
 *  4) Оборот в RUB = оборот в BYN × 28 (фиксированный технический курс WB).
 *  5) Количество заказов в месяц = оборот в BYN ÷ средний чек.
 *  6) Минимум клиентов в день = Math.ceil(заказы в месяц ÷ 30).
 *
 * Все денежные величины округляются до двух знаков (защита от багов float),
 * любые некорректные/пустые значения инпутов не ломают расчёт (`|| 0`).
 */

export const PVZ_CONFIG = {
  /** Фиксированный технический курс WB: 1 BYN = ? RUB */
  RUB_PER_BYN: 28,
  /** Дней в расчётном месяце */
  DAYS_IN_MONTH: 30,
  /** Ежемесячная аренда помещения по умолчанию, BYN */
  DEFAULT_RENT: 1200,
  /** ФОТ двух менеджеров с налогами по умолчанию, BYN */
  DEFAULT_STAFF: 2200,
  /** Коммуналка, интернет и охрана по умолчанию, BYN */
  DEFAULT_UTILITIES: 400,
  /** Средний чек одного заказа WB по умолчанию, BYN */
  DEFAULT_AVG_CHECK: 55,
} as const;

/**
 * Округление денежных величин до копеек с защитой от багов плавающей точки JS.
 * Number.EPSILON компенсирует погрешность вида 1.005 * 100 = 100.49999999999999.
 */
export const roundMoney = (num: number): number => {
  const safe = Number.isFinite(num) ? num : 0;
  return Math.round((safe + Number.EPSILON) * 100) / 100;
};

/** Округление неденежных величин (проценты, количества) */
export const roundTo = (num: number, digits = 2): number => {
  const safe = Number.isFinite(num) ? num : 0;
  const factor = Math.pow(10, digits);
  return Math.round(safe * factor) / factor;
};

/** Строка → число. Пустая строка, мусор и NaN дают 0 (защита от NaN). */
export const toNumber = (value: string | number | undefined | null): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface PvzZone {
  id: string;
  /** Название зоны с процентом выплат — попадает в <option> */
  label: string;
  /** Процент выплат ПВЗ от оборота как ДОЛЯ (0.04 = 4%) */
  rate: number;
}

/** id ручной зоны: активирует скрытое поле «Кастомный тариф зоны, %» */
export const PVZ_ZONE_CUSTOM_ID = 'zone_custom';

export const PVZ_ZONES: PvzZone[] = [
  {
    id: 'zone_purple',
    label: 'Фиолетовая зона (Выплата: 4.0% от оборота)',
    rate: 0.04,
  },
  {
    id: 'zone_bordeaux',
    label: 'Бордовая зона (Выплата: 3.2% от оборота)',
    rate: 0.032,
  },
  {
    id: 'zone_green_subsidy',
    label: 'Зеленая зона повышенных субсидий (Выплата: 4.5% от оборота)',
    rate: 0.045,
  },
  {
    id: PVZ_ZONE_CUSTOM_ID,
    label: 'Другая зона (ввести процент вознаграждения вручную)',
    rate: 0.04,
  },
];

export const DEFAULT_ZONE_ID = PVZ_ZONES[0].id;

export function getPvzZone(id: string): PvzZone {
  return PVZ_ZONES.find((zone) => zone.id === id) ?? PVZ_ZONES[0];
}

/** Скрытый массив штрафов симулятора «плохого месяца», BYN */
export interface PvzFine {
  id: string;
  /** Причина списания */
  reason: string;
  /** Сумма штрафа/удержания, BYN */
  amount: number;
}

export const PVZ_BAD_MONTH_FINES: PvzFine[] = [
  {
    id: 'fine_electronics',
    reason: 'Штраф за утерю/подмену дорогой электроники сотрудником',
    amount: 1100,
  },
  {
    id: 'fine_rating',
    reason: 'Удержание дохода за падение рейтинга точки ниже 4.95 звезд',
    amount: 800,
  },
];

export const PVZ_FINE_TOTAL: number = roundMoney(
  PVZ_BAD_MONTH_FINES.reduce((sum, fine) => sum + fine.amount, 0)
);

export interface PvzBreakEvenForm {
  /** id тарифной зоны ПВЗ */
  zone: string;
  /** Кастомный тариф зоны, % — используется только при zone === PVZ_ZONE_CUSTOM_ID */
  custom_rate: string;
  /** Ежемесячная аренда помещения, BYN */
  rent: string;
  /** ФОТ сотрудников в месяц (зарплата 2-х менеджеров + налоги), BYN */
  staff: string;
  /** Коммуналка, интернет и охрана точки, BYN */
  utilities: string;
  /** Средний чек одного заказа на WB, BYN */
  avg_check: string;
}

export const DEFAULT_PVZ_FORM: PvzBreakEvenForm = {
  zone: DEFAULT_ZONE_ID,
  custom_rate: '4',
  rent: String(PVZ_CONFIG.DEFAULT_RENT),
  staff: String(PVZ_CONFIG.DEFAULT_STAFF),
  utilities: String(PVZ_CONFIG.DEFAULT_UTILITIES),
  avg_check: String(PVZ_CONFIG.DEFAULT_AVG_CHECK),
};

export interface PvzBreakEvenResult {
  /** Ставка выплаты зоны, ДОЛЯ оборота */
  rate: number;
  ratePercent: number;
  /** Название выбранной зоны */
  zoneLabel: string;
  isCustomZone: boolean;

  rent: number;
  staff: number;
  utilities: number;
  /** Постоянные расходы без штрафов, BYN */
  baseExpenses: number;
  /** Сумма штрафов «плохого месяца», BYN */
  finesTotal: number;
  /** Постоянные расходы с учётом штрафов, BYN */
  fixedExpenses: number;

  /** Минимально необходимый доход ПВЗ, BYN */
  requiredRevenueByn: number;
  /** Необходимый оборот выданных заказов, BYN */
  requiredTurnoverByn: number;
  /** Необходимый оборот в RUB по фиксированному курсу WB */
  requiredTurnoverRub: number;
  /** Общее количество заказов в месяц */
  ordersPerMonth: number;
  /** Минимальное количество клиентов в день (всегда целое, вверх) */
  clientsPerDay: number;
  /** Выплата ПВЗ за месяц при таком обороте, BYN */
  payoutByn: number;
  /** Курс, по которому считается оборот в RUB */
  rubPerByn: number;
}

export function calculatePvzBreakEven(
  form: PvzBreakEvenForm,
  badMonth: boolean
): PvzBreakEvenResult {
  const isCustomZone = form.zone === PVZ_ZONE_CUSTOM_ID;
  const zone = getPvzZone(form.zone);

  // Кастомная ставка вводится в процентах (4 = 4%) и переводится в долю оборота
  const customPercent = Math.max(0, toNumber(form.custom_rate) || 0);
  const rate = isCustomZone ? roundTo(customPercent / 100, 6) : zone.rate;
  const safeRate = Math.max(0, toNumber(rate) || 0);

  const rent = roundMoney(toNumber(form.rent) || 0);
  const staff = roundMoney(toNumber(form.staff) || 0);
  const utilities = roundMoney(toNumber(form.utilities) || 0);
  const avgCheck = roundMoney(toNumber(form.avg_check) || 0);

  const baseExpenses = roundMoney(rent + staff + utilities);
  const finesTotal = badMonth ? PVZ_FINE_TOTAL : 0;
  const fixedExpenses = roundMoney(baseExpenses + finesTotal);

  // 2) Минимально необходимый доход ПВЗ для работы в ноль = постоянные расходы
  const requiredRevenueByn = fixedExpenses;

  // 3) Необходимый оборот выданных заказов = FixedExpenses ÷ процент выплат зоны
  const requiredTurnoverByn = safeRate > 0 ? roundMoney(requiredRevenueByn / safeRate) : 0;

  // 4) Оборот в RUB по фиксированному техническому курсу WB
  const requiredTurnoverRub = roundMoney(requiredTurnoverByn * PVZ_CONFIG.RUB_PER_BYN);

  // 5) Общее количество заказов в месяц = оборот в BYN ÷ средний чек
  const ordersPerMonth = avgCheck > 0 ? roundTo(requiredTurnoverByn / avgCheck, 2) : 0;

  // 6) Минимальное количество клиентов в день
  const clientsPerDay = Math.ceil(ordersPerMonth / PVZ_CONFIG.DAYS_IN_MONTH);

  const payoutByn = roundMoney(requiredTurnoverByn * safeRate);

  return {
    rate: safeRate,
    ratePercent: roundTo(safeRate * 100, 2),
    zoneLabel: isCustomZone ? `Другая зона (${formatZonePercent(safeRate)})` : zone.label,
    isCustomZone,

    rent,
    staff,
    utilities,
    baseExpenses,
    finesTotal,
    fixedExpenses,

    requiredRevenueByn,
    requiredTurnoverByn,
    requiredTurnoverRub,
    ordersPerMonth,
    clientsPerDay: Number.isFinite(clientsPerDay) && clientsPerDay > 0 ? clientsPerDay : 0,
    payoutByn,
    rubPerByn: PVZ_CONFIG.RUB_PER_BYN,
  };
}

/** Процент выплат долей оборота → «4%» / «3.2%» */
export function formatZonePercent(rate: number): string {
  const percent = roundTo(toNumber(rate) * 100, 2);
  const text = percent.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return `${text}%`;
}