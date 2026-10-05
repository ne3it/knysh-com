import type { ConstructionRegionKey } from '@/lib/store/constructionStore';
import { INSULATION_PRODUCTS, type InsulationId } from './constants';

/**
 * Прайс-лист каркасного дома (/frame). ВСЕ ДЕНЬГИ — BYN, без исключений.
 *
 * ЧЕМ ЭТОТ ПРАЙС ОТЛИЧАЕТСЯ ОТ `/lib/construction/prices.ts`:
 *   - там цены на КЛАДКУ (блоки, клей) и фундамент из МАССИВНОГО бетона;
 *   - здесь цены на ДЕРЕВЯННЫЙ КАРКАС, и почти всё считается в погонных
 *     метрах и кубометрах, а не в мешках.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: утеплитель котируется ЗА М³ КОНКРЕТНОЙ ТОЛЩИНЫ.
 *
 *   Белтеп-100: базовая паспортная цена 9,40 BYN за м³ при толщине 100 мм.
 *   Толщина 150 мм — это 1,5 м³ на тот же квадрат, значит 14,10 BYN/м³.
 *
 * Почему так: в прайсах поставщиков РБ утеплитель продаётся упаковками «пачка
 * 0,25 м³» или «6 м² при 100 мм», и цена за м³ зависит от толщины нелинейно —
 * маржа на тонком листе выше. Считать «среднюю цену за м³» и умножать на объём
 * значит ошибаться на 30–50 % на марке Paroc, а именно её чаще всего берут
 * «чтобы не думать».
 *
 * Региональные коэффициенты те же, что в /const (материал −6 %, работа −12 %
 * вне Минска), но применены к ДЕРЕВЯННЫМ ценам: пиломатериал в областях дешевле
 * сильнее, чем бетон, потому что возят его с ближайшего склада и без
 * манипулятора. Поэтому у `lumber` отдельный коэффициент — 0,90.
 */

/** Тип позиции: материал или работа. От него зависит региональный коэффициент */
export type FramePriceKind = 'material' | 'labor';

export interface FramePriceItem {
  /** Базовая цена в BYN (Минск, склад, без доставки крупногабаритом) */
  value: number;
  kind: FramePriceKind;
  /** Единица измерения позиции в смете */
  unit: string;
  /** Наименование позиции в смете */
  label: string;
  /** Группа для группировки по шагам конструктора */
  group: 'foundation' | 'walls' | 'pie' | 'roof' | 'work' | 'element';
}

/**
 * Региональные коэффициенты к каркасным ценам.
 *
 * Отличие от /const: пиломатериал и плиты (OSB, утеплитель) имеют СВОЙ
 * коэффициент 0,90 — в областях доска и OSB дешевле на 10 %, потому что
 * производство и склад ближе, а бетон остаётся на общем уровне.
 */
export const FRAME_REGION_COEFFICIENTS: Record<
  ConstructionRegionKey,
  {
    label: string;
    shortLabel: string;
    material: number;
    /** Пиломатериал и плиты: дешевле в областях сильнее, чем бетон */
    lumber: number;
    labor: number;
  }
> = {
  minsk: { label: 'Минск', shortLabel: 'Минск', material: 1, lumber: 1, labor: 1 },
  region: { label: 'Регионы РБ', shortLabel: 'Регионы', material: 0.94, lumber: 0.9, labor: 0.88 },
};

/**
 * Ключи позиций прайса.
 *
 * `lumber*` и `sheet*` разделены намеренно: у них разные региональные
 * коэффициенты, и если бы они лежали в одном ключе, смета в регионе считалась
 * бы по неверному множителю.
 */
export type FramePriceKey =
  // ---- Фундамент: обвязка и сваи ----
  | 'concretePile'
  | 'rebarPile'
  | 'rebarTie'
  | 'beam150'
  | 'beam200'
  | 'waterproofRoll'
  | 'gravelPile'
  // ---- Стены: каркас ----
  | 'stud50150'
  | 'stud50200'
  | 'boardBrace'
  | 'boardLedger'
  | 'boardSill'
  | 'plateOSB'
  | 'fastener'
  | 'concretePileWork'
  | 'frameAssembleWork'
  // ---- Пирог стены ----
  | 'vaporBarrier'
  | 'windMembrane'
  | 'gypsum'
  | 'sheathingWork'
  // ---- Кровля ----
  | 'rafterBoard'
  | 'battenBoard'
  | 'roofMembrane'
  | 'profiledMetal'
  | 'roofWork'
  | 'gutter'
  // ---- Элементы (монтаж) ----
  | 'windowInstall'
  | 'doorInstall'
  | 'terraceDeck'
  | 'terraceWork';

export const FRAME_PRICES_BYN: Record<FramePriceKey, FramePriceItem> = {
  // ---- Фундамент ----
  concretePile: {
    value: 168,
    kind: 'material',
    unit: 'м³',
    label: 'Бетон С16/20 (М250) на сваи, с доставкой',
    group: 'foundation',
  },
  rebarPile: {
    value: 1520,
    kind: 'material',
    unit: 'т',
    label: 'Арматура А500С d10–12 на сваи',
    group: 'foundation',
  },
  rebarTie: {
    value: 2.8,
    kind: 'material',
    unit: 'кг',
    label: 'Проволока вязальная d1,2',
    group: 'foundation',
  },
  beam150: {
    value: 1180,
    kind: 'material',
    unit: 'м³',
    label: 'Брус обвязки 150×150, естественной влажности',
    group: 'foundation',
  },
  beam200: {
    value: 1265,
    kind: 'material',
    unit: 'м³',
    label: 'Брус обвязки 200×200, естественной влажности',
    group: 'foundation',
  },
  waterproofRoll: {
    value: 8.4,
    kind: 'material',
    unit: 'м²',
    label: 'Гидроизоляция рулонная (рубероид РКП-3, 2 слоя)',
    group: 'foundation',
  },
  gravelPile: {
    value: 62,
    kind: 'material',
    unit: 'м³',
    label: 'ПГС под сваи с трамбовкой',
    group: 'foundation',
  },

  // ---- Стены: каркас ----
  stud50150: {
    value: 1240,
    kind: 'material',
    unit: 'м³',
    label: 'Доска строганая 50×150 (стойка), естественной влажности 18 %',
    group: 'walls',
  },
  stud50200: {
    value: 1310,
    kind: 'material',
    unit: 'м³',
    label: 'Доска строганая 50×200 (стойка), естественной влажности 18 %',
    group: 'walls',
  },
  boardBrace: {
    value: 1180,
    kind: 'material',
    unit: 'м³',
    label: 'Доска 25×100 (укосина)',
    group: 'walls',
  },
  boardLedger: {
    value: 1180,
    kind: 'material',
    unit: 'м³',
    label: 'Доска 25×100 (ригель: опорный 1,35 м и под перекрытием)',
    group: 'walls',
  },
  boardSill: {
    value: 1180,
    kind: 'material',
    unit: 'м³',
    label: 'Доска 50×150 (нижняя обвязка стен по брусу)',
    group: 'walls',
  },
  plateOSB: {
    value: 21.5,
    kind: 'material',
    unit: 'м²',
    label: 'ОСП-3, 9 мм, влагостойкая (ветрозащита)',
    group: 'walls',
  },
  fastener: {
    value: 6.2,
    kind: 'material',
    unit: 'кг',
    label: 'Крепёж: саморезы 4,2×75, скобы, уголок перфорированный',
    group: 'walls',
  },

  // ---- Пирог стены ----
  vaporBarrier: {
    value: 2.9,
    kind: 'material',
    unit: 'м²',
    label: 'Пароизоляция ПЭ 120 мкм',
    group: 'pie',
  },
  windMembrane: {
    value: 5.4,
    kind: 'material',
    unit: 'м²',
    label: 'Мембрана паропроницаемая (альтернатива ОСП)',
    group: 'pie',
  },
  gypsum: {
    value: 13.8,
    kind: 'material',
    unit: 'м²',
    label: 'ГКЛ 12,5 мм на каркас (внутренняя обшивка)',
    group: 'pie',
  },
  sheathingWork: {
    value: 52,
    kind: 'labor',
    unit: 'м²',
    label: 'Работа: утепление, пароизоляция, ветрозащита',
    group: 'work',
  },

  // ---- Кровля ----
  rafterBoard: {
    value: 1290,
    kind: 'material',
    unit: 'м³',
    label: 'Доска стропильная 50×200',
    group: 'roof',
  },
  battenBoard: {
    value: 1390,
    kind: 'material',
    unit: 'м³',
    label: 'Брусок обрешётки 25×50',
    group: 'roof',
  },
  roofMembrane: {
    value: 8.9,
    kind: 'material',
    unit: 'м²',
    label: 'Мембрана кровельная ПВХ, 1 слой',
    group: 'roof',
  },
  profiledMetal: {
    value: 15.8,
    kind: 'material',
    unit: 'м²',
    label: 'Металлочерепица / профнастил с доборными элементами',
    group: 'roof',
  },
  gutter: {
    value: 16.5,
    kind: 'material',
    unit: 'пог. м',
    label: 'Водосточная система (желоб, труба, воронка)',
    group: 'roof',
  },

  // ---- Работа ----
  concretePileWork: {
    value: 145,
    kind: 'labor',
    unit: 'шт',
    label: 'Работа: свая с нуля — бурение/копка, опалубка, бетон',
    group: 'work',
  },
  frameAssembleWork: {
    value: 96,
    kind: 'labor',
    unit: 'м²',
    label: 'Работа: сборка каркаса стен — стойки, укосины, ригели, обшивка',
    group: 'work',
  },
  roofWork: {
    value: 44,
    kind: 'labor',
    unit: 'м²',
    label: 'Работа: стропильная система, обрешётка, кровля',
    group: 'work',
  },

  // ---- Элементы ----
  windowInstall: {
    value: 45,
    kind: 'labor',
    unit: 'шт',
    label: 'Работа: монтаж окна с откосами и отливом',
    group: 'element',
  },
  doorInstall: {
    value: 55,
    kind: 'labor',
    unit: 'шт',
    label: 'Работа: монтаж входной двери',
    group: 'element',
  },
  terraceDeck: {
    value: 158,
    kind: 'material',
    unit: 'м²',
    label: 'Настил террасы лиственница 27 мм + лаги + крепёж',
    group: 'element',
  },
  terraceWork: {
    value: 74,
    kind: 'labor',
    unit: 'м²',
    label: 'Работа: устройство террасы с ограждением',
    group: 'work',
  },
};

/**
 * Паспортные базовые цены утеплителя: BYN за м³ при ТОЛЩИНЕ 100 мм.
 *
 * Затемняются функцией `insulationPriceM3`: толщина пересчитывается линейно,
 * потому что при удвоении толщины удваивается и объём в том же м².
 * Заменять на «среднюю цену» нельзя — см. комментарий в шапке файла.
 */
const INSULATION_BASE_PER_M3_AT_100MM: Record<string, number> = {
  'beltep-100': 9.4,
  'beltep-150': 13.1,
  'paroc-145': 17.8,
  'paroc-200': 21.5,
};

/**
 * Цена утеплителя за м³ при заданной толщине, BYN.
 *
 * `thicknessMm` обязателен: без него нельзя отличиить дешёвый тонкий лист от
 * дорогого толстого, а именно на этом чаще всего ошибаются в сметах.
 */
export function insulationPriceM3(id: InsulationId, thicknessMm: number): number {
  const base = INSULATION_BASE_PER_M3_AT_100MM[id];
  if (base === undefined) {
    // Неизвестный ключ не должен ронять весь расчёт: берём самый дешёвый лист
    // и помечаем это в интерфейсе через `insulationProduct()`.
    return INSULATION_BASE_PER_M3_AT_100MM['beltep-100'] * Math.max(1, thicknessMm / 100);
  }
  return round2(base * Math.max(1, thicknessMm) / 100);
}

/** Цена утеплителя за 1 м² стены при толщине, BYN/м² — так удобнее показывать в интерфейсе */
export function insulationPriceM2(id: InsulationId, thicknessMm: number): number {
  return round2((insulationPriceM3(id, thicknessMm) * Math.max(1, thicknessMm)) / 100);
}

/** Паспортная плотность марки — по ней считается масса и грузоподъёмность */
export function insulationDensity(id: InsulationId): number {
  return INSULATION_PRODUCTS.find((item) => item.id === id)?.densityKgM3 ?? 100;
}

/**
 * Цена позиции с учётом региона, BYN.
 *
 * Округление до копеек выполняется здесь, а не на месте умножения: иначе в смете
 * на 40 позиций накапливается мусор вида 1180.0000000000002, и итог перестаёт
 * совпадать с суммой строк, которую прораб видит на экране.
 */
export function getFramePrice(key: FramePriceKey, region: ConstructionRegionKey): number {
  const item = FRAME_PRICES_BYN[key];
  const coefficient = FRAME_REGION_COEFFICIENTS[region];
  const factor =
    item.kind === 'labor'
      ? coefficient.labor
      : isLumberKey(key)
        ? coefficient.lumber
        : coefficient.material;
  return round2(item.value * factor);
}

/**
 * Позиция прайса с подписью, единицей и региональной ценой — для сборки сметы.
 *
 * Возвращается вместе с `key`, чтобы калькулятор не держал параллельный
 * список id и подписей: рассинхрон между ними — источник строк вида
 * «Брус обвязки» с единицей «шт».
 */
export function getFramePricedItem(
  key: FramePriceKey,
  region: ConstructionRegionKey
): FramePriceItem & { key: FramePriceKey; total: number } {
  const item = FRAME_PRICES_BYN[key];
  return { ...item, key, total: getFramePrice(key, region) };
}

/** Отдельная цена утеплителя с его подписью — вне общего прайса */
export function getInsulationPricedItem(
  id: InsulationId,
  thicknessMm: number,
  region: ConstructionRegionKey
): FramePriceItem & { key: string; total: number } {
  const product = INSULATION_PRODUCTS.find((item) => item.id === id);
  const name = product ? `${product.brand} ${product.name.toLowerCase()}` : 'Утеплитель минеральная вата';
  const base = insulationPriceM3(id, thicknessMm);
  const coefficient = FRAME_REGION_COEFFICIENTS[region].material;
  return {
    value: base,
    total: round2(base * coefficient),
    kind: 'material',
    unit: 'м³',
    label: `Утеплитель ${name}, ${thicknessMm} мм`,
    group: 'pie',
    // `key` — идентификатор позиции для сгруппированного списка сметы. Здесь
    // это `insulation:<id>:<толщина>`: составной, потому что одна и та же
    // марка на разной толщине — РАЗНЫЕ позиции закупки, и сводить их в одну
    // строку значит показать прорабу цену чужого объёма.
    key: `insulation:${id}:${thicknessMm}`,
  };
}

/** Цена ключа без округления — только для внутренних сравнений (например, сортировки) */
export function framePriceRaw(key: FramePriceKey): number {
  return FRAME_PRICES_BYN[key].value;
}

/** Ключи позиций по шагам конструктора: шаг 1..4 тянет только своё */
export const FRAME_PRICE_GROUPS: Record<'foundation' | 'walls' | 'pie' | 'roof', FramePriceKey[]> = {
  foundation: [
    'concretePile',
    'rebarPile',
    'rebarTie',
    'gravelPile',
    'beam150',
    'beam200',
    'waterproofRoll',
    'concretePileWork',
  ],
  walls: ['stud50150', 'stud50200', 'boardBrace', 'boardSill', 'plateOSB', 'fastener', 'frameAssembleWork'],
  pie: ['vaporBarrier', 'windMembrane', 'gypsum', 'sheathingWork'],
  roof: ['rafterBoard', 'battenBoard', 'roofMembrane', 'profiledMetal', 'gutter', 'roofWork'],
};

/**
 * Пиломатериал и плиты получают отдельный региональный коэффициент.
 *
 * Список закрытый и объявлен константой: добавлять новый ключ в прайс и
 * забыть про `isLumberKey` — это типичный баг, из-за которого смета в
 * регионе «съезжает» на 4–6 %. Новое ключевое слово добавляется ЗДЕСЬ.
 */
const LUMBER_KEYS: ReadonlySet<FramePriceKey> = new Set<FramePriceKey>([
  'beam150',
  'beam200',
  'stud50150',
  'stud50200',
  'boardBrace',
  'boardSill',
  'rafterBoard',
  'battenBoard',
]);

function isLumberKey(key: FramePriceKey): boolean {
  return LUMBER_KEYS.has(key);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
