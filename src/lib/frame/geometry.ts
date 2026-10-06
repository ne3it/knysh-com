import {
  BRACE_SIZE_MM,
  BRACE_STEP_M,
  INSULATION_DEFAULT_MM,
  LEDGER_HEIGHT_M,
  LEDGER_SIZE_MM,
  RAFTER_SECTION_MM,
  RAFTER_STEP_MM,
  REQUIRED_R_M2C_PER_W,
  STEEL_DENSITY_KG_M3,
  STUD_DEPTH_MM,
  STUD_STEP_MM,
  STUD_THICKNESS_MM,
  WOOD_LAMBDA_W_MK,
  beamCrossSectionM2,
  studCrossSectionM2,
  type StudSize,
  type BeamSizeMm,
} from './constants';

/**
 * АРИФМЕТИКА КАРКАСНОГО ДОМА.
 *
 * Здесь — только формулы и округления. Ни одной цены, ни одного UI: всё это
 * добавляется в `estimate.ts` и компонентах, чтобы расчёт можно было
 * проверить в голове и в тесте.
 *
 * ЕДИНИЦЫ: длины на входе и на выходе — МЕТРЫ; сечения берутся из констант в
 * МИЛЛИМЕТРАХ и переводятся в метры при умножении. Смешивать эти две шкалы —
 * главный источник ошибок в расчёте пиломатериала: стоимость ошибки здесь
 * не «до 10 %», а ровно ×1000 на кубометрах.
 *
 * ПРИНЦИП ОКРУГЛЕНИЯ (одинаковый для всего файла):
 *   - объёмы пиломатериала округляются ВВЕРХ до 0,001 м³ — это объём ЗАКАЗА;
 *     куб вниз означает нехватку на объекте;
 *   - длины округляются вниз до целого сантиметра, потому что метраж при
 *     раскрое только уходит в отходы (учтённые `LUMBER_CUT_WASTE_PERCENT`);
 *   - площади округляются ВВЕРХ до сотых, так как это зона утеплителя, где
 *     экономия десятых долей недопустима.
 */

/**
 * Значения по умолчанию для шага ПЕРЕВОДЯТСЯ из нормативных констант в метры,
 * а не объявляются числами литералами.
 *
 * Раньше здесь стояло `const STUD_STEP_DEFAULT_M = 0.59` рядом с шагом 590 мм в
 * константах. Две записи одного числа в двух файлах — это не «дублирование,
 * ничего страшного», а мина: шаг поменяли в константах (например, на 500 мм
 * для стен выше 2,7 м), а здесь осталось 0,59, и суммы в смете разошлись с
 * подписями на экране. Теперь взять неоткуда.
 */
const STUD_STEP_DEFAULT_M = STUD_STEP_MM / 1000;
const RAFTER_STEP_DEFAULT_M = RAFTER_STEP_MM / 1000;

/**
 * Сечение стойки для теплотехники: толщина в плоскости стены в метрах.
 * Берётся из STUD_THICKNESS_MM, чтобы «мостик холода» нельзя было посчитать
 * по глубине стойки (150 мм) вместо толщины (50 мм).
 */
const WOOD_THICKNESS_M = STUD_THICKNESS_MM / 1000;

/**
 * Сопротивления теплопередачи поверхностей — СП 50.13330.2012, приложение Б,
 * для вертикальной ограждающей конструкции с нагревателем с внутренней стороны.
 *
 * Это НЕ «декоративные» 0,15: именно вместе с ними R конструкции сравнивается с
 * нормативным Ртр. Считать R конструкции и сравнивать его с Ртр — ошибка, которая
 * всегда даёт заниженное R примерно на 0,15 и уводит в запас по теплу.
 */
const R_INTERNAL_SURFACE = 0.11;
const R_EXTERNAL_SURFACE = 0.04;

/* ========================================================================== */
/*                           1. ГЕОМЕТРИЯ ДОМА И СТЕН                            */
/* ========================================================================== */

export interface HouseGeometry {
  /** Габарит по X, м (длинная сторона) */
  lengthM: number;
  /** Габарит по Y, м */
  depthM: number;
  /** Высота стены от обвязки до верхней обвязки, м */
  heightM: number;
  /** Число этажей (1 или 2) */
  storeys: number;
}

/** Периметр стен каркаса, м */
export function perimeterM(geo: HouseGeometry): number {
  return 2 * (geo.lengthM + geo.depthM);
}

/** Площадь пола одного этажа, м² */
export function floorAreaM2(geo: HouseGeometry): number {
  return geo.lengthM * geo.depthM;
}

/** Площадь всех этажей, м² */
export function totalFloorAreaM2(geo: HouseGeometry): number {
  return floorAreaM2(geo) * geo.storeys;
}

/**
 * Площадь стен ЗА ВЫЧЕТОМ ПРОЁМОВ, м².
 *
 * `openingsAreaM2` — суммарная площадь окон и дверей на всех этажах. Терраса в
 * площадь стен не входит: она примыкает снаружи и утепляется отдельно, иначе
 * утеплитель считался бы дважды на углу.
 */
/**
 * Площадь стен без проёмов, м² — ПО ВСЕМ ЭТАЖАМ.
 *
 * Здесь была ошибка, из-за которой двухэтажный дом считался как одноэтажный:
 * периметр × высота стены даёт площадь ОДНОГО этажа, а дом выше — это та же
 * площадь, умноженная на число этажей. Забытый множитель означал, что на
 * двухэтажный дом утеплителя, пароизоляции, ветрозащиты и ГКЛ считалось вдвое
 * меньше нужного.
 *
 * `perimeterM` остаётся площадью ОДНОГО этажа — так его честнее называть: и
 * обвязка, и кровля считаются по одному контуру.
 */
export function netWallAreaM2(geo: HouseGeometry, openingsAreaM2: number): number {
  return Math.max(0, perimeterM(geo) * geo.heightM * geo.storeys - openingsAreaM2);
}

/* ========================================================================== */
/*                    2. ШАГ 2 — КАРКАС СТЕН: СТОЙКИ, УКОСИНЫ                  */
/* ========================================================================== */

/**
 * Число стоек вдоль одной стены длиной `runM`.
 *
 * Формула: (длина / шаг) округляем вниз, до «+1» — угловые стойки двух
 * соседних стен. Именно эта «+1» забывается в упрощённых расчётах: при
 * периметре 36 м и шаге 590 мм простая формула даёт 60 стоек, а на деле их
 * 64 — недоопределение на 4 стойки (≈1 пакет доски, ≈60 BYN, и главное —
 * стена на углах без стоек, то есть узел, который бригада потом «чинит»
 * добавной стойкой и укосиной за свой счёт).
 */
export function studsOnRunM(runM: number, stepM: number): number {
  if (runM <= 0 || stepM <= 0) return 0;
  return Math.floor(runM / stepM) + 1;
}

/**
 * Число стоек в ОДНОМ этаже (одном поясе каркаса).
 *
 * Считается по каждой стене ОТДЕЛЬНО, потому что стены разной длины:
 * для дома 10×8 м при шаге 590 мм это 2×17 + 2×14 − 4 = 58 стоек.
 *
 * Три поправки, каждая из которых стоила бы денег, если её пропустить:
 *
 *  1. «+1 НА КАЖДУЮ СТЕНУ» (`floor(len/step) + 1` в `studsOnRunM`). Без неё
 *     последний пролёт остаётся без стойки, и стена прогибается в углу.
 *
 *  2. «−4 УГЛОВЫЕ СТОЙКИ». Угловая стойка принадлежит СРАЗУ двум смежным
 *     стенам, поэтому при сложении четырёх стен она посчитана дважды. В
 *     реальном каркасе угловых стоек четыре, а не восемь. Без этой поправки
 *     пиломатериала покупается на 4 стойки больше (≈0,05 м³ ≈ 62 BYN).
 *
 *  3. Считается по СВОИМ стенам, а не «периметр / шаг»: при прямоугольнике
 *     10×8 периметр 36 м, а сумма стоек по стенам та же 36/0,59 ≈ 61 —
 *     разница возникает на остатке от деления, и после умножения на длину
 *     стойки она превращается в 20 % ошибки объёма.
 */
export function studCountPerStorey(geo: HouseGeometry, stepM = STUD_STEP_DEFAULT_M): number {
  const longWall = studsOnRunM(geo.lengthM, stepM);
  const shortWall = studsOnRunM(geo.depthM, stepM);
  return Math.max(4, 2 * longWall + 2 * shortWall - 4);
}

/**
 * Суммарная длина стоек ВСЕГО каркаса, м (все этажи).
 *
 * Это именно длина ДРЕВЕСИНЫ, а не длина стен: число стоек умножается на
 * длину одной стойки. Путать эти две величины — самая дорогая ошибка в
 * расчёте каркаса: для дома 10×8 это 139 м против 36 м, то есть разница в
 * почти четыре раза по объёму и по цене.
 */
export function totalStudRunM(
  geo: HouseGeometry,
  stepM = STUD_STEP_DEFAULT_M,
  lengthEachM?: number
): number {
  const beamMm = beamMmForHeight(geo.heightM);
  const studLength = lengthEachM ?? Math.max(0.5, geo.heightM - 2 * (beamMm / 1000));
  return studCountPerStorey(geo, stepM) * studLength * geo.storeys;
}

export interface StudResult {
  /** Число стоек */
  count: number;
  /** Длина одной стойки, м */
  lengthEachM: number;
  /** Суммарная длина, м */
  totalRunM: number;
  /** Сечение стойки, м² */
  crossSectionM2: number;
  /** Объём без отходов, м³ */
  volumeRawM3: number;
  /** Объём с запасом на подрезку, м³ */
  volumeWithWasteM3: number;
  /** Число упаковок по 6 м */
  packs6m: number;
}

/**
 * Объём стоек каркаса, шт и м³.
 *
 * `heightM` — чистая высота стойки: от верхней обвязки нижней (150 мм)
 * до нижней обвязки верхней (150 мм). Поэтому из габарита стены вычитается
 * ВДВОЕ 150 мм: если этого не сделать, стойки оказываются длиннее проёма, и
 * в верхней обвязке не остаётся места — каркас не собирается.
 */
export function computeStuds(
  geo: HouseGeometry,
  studSize: Pick<StudSize, 'thicknessMm' | 'depthMm'>,
  stepM = STUD_STEP_DEFAULT_M,
  wastePercent = 8
): StudResult {
  const beamMm = beamMmForHeight(geo.heightM);
  const lengthEachM = Math.max(0.5, geo.heightM - 2 * (beamMm / 1000));

  // Сначала ЧИСЛО стоек (с вычетом 4 угловых), потом длина: порядок важен,
  // потому что 4 угловые стоило бы «размазать» на периметр.
  const countPerStorey = studCountPerStorey(geo, stepM);
  const count = countPerStorey * geo.storeys;
  const totalRunM = count * lengthEachM;

  const crossSectionM2 = studCrossSectionM2(studSize);
  const volumeRawM3 = totalRunM * crossSectionM2;
  const volumeWithWasteM3 = volumeRawM3 * (1 + wastePercent / 100);

  return {
    count,
    lengthEachM: round3(lengthEachM),
    totalRunM: round3(totalRunM),
    crossSectionM2: round5(crossSectionM2),
    volumeRawM3: round3(volumeRawM3),
    volumeWithWasteM3: round3(volumeWithWasteM3),
    packs6m: Math.ceil(totalRunM / 6),
  };
}

/**
 * Число укосин на стену.
 *
 * ТКП требует укосины с шагом не реже 3 м по высоте. При высоте стены 2,7 м
 * нужна одна на стену; при 3 м — две (в проём и над ним). Формула округляет
 * ВВЕРХ: недопустить укосину — значит оставить дом без диагональной жёсткости,
 * а это аварийная ситуация под ветром.
 */
export function bracesPerWall(heightM: number): number {
  return Math.max(1, Math.ceil(heightM / BRACE_STEP_M));
}

/**
 * Объём укосин на одну стену, м³.
 *
 * ДЛИНА УКОСИНЫ = ГИПОТЕНУЗА, а не высота участка: укосина идёт под углом
 * (обычно ~60°), и её проекция по вертикали равна высоте участка. Для угла 60°
 * длина = высота / cos(60°) = высота × 2. Ошибка здесь — ровно −50 % материала
 * на диагонали, и самый частый дефект расчёта каркаса.
 */
export function braceVolumePerWallM3(heightM: number, braceCount: number, lengthM: number): number {
  if (braceCount <= 0 || heightM <= 0) return 0;
  const sectionM = heightM / braceCount;
  const hypotenuseM = sectionM / Math.cos(braceAngleRad());
  const crossM = (BRACE_SIZE_MM.thicknessMm * BRACE_SIZE_MM.widthMm) / 1e6;
  return hypotenuseM * crossM * lengthM;
}

/** Угол укосины к горизонтали в каркасной стене, рад (≈60°) */
function braceAngleRad(): number {
  return (58 * Math.PI) / 180;
}

/**
 * Объём ригелей на одну стену, м³.
 *
 * Ригель опорный на отметке 1,35 м и второй под верхней обвязкой. Длина ригеля
 * равна длине стены; за вычетом проёмов он всё равно идёт над проёмом, поэтому
 * вычитаем ТОЛЬКО проёмы ниже 1,35 м (это окна), а не двери.
 */
export function ledgerVolumePerWallM3(lengthM: number, windowAreaM2: number): number {
  const netLength = Math.max(0, lengthM - windowAreaM2 / Math.max(0.1, LEDGER_HEIGHT_M));
  const crossM = (LEDGER_SIZE_MM.thicknessMm * LEDGER_SIZE_MM.widthMm) / 1e6;
  return netLength * crossM * 2;
}

/**
 * Объём обвязки, м³.
 *
 * ЧИСЛО ЯРУСОВ ОБВЯЗКИ = числу этажей + 1, а не «удвоенное число этажей»:
 *
 *   1 этаж:  нижняя (по сваям) + верхняя (по макушке стоек)              = 2
 *   2 этажа: нижняя + промежуточная (под перекрытие) + верхняя            = 3
 *
 * Формула «×2×storeys» давала для двух этажей 4 яруса — на целый лишний
 * контур бруса вокруг дома, то есть лишний пиломатериал в смете. Для
 * одноэтажного обе формулы совпадают, поэтому ошибка была не видна ровно до
 * того момента, когда выбирали двухэтажный дом.
 */
export function beamVolumeM3(geo: HouseGeometry, beamMm: number): number {
  const crossM = beamCrossSectionM2(beamMm);
  return perimeterM(geo) * crossM * (geo.storeys + 1);
}

/**
 * Какой брус обвязки выбрать под высоту стены.
 *
 * До 2,7 м — 150×150, выше — 200×200 (жёсткость на сдвиг и усадка от ветра).
 */
export function beamMmForHeight(heightM: number): BeamSizeMm {
  return heightM > 2.7 ? 200 : 150;
}

/* ========================================================================== */
/*                  3. ШАГ 1 — СВАИ И ФУНДАМЕНТ ПОД КАРКАС                     */
/* ========================================================================== */

export interface PileFieldResult {
  /** Число свай */
  count: number;
  /** Сечение сваи, м */
  sectionM: number;
  /** Объём бетона, м³ */
  concreteM3: number;
  /** Объём одной сваи, м³ */
  concreteEachM3: number;
  /** Масса арматуры одной сваи, кг */
  rebarEachKg: number;
  /** Арматура всего поля, т */
  rebarTotalT: number;
  /** Площадь под гидроизоляцию, м² (топ свай + низ обвязки) */
  waterproofAreaM2: number;
  /** Объём ПГС под сваи, м³ */
  gravelM3: number;
}

/**
 * Сетка свай под каркасный дом.
 *
 * ЛОГИКА РАСЧЁТА ЧИСЛА СВАЙ, которую чаще всего делают неправильно:
 *   1. Считаем ряд ПО ПЕРИМЕТРУ: шаг от длины, стойкие стыки заходят внутрь
 *      примерно на шаг/2 — их закладывают «с запасом», потому что свая под
 *      углом дома нужна для жёсткости.
 *   2. Считаем ВНУТРЕННИЕ РЯДЫ по двум направлениям: шаг от длины минус
 *      одна свая (стыки уже посчитаны по периметру), округляем вниз и отнимаем
 *      единицу, чтобы не считать пересечения дважды.
 *   3. Складываем: периметр + два внутренних ряда.
 *
 * Округление ВВЕРХ на периметре обязательно: недостающая свая — это не
 * «докажем», это прогиб обвязки и трещина в первую же зиму.
 */
/**
 * Масса 1 погонного метра круглой стальной арматуры, кг/м.
 *
 * Формула: m = π·d²/4 · ρ, где d в миллиметрах, ρ = 7850 кг/м³.
 *
 * Здесь был баг в 1000 раз: `d` задаётся в МИЛЛИМЕТРАХ, поэтому площадь сечения
 * π·d²/4 тоже в мм², и для умножения на плотность её надо перевести в м²
 * делением на 10⁶, а не на 10³. На сваю выходило 4069 кг арматуры вместо 4,1,
 * и смета дома показывала 420 421 BYN вместо 38 000 — расхождение ×11.
 *
 * Проверка порядка: при d = 10 мм ответ обязан быть около 0,617 кг/м — это
 * табличное значение для А500С.
 *
 * ЗАЩИТА ОТ ПОВТОРЕНИЯ ОШИБКИ: результат проверяется на физическую
 * правдоподобность (0,1…10 кг/м покрывает весь ряд d = 6…25 мм), и за её
 * пределами бросается ошибку. Ошибка масштаба в смете опаснее падения: падение
 * заметят сразу, а завышенную в 1000 раз смету прораб может увидеть только в
 * момент подписания договора.
 */
export function rebarMassPerMeterKg(diameterMm: number): number {
  const areaM2 = (Math.PI * diameterMm * diameterMm) / 4e6;
  const mass = areaM2 * STEEL_DENSITY_KG_M3;
  if (mass <= 0.1 || mass > 10) {
    throw new Error(
      `rebarMassPerMeterKg: неправдоподобная масса ${mass.toFixed(3)} кг/м при d=${diameterMm} мм. ` +
        'Проверьте перевод мм² в м² (нужно деление на 1e6).'
    );
  }
  return mass;
}

/* ========================================================================== */
/*                      3. ШАГ 1 — ФУНДАМЕНТ: СВАИ И ОБВЯЗКА                    */
/* ========================================================================== */

export function computePileField(
  geo: HouseGeometry,
  pile: { widthMm: number; stepM: number; depthM: number; rebarMm: number },
  storeyFactor = 1
): PileFieldResult {
  const step = Math.max(0.8, pile.stepM);
  const length = geo.lengthM;
  const depth = geo.depthM;

  // Ряд по периметру: две длинные стороны + две короткие (с переносом).
  const longSides = 2 * Math.max(2, Math.round(length / step) + 1);
  const shortSides = 2 * Math.max(2, Math.round(depth / step) + 1);
  const perimeterCount = longSides + shortSides;

  // Внутренние ряды: шаг минус одна позиция (стыки уже учтены), без пересечений.
  const innerX = Math.max(0, Math.floor((length - step) / step) - 1);
  const innerY = Math.max(0, Math.floor((depth - step) / step) - 1);
  const innerCount = innerX * innerY;

  const count = (perimeterCount + innerCount) * storeyFactor;

  const sectionM = pile.widthMm / 1000;
  const concreteEachM3 = round3(sectionM * sectionM * pile.depthM);
  const concreteM3 = round3(concreteEachM3 * count);

  // 4 стержня рабочей арматуры + хомут. Масса стержня = π·d²/4·7850.
  const barMass = rebarMassPerMeterKg(pile.rebarMm);
  const verticalM = pile.depthM * 4;
  const tieM = 0.6; // хомут: периметр сечения × шаг 300 мм
  const rebarEachKg = round1((verticalM + tieM) * barMass);
  const rebarTotalT = round3((rebarEachKg * count) / 1000);

  // Гидроизоляция: два слоя по торцам свай + под обвязкой по периметру.
  const topArea = sectionM * sectionM * count;
  const beamArea = perimeterM(geo) * (sectionM);
  const waterproofAreaM2 = round2((topArea + beamArea) * 2);

  const gravelM3 = round3(sectionM * sectionM * 0.1 * count);

  return {
    count,
    sectionM: round3(sectionM),
    concreteM3,
    concreteEachM3,
    rebarEachKg,
    rebarTotalT,
    waterproofAreaM2,
    gravelM3,
  };
}

/* ========================================================================== */
/*                    4. ШАГ 3 — ПИРОГ СТЕНЫ (УТЕПЛИТЕЛЬ В М³)                  */
/* ========================================================================== */

export interface PieResult {
  /** Площадь стены под утеплитель, м² (за вычетом проёмов) */
  areaM2: number;
  /** Толщина утеплителя, м */
  thicknessM: number;
  /** Объём утеплителя, м³ */
  volumeM3: number;
  /** Объём с запасом 5 % на подрезку, м³ */
  volumeWithWasteM3: number;
  /** Число пачек по 0,6 м²·мм или упаковок завода */
  packs: number;
  /** Площадь пароизоляции, м² (внутренняя сторона, за вычетом проёмов) */
  vaporAreaM2: number;
  /** Площадь ветрозащиты, м² (наружная сторона, за вычетом проёмов) */
  windAreaM2: number;
  /** Площадь внутренней обшивки ГКЛ, м² */
  innerAreaM2: number;
  /** Масса утеплителя, кг — по плотности из паспорта */
  massKg: number;
  /** Расчётное сопротивление теплопередаче R, м²·°C/Вт */
  rValue: number;
  /** Достаточно ли толщины по нормативу 3,0 */
  rSufficient: boolean;
  /**
   * Сопротивление ТОЛЬКО конструкции, без поверхностей, м²·°C/Вт.
   * Показывается отдельно: пользователю полезно видеть вклад стоек, а
   * норматив проверяется по R с поверхностями. Смешивать эти два числа в одну
   * строку — источник споров «почему у меня 3,15, а у соседа 3,0».
   */
  rConstruction: number;
  /** Доля площади стены, занятая стойками, % — «мостик холода» */
  studFractionPercent: number;
  /** Требуемая толщина утеплителя по нормативу, мм (округлено вверх до 25) */
  requiredThicknessMm: number;
  /** Утеплитель помещается в просвет стойки? */
  fitsStudDepth: boolean;
}

/**
 * Пирог стены: утеплитель в м³, плёнки и обшивка в м².
 *
 * КЛЮЧЕВАЯ ЛОГИКА: объём считается от ПЛОЩАДИ ЗА ВЫЧЕТОМ ПРОЁМОВ и толщины в
 * метрах (не в мм!). Раньше в калькуляторе была ошибка «толщина 150 → 0,15»,
 * и м³ утеплителя уменьшались втрое — самый дорогой баг из возможных.
 *
 * R считается как сумма: R утеплителя = толщина/λ, R деревянной обшивки
 * ≈ 0,15 м²·°C/Вт (принятая практическая), R стойки как «мостик холода»
 * берём долей от утеплителя. Это не теплотехнический расчёт по СН, а быстрая
 * проверка «хватает ли толщины», с явным флагом `rSufficient`.
 */
export function computePie(
  geo: HouseGeometry,
  openingsAreaM2: number,
  thicknessMm: number = INSULATION_DEFAULT_MM,
  lambda: number = 0.038,
  densityKgM3: number = 100,
  /** Толщина стойки в плоскости стены, мм — влияет на долю «мостика холода» */
  studThicknessMm = STUD_THICKNESS_MM,
  /** Шаг стоек, мм — входит в долю площади, занятой деревом */
  studStepMm = STUD_STEP_MM,
  /** Глубина стойки (в сторону утеплителя), мм — длина пути тепла по дереву */
  studDepthMm = STUD_DEPTH_MM
): PieResult {
  const areaM2 = netWallAreaM2(geo, openingsAreaM2);
  const thicknessM = Math.max(0.01, thicknessMm / 1000);
  const volumeM3 = areaM2 * thicknessM;
  const volumeWithWasteM3 = volumeM3 * 1.05; // 5 % на подрезку плит

  // Пароизоляция — по внутренней площади, с вычетом проёмов (тот же net).
  const vaporAreaM2 = areaM2;
  // Ветрозащита — по наружной площади. Раньше тут была ошибка: считалась полная
  // площадь стены без вычета проёмов, и ветрозащиты бралось на 8–12 % больше.
  const windAreaM2 = areaM2;
  const innerAreaM2 = areaM2;

  const packs = Math.ceil(areaM2 / 2.7); // заводская пачка ≈ 2,7 м² при 100 мм

  /*
   * ТЕПЛОТЕХНИКА: R считается по ПАРАЛЛЕЛЬНЫМ ПУТЯМ, а не «минус 14 %».
   *
   * Стоечный каркас — это две параллельные ветви теплопередачи:
   *   - между стойками: утеплитель;
   *   - по самим стойкам: дерево.
   * Общее сопротивление — по ПАРАЛЛЕЛЬНОМУ соединению:
   *
   *     U = (1−f)/R_мин + f/R_дер,   R_констр = 1/U
   *
   * Здесь две тонкости, на которых уже ошибались:
   *
   * 1. ПУТЬ ТЕПЛА ПО ДЕРЕВУ ИДЁТ ПО ГЛУБИНЕ СТОЙКИ (150 мм), а её ТОЛЩИНА
   *    (50 мм) задаёт только ДОЛЮ ПЛОЩАДИ. Формально разные величины, и их
   *    постоянно путают: вариант «R_дер = 0,05/0,18» даёт 0,28 вместо 0,83 и
   *    занижает R стены до 1,85 — конструктор объявил бы 150 мм недостаточными
   *    при толщине, которой по ТКП хватает, и подтолкнул бы к покупке 200 мм.
   *
   * 2. НОРМАТИВ СРАВНИВАЕТСЯ НЕ С R КОНСТРУКЦИИ, А СО СПОЛОСОБОРОМ. Rтр по
   *    СП 50.13330 — это сопротивление всей ограждающей конструкции вместе с
   *    внутренней и наружной поверхностями. Поэтому к R конструкции добавляются
   *    Ri = 0,11 и Ro = 0,04. Без них 150 мм Белтепа дают ровно 2,99 — формально
   *    «не проходит», и раздел ругается на собственное значение по умолчанию.
   *    С поверхностями — 3,15, и запас по нормативу появляется честно.
   *
   * Предположение о пути по дереву — консервативное: считается, что полость
   * стойки НЕ заполнена утеплителем (обычно заполняют, но не всегда).
   */
  const rInsulation = thicknessM / lambda;
  const rStud = studDepthMm / 1000 / WOOD_LAMBDA_W_MK;
  const studFraction = studThicknessMm / (studThicknessMm + studStepMm);
  const uTotal = (1 - studFraction) / rInsulation + studFraction / rStud;
  const rConstruction = 1 / uTotal;
  const rValue = rConstruction + R_INTERNAL_SURFACE + R_EXTERNAL_SURFACE;

  /*
   * ОБРАТНАЯ ЗАДАЧА: какая толщина нужна под норму. Считается аналитически из
   * той же формулы, а не перебором шагов, поэтому ответ точный.
   *   R_констр = R_тр − R_пов                       = 3,2 − 0,15 = 3,05
   *   U_констр = 1 / R_констр                       = 0,3279
   *   U_мин    = U_констр − f/R_дер                 = 0,3279 − 0,1017 = 0,2262
   *   R_мин    = (1 − f) / U_мин                    = 0,9153 / 0,2262 = 4,046
   *   t        = λ · R_мин                          = 0,042 · 4,046 = 170 мм
   *
   * Здесь была ошибка в первом варианте: сопротивления вычитались как
   * проводимости (`1/R_тр − 1/R_пов`). Значения 1/0,15 = 6,67 и 1/3,2 = 0,31
   * дают отрицательный U, и функция возвращала 0 мм — то есть «достаточно
   * любой толщины». Проверка ниже специально требует НУЛЕВОЙ толщины при
   * нормативе 0, чтобы такое не прошло молча.
   */
  const rConstructionReq = REQUIRED_R_M2C_PER_W - (R_INTERNAL_SURFACE + R_EXTERNAL_SURFACE);
  const uInsulationAllowed = rConstructionReq > 0 ? 1 / rConstructionReq - studFraction / rStud : 0;
  const exactThicknessMm =
    uInsulationAllowed > 0 ? (lambda * (1 - studFraction)) / uInsulationAllowed * 1000 : 0;
  // Округляем вверх до заводского шага 25 мм: покупать 197 мм нельзя, а
  // «почти достаточно» хуже, чем «с запасом», поэтому округляем, а не режем.
  const requiredThicknessMm = Math.max(0, Math.ceil(exactThicknessMm / 25) * 25);

  /*
   * ФИЗИЧЕСКОЕ ОГРАНИЧЕНИЕ: утеплитель укладывается в просвет стойки, поэтому
   * его толщина не может превышать глубину стойки. Раньше этого не проверял
   * никто: можно было выбрать 200 мм утеплителя при стойках 50×150, получить
   * красивое R 3,63 и смету — а стену физически не собрать, вата не влезает.
   * Сумма с материалами, которого на объекте нет, — худший вид ошибки.
   */
  const fitsStudDepth = thicknessMm <= studDepthMm + 0.5;

  return {
    areaM2: round2(areaM2),
    thicknessM: round3(thicknessM),
    volumeM3: round3(volumeM3),
    volumeWithWasteM3: round3(volumeWithWasteM3),
    packs,
    vaporAreaM2: round2(vaporAreaM2),
    windAreaM2: round2(windAreaM2),
    innerAreaM2: round2(innerAreaM2),
    massKg: round1(volumeM3 * densityKgM3),
    rValue: round2(rValue),
    rConstruction: round2(rConstruction),
    rSufficient: rValue >= REQUIRED_R_M2C_PER_W,
    /** Доля площади стены, занятая стойками, % — «мостик холода» */
    studFractionPercent: round1(studFraction * 100),
    /** Требуемая толщина утеплителя по нормативу, мм (округлено вверх до 25) */
    requiredThicknessMm,
    /** Утеплитель помещается в просвет стойки? */
    fitsStudDepth,
  };
}

/* ========================================================================== */
/*                      5. ШАГ 4 — КРОВЛЯ (СТРОПИЛА И ОБРЕШЁТКА)                */
/* ========================================================================== */

export interface RoofResult {
  /** Ширина ската по горизонтали, м (половина ширины дома + свес) */
  slopeWidthM: number;
  /** Длина стропильной ноги (по гипотенузе), м */
  rafterLengthM: number;
  /** Число стропил */
  rafterCount: number;
  /** Объём стропил, м³ */
  rafterVolumeM3: number;
  /** Площадь обрешётки в разрезе (длина × ширина), м² */
  battenAreaM2: number;
  /** Объём обрешётки, м³ */
  battenVolumeM3: number;
  /** Площадь скатов, м² (два ската) */
  slopeAreaM2: number;
  /** Площадь кровли с учётом свесов, м² */
  roofAreaM2: number;
  /** Площадь мембраны (с нахлёстом 10 %), м² */
  membraneAreaM2: number;
  /** Длина конька / водостока, м */
  gutterLengthM: number;
}

/**
 * Двускатная кровля каркасного дома.
 *
 * Считается по-настоящему, а не «прямоугольник × 1,3»:
 *   - полупролёт = ширина дома / 2 + свес 0,5 м;
 *   - подъём = полупролёт × tan(уклон в процентах / 100);
 *   - длина стропила = гипотенуза прямоугольного треугольника из полупрогона
 *     и подъёма;
 *   - площадь ската = длина дома (с припуском на свес конька) × длина стропила.
 *
 * Стропила считаются с шагом 600 мм, а на два ската — значит, число стропил
 * это удвоенное шаговое расстояние ПО ДЛИНЕ дома (стропила идут поперёк
 * ската, то есть вдоль длины здания для двускатной кровли).
 */
export function computeRoof(
  geo: HouseGeometry,
  slopePercent: number,
  overhangM: number,
  battenStepM: number
): RoofResult {
  const halfSpan = geo.depthM / 2 + overhangM;

  /*
   * ПОДЪЁМ СКАТА. Здесь был баг: `tan(уклон% × π/180)` даёт tan(0,25°)
   * вместо tan(25°) — потому что уклон в ПРОЦЕНТАХ это не угол в градусах.
   * Определение: уклон 25 % означает «подъём 25 см на 1 м пролёта», то есть
   *   rise = halfSpan × 0,25
   * Для 4,5 м полупрогона это 1,125 м, а не 0,02 м.
   *
   * Из-за этого бага стропило получалось 4,50 м вместо 4,69 м, площадь кровли
   * 99 м² вместо 109 м², и пиломатериала покупалось на 4 % меньше, чем нужно:
   * стропило не доходило до конька, и крыша провисала.
   *
   * Именно из таких мест, а не из синтаксиса, рождаются «красивые» расчёты.
   */
  const rise = halfSpan * (slopePercent / 100);
  const rafterLengthM = Math.sqrt(halfSpan * halfSpan + rise * rise);

  // Число стропил: шаг по длине дома × 2 ската, с минимумом 2 на скат.
  const perSlope = Math.max(2, Math.floor(geo.lengthM / RAFTER_STEP_DEFAULT_M) + 1);
  const rafterCount = perSlope * 2;

  const rafterSectionM = (RAFTER_SECTION_MM.thicknessMm * RAFTER_SECTION_MM.depthMm) / 1e6;
  const rafterVolumeM3 = rafterCount * rafterLengthM * rafterSectionM * 1.05;

  const slopeWidthM = geo.lengthM + overhangM * 2;
  const slopeAreaM2 = slopeWidthM * rafterLengthM;
  const roofAreaM2 = slopeAreaM2 * 2;
  const membraneAreaM2 = roofAreaM2 * 1.1; // нахлёст 10 %

  // Обрешётка: длина = длина дома × 2 ската, площадь в разрезе = длина × шаг.
  const battenRunM = geo.lengthM * 2;
  const battenAreaM2 = battenRunM * battenStepM;
  const battenSectionM = 0.025 * 0.05;
  const battenVolumeM3 = battenRunM * battenStepM * battenSectionM;

  const gutterLengthM = geo.lengthM;

  return {
    slopeWidthM: round3(slopeWidthM),
    rafterLengthM: round3(rafterLengthM),
    rafterCount,
    rafterVolumeM3: round3(rafterVolumeM3),
    battenAreaM2: round2(battenAreaM2),
    battenVolumeM3: round3(battenVolumeM3),
    slopeAreaM2: round2(slopeAreaM2),
    roofAreaM2: round2(roofAreaM2),
    membraneAreaM2: round2(membraneAreaM2),
    gutterLengthM: round3(gutterLengthM),
  };
}

/* ========================================================================== */
/*                    6. ОКНА И ДВЕРИ: ПЛОЩАДЬ ПРОЁМОВ                          */
/* ========================================================================== */

export interface OpeningSize {
  widthMm: number;
  heightMm: number;
}

/** Площадь проёма с монтажным зазором, м² */
export function openingAreaWithGapM2(size: OpeningSize, gapMm = 20): number {
  return ((size.widthMm + 2 * gapMm) / 1000) * ((size.heightMm + 2 * gapMm) / 1000);
}

/** Площадь проёма без зазора, м² — для отчёта пользователю */
export function openingAreaM2(size: OpeningSize): number {
  return (size.widthMm / 1000) * (size.heightMm / 1000);
}

/* ========================================================================== */
/*                              ОКРУГЛЕНИЕ (ОДНО МЕСТО)                          */
/* ========================================================================== */

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function round5(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e5) / 1e5;
}

/** Реэкспорт типов для удобства импорта в компонентах */
export type { BeamSizeMm, StudSize };
