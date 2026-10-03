'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, FileText, Package, Plus, RotateCcw, Trash2 } from 'lucide-react';
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

/**
 * Строка спецификации товаров — одна позиция в рамках одной ТТН-1.
 * Акт может оформляться на многострочную поставку: в одной накладной
 * едет несколько разных товаров, каждый со своими количествами и ценой.
 */
export interface SpecificationRow {
  /** Стабильный ключ строки: сохраняется при пересчётах и удалении соседних строк */
  id: string;
  /** Наименование товара / грузового места — графа 2 таблицы акта */
  productName: string;
  /** Единица измерения — графа 3 таблицы акта */
  unit: string;
  /** Отправлено по накладной, шт. */
  shipped: string;
  /** Фактически принято складом, шт. */
  accepted: string;
  /** Стоимость 1 единицы товара (упущенная цена продажи), BYN */
  unitPrice: string;
}

/** Значения строки спецификации без служебного ключа */
type SpecificationValues = Omit<SpecificationRow, 'id'>;

/** Первая строка спецификации предзаполняется демонстрационными значениями */
export const DEFAULT_SPECIFICATION: SpecificationValues = {
  productName: 'Платье женское базовое',
  unit: 'шт.',
  shipped: '100',
  accepted: '95',
  unitPrice: '40',
};

/** Добавляемые пользователем строки создаются пустыми (кроме единицы измерения) */
const EMPTY_SPECIFICATION: SpecificationValues = {
  productName: '',
  unit: 'шт.',
  shipped: '',
  accepted: '',
  unitPrice: '',
};

let specificationRowSeq = 0;

/** Идентификатор строки не зависит от её позиции в массиве */
const nextSpecificationId = () => {
  specificationRowSeq += 1;
  return `spec-${specificationRowSeq}`;
};

function createSpecificationRow(values: SpecificationValues = EMPTY_SPECIFICATION): SpecificationRow {
  return { id: nextSpecificationId(), ...values };
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
  /** Позиции товаров по ТТН-1 — многострочная спецификация акта */
  specification: SpecificationRow[];
}

const createDefaultForm = (): FormState => ({
  organization: 'ИП Кныш А.А.',
  unp: '193674829',
  carrier: "ООО 'ТК Энергия'",
  ttnSeries: 'УТ',
  ttnNumber: '3761604',
  vehicle: '',
  driverName: '',
  receiverName: 'Кныш А.А.',
  place: 'г. Минск',
  violation: DEFAULT_VIOLATION_TYPE,
  customLaw: '',
  specification: [createSpecificationRow(DEFAULT_SPECIFICATION)],
});

const inputClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

/** Строка спецификации с посчитанными величинами */
export interface SpecificationRowResult extends SpecificationRow {
  /** Отправлено, шт. */
  shippedQty: number;
  /** Фактически принято, шт. */
  acceptedQty: number;
  /** Цена 1 единицы, BYN */
  unitPriceValue: number;
  /** Недостача = Отправлено − Принято, без отрицательных значений */
  shortage: number;
  /** Сумма ущерба строки = Недостача * Цена 1 ед. */
  amount: number;
}

export interface DiscrepancyResult {
  /** Посчитанные строки спецификации в порядке следования */
  rows: SpecificationRowResult[];
  /** Сумма «отправлено» по всем позициям ТТН-1, шт. */
  shipped: number;
  /** Сумма «фактически принято» по всем позициям ТТН-1, шт. */
  accepted: number;
  /** Общее количество утерянного товара по всей ТТН-1, шт. */
  shortage: number;
  /** Общая сумма ущерба по всей ТТН-1, BYN */
  claimAmount: number;
  violation: ViolationOption;
}

const toNumber = (value: string) => {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Расчёт одной позиции спецификации.
 * Недостача = Отправлено − Фактически принято; Ущерб = Недостача * Цена 1 ед.
 * Отрицательные значения (перебор) и нечисловой ввод приводятся к нулю.
 */
export function calculateSpecificationRow(row: SpecificationRow): SpecificationRowResult {
  const shippedQty = Math.max(0, toNumber(row.shipped));
  const acceptedQty = Math.max(0, toNumber(row.accepted));
  const unitPriceValue = Math.max(0, toNumber(row.unitPrice));
  const shortage = Math.max(0, shippedQty - acceptedQty);

  return {
    ...row,
    shippedQty,
    acceptedQty,
    unitPriceValue,
    shortage,
    amount: shortage * unitPriceValue,
  };
}

/**
 * Сводный расчёт по всей ТТН-1: недостача и сумма ущерба циклически
 * суммируются по всем позициям спецификации.
 */
export function calculateDiscrepancy(form: FormState): DiscrepancyResult {
  const rows = form.specification.map(calculateSpecificationRow);

  return {
    rows,
    shipped: rows.reduce((sum, row) => sum + row.shippedQty, 0),
    accepted: rows.reduce((sum, row) => sum + row.acceptedQty, 0),
    shortage: rows.reduce((sum, row) => sum + row.shortage, 0),
    claimAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    violation: getViolation(form.violation),
  };
}

/**
 * Позиция считается заполненной, если пользователь ввёл наименование или
 * хотя бы одно число. Единица измерения в расчёт не входит: у новой строки
 * она по умолчанию «шт.», и иначе пустая строка попала бы в таблицу акта.
 */
function isFilledRow(row: SpecificationRow) {
  return [row.productName, row.shipped, row.accepted, row.unitPrice].some(
    (value) => value.trim() !== ''
  );
}

/** Позиции, попадающие в таблицу акта: все заполненные строки спецификации */
export function filledSpecificationRows(rows: SpecificationRowResult[]) {
  return rows.filter(isFilledRow);
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
 * (при полях по 10 мм). Одна строка спецификации занимает одну строку таблицы,
 * поэтому графы рассчитаны на любое количество позиций.
 */
const TABLE_COLUMNS: TableColumn[] = [
  { title: '№', width: 8, align: 'center' },
  { title: 'Наименование товара', width: 45, align: 'left' },
  { title: 'Ед.', width: 12, align: 'center' },
  { title: 'Числилось (шт)', width: 23, align: 'center' },
  { title: 'Фактически (шт)', width: 23, align: 'center' },
  { title: 'Недостача (шт)', width: 23, align: 'center' },
  { title: 'Цена (BYN)', width: 26, align: 'right' },
  { title: 'Сумма (BYN)', width: 30, align: 'right' },
];

const CELL_PAD_X = 1.6;
const HEADER_LINE_HEIGHT = 3.2;
const BODY_LINE_HEIGHT = 3.6;

/** Строка таблицы акта: ячейки, объединённые графы и оформление */
interface TableRow {
  cells: string[];
  /** Объединённые графы: { 0: 8 } — ячейка на ширине граф 1–8 */
  spans?: Record<number, number>;
  /** Заливка фона строки, null — без заливки */
  fill: [number, number, number] | null;
  size: number;
  style: 'normal' | 'bold';
  lineHeight: number;
  /** Выравнивание для объединённых ячеек; обычные графы берут выравнивание из TABLE_COLUMNS */
  align?: 'left' | 'center' | 'right';
}

/** Строка таблицы с рассчитанной высотой отрисовки */
interface PlacedRow {
  row: TableRow;
  height: number;
}

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

  /* ── 3. ОФИЦИАЛЬНАЯ ТАБЛИЦА РАСХОЖДЕНИЙ (МНОГОСТРОЧНАЯ) ────────────── */

  // Все позиции спецификации попадают в таблицу последовательно, своими строками
  const bodyRows: TableRow[] = filledSpecificationRows(result.rows).map((row, index) => ({
    cells: [
      String(index + 1),
      blank(row.productName, '________________'),
      blank(row.unit, 'шт.'),
      format(row.shippedQty, 0),
      format(row.acceptedQty, 0),
      format(row.shortage, 0),
      format(row.unitPriceValue),
      format(row.amount),
    ],
    fill: null,
    size: 8.2,
    style: 'normal',
    lineHeight: BODY_LINE_HEIGHT,
  }));

  const columnEdges = TABLE_COLUMNS.reduce<number[]>(
    (edges, column, index) => [...edges, (edges[index] ?? MARGIN.left) + column.width],
    [MARGIN.left]
  );

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

  // Содержимое ячеек с вертикальным центрированием
  const writeCells = (row: TableRow, top: number, height: number) => {
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

  const HEADER_FILL: [number, number, number] = [233, 233, 233];

  /** Отрисовка непрерывного фрагмента таблицы: рамка, сетка и содержимое ячеек */
  const drawTableChunk = (chunk: PlacedRow[], top: number) => {
    const height = chunk.reduce((sum, placed) => sum + placed.height, 0);
    const bottom = top + height;

    doc.setLineWidth(0);
    let y = top;
    chunk.forEach(({ row, height: rowHeight }) => {
      if (row.fill) {
        doc.setFillColor(row.fill[0], row.fill[1], row.fill[2]);
        doc.rect(MARGIN.left, y, CONTENT_WIDTH, rowHeight, 'F');
      }
      y += rowHeight;
    });

    doc.setLineWidth(0.35);
    doc.setDrawColor(60, 60, 60);

    // Вертикали: внутри объединённых ячеек они не проводятся
    y = top;
    chunk.forEach(({ row, height: rowHeight }) => {
      for (let i = 1; i < columnEdges.length - 1; i += 1) {
        if (isCovered(row, i) || row.spans?.[i]) continue;
        doc.line(columnEdges[i], y, columnEdges[i], y + rowHeight);
      }
      y += rowHeight;
    });

    // Горизонтали: верх, низ и границы между строками
    doc.line(MARGIN.left, top, RIGHT_EDGE, top);
    y = top;
    chunk.forEach(({ height: rowHeight }) => {
      y += rowHeight;
      doc.line(MARGIN.left, y, RIGHT_EDGE, y);
    });
    doc.line(MARGIN.left, top, MARGIN.left, bottom);
    doc.line(RIGHT_EDGE, top, RIGHT_EDGE, bottom);

    // Утолщённая рамка фрагмента таблицы
    doc.setLineWidth(0.8);
    doc.rect(MARGIN.left, top, CONTENT_WIDTH, height, 'S');
    doc.setLineWidth(0.35);

    y = top;
    chunk.forEach(({ row, height: rowHeight }) => {
      writeCells(row, y, rowHeight);
      y += rowHeight;
    });
  };

  const place = (row: TableRow): PlacedRow => ({ row, height: measureRow(row) });

  // Шапка таблицы повторяется на каждой странице, где есть строки позиций
  const headerPlaced = place({
    cells: TABLE_COLUMNS.map((column) => column.title),
    fill: HEADER_FILL,
    size: 6.6,
    style: 'bold',
    lineHeight: HEADER_LINE_HEIGHT,
  });

  // Обязательная итоговая по ТТН-1 строка: на всю ширину таблицы
  const summaryPlaced = place({
    cells: [
      `Всего по накладной ТТН-1 Серия ${ttnSeries} № ${ttnNumber} числилось ` +
        `${format(result.shipped, 0)} мест, фактически принято ${format(result.accepted, 0)} мест.`,
    ],
    spans: { 0: TABLE_COLUMNS.length },
    fill: [247, 247, 247],
    size: 8.2,
    style: 'normal',
    lineHeight: BODY_LINE_HEIGHT,
    align: 'left',
  });

  // Итоговая жирная строка акта
  const totalPlaced = place({
    cells: [`ИТОГО: ${shortage} шт. на сумму ${amount} BYN`],
    spans: { 0: TABLE_COLUMNS.length },
    fill: [240, 240, 240],
    size: 8.2,
    style: 'bold',
    lineHeight: BODY_LINE_HEIGHT,
    align: 'left',
  });

  const tailHeight = summaryPlaced.height + totalPlaced.height;
  // Место, которое на последней странице займут заключение и подписи сторон
  const signatureReserve = 58;

  let chunk: PlacedRow[] = [];
  /** Верх текущего фрагмента таблицы */
  let chunkTop = cursorY;
  /** Текущая позиция отрисовки: низ последней помещённой строки */
  let chunkBottom = cursorY;

  /** Шапка таблицы повторяется на каждой странице, где есть строки позиций */
  const startChunk = (top: number) => {
    chunk = [headerPlaced];
    chunkTop = top;
    chunkBottom = top + headerPlaced.height;
  };

  const flush = () => {
    if (!chunk.length) return;
    drawTableChunk(chunk, chunkTop);
    chunkTop = chunkBottom;
    chunk = [];
  };

  startChunk(cursorY);

  const bodyPlaced = bodyRows.map(place);
  bodyPlaced.forEach((placed, index) => {
    const isLast = index === bodyPlaced.length - 1;
    // На последней строке резервируем итоги и подписи, на промежуточных — повтор шапки
    const reserve = isLast ? tailHeight + signatureReserve : headerPlaced.height;
    if (chunkBottom + placed.height + reserve > pageBottom()) {
      flush();
      doc.addPage();
      startChunk(MARGIN.top);
    }
    chunk.push(placed);
    chunkBottom += placed.height;
  });

  // Итоговые строки не должны отрываться от места, подписей и заключения
  if (chunkBottom + tailHeight + signatureReserve > pageBottom()) {
    flush();
    doc.addPage();
    startChunk(MARGIN.top);
  }
  chunk.push(summaryPlaced, totalPlaced);
  chunkBottom += tailHeight;
  flush();

  cursorY = chunkBottom + 5;

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

  // Блок подписей переносится целиком, а не разрывается между страницами
  const SIGNATURE_BLOCK_HEIGHT = 30;
  if (cursorY + SIGNATURE_BLOCK_HEIGHT > pageBottom()) {
    doc.addPage();
    cursorY = MARGIN.top;
  }

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
  const [form, setForm] = useState<FormState>(createDefaultForm);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Правка одного поля конкретной позиции спецификации */
  const updateSpecificationRow = (id: string, field: keyof SpecificationValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      specification: prev.specification.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  };

  /** Добавление пустой позиции в конец спецификации */
  const addSpecificationRow = () => {
    setForm((prev) => ({
      ...prev,
      specification: [...prev.specification, createSpecificationRow()],
    }));
  };

  /** Удаление позиции; последняя строка не удаляется, чтобы остаться минимум одна */
  const removeSpecificationRow = (id: string) => {
    setForm((prev) =>
      prev.specification.length <= 1
        ? prev
        : { ...prev, specification: prev.specification.filter((row) => row.id !== id) }
    );
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
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(createDefaultForm())}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Сбросить
                </button>
                <span className="flex-1 self-center text-xs text-neutral-400">
                  Позиции товаров и сумма ущерба пересчитываются мгновенно
                </span>
              </div>
            </div>
          </div>

          {/* Расчёт и превью документа */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Итоги по акту</h3>
            <p className="text-sm text-neutral-500 mb-4">
              По каждой позиции: Недостача = Отправлено − Принято, Ущерб = Недостача × Цена. Итоги —
              сумма по всем строкам ТТН-1
            </p>

            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-5 text-center">
              <p className="text-sm text-neutral-600 mb-1">
                Общее количество утерянного товара
              </p>
              <p className="text-3xl font-bold text-neutral-900 mb-3">
                {format(result.shortage, 0)} шт.
              </p>
              <p className="text-sm text-neutral-600">
                Общая сумма ущерба по всей ТТН-1:{' '}
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
                <p className="text-xs text-neutral-400">
                  по всей накладной: {unitLabel(result.shortage)}
                </p>
              </div>
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Позиций в ТТН-1</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {filledSpecificationRows(result.rows).length}
                </p>
                <p className="text-xs text-neutral-400">строк в таблице акта</p>
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
                        <th className="border border-neutral-400 px-1 py-1 font-semibold text-left w-[24%]">
                          Наименование товара
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[6%]">
                          Ед.
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[12%]">
                          Числилось (шт)
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[12%]">
                          Фактически (шт)
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[12%]">
                          Недостача (шт)
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[13%]">
                          Цена (BYN)
                        </th>
                        <th className="border border-neutral-400 px-1 py-1 font-semibold w-[17%]">
                          Сумма (BYN)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filledSpecificationRows(result.rows).map((row, index) => (
                        <tr key={row.id}>
                          <td className="border border-neutral-400 px-1 py-1.5 text-center">
                            {index + 1}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5">
                            {row.productName || '—'}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-center">
                            {row.unit || 'шт.'}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-center">
                            {format(row.shippedQty, 0)}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-center">
                            {format(row.acceptedQty, 0)}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-center font-semibold">
                            {format(row.shortage, 0)}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-right">
                            {format(row.unitPriceValue)}
                          </td>
                          <td className="border border-neutral-400 px-1 py-1.5 text-right font-semibold">
                            {format(row.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-neutral-100">
                        <td className="border border-neutral-400 px-1.5 py-1.5" colSpan={8}>
                          Всего по накладной ТТН-1 Серия {form.ttnSeries || '—'} №{' '}
                          {form.ttnNumber || '—'} числилось {format(result.shipped, 0)} мест,
                          фактически принято {format(result.accepted, 0)} мест.
                        </td>
                      </tr>
                      <tr className="bg-neutral-200">
                        <td className="border border-neutral-400 px-1.5 py-1.5 font-bold" colSpan={8}>
                          ИТОГО: {format(result.shortage, 0)} шт. на сумму{' '}
                          {format(result.claimAmount)} BYN
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

        {/* Спецификация товаров — многострочная поставка по одной ТТН-1 */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#7b1fa2]" aria-hidden="true" />
              Спецификация товаров
            </h3>
            <span className="shrink-0 text-xs text-neutral-500 bg-neutral-100 rounded-full px-3 py-1">
              {form.specification.length}{' '}
              {plural(form.specification.length, 'позиция', 'позиции', 'позиций')}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mb-4">
            Каждая позиция попадает отдельной строкой в таблицу акта. Недостача и ущерб по позиции
            считаются сразу, а итоги блока справа суммируют все строки ТТН-1.
          </p>

          <div className="space-y-3">
            {/* Подписи граф спецификации — скрыты на узких экранах */}
            <div className="hidden lg:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-neutral-500">
              <span className="col-span-4">Наименование товара</span>
              <span className="col-span-1">Ед.</span>
              <span className="col-span-2">Отправлено, шт</span>
              <span className="col-span-2">Принято фактически, шт</span>
              <span className="col-span-2">Цена за 1 шт, BYN</span>
              <span className="col-span-1" />
            </div>

            {form.specification.map((row, index) => {
              const rowResult = result.rows[index];
              const isOnlyRow = form.specification.length <= 1;

              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3"
                >
                  <div className="grid grid-cols-2 lg:grid-cols-12 gap-2 items-end">
                    <div className="col-span-2 lg:col-span-4">
                      <label
                        className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                        htmlFor={`act-spec-name-${row.id}`}
                      >
                        Наименование товара
                      </label>
                      <input
                        id={`act-spec-name-${row.id}`}
                        type="text"
                        value={row.productName}
                        onChange={(e) => updateSpecificationRow(row.id, 'productName', e.target.value)}
                        className={inputClass}
                        placeholder="Например: Платье женское базовое"
                      />
                    </div>

                    <div className="lg:col-span-1">
                      <label
                        className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                        htmlFor={`act-spec-unit-${row.id}`}
                      >
                        Ед.
                      </label>
                      <input
                        id={`act-spec-unit-${row.id}`}
                        type="text"
                        value={row.unit}
                        onChange={(e) => updateSpecificationRow(row.id, 'unit', e.target.value)}
                        className={inputClass}
                        placeholder="шт."
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label
                        className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                        htmlFor={`act-spec-shipped-${row.id}`}
                      >
                        Отправлено, шт
                      </label>
                      <input
                        id={`act-spec-shipped-${row.id}`}
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        value={row.shipped}
                        onChange={(e) => updateSpecificationRow(row.id, 'shipped', e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label
                        className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                        htmlFor={`act-spec-accepted-${row.id}`}
                      >
                        Принято фактически, шт
                      </label>
                      <input
                        id={`act-spec-accepted-${row.id}`}
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        value={row.accepted}
                        onChange={(e) => updateSpecificationRow(row.id, 'accepted', e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label
                        className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                        htmlFor={`act-spec-price-${row.id}`}
                      >
                        Цена за 1 шт, BYN
                      </label>
                      <input
                        id={`act-spec-price-${row.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={row.unitPrice}
                        onChange={(e) => updateSpecificationRow(row.id, 'unitPrice', e.target.value)}
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex justify-end lg:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeSpecificationRow(row.id)}
                        disabled={isOnlyRow}
                        title={
                          isOnlyRow
                            ? 'В акте должна остаться хотя бы одна позиция'
                            : 'Удалить позицию из акта'
                        }
                        aria-label={`Удалить позицию ${index + 1} из акта`}
                        className={cn(
                          'flex items-center justify-center w-full px-2 py-2 rounded-lg border transition-colors',
                          isOnlyRow
                            ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                            : 'border-neutral-300 text-neutral-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Живой расчёт по позиции */}
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
                    <span>
                      Недостача:{' '}
                      <b className="text-neutral-900">{format(rowResult.shortage, 0)} шт.</b>
                    </span>
                    <span>
                      Ущерб по позиции:{' '}
                      <b className="text-neutral-900">{format(rowResult.amount)} BYN</b>
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addSpecificationRow}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-[#7b1fa2] hover:bg-[#6a1b91] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить товар в акт
            </button>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
