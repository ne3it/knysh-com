/**
 * Интерактивный калькулятор окупаемости пункта выдачи заказов (ПВЗ) Wildberries в РБ.
 *
 * Логика обратного расчёта точки безубыточности:
 *  1) FixedExpenses = аренда + ФОТ + коммуналка (+ отмеченные штрафы WB).
 *  2) Минимально необходимый доход ПВЗ для работы в ноль = FixedExpenses.
 *  3) Необходимый оборот выданных заказов (BYN) = FixedExpenses ÷ процент выплат зоны.
 *  4) Оборот в RUB = оборот в BYN × 28 (фиксированный технический курс WB).
 *  5) Количество заказов в месяц = оборот в BYN ÷ средний чек.
 *  6) Минимум клиентов в день = Math.ceil(заказы в месяц ÷ 30).
 *
 * Налоговый модуль РБ (чистая прибыль селлера):
 *  Чистая_Прибыль = (Валовый_Доход_ПВЗ − Постоянные_Расходы) × (1 − Ставка_Налога / 100).
 *  Налог НЕ прибавляется к расходам, а удерживается только с положительной прибыли:
 *  при убытке точки налог автоматически равен 0, точка безубыточности не ломается.
 *
 * Валовый доход считается от трафика, отдельного ввода оборота в форме нет:
 *  ExpectedMonthlyVolume_BYN = Ожидаемый_поток_клиентов × Средний_чек × 30 дней
 *  Валовый_Доход = ExpectedMonthlyVolume_BYN × Процент_выплат_зоны
 *
 * ФОТ собирается из динамического списка сотрудников (как спецификация ТТН-1):
 *  ФОТ = Σ окладов + 34% (взносы в ФСЗН) + 0.6% (Белгосстрах).
 *
 * Сравнение теории с реальностью:
 *  Ожидаемый поток клиентов (чел./день) сравнивается с минимумом клиентов в день,
 *  необходимым для выхода в ноль: покрывает или нет.
 *
 * Симулятор рисков и штрафов WB:
 *  Пользователь отмечает нужные штрафы чекбоксами; сумма отмеченных удержаний
 *  (включая ручной ввод кастомного штрафа) прибавляется к постоянным расходам.
 *  При TotalFines > 0 плашка чистой прибыли желтеет (прибыль ещё в плюсе)
 *  или краснеет (точка ушла в кассовый разрыв).
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
  /** Коммуналка, интернет и охрана по умолчанию, BYN */
  DEFAULT_UTILITIES: 400,
  /** Средний чек одного заказа WB по умолчанию, BYN */
  DEFAULT_AVG_CHECK: 55,
  /** Ожидаемый поток клиентов по умолчанию, чел./день */
  DEFAULT_TRAFFIC: 80,
  /** Взносы в ФСЗН за работника в РБ, % от оклада */
  FSZN_EMPLOYEE_RATE: 34,
  /** Взносы в Белгосстрах за работника в РБ, % от оклада */
  BGS_EMPLOYEE_RATE: 0.1,
  /**
   * Максимум сотрудников в расчёте ПВЗ.
   * Ограничение по законодательству РБ: на одном пункте выдачи допускается
   * не более 3 работников, поэтому четвёртая строка не добавляется.
   */
  MAX_EMPLOYEES: 3,
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
  /** Название зоны — попадает в <option> */
  label: string;
  /** Процент выплат ПВЗ от оборота как ДОЛЯ (0.035 = 3.5%) */
  rate: number;
  /** Группа населённых пунктов — попадает в <optgroup> */
  group: string;
}

/** id ручной зоны: активирует скрытое поле «Кастомный тариф зоны, %» */
export const PVZ_ZONE_CUSTOM_ID = 'zone_custom';

/** Ставка кастомной зоны по умолчанию — 3.5% от оборота */
export const PVZ_ZONE_CUSTOM_RATE = 0.035;

export const PVZ_ZONE_GROUP_MINSK = 'Минск и Минский район';
export const PVZ_ZONE_GROUP_REGIONAL = 'Областные центры РБ (Брест, Гродно, Гомель, Витебск, Могилев)';
export const PVZ_ZONE_GROUP_SUBSIDY = 'Малые города и сельская местность (Субсидируемые регионы)';
export const PVZ_ZONE_GROUP_CUSTOM = 'УНИВЕРСАЛЬНЫЙ ВВОД';

/** Порядок групп в выпадающем списке сохраняется */
export const PVZ_ZONE_GROUPS: string[] = [
  PVZ_ZONE_GROUP_MINSK,
  PVZ_ZONE_GROUP_REGIONAL,
  PVZ_ZONE_GROUP_SUBSIDY,
  PVZ_ZONE_GROUP_CUSTOM,
];

export const PVZ_ZONES: PvzZone[] = [
  {
    id: 'zone_minsk_standard',
    label: 'Минск — Зона Стандарт',
    rate: 0.035,
    group: PVZ_ZONE_GROUP_MINSK,
  },
  {
    id: 'zone_minsk_red',
    label: 'Минск — Зона Насыщенная (Красная)',
    rate: 0.028,
    group: PVZ_ZONE_GROUP_MINSK,
  },
  {
    id: 'zone_regional_standard',
    label: 'Областной город — Зона Стандарт',
    rate: 0.038,
    group: PVZ_ZONE_GROUP_REGIONAL,
  },
  {
    id: 'zone_regional_new',
    label: 'Областной город — Новые кварталы',
    rate: 0.042,
    group: PVZ_ZONE_GROUP_REGIONAL,
  },
  {
    id: 'zone_district_center',
    label: 'Районный центр (население до 50 тыс.)',
    rate: 0.045,
    group: PVZ_ZONE_GROUP_SUBSIDY,
  },
  {
    id: 'zone_village_max',
    label: 'Деревни / Села / Поселки (Максимальная субсидия)',
    rate: 0.05,
    group: PVZ_ZONE_GROUP_SUBSIDY,
  },
  {
    id: PVZ_ZONE_CUSTOM_ID,
    label: 'Кастомная тарифная зона (ввести процент вручную)',
    rate: PVZ_ZONE_CUSTOM_RATE,
    group: PVZ_ZONE_GROUP_CUSTOM,
  },
];

export const DEFAULT_ZONE_ID = PVZ_ZONES[0].id;

export function getPvzZone(id: string): PvzZone {
  return PVZ_ZONES.find((zone) => zone.id === id) ?? PVZ_ZONES[0];
}

export interface PvzZoneGroup {
  group: string;
  options: PvzZone[];
}

/** Зоны, сгруппированные по типу населённых пунктов — для <optgroup> */
export const PVZ_ZONES_BY_GROUP: PvzZoneGroup[] = PVZ_ZONE_GROUPS.map((group) => ({
  group,
  options: PVZ_ZONES.filter((zone) => zone.group === group),
})).filter((entry) => entry.options.length > 0);

/** Ультимативная база удержаний и штрафов Wildberries для ПВЗ, BYN */
export interface PvzFine {
  id: PvzFineId;
  /** Название нарушения — текст чекбокса в панели стрес��-теста */
  reason: string;
  /** Сумма штрафа/удержания, BYN. У кастомного штрафа сумма вводится вручную */
  amount: number;
  /** true — сумму вводит пользователь в скрытом поле */
  custom?: boolean;
}

export type PvzFineId =
  | 'fine_electronics'
  | 'fine_rating'
  | 'fine_acceptance'
  | 'fine_videofixation'
  | 'fine_complaint'
  | 'fine_closed'
  | 'fine_custom_check';

/** id кастомного штрафа: включает скрытое поле ручного ввода суммы */
export const PVZ_FINE_CUSTOM_ID = 'fine_custom_check';

/** Дефолт ручного ввода для кастомного штрафа, BYN */
export const PVZ_FINE_CUSTOM_DEFAULT = '0';

export const PVZ_FINES: PvzFine[] = [
  {
    id: 'fine_electronics',
    reason: 'Утеря или подмена дорогого товара/электроники сотрудником',
    amount: 1100,
  },
  {
    id: 'fine_rating',
    reason: 'Депремирование за падение рейтинга точки ниже 4.95 звезд',
    amount: 800,
  },
  {
    id: 'fine_acceptance',
    reason: 'Просрочка разбора и сканирования утренней коробки/поставки',
    amount: 350,
  },
  {
    id: 'fine_videofixation',
    reason: 'Нарушение регламента видеофиксации (выдача без пакета, закрытая камера)',
    amount: 200,
  },
  {
    id: 'fine_complaint',
    reason: 'Жалоба клиента на некорректное/грубое поведение персонала',
    amount: 100,
  },
  {
    id: 'fine_closed',
    reason: 'Закрытие ПВЗ в рабочие часы (опоздание менеджера на смену)',
    amount: 150,
  },
  {
    id: PVZ_FINE_CUSTOM_ID,
    reason: 'Другой кастомный штраф от маркетплейса (ручной ввод суммы)',
    amount: 0,
    custom: true,
  },
];

/** Отметки чекбоксов панели штрафов: id штрафа → выбран ли */
export type PvzFineSelection = Record<string, boolean>;

/** Ничего не выбрано — стресс-тест выключен */
export const DEFAULT_FINE_SELECTION: PvzFineSelection = {};

/** Сумма всех типовых (не кастомных) штрафов, BYN */
export const PVZ_FINE_TOTAL: number = roundMoney(
  PVZ_FINES.filter((fine) => !fine.custom).reduce((sum, fine) => sum + fine.amount, 0)
);

/**
 * Суммирует штрафы по отмеченным чекбоксам и добавляет ручной ввод
 * кастомного штрафа, если включён его чекбокс. Любые пустые/мусорные
 * значения приводятся к 0 (защита от NaN).
 */
export function sumSelectedFines(
  selection: PvzFineSelection,
  customAmount: string | number
): number {
  const active = selection ?? {};
  let total = 0;

  for (const fine of PVZ_FINES) {
    if (!active[fine.id]) continue;
    total += fine.custom
      ? Math.max(0, toNumber(customAmount) || 0)
      : Math.max(0, toNumber(fine.amount) || 0);
  }

  return roundMoney(total);
}

/** Система налогообложения ИП в РБ: налог берётся только с ПОЛОЖИТЕЛЬНОЙ прибыли */
export type PvzTaxId = 'income' | 'osn_vat';

export interface PvzTaxSystem {
  id: PvzTaxId;
  label: string;
  /** Ставка налога, % от прибыли */
  rate: number;
  /** Пояснение для интерфейса */
  hint: string;
}

export const PVZ_TAX_SYSTEMS: PvzTaxSystem[] = [
  {
    id: 'income',
    label: 'Подоходный налог (ставка 20% от чистой прибыли)',
    rate: 20,
    hint: 'Налог начисляется только с прибыли: при убытке точки ставка равна 0.',
  },
  {
    id: 'osn_vat',
    label: 'Общая система с НДС (ОСН)',
    rate: 40,
    hint: 'Эффективная нагрузка ОСН: НДС 20% + налог на прибыль 20%. НДС идёт в вычет, поэтому в формуле (1 − ставка) применяется 40%.',
  },
];

export const DEFAULT_PVZ_TAX_ID: PvzTaxId = 'income';

export function getPvzTaxSystem(id: string): PvzTaxSystem {
  return PVZ_TAX_SYSTEMS.find((system) => system.id === id) ?? PVZ_TAX_SYSTEMS[0];
}

export interface PvzBreakEvenForm {
  /** id тарифной зоны ПВЗ */
  zone: string;
  /** Кастомный тариф зоны, % — используется только при zone === PVZ_ZONE_CUSTOM_ID */
  custom_rate: string;
  /** Ежемесячная аренда помещения, BYN */
  rent: string;
  /** Сотрудники ПВЗ: многострочный список с окладами (как спецификация ТТН-1) */
  employees: PvzEmployee[];
  /** Коммуналка, интернет и охрана точки, BYN */
  utilities: string;
  /** Средний чек одного заказа на WB, BYN */
  avg_check: string;
  /** Ожидаемый поток клиентов, чел./день — база расчёта дохода и сравнения с безубыточностью */
  traffic: string;
  /** Система налогообложения ИП в РБ */
  tax_system: PvzTaxId;
}

/**
 * Строка персонала ПВЗ — по аналогии со строкой спецификации ТТН-1:
 * несколько сотрудников добавляются кнопкой «Добавить сотрудника».
 */
export interface PvzEmployee {
  /** Стабильный ключ строки: не зависит от позиции в массиве */
  id: string;
  /** Должность или имя сотрудника */
  position: string;
  /** Оклад / зарплата за месяц на руки, BYN */
  salary: string;
}

/** Значения строки персонала без служебного ключа */
export type PvzEmployeeValues = Omit<PvzEmployee, 'id'>;

/** Первая строка персонала предзаполняется демонстрационными значениями */
export const DEFAULT_EMPLOYEE: PvzEmployeeValues = {
  position: 'Менеджер смены 1',
  salary: '900',
};

/** Добавляемые пользователем строки создаются пустыми */
export const EMPTY_EMPLOYEE: PvzEmployeeValues = {
  position: '',
  salary: '',
};

let employeeSeq = 0;

/** Идентификатор строки не зависит от её позиции в массиве */
const nextEmployeeId = () => {
  employeeSeq += 1;
  return `emp-${employeeSeq}`;
};

export function createPvzEmployee(values: PvzEmployeeValues = EMPTY_EMPLOYEE): PvzEmployee {
  return { id: nextEmployeeId(), ...values };
}

/** Правка одного поля конкретной строки персонала */
export function updateEmployeeRow(
  employees: PvzEmployee[],
  id: string,
  field: keyof PvzEmployeeValues,
  value: string
): PvzEmployee[] {
  return (Array.isArray(employees) ? employees : []).map((employee) =>
    employee.id === id ? { ...employee, [field]: value } : employee
  );
}

/**
 * Добавление новой видимой строки сотрудника в конец списка.
 * Ограничено PVZ_CONFIG.MAX_EMPLOYEES: лишние строки молча игнорируются,
 * поэтому кнопка «＋ Добавить сотрудника» просто перестаёт работать.
 */
export function addEmployeeRow(employees: PvzEmployee[]): PvzEmployee[] {
  const list = Array.isArray(employees) ? employees : [];
  if (list.length >= PVZ_CONFIG.MAX_EMPLOYEES) return list;
  return [...list, createPvzEmployee()];
}

/** Можно ли добавить ещё одну строку сотрудника (лимит 3 по закону РБ) */
export function canAddEmployee(employees: PvzEmployee[]): boolean {
  return (Array.isArray(employees) ? employees : []).length < PVZ_CONFIG.MAX_EMPLOYEES;
}

/**
 * Удаление строки персонала. Последний сотрудник не удаляется:
 * хотя бы одна строка с полями остаётся видимой в форме всегда.
 */
export function removeEmployeeRow(employees: PvzEmployee[], id: string): PvzEmployee[] {
  const list = Array.isArray(employees) ? employees : [];
  if (list.length <= 1) return list;
  return list.filter((employee) => employee.id !== id);
}

export const DEFAULT_PVZ_FORM: PvzBreakEvenForm = {
  zone: DEFAULT_ZONE_ID,
  custom_rate: '3.5',
  rent: String(PVZ_CONFIG.DEFAULT_RENT),
  employees: [createPvzEmployee(DEFAULT_EMPLOYEE)],
  utilities: String(PVZ_CONFIG.DEFAULT_UTILITIES),
  avg_check: String(PVZ_CONFIG.DEFAULT_AVG_CHECK),
  traffic: String(PVZ_CONFIG.DEFAULT_TRAFFIC),
  tax_system: DEFAULT_PVZ_TAX_ID,
};

/** Разложенный фонд оплаты труда: оклады + взносы ФСЗН и Белгосстраха */
export interface PvzPayroll {
  /** Количество сотрудников в штате */
  headcount: number;
  /** Сумма окладов «на руки», BYN */
  salariesTotal: number;
  /** Взносы в ФСЗН, BYN (34% от окладов) */
  fsznTotal: number;
  /** Взносы в Белгосстрах, BYN (0.6% от окладов) */
  bgsTotal: number;
  /** Итоговый ФОТ, идущий в постоянные расходы, BYN */
  total: number;
}

/**
 * ФОТ = Σ окладов + 34% (ФСЗН за работника) + 0.6% (Белгосстрах).
 * Оба взноса считаются от базы окладов, поэтому итог = оклады × 1.346.
 * Любые пустые/мусорные оклады дают 0 (защита от NaN).
 */
export function calculatePayroll(employees: PvzEmployee[]): PvzPayroll {
  const list = Array.isArray(employees) ? employees : [];
  const salariesTotal = roundMoney(
    list.reduce((sum, employee) => sum + Math.max(0, toNumber(employee?.salary) || 0), 0)
  );
  const fsznTotal = roundMoney((salariesTotal * PVZ_CONFIG.FSZN_EMPLOYEE_RATE) / 100);
  const bgsTotal = roundMoney((salariesTotal * PVZ_CONFIG.BGS_EMPLOYEE_RATE) / 100);

  return {
    headcount: list.length,
    salariesTotal,
    fsznTotal,
    bgsTotal,
    total: roundMoney(salariesTotal + fsznTotal + bgsTotal),
  };
}

export interface PvzBreakEvenResult {
  /** Ставка выплаты зоны, ДОЛЯ оборота */
  rate: number;
  ratePercent: number;
  /** Название выбранной зоны */
  zoneLabel: string;
  isCustomZone: boolean;

  rent: number;
  /** Разложенный ФОТ: оклады сотрудников + взносы ФСЗН 34% и Белгосстрах 0.6% */
  payroll: PvzPayroll;
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

  /** Ожидаемый оборот при введённом трафике, BYN */
  expectedTurnoverByn: number;
  /** Ожидаемый оборот в RUB по фиксированному курсу WB */
  expectedTurnoverRub: number;
  /** Ожидаемое количество заказов в месяц = трафик × дней в месяце */
  expectedOrdersPerMonth: number;
  /** Валовый доход ПВЗ при ожидаемом обороте, BYN */
  grossRevenueByn: number;
  /** Прибыль до налогов: валовый доход − постоянные расходы, BYN */
  preTaxProfitByn: number;
  /** Налог, BYN. При убытке автоматически 0, чтобы не ломать точку безубыточности */
  taxAmountByn: number;
  /** Чистая прибыль после налогов = (валовый доход − расходы) × (1 − ставка/100), BYN */
  netProfitByn: number;
  /** Ставка налога, применённая в расчёте, % */
  taxRatePercent: number;
  /** Название системы налогообложения */
  taxLabel: string;

  /** Ожидаемый поток клиентов, чел./день (ввод пользователя) */
  trafficPerDay: number;
  /** Прогноз трафика покрывает точку безубыточности */
  trafficCoversBreakEven: boolean;
  /** Выбран хотя бы один штраф стрес��-теста */
  hasFines: boolean;
}

export function calculatePvzBreakEven(
  form: PvzBreakEvenForm,
  /** Сумма штрафов по отмеченным чекбоксам панели, BYN (см. sumSelectedFines) */
  finesTotalInput: number
): PvzBreakEvenResult {
  const isCustomZone = form.zone === PVZ_ZONE_CUSTOM_ID;
  const zone = getPvzZone(form.zone);
  const taxSystem = getPvzTaxSystem(form.tax_system);

  // Кастомная ставка вводится в процентах (3.5 = 3.5%) и переводится в долю оборота
  const customPercent = Math.max(0, toNumber(form.custom_rate) || 0);
  const rate = isCustomZone ? roundTo(customPercent / 100, 6) : zone.rate;
  const safeRate = Math.max(0, toNumber(rate) || 0);

  const rent = roundMoney(toNumber(form.rent) || 0);
  const payroll = calculatePayroll(form.employees);
  const utilities = roundMoney(toNumber(form.utilities) || 0);
  const avgCheck = roundMoney(toNumber(form.avg_check) || 0);
  const trafficPerDay = Math.max(0, roundTo(toNumber(form.traffic) || 0, 0));

  const baseExpenses = roundMoney(rent + payroll.total + utilities);
  // Отрицательные и мусорные суммы штрафов не уменьшают расходы точки
  const finesTotal = Math.max(0, roundMoney(toNumber(finesTotalInput) || 0));
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

  // Налоговый модуль РБ: налог НЕ прибавляется к расходам, а удерживается с прибыли.
  // Чистая_Прибыль = (Валовый_Доход_ПВЗ − Постоянные_Расходы) × (1 − Ставка_Налога / 100).
  // При убытке налог автоматически 0 — точка безубыточности не ломается.
  //
  // Валовый доход строится только от трафика и среднего чека:
  //   ExpectedMonthlyVolume_BYN = трафик (чел/день) × средний чек × 30 дней
  //   Валовый_Доход = ExpectedMonthlyVolume_BYN × процент выплат зоны
  const expectedOrdersPerMonth = roundTo(trafficPerDay * PVZ_CONFIG.DAYS_IN_MONTH, 2);
  const expectedTurnoverByn = roundMoney(
    trafficPerDay * avgCheck * PVZ_CONFIG.DAYS_IN_MONTH
  );
  const expectedTurnoverRub = roundMoney(expectedTurnoverByn * PVZ_CONFIG.RUB_PER_BYN);

  const taxRatePercent = Math.min(100, Math.max(0, toNumber(taxSystem.rate) || 0));
  const grossRevenueByn = roundMoney(expectedTurnoverByn * safeRate);
  const preTaxProfitByn = roundMoney(grossRevenueByn - fixedExpenses);
  const taxAmountByn =
    preTaxProfitByn > 0 ? roundMoney(preTaxProfitByn * (taxRatePercent / 100)) : 0;
  const netProfitByn =
    preTaxProfitByn > 0 ? roundMoney((preTaxProfitByn / 100) * (100 - taxRatePercent)) : preTaxProfitByn;

  // Сравнение теории с реальностью: хватает ли ожидаемого потока клиентов
  const trafficCoversBreakEven = trafficPerDay >= clientsPerDay;

  return {
    rate: safeRate,
    ratePercent: roundTo(safeRate * 100, 2),
    zoneLabel: isCustomZone ? `Кастомная тарифная зона (${formatZonePercent(safeRate)})` : zone.label,
    isCustomZone,

    rent,
    payroll,
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

    expectedTurnoverByn,
    expectedTurnoverRub,
    expectedOrdersPerMonth,
    grossRevenueByn,
    preTaxProfitByn,
    taxAmountByn,
    netProfitByn,
    taxRatePercent: roundTo(taxRatePercent, 2),
    taxLabel: taxSystem.label,

    trafficPerDay,
    trafficCoversBreakEven,
    hasFines: finesTotal > 0,
  };
}

/** Процент выплат долей оборота → «4%» / «3.2%» */
export function formatZonePercent(rate: number): string {
  const percent = roundTo(toNumber(rate) * 100, 2);
  const text = percent.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return `${text}%`;
}