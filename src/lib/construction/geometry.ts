import {
  BLOCKS_PER_PALLET,
  BLOCK_SIZES,
  BLOCK_VOLUME_M3,
  BREAKAGE_DEFAULT_PERCENT,
  CONCRETE_DENSITY_KG_M3,
  FROST_DEPTH_M,
  JOINT_THICKNESS_MIN_MM,
  MORTAR_KG_PER_M3,
  MIN_FROST_BELOW_GRADE_M,
  OPENING_CUT_WASTE_PERCENT,
  OVERLAP_ABSOLUTE_MIN_MM,
  OVERLAP_DIAMETERS_FACTOR,
  RAFTER_BOARD,
  STEEL_DENSITY_KG_M3,
  VIBRATION_COMPACTION_FACTOR,
  CONCRETE_LOSS_PERCENT,
  type BlockSizeKey,
  type ConcreteMark,
} from './constants';

/**
 * Чистая арифметика калькуляторов раздела «Строительный» (/const).
 *
 * В модуле НЕТ состояния, НЕТ React и НЕТ цен — только формулы и единицы
 * измерения. Единицы зафиксированы жёстко и указаны в имени функции:
 *
 *   ...Mm   — миллиметры (то, что вводит прораб);
 *   ...M    — метры;
 *   ...M2   — квадратные метры;
 *   ...M3   — кубометры;
 *   ...Kg   — килограммы;
 *   ...T    — тонны.
 *
 * Так смета не может разойтись с чертежом из-за потерянного нуля: конвертацию
 * делает единственная функция `mmToM`, а всё остальное уже в метрах.
 */

/* ========================================================================== */
/*                            Базовые преобразования                          */
/* ========================================================================== */

/** Миллиметры → метры */
export function mmToM(mm: number): number {
  return mm / 1000;
}

/** Метры → миллиметры */
export function mToMm(m: number): number {
  return m * 1000;
}

/**
 * Разбор строки из инпута в число.
 *
 * Прораб на смартфоне вводит и «12,5», и «12.5», и «12,5 м» — запятая
 * главный разделитель в РБ. Пустая строка даёт fallback, а не NaN: иначе
 * результат мгновенно превращается в «NaN м³» и пугает на объекте.
 */
export function safeNum(raw: string | number | undefined, fallback = 0): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  if (!raw) return fallback;
  const normalized = String(raw).replace(/\s|м\s*м?\s*|м3|м³|кг/gi, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : fallback;
}

/** Ограничение диапазона: физика не принимает отрицательную площадь */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Округление вниз до шага (например, шаг стропил 0,05 м) */
export function roundDownTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.floor(value / step + Number.EPSILON) * step;
}

/**
 * Округление вверх до шага (глубину заложения округляют ВВЕРХ, а не вниз).
 *
 * Вычитание 1e-9 — не «магическое число», а защита от двоичного представления:
 * 1,35 + 0,1 даёт 1.4500000000000002, деление на 0,05 — 29.000000000000004,
 * и наивный Math.ceil округлил бы глубину заложения на полшага вверх.
 * Относительная погрешность у float возле единицы порядка 2e-16, поэтому 1e-9
 * заведомо больше шума, но всё ещё намного меньше реального шага.
 */
export function roundUpTo(value: number, step: number): number {
  if (step <= 0) return value;
  const steps = Math.ceil(value / step - 1e-9);
  return round3(steps * step);
}

/** Площадь прямоугольника, м² (длина и ширина в метрах) */
export function areaM2(lengthM: number, widthM: number): number {
  return clamp(lengthM, 0, Number.MAX_SAFE_INTEGER) * clamp(widthM, 0, Number.MAX_SAFE_INTEGER);
}

/** Площадь проёма по размерам в миллиметрах, м² */
export function openingAreaM2(widthMm: number, heightMm: number, count = 1): number {
  return mmToM(widthMm) * mmToM(heightMm) * clamp(count, 0, 1000);
}

/** Сумма позиций сметы */
export function sumItems(items: Array<{ total: number }>): number {
  return items.reduce((acc, item) => acc + item.total, 0);
}

/* ========================================================================== */
/*                     ПРОМЕРЗАНИЕ И ГЛУБИНА ЗАЛОЖЕНИЯ ФУНДАМЕНТА            */
/* ========================================================================== */

export interface FrostInput {
  /** Область РБ (ключ FROST_DEPTH_M) */
  district: string;
  /** Тип грунта (коэффициент из SOIL_TYPE_FROST_FACTOR) */
  soilFactor?: number;
  /** Дополнительный запас ниже промерзания, м */
  extraBelowGradeM?: number;
}

export interface FrostResult {
  /** Расчётная глубина промерзания по СН 2.01.01-2019, м */
  normativeM: number;
  /** Глубина промерзания с поправкой на грунт, м */
  adjustedM: number;
  /** Рекомендуемая глубина заложения подошвы от планировочной земли, м */
  footingDepthM: number;
}

/**
 * Глубина заложения фундамента по СН 2.01.01-2019.
 *
 * Логика: подошва должна быть НИЖЕ границы промерзания плюс запас
 * MIN_FROST_BELOW_GRADE_M (0,1 м) на пучение и на неровность площадки.
 * Результат округляется вверх до 0,05 м — так копка идёт ровными слоями
 * по колышкам, а не «по краю котлована».
 */
export function computeFrostDepth(input: FrostInput): FrostResult {
  const normative = FROST_DEPTH_M[input.district] ?? FROST_DEPTH_M.minsk;
  const soilFactor = input.soilFactor ?? 1;
  const adjusted = round3(normative * soilFactor);
  const footingDepthM = roundUpTo(
    round3(adjusted + (input.extraBelowGradeM ?? MIN_FROST_BELOW_GRADE_M)),
    0.05
  );
  return { normativeM: normative, adjustedM: adjusted, footingDepthM: round2(footingDepthM) };
}

/* ========================================================================== */
/*                          ФУНДАМЕНТЫ: ЛЕНТА И ПЛИТА                         */
/* ========================================================================== */

export type FoundationType = 'strip' | 'slab';

export interface FoundationInput {
  type: FoundationType;
  /** Длина ленты по наружному периметру, м */
  lengthM: number;
  /** Ширина ленты / плиты, мм */
  widthMm: number;
  /** Толщина (глубина) ленты / толщина плиты, мм */
  thicknessMm: number;
  /** Число лент (1 — одна стена, 2 — с двумя полостями и т. п.) */
  stripsCount?: number;
  /** Подошва ниже земли, м (для ленты: чистая высота бетона) */
  depthM?: number;
  /** Толщина подстилающей песчано-гравийной подушки, мм */
  beddingMm?: number;
  /** Толщина бетонной подготовки под подушкой, мм */
  blindingMm?: number;
}

export interface FoundationGeometry {
  /** Габарит фундамента по плану, м */
  planLengthM: number;
  planWidthM: number;
  /** Чистый объём бетона конструкции, м³ */
  volumeM3: number;
  /** Объём после коэффициента уплотнения вибратором 1,05 */
  volumeCompactedM3: number;
  /** Объём к закупке: +3 % на потери при подаче/транспортировке */
  volumeToOrderM3: number;
  /** Масса бетона, кг */
  massKg: number;
  /** Площадь опалубки, м² */
  formworkM2: number;
  /** Объём подстилающей подушки, м³ */
  beddingM3: number;
  /** Площадь подстилающей подушки, м² */
  beddingM2: number;
}

/**
 * Геометрия фундамента.
 *
 * Для ленты объём = длина × ширина × глубина заложения под землёй
 * (то, что реально в земле). Для плиты объём = длина × ширина × толщина,
 * и подстилающая подушка идёт по всей площади плиты, а не по периметру.
 *
 * Три уровня объёма бетона — разные вещи, и прораб их регулярно путает:
 *   volumeM3            — что залито в опалубку;
 *   volumeCompactedM3   — с учётом уплотнения глубинным вибратором (1,05);
 *   volumeToOrderM3     — сколько заказать на заводе (+3 % потери).
 */
export function computeFoundationGeometry(input: FoundationInput): FoundationGeometry {
  const planWidthM = mmToM(input.widthMm);
  const beddingM = mmToM(input.beddingMm ?? 200);
  const blindingM = mmToM(input.blindingMm ?? 100);

  if (input.type === 'slab') {
    const thicknessM = mmToM(input.thicknessMm);
    const planLengthM = clamp(input.lengthM, 0, Number.MAX_SAFE_INTEGER);
    const planAreaM2 = areaM2(planLengthM, planWidthM);
    const volumeM3 = planAreaM2 * thicknessM;
    return {
      planLengthM: round2(planLengthM),
      planWidthM: round2(planWidthM),
      volumeM3: round3(volumeM3),
      volumeCompactedM3: round3(volumeM3 * VIBRATION_COMPACTION_FACTOR),
      volumeToOrderM3: round3(volumeM3 * VIBRATION_COMPACTION_FACTOR * (1 + CONCRETE_LOSS_PERCENT / 100)),
      massKg: round1(volumeM3 * CONCRETE_DENSITY_KG_M3),
      // У плиты опалубка по периметру плюс торцы-откосы; берём развёртку периметра × высоту
      formworkM2: round2((2 * (planLengthM + planWidthM)) * thicknessM),
      beddingM3: round3(planAreaM2 * beddingM),
      beddingM2: round2(planAreaM2),
    };
  }

  const stripsCount = Math.max(1, Math.round(input.stripsCount ?? 1));
  const depthM = Math.max(0, input.depthM ?? 0);
  const planLengthM = clamp(input.lengthM, 0, Number.MAX_SAFE_INTEGER);
  const volumeM3 = planLengthM * planWidthM * depthM * stripsCount;
  const beddingAreaM2 = planLengthM * planWidthM * stripsCount;
  return {
    planLengthM: round2(planLengthM),
    planWidthM: round2(planWidthM),
    volumeM3: round3(volumeM3),
    volumeCompactedM3: round3(volumeM3 * VIBRATION_COMPACTION_FACTOR),
    volumeToOrderM3: round3(volumeM3 * VIBRATION_COMPACTION_FACTOR * (1 + CONCRETE_LOSS_PERCENT / 100)),
    massKg: round1(volumeM3 * CONCRETE_DENSITY_KG_M3),
    // Лента: две стороны + торец каждой полосы
    formworkM2: round2((2 * depthM * planLengthM + 2 * planWidthM) * stripsCount),
    beddingM3: round3(beddingAreaM2 * beddingM),
    beddingM2: round2(beddingAreaM2),
  };
}

/**
 * Рецептура бетонной смеси для ручной/бетонно-роторной подготовки на объекте.
 *
 * Объёмные доли «цемент : песок : щебень» — то, чем реально меряют на стройке
 * лопатами, и расход цемента на 1 м³ готового бетона. Вода — 0,5 л на 1 кг
 * цемента (водоцементное отношение ≈ 0,5, выше бетон становится пористым).
 */
export const CONCRETE_RECIPES: Record<ConcreteMark['mark'], {
  cementKgPerM3: number;
  sandM3PerM3: number;
  gravelM3PerM3: number;
  waterLPerM3: number;
  parts: string;
}> = {
  М200: { cementKgPerM3: 200, sandM3PerM3: 0.35, gravelM3PerM3: 0.75, waterLPerM3: 100, parts: '1 : 2 : 4' },
  М250: { cementKgPerM3: 250, sandM3PerM3: 0.35, gravelM3PerM3: 0.75, waterLPerM3: 125, parts: '1 : 2 : 4' },
  М300: { cementKgPerM3: 300, sandM3PerM3: 0.42, gravelM3PerM3: 0.82, waterLPerM3: 150, parts: '1 : 1,5 : 3' },
  М350: { cementKgPerM3: 350, sandM3PerM3: 0.45, gravelM3PerM3: 0.85, waterLPerM3: 175, parts: '1 : 1,3 : 2,8' },
};

/** Расход компонентов на заданный объём бетона */
export function computeConcreteBatch(
  volumeM3: number,
  mark: ConcreteMark['mark']
): {
  cementKg: number;
  sandM3: number;
  gravelM3: number;
  waterL: number;
  cementBags50: number;
  parts: string;
} {
  const recipe = CONCRETE_RECIPES[mark];
  return {
    cementKg: round1(volumeM3 * recipe.cementKgPerM3),
    sandM3: round2(volumeM3 * recipe.sandM3PerM3),
    gravelM3: round2(volumeM3 * recipe.gravelM3PerM3),
    waterL: round1(volumeM3 * recipe.waterLPerM3),
    // Мешок цемента ПЦ 400 — 50 кг, мешков нужно с запасом → вверх
    cementBags50: Math.ceil((volumeM3 * recipe.cementKgPerM3) / 50),
    parts: recipe.parts,
  };
}

/* ========================================================================== */
/*                       АРМАТУРА: НАХЛЁСТ И МАССА                            */
/* ========================================================================== */

/** Масса 1 погонного метра арматурного стержня, кг (π·d²/4·7850) */
export function rebarWeightPerMeterKg(diameterMm: number): number {
  const d = mmToM(diameterMm);
  return round3(Math.PI * (d * d) / 4 * STEEL_DENSITY_KG_M3);
}

/** Минимальный нахлёст стержня, м */
export function rebarOverlapM(
  barLengthM: number,
  diameterMm: number,
  overlapPercent: number
): number {
  const byPercent = barLengthM * (clamp(overlapPercent, 0, 100) / 100);
  const byAbsolute = Math.max(OVERLAP_ABSOLUTE_MIN_MM / 1000, diameterMm * OVERLAP_DIAMETERS_FACTOR / 1000);
  return round3(Math.max(byPercent, byAbsolute));
}

export interface RebarInput {
  /** Общая длина каркаса в проекте (полная длина стержней без нахлёстов), м */
  totalRunM: number;
  /** Диаметр стержня, мм */
  diameterMm: number;
  /** Длина стержня от завода, м */
  barLengthM: number;
  /** Нахлёст, % от длины стержня (10–12) */
  overlapPercent: number;
  /** Шаг стержней в конструкции, м (для подсчёта числа стержней) */
  spacingM?: number;
  /** Длина ряда стержней в конструкции, м (число рядов = длина / шаг) */
  layLengthM?: number;
}

export interface RebarResult {
  /** Нахлёст на стык, м */
  overlapM: number;
  /** Полезный шаг стержня вдоль линии: длина минус нахлёст, м */
  effectiveStepM: number;
  /** Число стержней вдоль одной линии */
  barsPerLine: number;
  /** Число рядов (сеток) */
  layersCount: number;
  /** Суммарная длина металла с учётом нахлёстов, м */
  totalLengthM: number;
  /** Масса металла, кг */
  totalWeightKg: number;
  /** Масса металла, т */
  totalWeightT: number;
  /** Проволока для вязки, кг (≈ 40 % массы металла) */
  wireKg: number;
}

/**
 * Армирование с нормативным нахлёстом.
 *
 * Нахлёст берётся как МАКСИМУМ из трёх требований:
 *   1) доля от длины стержня (10–12 % по ТЗ) — экономия металла;
 *   2) не менее 250 мм — абсолютный минимум для связывания узла;
 *   3) не менее 20 диаметров — прочность стыка, иначе металл рвётся по нахлёсту.
 *
 * Число стержней округляется ВВЕРХ: лучше купить лишний стержень, чем получить
 * провал шага сетки в центре плиты, который бригада потом «добьёт» сваркой.
 */
export function computeRebar(input: RebarInput): RebarResult {
  const barLengthM = Math.max(0.1, input.barLengthM);
  const overlapM = rebarOverlapM(barLengthM, input.diameterMm, input.overlapPercent);
  const effectiveStepM = Math.max(0.01, barLengthM - overlapM);

  const barsPerLine = input.spacingM && input.spacingM > 0
    ? Math.floor(input.totalRunM / input.spacingM) + 1
    : Math.ceil(input.totalRunM / barLengthM);
  const layersCount = input.layLengthM && input.spacingM && input.spacingM > 0
    ? Math.floor(input.layLengthM / input.spacingM) + 1
    : 1;

  const barsTotal = barsPerLine * layersCount;
  const totalLengthM = barsTotal * barLengthM;
  const totalWeightKg = totalLengthM * rebarWeightPerMeterKg(input.diameterMm);

  return {
    overlapM,
    effectiveStepM: round3(effectiveStepM),
    barsPerLine,
    layersCount,
    totalLengthM: round1(totalLengthM),
    totalWeightKg: round1(totalWeightKg),
    totalWeightT: round3(totalWeightKg / 1000),
    // 40 % массы металла на проволоку — практическая норма для вязки вручную
    wireKg: round1(totalWeightKg * 0.4),
  };
}

/* ========================================================================== */
/*                        КЛАДКА: СТЕНА ИЗ БЛОКОВ                            */
/* ========================================================================== */

export interface WallOpening {
  /** Ширина проёма, мм */
  widthMm: number;
  /** Высота проёма, мм */
  heightMm: number;
  /** Количество таких проёмов, шт */
  count?: number;
  /** Подпись для сметы */
  label?: string;
}

export interface MasonryInput {
  /** Длина стены по оси, м */
  lengthM: number;
  /** Высота стены от уровня кладки, м */
  heightM: number;
  /** Типоразмер блока */
  blockSize: BlockSizeKey;
  /** Проёмы (окна, двери) */
  openings?: WallOpening[];
  /** Запас на бой и подрезку, % (5–7) */
  breakagePercent?: number;
  /** Толщина шва, мм (тонкий шов 2–3) */
  jointMm?: number;
}

export interface MasonryResult {
  /** Объём кладки без вычета проёмов, м³ */
  grossVolumeM3: number;
  /** Площадь стены без проёмов, м² */
  grossAreaM2: number;
  /** Суммарная площадь проёмов, м² */
  openingsAreaM2: number;
  /** Площадь стены за вычетом проёмов, м² */
  netAreaM2: number;
  /** Объём кладки за вычетом проёмов, м³ */
  netVolumeM3: number;
  /** Объём на вырубку проёмов (с отходом 3 %), м³ */
  cuttingVolumeM3: number;
  /** Число рядов кладки */
  rowsCount: number;
  /** Число блоков в ряду */
  blocksPerRow: number;
  /** Блоков по рядам, без запаса */
  blocksByRows: number;
  /** Блоков по кубатуре, без запаса */
  blocksByVolume: number;
  /** Блоков к закупке с запасом на бой (округлено вверх) */
  blocksToOrder: number;
  /** Доля запаса, применённая к расчёту, % */
  breakageAppliedPercent: number;
  /** Расход клея на кладку, кг */
  mortarKg: number;
  /** Мешков клея по 25 кг (вверх) */
  mortarBags: number;
  /** Паллет для перевозки */
  palletsCount: number;
}

/**
 * Кладка из блоков: объём, блоки с запасом на бой и клей.
 *
 * Объём считается ТРЕМЯ независимыми способами, и калькулятор берёт худший:
 *
 *   1. по кубатуре: объём стены ÷ кубатура блока — «сколько блоков в кубе»;
 *   2. по рядам:    высота ÷ высота ряда, длина ÷ длина блока — так реально
 *                   кладёт бригада, с учётом швов и доборных элементов;
 *   3. проёмы:      вычитаются и из объёма, и из числа рядов/блоков.
 *
 * Берётся максимум (1) и (2): если ряд даёт больше блоков, чем кубатура, значит
 * по краям стены остаются доборные элементы и их нужно купить. Экономить на этом
 * нельзя — недостача обнаружится уже на кладке, когда возить нечем.
 *
 * Клей берётся от ЧИСТОГО объёма кладки (без проёмов), потому что в проёмах
 * клея нет, но добавляется объём вырубки — он идёт отдельной строкой.
 */
export function computeMasonry(input: MasonryInput): MasonryResult {
  const size = BLOCK_SIZES[input.blockSize];
  const blockVolumeM3 = BLOCK_VOLUME_M3[input.blockSize];
  const jointM = (input.jointMm ?? JOINT_THICKNESS_MIN_MM) / 1000;
  const thicknessM = mmToM(size.widthMm);
  const wallAreaM2 = areaM2(input.lengthM, input.heightM);
  const grossVolumeM3 = wallAreaM2 * thicknessM;

  // Проёмы
  const openings = input.openings ?? [];
  const openingsAreaM2 = openings.reduce(
    (acc, opening) => acc + openingAreaM2(opening.widthMm, opening.heightMm, opening.count ?? 1),
    0
  );
  const netAreaM2 = Math.max(0, wallAreaM2 - openingsAreaM2);
  const netVolumeM3 = netAreaM2 * thicknessM;
  const cuttingVolumeM3 = netVolumeM3 * (OPENING_CUT_WASTE_PERCENT / 100);

  // Считаем по рядам с учётом швов
  const effectiveRowHeightM = mmToM(size.heightMm) + jointM;
  const effectiveBlockLengthM = mmToM(size.lengthMm) + jointM;
  const rowsTotal = Math.floor(mmToM(input.heightM) / effectiveRowHeightM);
  const blocksPerRowTotal = Math.floor(input.lengthM / effectiveBlockLengthM);

  // Проёмы «съедают» ряды: в ряду с оконным проёмом блоков меньше.
  // Считаем площадь проёмов, переведённую в число блоков ряда.
  const blocksLostToOpenings = openings.reduce((acc, opening) => {
    const openingArea = openingAreaM2(opening.widthMm, opening.heightMm, opening.count ?? 1);
    const blockFaceArea = mmToM(size.lengthMm) * mmToM(size.heightMm);
    return acc + openingArea / blockFaceArea;
  }, 0);

  const rowsCount = Math.max(0, rowsTotal);
  const blocksByRows = Math.max(0, rowsCount * blocksPerRowTotal - blocksLostToOpenings);

  const blocksByVolume = netVolumeM3 / blockVolumeM3;

  // Запас на бой и подрезку
  const breakageAppliedPercent = clamp(input.breakagePercent ?? BREAKAGE_DEFAULT_PERCENT, 0, 20);
  const base = Math.max(blocksByRows, blocksByVolume);
  const blocksToOrder = Math.ceil(base * (1 + breakageAppliedPercent / 100));

  // Клей — от чистого объёма кладки + вырубка проёмов (на вырубку клей не нужен,
  // но подрезка по краям проёмов требует клея, поэтому берём от объёма с вырубкой)
  const mortarVolumeM3 = netVolumeM3 + cuttingVolumeM3;
  const mortarKg = mortarVolumeM3 * MORTAR_KG_PER_M3;
  const blocksPerPallet = BLOCKS_PER_PALLET[input.blockSize];

  return {
    grossVolumeM3: round3(grossVolumeM3),
    grossAreaM2: round2(wallAreaM2),
    openingsAreaM2: round2(openingsAreaM2),
    netAreaM2: round2(netAreaM2),
    netVolumeM3: round3(netVolumeM3),
    cuttingVolumeM3: round3(cuttingVolumeM3),
    rowsCount,
    blocksPerRow: blocksPerRowTotal,
    blocksByRows: Math.ceil(blocksByRows),
    blocksByVolume: Math.ceil(blocksByVolume),
    blocksToOrder,
    breakageAppliedPercent,
    mortarKg: round1(mortarKg),
    mortarBags: Math.ceil(mortarKg / 25),
    // Паллет считаем «нарезкой» из палитры: сколько блоков влезает на паллет,
    // столько и едет одним рейсом. Часть паллет приходится на подрезку.
    palletsCount: Math.max(1, Math.ceil(blocksToOrder / blocksPerPallet)),
  };
}

/* ========================================================================== */
/*                           СКАТНАЯ КРОВЛЯ: СКАТЫ                          */
/* ========================================================================== */

/** Длина ската по теореме Пифагора, м (пролёт по горизонтали, подъём) */
export function slopeLengthM(runM: number, riseM: number): number {
  return Math.sqrt(clamp(runM, 0, 1e6) ** 2 + clamp(riseM, 0, 1e6) ** 2);
}

/** Уклон в процентах */
export function slopePercent(runM: number, riseM: number): number {
  if (runM <= 0) return 0;
  return (clamp(riseM, 0, 1e6) / runM) * 100;
}

export interface RoofInput {
  /** Пролёт здания (ширина), м */
  spanM: number;
  /** Длина здания, м */
  lengthM: number;
  /** Высота конька над перекрытием, м */
  ridgeHeightM?: number;
  /** Ширина свеса, м (по умолчанию 0,5 м — норма для РБ) */
  overhangM?: number;
  /** Расчётный уклон ската, % (по типу кровли) */
  slopePercent?: number;
  /** Форма: двускатная или четырёхскатная (вальмовая) */
  shape?: 'gable' | 'hip';
  /** Шаг стропил, м */
  rafterStepM?: number;
  /** Шаг обрешётки, м */
  battenStepM?: number;
  /** Толщина утеплителя в кровельном пироге, мм */
  insulationMm?: number;
}

export interface RoofGeometry {
  /** Уклон ската, % */
  slopePercent: number;
  /** Угол ската, ° */
  slopeAngleDeg: number;
  /** Длина ската (стропило), м */
  slopeLengthM: number;
  /** Ширина ската с учётом свеса, м */
  slopeWidthM: number;
  /** Площадь одного ската, м² */
  slopeAreaM2: number;
  /** Число скатов */
  slopesCount: number;
  /** Общая площадь кровли (включая свесы), м² */
  totalAreaM2: number;
  /** Площадь двухскатного ската без треугольных свесов */
  trapezoidAreaM2: number;
  /** Площадь треугольных (вальмовых) свесов, м² */
  triangleAreaM2: number;
  /** Число стропильных ног */
  raftersCount: number;
  /** Объём стропильной древесины, м³ */
  rafterVolumeM3: number;
  /** Число стропил в связи с шагом */
  rafterStepM: number;
  /** Объём обрешётки, м³ */
  battenVolumeM3: number;
  /** Площадь стропильной системы (пирога) */
  underlaymentAreaM2: number;
  /** Объём утеплителя, м³ */
  insulationM3: number;
  /** Длина конька, м */
  ridgeLengthM: number;
  /** Длина водосточных свесов (с двух сторон), м */
  eavesLengthM: number;
}

/**
 * Геометрия скатной кровли.
 *
 * Двускатная (фронтонная) форма — два прямоугольных ската и два треугольных
 * свеса (фронтоны). Именно поэтому считаются ДВЕ площади: прямоугольная часть
 * и треугольники. Прораб в смете часто пишет только «L × скат» и забывает
 * треугольники — а это до 5–7 % кровли на небольших домах.
 *
 * Четырёхскатная (вальмовая) — четыре ската-трапеции, свесов нет в торцах,
 * но конёк вдвое короче.
 */
export function computeRoof(input: RoofInput): RoofGeometry {
  const overhang = Math.max(0, input.overhangM ?? 0.5);
  const slopePct = Math.max(1, input.slopePercent ?? 20);
  const riseM = (input.spanM / 2) * (slopePct / 100);
  const actualRidge = input.ridgeHeightM ?? riseM;
  const effectiveRise = Math.max(actualRidge, input.spanM / 2 * (slopePct / 100));
  const runM = input.spanM / 2;

  const slope = slopeLengthM(runM, effectiveRise);
  const slopeWidthM = input.lengthM + 2 * overhang;
  const angle = (Math.atan2(effectiveRise, runM) * 180) / Math.PI;

  const shape = input.shape ?? 'gable';
  const slopesCount = shape === 'gable' ? 2 : 4;

  // Прямоугольная часть ската: от конька до свеса, без треугольного фронтона
  const trapezoidAreaM2 = slope * slopeWidthM * (shape === 'gable' ? 2 : 1);
  // Треугольные свесы фронтонов: равнобедренный треугольник основанием = пролёт
  const triangleHeightM = effectiveRise - (overhang * slopePct) / 100;
  const triangleAreaM2 = shape === 'gable'
    ? 2 * (input.spanM * Math.max(0, triangleHeightM)) / 2
    : 2 * (input.spanM / 2) * (input.spanM / 4);

  const totalAreaM2 = trapezoidAreaM2 + triangleAreaM2;

  const rafterStepM = Math.max(0.3, input.rafterStepM ?? 0.9);
  const raftersCount = Math.max(2, Math.ceil(slopeWidthM / rafterStepM) * 2 + (shape === 'hip' ? 2 : 0));
  // Объём стропильной древесины: число ног × длина ската × сечение доски
  const rafterSectionM2 = mmToM(RAFTER_BOARD.widthMm) * mmToM(RAFTER_BOARD.thicknessMm);
  const rafterVolumeM3 = raftersCount * slope * rafterSectionM2 * (shape === 'hip' ? 1.1 : 1);

  const battenStepM = Math.max(0.2, input.battenStepM ?? 0.3);
  const battenSectionM2 = 0.05 * 0.05;
  const battenVolumeM3 = (totalAreaM2 / battenStepM) * battenSectionM2;

  const insulationThicknessM = mmToM(input.insulationMm ?? 200);

  return {
    slopePercent: round2(slopePct),
    slopeAngleDeg: round1(angle),
    slopeLengthM: round2(slope),
    slopeWidthM: round2(slopeWidthM),
    slopeAreaM2: round2(trapezoidAreaM2),
    slopesCount,
    totalAreaM2: round2(totalAreaM2),
    trapezoidAreaM2: round2(trapezoidAreaM2),
    triangleAreaM2: round2(triangleAreaM2),
    raftersCount,
    rafterVolumeM3: round3(rafterVolumeM3),
    rafterStepM,
    battenVolumeM3: round3(battenVolumeM3),
    underlaymentAreaM2: round2(totalAreaM2 * 1.15),
    insulationM3: round3(totalAreaM2 * insulationThicknessM),
    // Конёк двускатной идёт по всей длине здания, у вальмовой — до половины
    ridgeLengthM: round2(shape === 'gable' ? slopeWidthM : slopeWidthM * 0.6),
    eavesLengthM: round2(slopeWidthM * 2),
  };
}

/* ========================================================================== */
/*                  ШТУКАТУРКА И СТЯЖКА: РАСХОД СУХИХ СМЕСЕЙ                   */
/* ========================================================================== */

export interface MixInput {
  /** Площадь отделки, м² */
  areaM2: number;
  /** Толщина слоя, мм */
  thicknessMm: number;
  /** Расход на 1 мм слоя, кг/м² (из паспорта марки) */
  kgPerM2PerMm: number;
  /** Фасовка мешка, кг */
  bagKg: number;
  /** Запас на потери и брак, % */
  wastePercent?: number;
}

export interface MixResult {
  /** Объём слоя, м³ */
  volumeM3: number;
  /** Масса сухой смеси без запаса, кг */
  dryMixKg: number;
  /** Масса с запасом, кг */
  dryMixWithWasteKg: number;
  /** Число мешков (округление вверх — недобор мешка = недобор работы) */
  bags: number;
  /** Число мешков без запаса */
  bagsExact: number;
  /** Мешки к докупке сверх целых */
  extraBags: number;
}

/**
 * Расход сухой смеси.
 *
 * Норма расхода приходит из паспорта конкретной марки (1,5–1,7 кг/м²/мм для
 * штукатурки, 1,8–2,0 для стяжки), а не берётся «средним»: мешки Тайфун и
 * Илмакс отличаются на десятые доли, и на площади 200 м² это десятки килограммов.
 *
 * Мешки округляются ВВЕРХ. Прораб считает мешками, а не килограммами, и
 * «ровно 48,3 мешка» на объекте превращается в нехватку.
 */
export function computeMixConsumption(input: MixInput): MixResult {
  const area = clamp(input.areaM2, 0, 1e6);
  const thicknessM = mmToM(input.thicknessMm);
  // Норма расхода задана на 1 мм слоя, поэтому толщину берём в миллиметрах:
  // расход, кг = площадь, м² × толщина, мм × норма, кг/(м²·мм)
  const dryMixKg = area * input.thicknessMm * input.kgPerM2PerMm;
  const dryMixWithWasteKg = dryMixKg * (1 + clamp(input.wastePercent ?? 5, 0, 50) / 100);
  const bagsExact = dryMixWithWasteKg / Math.max(1, input.bagKg);
  const bags = Math.ceil(bagsExact);
  return {
    volumeM3: round3(area * thicknessM),
    dryMixKg: round1(dryMixKg),
    dryMixWithWasteKg: round1(dryMixWithWasteKg),
    bags,
    bagsExact: round2(bagsExact),
    extraBags: Math.max(0, bags - Math.floor(bagsExact)),
  };
}

export interface ScreedComponents {
  /** Цемент ПЦ 400, кг (для «классической» стяжки из раствора) */
  cementKg: number;
  /** Цемент, мешков по 50 кг */
  cementBags50: number;
  /** Песок, м³ */
  sandM3: number;
  /** Вода, л */
  waterL: number;
  /** Пропорция «цемент : песок» */
  parts: string;
}

/**
 * Состав классической стяжки «цемент + песок» (без финишной смеси).
 *
 * Пропорция 1 : 3 по объёму для стяжки толщиной до 50 мм. Для тонких стяжек
 * (< 30 мм) берут 1 : 2, поэтому толщина входит в расчёт пропорции.
 */
export function computeScreedComponents(volumeM3: number, thicknessMm: number): ScreedComponents {
  const parts = thicknessMm < 30 ? '1 : 2' : '1 : 3';
  const sandPart = thicknessMm < 30 ? 2 : 3;
  const cementBulkM3 = volumeM3 / (1 + sandPart) / 1.15;
  const sandM3 = cementBulkM3 * sandPart;
  // Насыпная плотность цемента ПЦ 400 ≈ 1500 кг/м³, мешок — 50 кг
  const cementKg = cementBulkM3 * 1500;
  return {
    cementKg: round1(cementKg),
    cementBags50: Math.ceil(cementKg / 50),
    sandM3: round2(sandM3),
    waterL: round1(cementKg * 0.5),
    parts,
  };
}

/* ========================================================================== */
/*                              Округления                                    */
/* ========================================================================== */

export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}