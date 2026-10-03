'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, FileText, RotateCcw, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { jsPDF } from 'jspdf';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from '@/lib/fonts';
import type { Feature } from '@/types/section';

export type ViolationType =
  | 'loss'
  | 'inside_loss'
  | 'damage'
  | 'temp_damage'
  | 'delay'
  | 'law_custom';

/**
 * Ультимативная база правовых стандартов РБ для претензий к перевозчику
 * (ТК / Фулфилмент). Сгруппирована по optgroup-ам выпадающего списка.
 */
export interface ViolationOption {
  type: ViolationType;
  label: string;
}

export interface ViolationGroup {
  group: string;
  violations: ViolationOption[];
}

export const VIOLATION_GROUPS: ViolationGroup[] = [
  {
    group: 'Потеря и недостача груза',
    violations: [
      {
        type: 'loss',
        label: 'Полная или частичная утеря грузовых мест (ошибка ТК)',
      },
      {
        type: 'inside_loss',
        label: 'Вскрытие коробок / внутренняя недостача товара',
      },
    ],
  },
  {
    group: 'Повреждение и порча',
    violations: [
      {
        type: 'damage',
        label: 'Механическое повреждение упаковки и товара (разбито/залито)',
      },
      {
        type: 'temp_damage',
        label: 'Порча товара из-за нарушения температурного режима',
      },
    ],
  },
  {
    group: 'Нарушение сроков',
    violations: [
      {
        type: 'delay',
        label: 'Нарушение нормативных сроков доставки (требование пени)',
      },
    ],
  },
  {
    group: 'УНИВЕРСАЛЬНЫЙ РУЧНОЙ ВВОД',
    violations: [
      {
        type: 'law_custom',
        label: 'Иное нарушение договора (ввести юридическое обоснование вручную)',
      },
    ],
  },
];

export const DEFAULT_VIOLATION_TYPE: ViolationType = 'loss';

export function getViolation(type: string): ViolationOption {
  for (const { violations } of VIOLATION_GROUPS) {
    const found = violations.find((violation) => violation.type === type);
    if (found) return found;
  }
  return VIOLATION_GROUPS[0].violations[0];
}

interface FormState {
  /** Название ИП/ООО заявителя */
  organization: string;
  /** УНП заявителя */
  unp: string;
  /** Название ТК / Фулфилмента (перевозчика) */
  carrier: string;
  /** Серия товарно-транспортной накладной формы ТТН-1 */
  ttnSeries: string;
  /** Номер товарно-транспортной накладной формы ТТН-1 */
  ttnNumber: string;
  /** Наименование товара / грузового места — графа 2 таблицы акта */
  productName: string;
  /** Единица измерения — графа 3 таблицы акта */
  unit: string;
  /** Транспортное средство перевозчика (автомобиль, гос. номер) */
  vehicle: string;
  /** Водитель ТК: ФИО и данные удостоверения */
  driverName: string;
  /** ФИО руководителя грузополучателя — правая подпись в акте */
  receiverName: string;
  /** Место составления акта */
  place: string;
  /** Тип нарушения (юридическое основание) */
  violation: ViolationType;
  /** Кастомное правовое обоснование (только для law_custom) */
  customLaw: string;
  /** Отправлено по накладной, шт. */
  shipped: string;
  /** Фактически принято складом, шт. */
  accepted: string;
  /** Стоимость 1 единицы товара, BYN */
  unitPrice: string;
}

const DEFAULT_FORM: FormState = {
  organization: 'ИП Кныш А.А.',
  unp: '193674829',
  carrier: "ООО 'ТК Энергия'",
  ttnSeries: 'УТ',
  ttnNumber: '3761604',
  productName: 'Коробки карго (грузовые места)',
  unit: 'шт.',
  vehicle: '',
  driverName: '',
  receiverName: 'Кныш А.А.',
  place: 'г. Минск',
  violation: DEFAULT_VIOLATION_TYPE,
  customLaw: '',
  shipped: '100',
  accepted: '95',
  unitPrice: '40',
};

const inputClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

export interface DiscrepancyResult {
  shipped: number;
  accepted: number;
  /** Отправлено − принято, без отрицательных значений */
  shortage: number;
  /** Недостача = Отправлено − Фактически принято */
  unitPrice: number;
  /** Сумма претензии = Недостача * Стоимость 1 единицы */
  claimAmount: number;
  violation: ViolationOption;
}

const toNumber = (value: string) => {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Расчёт суммы ущерба.
 * Недостача = Отправлено − Фактически принято; Сумма претензии = Недостача * Цена 1 ед.
 * Отрицательные значения (перебор) и нечисловой ввод приводятся к нулю.
 */
export function calculateDiscrepancy(form: FormState): DiscrepancyResult {
  const shipped = Math.max(0, toNumber(form.shipped));
  const accepted = Math.max(0, toNumber(form.accepted));
  const unitPrice = Math.max(0, toNumber(form.unitPrice));
  const shortage = Math.max(0, shipped - accepted);

  return {
    shipped,
    accepted,
    shortage,
    unitPrice,
    claimAmount: shortage * unitPrice,
    violation: getViolation(form.violation),
  };
}

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });

/** Правильная форма множественного числа: 1 акт, 2 акта, 5 актов */
function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Текущая дата в формате «02.10.2026» */
function currentDateRu() {
  return new Date().toLocaleDateString('ru-RU');
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Дата в разговорной форме «02 октября 2026» — принятый вид реквизита в бланках актов */
function currentDateLong() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  return `${day} ${MONTHS_GENITIVE[now.getMonth()]} ${now.getFullYear()}`;
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'akt'
  );
}

/** Реквизиты нормативного акта, на который ссылается бланк акта */
export const POSTANOVLENIE_970 =
  'Постановлением Совета Министров Республики Беларусь от 30.06.2008 № 970';

/** То же реквизит в именительном падеже — для ссылок в скобках */
const POSTANOVLENIE_970_NOM = 'Постановление Совета Министров Республики Беларусь от 30.06.2008 № 970';

/**
 * Нормы, конкретизирующие характер расхождений.
 * Само Постановление № 970 уже процитировано во вводной части,
 * поэтому здесь перечисляются только применимые статьи и условия договора.
 * Для law_custom добавляется вручную введённое обоснование —
 * это делает инструмент неуязвимым к изменениям регламентов перевозок.
 */
function buildLegalBasis(form: FormState): string[] {
  const custom = form.customLaw.trim();
  const basis: string[] = [];

  switch (form.violation) {
    case 'loss':
      basis.push('ст. 750 ГК Республики Беларусь — ответственность перевозчика за утрату груза');
      break;
    case 'inside_loss':
      basis.push(
        'ст. 750 и ст. 761 ГК Республики Беларусь, а также условия договора транспортной перевозки'
      );
      break;
    case 'damage':
      basis.push(
        'ст. 761 ГК Республики Беларусь — ответственность за повреждение груза, и пункт 25 Правил автомобильных перевозок грузов'
      );
      break;
    case 'temp_damage':
      basis.push(
        'ст. 750 и ст. 761 ГК Республики Беларусь, а также требования к температурному режиму при перевозке грузов'
      );
      break;
    case 'delay':
      basis.push('ст. 752 ГК Республики Беларусь — ответственность за просрочку доставки груза');
      break;
    case 'law_custom':
    default:
      basis.push('условия договора транспортной перевозки и нормы ГК Республики Беларусь');
      break;
  }

  if (custom) basis.push(`дополнительное обоснование Заявителя: ${custom}`);

  return basis;
}

/** Человекочитаемая метрика для превью: сколько единиц недополучено */
function unitLabel(count: number) {
  return `${count} ${plural(count, 'единица', 'единицы', 'единиц')}`;
}

function registerPdfFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  return doc;
}

/** Геометрия листа A4 и поля бланка акта, мм */
const SHEET = { width: 210, height: 297 };
const MARGIN = { top: 14, right: 10, bottom: 14, left: 10 };
const CONTENT_WIDTH = SHEET.width - MARGIN.left - MARGIN.right;
const RIGHT_EDGE = SHEET.width - MARGIN.right;

interface TableColumn {
  title: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

/**
 * Жёсткая сетка таблицы расхождений: 8 граф суммарной шириной 190 мм
 * (при полях по 10 мм). Графы 1–6 числовые, 7–8 денежные.
 */
const TABLE_COLUMNS: TableColumn[] = [
  { title: '№', width: 9, align: 'center' },
  { title: 'Наименование товара / грузового места', width: 43, align: 'left' },
  { title: 'Ед. изм.', width: 13, align: 'center' },
  { title: 'Числилось по документам, шт.', width: 25, align: 'center' },
  { title: 'Фактически принято, шт.', width: 25, align: 'center' },
  { title: 'Расхождение / Недостача, шт.', width: 25, align: 'center' },
  { title: 'Стоимость за ед., BYN', width: 21, align: 'right' },
  { title: 'Сумма ущерба, BYN', width: 29, align: 'right' },
];

const CELL_PAD_X = 1.6;
const HEADER_LINE_HEIGHT = 3.2;
const BODY_LINE_HEIGHT = 3.6;

/**
 * Формирует первичный двусторонний Акт о расхождениях по форме,
 * предусмотренной Правилами автомобильных перевозок грузов (Пост. Совмина № 970).
 * Возвращает готовый документ — вызывающий код сохраняет его на диск.
 */
export function buildDiscrepancyActPdf(form: FormState, result: DiscrepancyResult): jsPDF {
  const doc = registerPdfFont(new jsPDF({ unit: 'mm', format: 'a4' }));

  const INK: [number, number, number] = [25, 25, 25];
  const MUTED: [number, number, number] = [110, 110, 110];
  const BODY_SIZE = 10;
  const BODY_LINE = 4.9;

  let cursorY = MARGIN.top;
  const pageBottom = () => SHEET.height - MARGIN.bottom;

  /**
   * Кириллический текст с автопереносом по ширине листа.
   * jsPDF выравнивает строку относительно точки x, а maxWidth использует
   * только как ширину переноса, поэтому для center/right якорь
   * предварительно сдвигается в середину или в конец блока.
   */
  const writeWrapped = (
    text: string,
    options: {
      align?: 'left' | 'center' | 'right' | 'justify';
      x?: number;
      width?: number;
      style?: 'normal' | 'bold';
      size?: number;
      color?: [number, number, number];
      lineHeight?: number;
      spaceAfter?: number;
    } = {}
  ) => {
    const {
      align = 'left',
      width = CONTENT_WIDTH,
      style = 'normal',
      size = BODY_SIZE,
      color = INK,
      lineHeight = BODY_LINE,
      spaceAfter = 0,
    } = options;

    const left = options.x ?? MARGIN.left;
    const anchor =
      align === 'center' ? left + width / 2 : align === 'right' ? left + width : left;

    doc.setFont('Roboto', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, width) as string[];
    if (cursorY + lines.length * lineHeight > pageBottom()) {
      doc.addPage();
      cursorY = MARGIN.top;
    }
    doc.text(text, anchor, cursorY, { maxWidth: width, align });
    cursorY += lines.length * lineHeight + spaceAfter;
  };

  /** Строка «реквизит: значение» — жирная подпись, переносимое значение */
  const writeField = (label: string, value: string) => {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const labelWidth = doc.getTextWidth(label);

    doc.setFont('Roboto', 'normal');
    const valueX = MARGIN.left + labelWidth;
    const valueWidth = RIGHT_EDGE - valueX;
    const lines = doc.splitTextToSize(value, valueWidth) as string[];

    if (cursorY + lines.length * BODY_LINE > pageBottom()) {
      doc.addPage();
      cursorY = MARGIN.top;
    }
    doc.setFont('Roboto', 'bold');
    doc.text(label, MARGIN.left, cursorY, { maxWidth: labelWidth });
    doc.setFont('Roboto', 'normal');
    doc.text(value, valueX, cursorY, { maxWidth: valueWidth });
    cursorY += lines.length * BODY_LINE;
  };

  const blank = (text: string, fallback: string) => text.trim() || fallback;

  const ttnSeries = blank(form.ttnSeries, '____');
  const ttnNumber = blank(form.ttnNumber, '_______');
  const amount = format(result.claimAmount);
  const shortage = format(result.shortage, 0);

  /* ── 1. ШАПКА И НАЗВАНИЕ ДОКУМЕНТА ─────────────────────────────────── */

  writeWrapped('АКТ № _____', {
    align: 'center', style: 'bold', size: 16, spaceAfter: 1.5,
  });
  writeWrapped('об установлении расхождений по количеству и качеству при приемке груза', {
    align: 'center', style: 'bold', size: 11, spaceAfter: 1.5,
  });
  writeWrapped(`от "${currentDateLong()}" г.    Место составления: ${blank(form.place, '____________')}`, {
    align: 'center', size: 10, spaceAfter: 2,
  });

  // Двойная линия-разделитель — типографский признак официального бланка
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.9);
  doc.line(MARGIN.left, cursorY, RIGHT_EDGE, cursorY);
  doc.setLineWidth(0.35);
  doc.line(MARGIN.left, cursorY + 1.3, RIGHT_EDGE, cursorY + 1.3);
  cursorY += 7;

  /* ── 2. ВВОДНАЯ ЮРИДИЧЕСКАЯ ЧАСТЬ ──────────────────────────────────── */

  writeWrapped(
    'Настоящий Акт составлен в соответствии с Правилами автомобильных перевозок грузов, ' +
      `утвержденными ${POSTANOVLENIE_970}.`,
    { align: 'justify', spaceAfter: 1 }
  );
  buildLegalBasis(form).forEach((item) =>
    writeWrapped(`— ${item};`, { align: 'justify', color: MUTED, spaceAfter: 0.5 })
  );
  cursorY += 2;

  writeField('Грузоотправитель/Заявитель: ', `${blank(form.organization, '________________')}, УНП ${blank(form.unp, '__________')}`);
  writeField('Перевозчик (ТК): ', blank(form.carrier, '________________'));
  writeField('Транспортное средство (автомобиль, гос.номер): ', blank(form.vehicle, '________________________'));
  writeField('Водитель ТК (ФИО, данные удостоверения): ', blank(form.driverName, '____________________________'));
  writeField(
    'Товаросопроводительный документ: ',
    `Товарно-транспортная накладная формы ТТН-1, Серия ${ttnSeries} № ${ttnNumber}`
  );
  writeField('Характер выявленных расхождений: ', result.violation.label);
  cursorY += 4;

  /* ── 3. ОФИЦИАЛЬНАЯ ТАБЛИЦА РАСХОЖДЕНИЙ ────────────────────────────── */

  const dataRow = [
    '1',
    blank(form.productName, '________________'),
    blank(form.unit, 'шт.'),
    format(result.shipped, 0),
    format(result.accepted, 0),
    shortage,
    format(result.unitPrice),
    amount,
  ];
  // Обязательная итоговая по ТТН-1 строка: на всю ширину таблицы
  const summaryRow = [
    `Всего по накладной ТТН-1 Серия ${ttnSeries} № ${ttnNumber} числилось ` +
      `${format(result.shipped, 0)} мест, фактически принято ${format(result.accepted, 0)} мест.`,
  ];
  const totalRow = ['ИТОГО', '', '', '', '', '', '—', amount];

  const columnEdges = TABLE_COLUMNS.reduce<number[]>(
    (edges, column, index) => [...edges, (edges[index] ?? MARGIN.left) + column.width],
    [MARGIN.left]
  );

  interface TableRow {
    cells: string[];
    /** Объединённые графы: { 0: 8 } — ячейка на ширине граф 1–8 */
    spans?: Record<number, number>;
    fill: [number, number, number] | null;
    size: number;
    style: 'normal' | 'bold';
    lineHeight: number;
    align?: 'left' | 'center' | 'right';
  }

  const tableRows: TableRow[] = [
    {
      cells: TABLE_COLUMNS.map((column) => column.title),
      fill: [233, 233, 233],
      size: 6.6,
      style: 'bold',
      lineHeight: HEADER_LINE_HEIGHT,
    },
    {
      cells: dataRow,
      fill: null,
      size: 8.2,
      style: 'normal',
      lineHeight: BODY_LINE_HEIGHT,
    },
    {
      cells: summaryRow,
      spans: { 0: TABLE_COLUMNS.length },
      fill: [247, 247, 247],
      size: 8.2,
      style: 'normal',
      lineHeight: BODY_LINE_HEIGHT,
      align: 'left',
    },
    {
      cells: totalRow,
      spans: { 0: 6 },
      fill: [240, 240, 240],
      size: 8.2,
      style: 'bold',
      lineHeight: BODY_LINE_HEIGHT,
    },
  ];

  /** Графа i скрыта, если попадает внутрь объединённой ячейки */
  const isCovered = (row: TableRow, index: number) =>
    Object.entries(row.spans ?? {}).some(([start, span]) => {
      const from = Number(start);
      return index > from && index < from + span;
    });

  /** Высота строки по максимальному числу строк текста в её ячейках */
  const measureRow = (row: TableRow) => {
    doc.setFont('Roboto', row.style);
    doc.setFontSize(row.size);
    let maxLines = 1;

    Object.entries(row.spans ?? {}).forEach(([start, span]) => {
      const index = Number(start);
      const inner = columnEdges[index + span] - columnEdges[index] - CELL_PAD_X * 2;
      const lines = doc.splitTextToSize(row.cells[index] ?? '', inner) as string[];
      maxLines = Math.max(maxLines, lines.length);
    });
    row.cells.forEach((text, index) => {
      if (row.spans?.[index] !== undefined || isCovered(row, index) || !text) return;
      const column = TABLE_COLUMNS[index];
      const lines = doc.splitTextToSize(text, column.width - CELL_PAD_X * 2) as string[];
      maxLines = Math.max(maxLines, lines.length);
    });

    return maxLines * row.lineHeight + 3.2;
  };

  const rowHeights = tableRows.map(measureRow);
  const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0);

  // Таблица не должна разрываться и не должна наезжать на блок подписей
  const signatureReserve = 40;
  if (cursorY + tableHeight > pageBottom() - signatureReserve) {
    doc.addPage();
    cursorY = MARGIN.top;
  }

  const tableTop = cursorY;
  const tableBottom = tableTop + tableHeight;

  let bandTop = tableTop;
  const bands = tableRows.map((row, index) => {
    const band = { row, top: bandTop, height: rowHeights[index] };
    bandTop += rowHeights[index];
    return band;
  });

  // Заливка фона строк
  doc.setLineWidth(0);
  bands.forEach(({ row, top, height }) => {
    if (!row.fill) return;
    doc.setFillColor(row.fill[0], row.fill[1], row.fill[2]);
    doc.rect(MARGIN.left, top, CONTENT_WIDTH, height, 'F');
  });
  doc.setLineWidth(0.35);
  doc.setDrawColor(60, 60, 60);

  // Горизонтальные линии сетки
  doc.line(MARGIN.left, tableTop, RIGHT_EDGE, tableTop);
  bands.forEach(({ top, height }) => {
    doc.line(MARGIN.left, top + height, RIGHT_EDGE, top + height);
  });

  // Вертикальные линии сетки; внутри объединённых ячеек они не проводятся
  for (let i = 1; i < columnEdges.length - 1; i += 1) {
    const x = columnEdges[i];
    let y = tableTop;
    bands.forEach(({ row, top, height }) => {
      if (!isCovered(row, i) && !row.spans?.[i]) doc.line(x, y, x, top + height);
      y = top + height;
    });
  }
  doc.line(RIGHT_EDGE, tableTop, RIGHT_EDGE, tableBottom);
  doc.line(MARGIN.left, tableTop, MARGIN.left, tableBottom);

  // Утолщённая рамка таблицы
  doc.setLineWidth(0.8);
  doc.rect(MARGIN.left, tableTop, CONTENT_WIDTH, tableHeight, 'S');
  doc.setLineWidth(0.35);

  // Содержимое ячеек с вертикальным центрированием
  const writeCells = (band: (typeof bands)[number]) => {
    const { row, top, height } = band;
    const centre = top + height / 2 + row.lineHeight * 0.34;

    Object.entries(row.spans ?? {}).forEach(([start, span]) => {
      const index = Number(start);
      const text = row.cells[index];
      if (!text) return;
      const left = columnEdges[index];
      const right = columnEdges[index + span];
      const inner = right - left - CELL_PAD_X * 2;

      doc.setFont('Roboto', row.style);
      doc.setFontSize(row.size);
      doc.setTextColor(INK[0], INK[1], INK[2]);

      const lines = doc.splitTextToSize(text, inner) as string[];
      const align = row.align ?? 'left';
      const textX =
        align === 'right' ? right - CELL_PAD_X : align === 'center' ? (left + right) / 2 : left + CELL_PAD_X;
      doc.text(lines, textX, centre - ((lines.length - 1) * row.lineHeight) / 2, {
        maxWidth: inner,
        align,
        baseline: 'middle',
      });
    });

    row.cells.forEach((text, index) => {
      if (row.spans?.[index] !== undefined || isCovered(row, index) || !text) return;
      const column = TABLE_COLUMNS[index];
      const left = columnEdges[index];
      const right = columnEdges[index + 1];
      const inner = column.width - CELL_PAD_X * 2;

      doc.setFont('Roboto', row.style);
      doc.setFontSize(row.size);
      doc.setTextColor(INK[0], INK[1], INK[2]);

      const lines = doc.splitTextToSize(text, inner) as string[];
      // jsPDF выравнивает по точке x: справа — правый край, по центру — ось ячейки
      const textX =
        column.align === 'right'
          ? right - CELL_PAD_X
          : column.align === 'center'
            ? (left + right) / 2
            : left + CELL_PAD_X;
      doc.text(lines, textX, centre - ((lines.length - 1) * row.lineHeight) / 2, {
        maxWidth: inner,
        align: column.align,
        baseline: 'middle',
      });
    });
  };

  bands.forEach(writeCells);

  cursorY = tableBottom + 5;

  /* ── 4. ЗАКЛЮЧИТЕЛЬНАЯ ЧАСТЬ ───────────────────────────────────────── */

  writeWrapped(
    `Итого по настоящему Акту выявлена недостача в количестве: ${shortage} шт., ` +
      `на общую сумму ${amount} BYN.`,
    { align: 'justify', style: 'bold', spaceAfter: 1 }
  );
  writeWrapped(
    'Подтверждающие коммерческие документы, фото- и видеоматериалы прилагаются к настоящему Акту ' +
      'и являются его неотъемлемой частью. Ущерб подлежит возмещению Перевозчиком в установленный ' +
      'договором и законодательством Республики Беларусь срок.',
    { align: 'justify' }
  );

  /* ── 5. ДВУСТОРОННИЕ ПОДПИСИ ───────────────────────────────────────── */

  const signatureTop = Math.max(cursorY + 10, pageBottom() - 32);
  const columnWidth = (CONTENT_WIDTH - 8) / 2;
  const leftX = MARGIN.left;
  const rightX = MARGIN.left + columnWidth + 8;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(MARGIN.left, signatureTop - 4, RIGHT_EDGE, signatureTop - 4);
  doc.setLineWidth(0.35);

  const writeSignatureBlock = (x: number, title: string, name: string) => {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(title, x, signatureTop, { maxWidth: columnWidth });

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9.5);
    doc.text(`______________ / ${name}`, x, signatureTop + 11, { maxWidth: columnWidth });

    doc.setFontSize(7.6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('(Подпись)', x, signatureTop + 15.5, { maxWidth: columnWidth });
    const initialsX = x + columnWidth - doc.getTextWidth('(Инициалы, фамилия)');
    doc.text('(Инициалы, фамилия)', initialsX, signatureTop + 15.5);
  };

  writeSignatureBlock(
    leftX,
    'Сдал от Перевозчика (Водитель ТК):',
    blank(form.driverName, '_________________')
  );
  writeSignatureBlock(
    rightX,
    'Принял от Грузополучателя / Селлера:',
    blank(form.receiverName, '_________________')
  );

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('М.П.', rightX, signatureTop + 22, { maxWidth: columnWidth });

  doc.setFontSize(7.4);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Акт сформирован ${currentDateRu()}. Форма бланка соответствует Правилам автомобильных перевозок грузов (${POSTANOVLENIE_970_NOM}).`,
    MARGIN.left + CONTENT_WIDTH / 2,
    SHEET.height - 6,
    { maxWidth: CONTENT_WIDTH, align: 'center' }
  );

  return doc;
}

export default function DiscrepancyAct({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCustomLaw = form.violation === 'law_custom';

  const result = useMemo(() => calculateDiscrepancy(form), [form]);
  const legalBasis = useMemo(() => buildLegalBasis(form), [form]);

  const handleDownloadPdf = () => {
    const doc = buildDiscrepancyActPdf(form, result);
    doc.save(
      `Akt_TTN1_${sanitizeFileName(form.ttnSeries)}_${sanitizeFileName(form.ttnNumber)}.pdf`
    );
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Параметры акта */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Параметры акта</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Первичный двусторонний Акт о расхождениях по Правилам автомобильных перевозок грузов
              (Пост. Совмина № 970)
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-organization"
                  >
                    Название ИП/ООО
                  </label>
                  <input
                    id="act-organization"
                    type="text"
                    value={form.organization}
                    onChange={(e) => updateField('organization', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-unp">
                    УНП
                  </label>
                  <input
                    id="act-unp"
                    type="text"
                    value={form.unp}
                    onChange={(e) => updateField('unp', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-carrier">
                    Название ТК / Фулфилмента
                  </label>
                  <input
                    id="act-carrier"
                    type="text"
                    value={form.carrier}
                    onChange={(e) => updateField('carrier', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-ttn-series">
                    Серия ТТН-1
                  </label>
                  <input
                    id="act-ttn-series"
                    type="text"
                    value={form.ttnSeries}
                    onChange={(e) => updateField('ttnSeries', e.target.value)}
                    className={inputClass}
                    placeholder="Например: УТ"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-ttn-number"
                  >
                    Номер ТТН-1
                  </label>
                  <input
                    id="act-ttn-number"
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    value={form.ttnNumber}
                    onChange={(e) => updateField('ttnNumber', e.target.value)}
                    className={inputClass}
                    placeholder="7 знаков номера"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-product-name"
                  >
                    Наименование товара / грузового места
                  </label>
                  <input
                    id="act-product-name"
                    type="text"
                    value={form.productName}
                    onChange={(e) => updateField('productName', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-unit">
                    Ед. изм.
                  </label>
                  <input
                    id="act-unit"
                    type="text"
                    value={form.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-vehicle">
                    Транспортное средство (автомобиль, гос.номер)
                  </label>
                  <input
                    id="act-vehicle"
                    type="text"
                    value={form.vehicle}
                    onChange={(e) => updateField('vehicle', e.target.value)}
                    className={inputClass}
                    placeholder="Если известно — заполните, иначе останется прочерк"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-driver-name"
                  >
                    Водитель ТК (ФИО, данные удостоверения)
                  </label>
                  <input
                    id="act-driver-name"
                    type="text"
                    value={form.driverName}
                    onChange={(e) => updateField('driverName', e.target.value)}
                    className={inputClass}
                    placeholder="Если известно — заполните, иначе останется прочерк"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-receiver-name"
                  >
                    ФИО руководителя (принимает груз)
                  </label>
                  <input
                    id="act-receiver-name"
                    type="text"
                    value={form.receiverName}
                    onChange={(e) => updateField('receiverName', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-place">
                    Место составления акта
                  </label>
                  <input
                    id="act-place"
                    type="text"
                    value={form.place}
                    onChange={(e) => updateField('place', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-violation">
                    Характер нарушения (Юридическое основание)
                  </label>
                  <select
                    id="act-violation"
                    value={form.violation}
                    onChange={(e) => updateField('violation', e.target.value)}
                    className={selectClass}
                  >
                    {VIOLATION_GROUPS.map(({ group, violations }) => (
                      <optgroup key={group} label={group}>
                        {violations.map((violation) => (
                          <option key={violation.type} value={violation.type}>
                            {violation.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Скрытое поле: включается ТОЛЬКО для универсального ручного ввода */}
                {isCustomLaw && (
                  <div className="md:col-span-2">
                    <label
                      className="block text-sm font-medium text-neutral-700 mb-1"
                      htmlFor="act-custom-law"
                    >
                      Кастомное правовое обоснование претензии
                    </label>
                    <textarea
                      id="act-custom-law"
                      value={form.customLaw}
                      onChange={(e) => updateField('customLaw', e.target.value)}
                      className={cn(inputClass, 'h-28 resize-y')}
                      placeholder="Например: п. 5.3 договора транспортной перевозки №__ от __ и ст. 750 ГК РБ"
                    />
                    <p className="mt-1 text-xs text-neutral-400">
                      Текст будет вставлен в мотивировочную часть акта без изменений
                    </p>
                  </div>
                )}

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-shipped"
                  >
                    Отправлено по накладной, шт.
                  </label>
                  <input
                    id="act-shipped"
                    type="number"
                    step="1"
                    min="0"
                    value={form.shipped}
                    onChange={(e) => updateField('shipped', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-accepted"
                  >
                    Фактически принято складом, шт.
                  </label>
                  <input
                    id="act-accepted"
                    type="number"
                    step="1"
                    min="0"
                    value={form.accepted}
                    onChange={(e) => updateField('accepted', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="act-unit-price"
                  >
                    Стоимость 1 единицы товара (упущенная цена продажи), BYN
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="act-unit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.unitPrice}
                      onChange={(e) => updateField('unitPrice', e.target.value)}
                      className={cn(inputClass, 'flex-1')}
                      required
                    />
                    <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">BYN</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(DEFAULT_FORM)}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Сбросить
                </button>
                <span className="flex-1 self-center text-xs text-neutral-400">
                  Сумма ущерба пересчитывается мгновенно при изменении полей
                </span>
              </div>
            </div>
          </div>

          {/* Расчёт и превью документа */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Итоги по акту</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Недостача = Отправлено − Фактически принято; Сумма = Недостача × Цена 1 ед.
            </p>

            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-5 text-center">
              <p className="text-sm text-neutral-600 mb-1">Количество недостачи</p>
              <p className="text-3xl font-bold text-neutral-900 mb-3">
                {format(result.shortage, 0)} шт.
              </p>
              <p className="text-sm text-neutral-600">
                Сумма ущерба:{' '}
                <span className="font-semibold text-neutral-900 text-lg">
                  {format(result.claimAmount)} BYN
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Отправлено / принято</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.shipped, 0)} / {format(result.accepted, 0)}
                </p>
                <p className="text-xs text-neutral-400">недостача: {unitLabel(result.shortage)}</p>
              </div>
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Цена 1 единицы</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.unitPrice)} BYN
                </p>
                <p className="text-xs text-neutral-400">упущенная цена продажи</p>
              </div>
            </div>

            {/* Превью официального бланка акта */}
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Превью бланка акта (Пост. Совмина № 970)
              </p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 max-h-[560px] overflow-y-auto">
                {/* Шапка */}
                <p className="text-center text-base font-bold text-neutral-900">АКТ № _____</p>
                <p className="mt-1 text-center text-xs font-bold text-neutral-800">
                  об установлении расхождений по количеству и качеству при приемке груза
                </p>
                <p className="mt-1 text-center text-xs text-neutral-700">
                  от «{currentDateLong()}» г.&nbsp;&nbsp;&nbsp; Место составления:{' '}
                  {form.place || '—'}
                </p>
                <div className="my-3 border-t-2 border-neutral-700" />

                {/* Вводная юридическая часть */}
                <div className="text-xs text-neutral-700 leading-relaxed text-justify space-y-1.5">
                  <p>
                    Настоящий Акт составлен в соответствии с Правилами автомобильных перевозок
                    грузов, утвержденными {POSTANOVLENIE_970}.
                  </p>
                  {legalBasis.map((item, index) => (
                    <p key={index} className="text-neutral-500">
                      — {item};
                    </p>
                  ))}

                  <div className="space-y-1 pt-1.5">
                    <p>
                      <span className="font-semibold text-neutral-900">Грузоотправитель/Заявитель: </span>
                      {form.organization || '—'}, УНП {form.unp || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-900">Перевозчик (ТК): </span>
                      {form.carrier || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-900">
                        Транспортное средство (автомобиль, гос.номер):{' '}
                      </span>
                      {form.vehicle || '________________________'}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-900">
                        Водитель ТК (ФИО, данные удостоверения):{' '}
                      </span>
                      {form.driverName || '____________________________'}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-900">
                        Товаросопроводительный документ:{' '}
                      </span>
                      Товарно-транспортная накладная формы ТТН-1, Серия{' '}
                      {form.ttnSeries || '—'} № {form.ttnNumber || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-900">
                        Характер выявленных расхождений:{' '}
                      </span>
                      {result.violation.label}
                    </p>
                  </div>
                </div>

                {/* Таблица расхождений */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-[10px] text-neutral-800">
                    <thead>
                      <tr className="bg-neutral-200">
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[4%]">№</th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold text-left w-[22%]">
                          Наименование товара / грузового места
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[7%]">
                          Ед. изм.
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[13%]">
                          Числилось по документам, шт.
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[13%]">
                          Фактически принято, шт.
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[13%]">
                          Расхождение / Недостача, шт.
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[13%]">
                          Стоимость за ед., BYN
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[15%]">
                          Сумма ущерба, BYN
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center">1</td>
                        <td className="border border-neutral-400 px-1 py-1.5">
                          {form.productName || '—'}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center">
                          {form.unit || 'шт.'}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center">
                          {format(result.shipped, 0)}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center">
                          {format(result.accepted, 0)}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center font-semibold">
                          {format(result.shortage, 0)}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-right">
                          {format(result.unitPrice)}
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-right font-semibold">
                          {format(result.claimAmount)}
                        </td>
                      </tr>
                      <tr className="bg-neutral-100">
                        <td className="border border-neutral-400 px-1.5 py-1.5" colSpan={8}>
                          Всего по накладной ТТН-1 Серия {form.ttnSeries || '—'} №{' '}
                          {form.ttnNumber || '—'} числилось {format(result.shipped, 0)} мест,
                          фактически принято {format(result.accepted, 0)} мест.
                        </td>
                      </tr>
                      <tr className="bg-neutral-200">
                        <td
                          className="border border-neutral-400 px-1 py-1.5 font-bold text-center"
                          colSpan={6}
                        >
                          ИТОГО
                        </td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-center">—</td>
                        <td className="border border-neutral-400 px-1 py-1.5 text-right font-bold">
                          {format(result.claimAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Заключительная часть */}
                <div className="mt-3 text-xs text-neutral-700 leading-relaxed text-justify space-y-1.5">
                  <p>
                    <span className="font-semibold text-neutral-900">
                      Итого по настоящему Акту выявлена недостача в количестве:{' '}
                      {format(result.shortage, 0)} шт., на общую сумму{' '}
                      {format(result.claimAmount)} BYN.
                    </span>
                  </p>
                  <p>
                    Подтверждающие коммерческие документы, фото- и видеоматериалы прилагаются к
                    настоящему Акту и являются его неотъемлемой частью. Ущерб подлежит возмещению
                    Перевозчиком в установленный договором и законодательством Республики Беларусь
                    срок.
                  </p>
                </div>

                {/* Двусторонние подписи */}
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-300 pt-3 text-xs text-neutral-800">
                  <div>
                    <p className="font-semibold">Сдал от Перевозчика (Водитель ТК):</p>
                    <p className="mt-2">______________ / {form.driverName || '_________________'}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      <span>(Подпись)</span>
                      <span className="float-right">(Инициалы, фамилия)</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Принял от Грузополучателя / Селлера:</p>
                    <p className="mt-2">______________ / {form.receiverName || '_________________'}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      <span>(Подпись)</span>
                      <span className="float-right">(Инициалы, фамилия)</span>
                    </p>
                    <p className="mt-1.5 text-neutral-700">М.П.</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-[#7b1fa2] hover:bg-[#7b1fa2]/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачать Акт о расхождениях (PDF)
            </button>

            <div className="mt-4 bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-600">
                  Форма бланка соответствует Правилам автомобильных перевозок грузов, утверждённым{' '}
                  {POSTANOVLENIE_970}. Акт является первичным двусторонним документом: подписи
                  водителя ТК и грузополучателя проставляются при подписании. При выборе пункта
                  «Иное нарушение договора» добавьте собственное юридическое обоснование —
                  инструмент остаётся рабочим при любых изменениях регламентов перевозок.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
