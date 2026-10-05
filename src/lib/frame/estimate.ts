import {
  ELEMENT_SPECS,
  FRAME_STEPS,
  LUMBER_CUT_WASTE_PERCENT,
  MOUNT_GAP_MM,
  REQUIRED_R_M2C_PER_W,
  STUD_STEP_MM,
  TERRACE_DECK_VOLUME_PER_M2_M3,
  type FrameElementKind,
  type InsulationId,
} from './constants';
import {
  getFramePricedItem,
  getInsulationPricedItem,
  insulationPriceM3,
  type FramePriceItem,
  type FramePriceKey,
} from './prices';
import {
  beamVolumeM3,
  bracesPerWall,
  braceVolumePerWallM3,
  computePie,
  computePileField,
  computeRoof,
  computeStuds,
  openingAreaWithGapM2,
  perimeterM,
  type HouseGeometry,
  type PieResult,
  type PileFieldResult,
  type RoofResult,
  type StudResult,
} from './geometry';
import type { ConstructionRegionKey } from '@/lib/store/constructionStore';

/**
 * СБОРКА СМЕТЫ И ТЕХНИЧЕСКОГО ЗАДАНИЯ КАРКАСНОГО ДОМА.
 *
 * Здесь склеиваются три слоя, которые по отдельности ничего не знают друг о
 * друге: геометрия (сколько стоек), цены (сколько стоит куб) и нормативы
 * (почему именно так). Результат — готовый текст в BYN, который прораб
 * копирует в мессенджер заказчику или в бухгалтерию.
 *
 * ДВА ВАЖНЫХ РЕШЕНИЯ, КОТОРЫЕ ОТЛИЧАЮТ ЭТОТ ФАЙЛ ОТ ШАБЛОНА /const:
 *
 *  1. ПРОЁМЫ — ОТДЕЛЬНАЯ СЕКЦИЯ СМЕТЫ, а не вычет «где-то в коде». Окно и
 *     дверь стоят денег, стоят работы по монтажу, и заказчик обязан видеть их
 *     отдельной строкой. Забыть про это — значит отправить клиенту смету,
 *     где на 8 окон и 2 двери «не хватает» 4 500 BYN, и объяснить это уже
 *     нечем.
 *
 *  2. ТЗ — ЭТО НЕ СМЕТА С ДРУГИМ ЗАГОЛОВКОМ. Техническое задание содержит
 *     пошаговую технологическую карту (что, каким материалом, по какой норме,
 *     каким инструментом), а смета — только деньги. Для подрядчика это два
 *     разных документа: по ТЗ он покупает, по смете выставляет счёт.
 */

/* ========================================================================== */
/*                          ТИПЫ СМЕТЫ                                         */
/* ========================================================================== */

export interface FrameEstimateLine {
  /** Наименование позиции */
  label: string;
  /** Единица: м³, м², пог. м, шт, т, кг */
  unit: string;
  /** Количество (уже округлено по правилам расчёта) */
  qty: number;
  /** Цена за единицу, BYN, с региональным коэффициентом */
  price: number;
  /** Расшифровка нормы — печатается справа в смете, справа в ТЗ */
  note?: string;
  /** Какой шаг конструктора породил позицию — для группировки в ТЗ */
  stepId?: string;
}

export interface FrameEstimateTotals {
  material: number;
  labor: number;
  total: number;
  /** Доля материалов в процентах — полезно при разговоре с заказчиком */
  materialSharePercent: number;
}

/** Полный результат расчёта: слои + смета + готовый текст */
export interface FrameEstimateResult {
  lines: FrameEstimateLine[];
  totals: FrameEstimateTotals;
  estimateText: string;
  specText: string;
}

/* ========================================================================== */
/*                       ВХОДНЫЕ ДАННЫЕ РАСЧЁТА (ИЗ СТОРА)                      */
/* ========================================================================== */

export interface PlacedElement {
  kind: FrameElementKind;
  /** Позиция по длине стены, м — для подсчёта количества это не важно,
   *  но для ТЗ нужно знать, сколько проёмов на стену */
  positionM: number;
}

export interface FrameDesignInput {
  geo: HouseGeometry;
  region: ConstructionRegionKey;
  /** Типоразмер стойки */
  studSize: { thicknessMm: number; depthMm: number; label: string };
  /** Брус обвязки, мм */
  beamMm: number;
  /** Сваи */
  pile: { widthMm: number; stepM: number; depthM: number; rebarMm: number; label: string };
  /** Марка утеплителя и толщина, мм */
  insulation: { id: InsulationId; thicknessMm: number; brand: string; lambda: number; densityKgM3: number };
  /** Уклон кровли, % и материал */
  roof: { slopePercent: number; materialLabel: string; battenStepM: number };
  /** Проёмы, расставленные на схеме */
  elements: PlacedElement[];
  /** Шаг утепления перегородок (для справки в ТЗ) */
  stepMm?: number;
}

/* ========================================================================== */
/*                      1. ПЛОЩАДЬ ПРОЁМОВ И СТЕН                              */
/* ========================================================================== */

/**
 * Суммарная площадь проёмов всех стен и этажей, м² — С ЗАЗОРОМ.
 *
 * В расчёт идёт проём, а не изделие: стена теряет кусок БЕТОНА/УТЕПЛИТЕЛЯ
 * размером с проём, и монтажный зазор 2×20 мм — часть этого куска.
 */
export function totalOpeningsAreaM2(elements: PlacedElement[]): number {
  let sum = 0;
  for (const element of elements) {
    const spec = ELEMENT_SPECS[element.kind];
    if (spec) sum += openingAreaWithGapM2(spec, MOUNT_GAP_MM);
  }
  return round2(sum);
}

/** Число проёмов по видам — для ТЗ и для шапки сметы */
export function countByKind(elements: PlacedElement[]): Record<FrameElementKind, number> {
  const counts: Record<FrameElementKind, number> = { window: 0, door: 0, terrace: 0 };
  for (const element of elements) counts[element.kind] += 1;
  return counts;
}

/* ========================================================================== */
/*                   2. ПОШАГОВАЯ СБОРКА ПОЗИЦИЙ СМЕТЫ                          */
/* ========================================================================== */

/**
 * Считает ВСЕ слои конструктора разом и возвращает готовый результат.
 *
 * Считается одним вызовом из компонента в `useMemo`: пользователь переносит
 * окно мышью — стор меняется — `useMemo` пересчитывает всё. Функция
 * идемпотентна (никакого состояния внутри) и дешёва: даже двухэтажный дом
 * с 20 проёмами пересчитывается менее чем за 1 мс.
 */
export function computeFrameEstimate(input: FrameDesignInput): FrameEstimateResult {
  const { geo, region, elements } = input;

  const openingsAreaM2 = totalOpeningsAreaM2(elements);
  const counts = countByKind(elements);

  // ---- ШАГ 1: ФУНДАМЕНТ, СВАИ, ОБВЯЗКА ----
  const piles: PileFieldResult = computePileField(geo, input.pile);
  const beamVolume = beamVolumeM3(geo, input.beamMm);

  // ---- ШАГ 2: КАРКАС СТЕН ----
  const studStepM = STUD_STEP_MM / 1000;
  const studs: StudResult = computeStuds(geo, input.studSize, studStepM);
  const bracesCountPerWall = bracesPerWall(geo.heightM);
  const braceVolumeTotal = braceVolumePerWallM3(geo.heightM, bracesCountPerWall, geo.lengthM + geo.depthM) * 2;

  // ---- ШАГ 3: ПИРОГ ----
  const pie: PieResult = computePie(
    geo,
    openingsAreaM2,
    input.insulation.thicknessMm,
    input.insulation.lambda,
    input.insulation.densityKgM3
  );

  // ---- ШАГ 4: КРОВЛЯ ----
  const roof: RoofResult = computeRoof(geo, input.roof.slopePercent, 0.5, input.roof.battenStepM);

  /* ---------------------------------------------------------------------- */
  /*                       СБОРКА ПОЗИЦИЙ (МАТЕРИАЛЫ)                        */
  /* ---------------------------------------------------------------------- */
  const lines: FrameEstimateLine[] = [];

  const pushMaterial = (
    key: FramePriceKey,
    qty: number,
    note: string,
    stepId: string,
    priceOverride?: number
  ) => {
    const priced = getFramePricedItem(key, region);
    lines.push({
      label: priced.label,
      unit: priced.unit,
      qty,
      price: priceOverride ?? priced.total,
      note,
      stepId,
    });
  };

  const pushWork = (key: FramePriceKey, qty: number, note: string, stepId: string, priceOverride?: number) => {
    const priced = getFramePricedItem(key, region);
    lines.push({
      label: priced.label,
      unit: priced.unit,
      qty,
      price: priceOverride ?? priced.total,
      note,
      stepId,
    });
  };

  /* ---- Шаг 1: Обвязка и фундамент ---- */
  pushMaterial(
    'gravelPile',
    piles.gravelM3,
    `под ${piles.count} сваями по 0,1 м`,
    'foundation'
  );
  pushMaterial('concretePile', piles.concreteM3, `М250, ${piles.count} шт × ${piles.sectionM} м`, 'foundation');
  pushMaterial('rebarPile', piles.rebarTotalT, `А500С d${input.pile.rebarMm}, 4 стержня в сваю`, 'foundation');
  pushMaterial('rebarTie', round1(piles.rebarTotalT * 1000 * 0.3), '30 % массы на вязку', 'foundation');
  pushMaterial(
    input.beamMm >= 200 ? 'beam200' : 'beam150',
    round3(beamVolume),
    `обвязка ${input.beamMm}×${input.beamMm}, периметр ${round2(perimeterM(geo))} м × 2 яруса`,
    'foundation'
  );
  pushMaterial(
    'waterproofRoll',
    piles.waterproofAreaM2,
    'рубероид РКП-3, 2 слоя: под обвязкой и по торцам свай',
    'foundation'
  );
  pushWork('concretePileWork', piles.count, 'бурение/копка, опалубка, приёмка бетона', 'foundation');

  /* ---- Шаг 2: Стены ---- */
  pushMaterial(
    input.studSize.depthMm >= 200 ? 'stud50200' : 'stud50150',
    studs.volumeWithWasteM3,
    `${studs.count} стоек × ${round2(studs.lengthEachM)} м, шаг ${STUD_STEP_MM} мм, запас ${LUMBER_CUT_WASTE_PERCENT} %`,
    'walls'
  );
  pushMaterial(
    'boardSill',
    round3(perimeterM(geo) * 0.05 * 0.15),
    'нижняя обвязка стен по брусу фундамента',
    'walls'
  );
  pushMaterial(
    'boardBrace',
    round3(braceVolumeTotal + geo.lengthM * 0.025 * 0.1 * 2),
    `укосин ${bracesCountPerWall} на стену под 58°, ригели на отм. 1,35 м`,
    'walls'
  );
  pushMaterial(
    'fastener',
    round1(netWallAreaWithoutOpenings(geo, openingsAreaM2) * 0.45),
    'саморезы 4,2×75, скобы, уголки — 0,45 кг/м² каркаса',
    'walls'
  );
  pushWork(
    'frameAssembleWork',
    round2(netWallAreaWithoutOpenings(geo, openingsAreaM2)),
    'сборка каркаса + внешняя обшивка ОСП',
    'walls'
  );

  /* ---- Шаг 3: Пирог стены ---- */
  const insulationPriced = getInsulationPricedItem(input.insulation.id, input.insulation.thicknessMm, region);
  lines.push({
    label: insulationPriced.label,
    unit: 'м³',
    qty: pie.volumeWithWasteM3,
    price: insulationPriced.total,
    note: `R = ${round2(pie.rValue)} м²·°C/Вт (норматив ≥ ${REQUIRED_R_M2C_PER_W})`,
    stepId: 'pie',
  });
  pushMaterial(
    'vaporBarrier',
    pie.vaporAreaM2,
    'ПЭ 120 мкм, со стороны помещения',
    'pie'
  );
  pushMaterial('windMembrane', pie.windAreaM2, 'мембрана либо ОСП-3 9 мм (в замену)', 'pie');
  pushMaterial('gypsum', pie.innerAreaM2, 'ГКЛ 12,5 мм на каркас', 'pie');
  pushWork('sheathingWork', pie.areaM2, 'утепление + плёнки + обшивка', 'pie');

  /* ---- Шаг 4: Кровля ---- */
  pushMaterial(
    'rafterBoard',
    roof.rafterVolumeM3,
    `${roof.rafterCount} стропил по ${round2(roof.rafterLengthM)} м, шаг 600 мм`,
    'roof'
  );
  pushMaterial(
    'battenBoard',
    roof.battenVolumeM3,
    `обрешётка ${input.roof.materialLabel}, шаг ${Math.round(input.roof.battenStepM * 1000)} мм`,
    'roof'
  );
  pushMaterial('roofMembrane', roof.membraneAreaM2, 'ПВХ, нахлёст 10 %', 'roof');
  pushMaterial('profiledMetal', roof.roofAreaM2, `${input.roof.materialLabel}, свес 0,5 м`, 'roof');
  pushMaterial('gutter', roof.gutterLengthM, 'желоб + 2 трубы', 'roof');
  pushWork('roofWork', roof.roofAreaM2, 'стропильная система, обрешётка, кровля', 'roof');

  /* ---- ЭЛЕМЕНТЫ: окна, двери, терраса ---- */
  // Отдельная секция: проёмы — самостоятельные покупки, они не «внутри» каркаса.
  if (counts.window > 0) {
    const spec = ELEMENT_SPECS.window;
    lines.push({
      label: `Окно ПВХ 2-камерное ${spec.widthMm}×${spec.heightMm}`,
      unit: 'шт',
      qty: counts.window,
      price: round2(spec.priceByn),
      note: `проём +${MOUNT_GAP_MM} мм по периметру · ${spec.note}`,
      stepId: 'elements',
    });
    pushWork('windowInstall', counts.window, 'монтаж, откосы, отлив', 'elements');
  }
  if (counts.door > 0) {
    const spec = ELEMENT_SPECS.door;
    lines.push({
      label: `Дверь входная ${spec.widthMm}×${spec.heightMm}`,
      unit: 'шт',
      qty: counts.door,
      price: round2(spec.priceByn),
      note: `проём +${MOUNT_GAP_MM} мм по периметру · ${spec.note}`,
      stepId: 'elements',
    });
    pushWork('doorInstall', counts.door, 'монтаж в проём, герметизация', 'elements');
  }
  if (counts.terrace > 0) {
    const spec = ELEMENT_SPECS.terrace;
    const areaM2 = round2((spec.widthMm / 1000) * (spec.heightMm / 1000));
    lines.push({
      label: `Терраса ${spec.widthMm}×${spec.heightMm} (настил)`,
      unit: 'м²',
      qty: areaM2,
      price: round2(spec.priceByn / areaM2),
      note: `${spec.note} · лаги ${round3(TERRACE_DECK_VOLUME_PER_M2_M3)} м³/м²`,
      stepId: 'elements',
    });
    pushWork('terraceWork', areaM2, 'каркас, лаги, настил, ограждение', 'elements');
  }

  /* ---------------------------------------------------------------------- */
  /*                               ИТОГИ                                     */
  /* ---------------------------------------------------------------------- */
  const totals = computeFrameTotals(lines);

  /* ---------------------------------------------------------------------- */
  /*                      ТЕКСТ СМЕТЫ И ТЕКСТ ТЗ                             */
  /* ---------------------------------------------------------------------- */
  const object = `${geo.lengthM}×${geo.depthM} м, ${geo.storeys} эт., высота ${geo.heightM} м`;
  const estimateText = buildFrameEstimateText({
    title: 'Каркасный дом по ТКП 45-5.05-146-2009',
    object,
    region,
    lines,
    totals: [
      { label: 'Периметр стен', value: `${round2(perimeterM(geo))} м` },
      { label: 'Стоек в каркасе', value: `${studs.count} шт (шаг ${STUD_STEP_MM} мм)` },
      { label: 'Площадь стен (чистая)', value: `${round2(netWallAreaWithoutOpenings(geo, openingsAreaM2))} м²` },
      { label: 'Проёмов всего', value: `${openingsCount(elements)} шт` },
      { label: 'Утеплитель', value: `${pie.volumeWithWasteM3} м³ ${input.insulation.brand}` },
      { label: 'Теплопотери: R стены', value: `${round2(pie.rValue)} м²·°C/Вт` },
      { label: 'Кровля (2 ската)', value: `${roof.roofAreaM2} м², стропил ${roof.rafterCount}` },
      { label: 'Свай', value: `${piles.count} шт, бетон ${piles.concreteM3} м³` },
    ],
    footer:
      'Цены — средние по РБ (склад, без доставки крупногабаритным). ' +
      'Нормативная база: ТКП 45-5.05-146-2009, СН 5.03.01-2018, СН 2.01.01-2019. ' +
      `Проёмы заложены с монтажным зазором ${MOUNT_GAP_MM} мм по периметру. ` +
      'Шаг стоек 590 мм выбран под плиты утеплителя 600 мм без продуваемых щелей.',
  });

  const specText = buildFrameSpecText({
    geo,
    region,
    studLabel: input.studSize.label,
    beamMm: input.beamMm,
    pileLabel: input.pile.label,
    pileCount: piles.count,
    studs,
    bracesCountPerWall,
    pie,
    roof,
    roofMaterial: input.roof.materialLabel,
    battenStepM: input.roof.battenStepM,
    insulationBrand: input.insulation.brand,
    insulationThicknessMm: input.insulation.thicknessMm,
    insulationPrice: insulationPriceM3(input.insulation.id, input.insulation.thicknessMm),
    elements,
    totals,
  });

  return { lines, totals, estimateText, specText };
}

/** Площадь стен без проёмов (вспомогательное, чтобы не считать дважды) */
function netWallAreaWithoutOpenings(geo: HouseGeometry, openingsAreaM2: number): number {
  return Math.max(0, perimeterM(geo) * geo.heightM - openingsAreaM2);
}

/** Общее число проёмов (окна + двери, терраса не проём) */
function openingsCount(elements: PlacedElement[]): number {
  const counts = countByKind(elements);
  return counts.window + counts.door;
}

/* ========================================================================== */
/*                          3. ИТОГИ СМЕТЫ (МАТЕРИАЛЫ / РАБОТЫ)                  */
/* ========================================================================== */

/**
 * Итоги с разделением материалов и работ.
 *
 * Разделение — не бухгалтерия ради бухгалтерии: материалы и работа в
 * регионах дешевеют по-разному, и когда прораб «в среднем по РБ» видит
 * одно число, он не может проверить, из чего оно сложилось. Кроме того,
 * по разнице «материал vs работа» видно, не завышена ли бригада.
 */
export function computeFrameTotals(lines: FrameEstimateLine[]): FrameEstimateTotals {
  let material = 0;
  let labor = 0;
  for (const line of lines) {
    const sum = line.qty * line.price;
    if (line.label.startsWith('Работа')) labor += sum;
    else material += sum;
  }
  material = round2(material);
  labor = round2(labor);
  const total = round2(material + labor);
  return {
    material,
    labor,
    total,
    materialSharePercent: total > 0 ? round1((material / total) * 100) : 0,
  };
}

/* ========================================================================== */
/*                       4. ТЕКСТ СМЕТЫ (ДЛЯ КОПИРОВАНИЯ)                      */
/* ========================================================================== */

function buildFrameEstimateText(input: {
  title: string;
  object: string;
  region: ConstructionRegionKey;
  lines: FrameEstimateLine[];
  totals: Array<{ label: string; value: string }>;
  footer: string;
}): string {
  const regionLabel = input.region === 'minsk' ? 'Минск' : 'Регионы РБ';
  const lines: string[] = [];

  lines.push(`СМЕТА — ${input.title.toUpperCase()}`);
  lines.push(`Объект: ${input.object}`);
  lines.push(`Регион: ${regionLabel} · Валюта: BYN`);
  lines.push(`Нормативная база: ТКП 45-5.05-146-2009`);
  lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
  lines.push('');

  const labelWidth = Math.max(28, ...input.lines.map((line) => line.label.length));
  const unitWidth = Math.max(7, ...input.lines.map((line) => line.unit.length));

  let currentStep = '';
  input.lines.forEach((line) => {
    const stepLabel = line.stepId ? findStepTitle(line.stepId) : '';
    if (stepLabel && stepLabel !== currentStep) {
      currentStep = stepLabel;
      lines.push('');
      lines.push(`── ${stepLabel.toUpperCase()} ──`);
    }
    const sum = line.qty * line.price;
    lines.push(
      [
        line.label.padEnd(labelWidth, ' '),
        fmt(line.qty, 2).padStart(9, ' '),
        line.unit.padEnd(unitWidth, ' '),
        fmt(line.price, 2).padStart(10, ' '),
        fmt(sum, 2).padStart(13, ' '),
        line.note ? `  (${line.note})` : '',
      ].join(' ')
    );
  });

  const t = computeFrameTotals(input.lines);
  lines.push('');
  lines.push('─'.repeat(72));
  lines.push(`Материалы: ${fmt(t.material)} BYN (${t.materialSharePercent} %)`);
  lines.push(`Работы:     ${fmt(t.labor)} BYN (${round1(100 - t.materialSharePercent)} %)`);
  lines.push(`ВСЕГО:      ${fmt(t.total)} BYN`);

  lines.push('');
  lines.push('РАСЧЁТНЫЕ ПОКАЗАТЕЛИ');
  input.totals.forEach((item) => lines.push(`  ${item.label}: ${item.value}`));

  lines.push('');
  lines.push(input.footer);

  return lines.join('\n');
}

function findStepTitle(stepId: string): string {
  if (stepId === 'elements') return 'Окна, двери, терраса';
  const step = FRAME_STEPS.find((item) => item.id === stepId);
  return step ? `Шаг ${step.number}. ${step.title}` : '';
}

/* ========================================================================== */
/*                    5. ТЕКСТ ТЗ (ТЕХНИЧЕСКОГО ЗАДАНИЯ)                       */
/* ========================================================================== */

/**
 * Техническое задание: не деньги, а ТЕХНОЛОГИЯ.
 *
 * Формат — нумерованные шаги с нормативной ссылкой, ключевыми размерами и
 * допуском. Это то, что отдаётся прорабу на объект или в бригаду: по нему
 * проверяют, что «150×150 в обвязке, 590 мм шаг, гидроизоляция в два слоя»,
 * и по нему же бригада может принять работу у другой бригады.
 */
function buildFrameSpecText(input: {
  geo: HouseGeometry;
  region: ConstructionRegionKey;
  studLabel: string;
  beamMm: number;
  pileLabel: string;
  pileCount: number;
  studs: StudResult;
  bracesCountPerWall: number;
  pie: PieResult;
  roof: RoofResult;
  roofMaterial: string;
  battenStepM: number;
  insulationBrand: string;
  insulationThicknessMm: number;
  insulationPrice: number;
  elements: PlacedElement[];
  totals: FrameEstimateTotals;
}): string {
  const counts = countByKind(input.elements);
  const stepMm = STUD_STEP_MM;
  const lines: string[] = [];

  lines.push(`ТЕХНИЧЕСКОЕ ЗАДАНИЕ — КАРКАСНЫЙ ДОМ`);
  lines.push(`ТКП 45-5.05-146-2009 · СН 5.03.01-2018 · СН 2.01.01-2019`);
  lines.push('');
  lines.push(`ОБЪЕКТ: ${input.geo.lengthM} × ${input.geo.depthM} м, ${input.geo.storeys} этаж, высота стен ${input.geo.heightM} м`);
  lines.push(`Регион: ${input.region === 'minsk' ? 'Минск' : 'Регионы РБ'}`);
  lines.push('');
  lines.push('='.repeat(72));

  /* ---- Шаг 1 ---- */
  lines.push('');
  lines.push(`ШАГ 1. ОБВЯЗКА И ФУНДАМЕНТ`);
  lines.push(`  · Сваи: ${input.pileLabel}, ${input.pileCount} шт. Бетон М250 (С16/20).`);
  lines.push(`  · Арматура А500С, 4 стержня в сваю, нахлёст 40Ø.`);
  lines.push(`  · Гидроизоляция: рулонная, 2 слоя (по торцам свай + под обвязкой).`);
  lines.push(`  · Обвязка: брус ${input.beamMm}×${input.beamMm} мм, замкнутый контур.`);
  lines.push(`  · Допуск: горизонтальность обвязки ±2 мм на 1 м пролёта.`);

  /* ---- Шаг 2 ---- */
  lines.push('');
  lines.push(`ШАГ 2. СТЕНЫ`);
  lines.push(`  · Стойка: ${input.studLabel}, шаг ${stepMm} мм (под плиты утеплителя 600 мм).`);
  lines.push(`  · Стойки в каркасе: ${input.studs.count} шт по ${fmt(input.studs.lengthEachM)} м.`);
  lines.push(`  · Укосины 25×100 мм: ${input.bracesCountPerWall} на стену, под углом ~58°.`);
  lines.push(`  · Ригели 25×100 мм: опорный на отм. 1,35 м и под перекрытием.`);
  lines.push(`  · Обшивка снаружи: ОСП-3 9 мм или мембрана.`);
  lines.push(`  · Допуск: вертикальность стойки ±2 мм на 1 м высоты.`);

  /* ---- Шаг 3 ---- */
  lines.push('');
  lines.push(`ШАГ 3. ПИРОГ СТЕНЫ`);
  lines.push(`  · Утеплитель: ${input.insulationBrand}, ${input.insulationThicknessMm} мм.`);
  lines.push(`  · Объём утеплителя: ${fmt(input.pie.volumeWithWasteM3)} м³ (с запасом 5 % на подрезку).`);
  lines.push(`  · Ориентир закупки: ${fmt(input.insulationPrice)} BYN за м³ утеплителя ${input.insulationThicknessMm} мм.`);
  lines.push(`  · R стены: ${fmt(input.pie.rValue, 2)} м²·°C/Вт — норматив ≥ 3,0 ${input.pie.rSufficient ? '✓' : '✗ НЕДОСТАТОЧНО, УВЕЛИЧЬТЕ ТОЛЩИНУ'}.`);
  lines.push(`  · Пароизоляция: ПЭ 120 мкм, со стороны тёплого помещения.`);
  lines.push(`  · Ветрозащита: мембрана (или ОСП-3 9 мм).`);
  lines.push(`  · Внутренняя обшивка: ГКЛ 12,5 мм.`);

  /* ---- Шаг 4 ---- */
  lines.push('');
  lines.push(`ШАГ 4. КРОВЛЯ`);
  lines.push(`  · Материал: ${input.roofMaterial}.`);
  lines.push(`  · Стропило 50×200: ${input.roof.rafterCount} шт по ${fmt(input.roof.rafterLengthM)} м, шаг 600 мм.`);
  lines.push(`  · Обрешётка 25×50: шаг ${Math.round(input.battenStepM * 1000)} мм (по профилю кровельного материала).`);
  lines.push(`  · Мембрана кровельная ПВХ, нахлёст 10 %.`);
  lines.push(`  · Площадь кровли: ${fmt(input.roof.roofAreaM2)} м² (2 ската, свес 0,5 м).`);
  lines.push(`  · Вентзазор под кровельным материалом — не менее 50 мм.`);

  /* ---- ЭЛЕМЕНТЫ ---- */
  lines.push('');
  lines.push(`ПРОЁМЫ И ЭЛЕМЕНТЫ`);
  if (counts.window > 0) {
    lines.push(`  · Окна: ${counts.window} шт ${ELEMENT_SPECS.window.widthMm}×${ELEMENT_SPECS.window.heightMm} мм (проём +${MOUNT_GAP_MM} мм).`);
  }
  if (counts.door > 0) {
    lines.push(`  · Двери: ${counts.door} шт ${ELEMENT_SPECS.door.widthMm}×${ELEMENT_SPECS.door.heightMm} мм (проём +${MOUNT_GAP_MM} мм).`);
  }
  if (counts.terrace > 0) {
    lines.push(`  · Терраса: ${counts.terrace} шт ${ELEMENT_SPECS.terrace.widthMm}×${ELEMENT_SPECS.terrace.heightMm} мм (настил лиственница).`);
  }
  if (counts.window + counts.door + counts.terrace === 0) {
    lines.push(`  · Проёмы не заданы — дом без окон и дверей (коробка).`);
  }

  /* ---- ИТОГ ---- */
  lines.push('');
  lines.push('='.repeat(72));
  lines.push(`ПРЕДВАРИТЕЛЬНАЯ СТОИМОСТЬ: ${fmt(input.totals.total)} BYN`);
  lines.push(`  Материалы: ${fmt(input.totals.material)} BYN · Работы: ${fmt(input.totals.labor)} BYN`);
  lines.push('');
  lines.push('Примечание: расчёт предварительный, по средним ценам РБ.');
  lines.push('Окончательная смета уточняется после выезда на объект и замера.');

  return lines.join('\n');
}

/* ========================================================================== */
/*                    6. КОПИРОВАНИЕ (АВТОКОПИРОВАНИЕ В БУФЕР)                  */
/* ========================================================================== */

/**
 * Копирование текста в буфер обмена.
 *
 * ТРИ уровня отката, потому что прораб работает с телефона по http:
 *   1. `navigator.clipboard` — только в защищённом контексте (HTTPS/localhost);
 *   2. `execCommand('copy')` через скрытую textarea — работает на http;
 *   3. возврат `false` → компонент показывает текст в модалке для ручного
 *      копирования долгим нажатием. Ничего не теряется.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // переходим к запасному пути
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/* ========================================================================== */
/*                              ЛОКАЛЬНЫЕ УТИЛИТЫ                               */
/* ========================================================================== */

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Реэкспорт типов для импорта в компонентах */
export type { FramePriceItem };
