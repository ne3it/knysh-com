import type { ConstructionRegionKey } from '@/lib/store/constructionStore';

/**
 * Прайс-лист раздела «Строительный» (/const).
 *
 * ВСЕ ДЕНЬГИ — СТРОГО BYN. Ни доллара, ни рубля: смета прораба в РБ уходит
 * в бухгалтерию и в приложение «Смета», где валюта одна.
 *
 * Как устроены цены
 * -----------------
 * `BASE_PRICES_BYN` хранит СРЕДНИЕ КОММЕРЧЕСКИЕ цены по РБ в базовом варианте
 * (Минск, розница со склада, без доставки крупногабаритом). Это ориентир для
 * предварительной сметы, а не оферта: точную цену прораб уточняет у поставщика.
 *
 * Регион не является одной общей скидкой. Материал в областях дешевле
 * (логистика, склад), но и работа бригады стоит дешевле — поэтому коэффициенты
 * разведены по видам: `material` и `labor`. Иначе «региональная смета»
 * занижала бы работы и незначительно удорожала материалы.
 *
 *   бетон М300: 1 м³ ≈ 172 BYN (в коридоре ТЗ 150–180)
 *   блоки:      1 м³ ≈ 135–145 BYN (в коридоре ТЗ 135–155)
 */
export type PriceKind = 'material' | 'labor';

export interface PriceItem {
  /** Базовая цена в BYN (Минск) */
  value: number;
  /** Материал или работа — от этого зависит региональный коэффициент */
  kind: PriceKind;
  /** Единица измерения для сметы */
  unit: string;
  /** Наименование позиции в смете */
  label: string;
}

/**
 * Региональные коэффициенты к базовым ценам.
 *
 * minsk — базовая точка (1.00 / 1.00).
 * region — средние области РБ: материал −6 %, труд −12 %.
 */
export const REGION_COEFFICIENTS: Record<
  ConstructionRegionKey,
  { label: string; shortLabel: string; material: number; labor: number }
> = {
  minsk: { label: 'Минск', shortLabel: 'Минск', material: 1, labor: 1 },
  region: { label: 'Регионы РБ', shortLabel: 'Регионы', material: 0.94, labor: 0.88 },
};

/** Ключи позиций прайса — по ним и считают калькуляторы */
export type PriceKey =
  // бетон и растворы
  | 'concreteM200'
  | 'concreteM250'
  | 'concreteM300'
  | 'concreteM350'
  | 'cementM400'
  | 'sand'
  | 'gravel'
  | 'groutFill'
  // фундамент
  | 'formwork'
  | 'rebar'
  | 'rebarWire'
  | 'xps'
  | 'concreteDelivery'
  // кладка
  | 'blocks625x300x200'
  | 'blocks625x400x200'
  | 'blocks500x300x250'
  | 'mortarBag25'
  | 'blockDelivery'
  // кровля
  | 'rafterBoard'
  | 'battenBoard'
  | 'osb'
  | 'membrane'
  | 'profiledMetal'
  | 'gutterSystem'
  // отделка
  | 'plasterMix'
  | 'screedMix'
  | 'waterproofing'
  // работа
  | 'workFoundation'
  | 'workMasonry'
  | 'workRoof'
  | 'workPlaster'
  | 'workScreed';

export const BASE_PRICES_BYN: Record<PriceKey, PriceItem> = {
  // ---- Бетон (за 1 м³, с доставкой миксера в пределах 30 км) ----
  concreteM200: { value: 150, kind: 'material', unit: 'м³', label: 'Бетон М200 (C12/15), с доставкой' },
  concreteM250: { value: 162, kind: 'material', unit: 'м³', label: 'Бетон М250 (C16/20), с доставкой' },
  concreteM300: { value: 172, kind: 'material', unit: 'м³', label: 'Бетон М300 (C18/22.5), с доставкой' },
  concreteM350: { value: 180, kind: 'material', unit: 'м³', label: 'Бетон М350 (C22/27), с доставкой' },

  cementM400: { value: 21, kind: 'material', unit: 'мешок 50 кг', label: 'Портландцемент ПЦ 400, мешок 50 кг' },
  sand: { value: 42, kind: 'material', unit: 'м³', label: 'Песок мытый 2-й класс' },
  gravel: { value: 58, kind: 'material', unit: 'м³', label: 'Щебень гранитный фракции 5–20' },
  groutFill: { value: 55, kind: 'material', unit: 'м³', label: 'Песчано-гравийная смесь ПГС' },

  // ---- Фундамент ----
  formwork: { value: 28, kind: 'material', unit: 'м²', label: 'Опалубка (комплект, с ГКЛ/фанерой)' },
  rebar: { value: 1450, kind: 'material', unit: 'т', label: 'Арматура А500С диаметром 10–14 мм' },
  rebarWire: { value: 2.8, kind: 'material', unit: 'кг', label: 'Проволока вязальная d1,2 мм' },
  xps: { value: 62, kind: 'material', unit: 'м³', label: 'Пенополистирол экструдированный XPS' },
  concreteDelivery: { value: 25, kind: 'material', unit: 'м³', label: 'Доставка бетона миксером (сверх объёма в тарифе)' },

  // ---- Кладка ----
  blocks625x300x200: { value: 138, kind: 'material', unit: 'м³', label: 'Блок силикатный 625×300×200, с паллетой' },
  blocks625x400x200: { value: 145, kind: 'material', unit: 'м³', label: 'Блок силикатный 625×400×200, с паллетой' },
  blocks500x300x250: { value: 135, kind: 'material', unit: 'м³', label: 'Блок силикатный 500×300×250, с паллетой' },
  mortarBag25: { value: 14.5, kind: 'material', unit: 'мешок 25 кг', label: 'Клеевая смесь для кладки, мешок 25 кг' },
  blockDelivery: { value: 18, kind: 'material', unit: 'м³', label: 'Доставка блоков манипулятором' },

  // ---- Кровля ----
  rafterBoard: { value: 1150, kind: 'material', unit: 'м³', label: 'Доска обрезная 50×150×5,5 м (стропила)' },
  battenBoard: { value: 1350, kind: 'material', unit: 'м³', label: 'Брусок 50×50×5,5 м (обрешётка)' },
  osb: { value: 12, kind: 'material', unit: 'м²', label: 'Плита OSB/3 толщиной 12 мм' },
  membrane: { value: 9.5, kind: 'material', unit: 'м²', label: 'Наплавляемая мембрана / рубероид' },
  profiledMetal: { value: 14.5, kind: 'material', unit: 'м²', label: 'Профнастил С8 либо металлочерепица' },
  gutterSystem: { value: 16, kind: 'material', unit: 'пог. м', label: 'Водосточная система (труба + воронка + желоб)' },

  // ---- Отделка ----
  plasterMix: { value: 16.5, kind: 'material', unit: 'мешок 25 кг', label: 'Штукатурная смесь, мешок 25 кг' },
  screedMix: { value: 18, kind: 'material', unit: 'мешок 25 кг', label: 'Стяжечная смесь, мешок 25 кг' },
  waterproofing: { value: 7.8, kind: 'material', unit: 'м²', label: 'Гидроизоляция обмазочная, 2 слоя' },

  // ---- Работа ----
  workFoundation: { value: 130, kind: 'labor', unit: 'м³', label: 'Работа: устройство фундамента, бетон + опалубка' },
  workMasonry: { value: 210, kind: 'labor', unit: 'м³', label: 'Работа: кладка блоков на тонкий шов' },
  workRoof: { value: 38, kind: 'labor', unit: 'м²', label: 'Работа: монтаж стропильной системы и кровли' },
  workPlaster: { value: 45, kind: 'labor', unit: 'м²', label: 'Работа: штукатурка, 2 слоя' },
  workScreed: { value: 28, kind: 'labor', unit: 'м²', label: 'Работа: стяжка с выравниванием по уровню' },
};

/**
 * Цена позиции с учётом региона, BYN.
 * Округление до копеек, чтобы в смете не копился мусор вида 172,00000000004.
 */
export function getPrice(key: PriceKey, region: ConstructionRegionKey): number {
  const item = BASE_PRICES_BYN[key];
  const coefficient = REGION_COEFFICIENTS[region];
  const factor = item.kind === 'material' ? coefficient.material : coefficient.labor;
  return round2(item.value * factor);
}

/** Позиция прайса вместе с подписью и региональной ценой — для сборки сметы */
export function getPricedItem(
  key: PriceKey,
  region: ConstructionRegionKey
): PriceItem & { key: PriceKey; total: number } {
  const item = BASE_PRICES_BYN[key];
  return { ...item, key, total: getPrice(key, region) };
}

/** Ключи позиций по виду работ — так калькуляторы перебирают «своё» подразделение */
export const PRICE_GROUPS: Record<string, PriceKey[]> = {
  foundation: [
    'concreteM250',
    'formwork',
    'rebar',
    'rebarWire',
    'xps',
    'sand',
    'workFoundation',
  ],
  masonry: ['blocks625x300x200', 'mortarBag25', 'blockDelivery', 'workMasonry'],
  roof: ['rafterBoard', 'battenBoard', 'osb', 'membrane', 'profiledMetal', 'gutterSystem', 'workRoof'],
  plaster: ['plasterMix', 'workPlaster'],
  screed: ['screedMix', 'waterproofing', 'workScreed'],
};

/** Подсказка по цене для подсказки «от»/«до» в интерфейсе */
export function priceHint(key: PriceKey, region: ConstructionRegionKey): string {
  const item = BASE_PRICES_BYN[key];
  const price = getPrice(key, region);
  return `${price.toFixed(2)} BYN / ${item.unit}`;
}

/** Округление до двух знаков, без сюрпризов на границах */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}