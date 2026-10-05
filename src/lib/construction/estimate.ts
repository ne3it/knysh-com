import { DISTRICT_LABELS } from './constants';
import { REGION_COEFFICIENTS } from './prices';
import { formatByn, formatDateRu, formatNumber } from './format';
import type { ConstructionDistrictKey, ConstructionRegionKey } from '@/lib/store/constructionStore';

/**
 * Текстовая смета в BYN — то, что прораб уносит с телефона в мессенджер
 * заказчику или в «Смету» для бухгалтерии.
 *
 * Формат создан как простой текст без разметки: он переживает копирование
 * в Telegram, WhatsApp, почту и заметки, а таблица в Excel на объекте не нужна.
 * Колонки выровнены пробелами, разделитель — точка с запятой.
 *
 * Строки собирает калькулятор: модуль ничего не знает про фундаменты и кладку,
 * он только складывает позиции и считает итоги.
 */

export interface EstimateLine {
  /** Наименование позиции */
  label: string;
  /** Единица измерения: м³, блок, мешок 25 кг, т */
  unit: string;
  /** Количество */
  qty: number;
  /** Цена за единицу в BYN (уже с региональным коэффициентом) */
  price: number;
  /** Уточнение нормы или источник цены — печатается справа */
  note?: string;
}

export interface EstimateInput {
  /** Название расчёта: «Расчет Фундамента» */
  title: string;
  /** Объект: «Дом 10×8 м, 1 этаж» */
  object?: string;
  region: ConstructionRegionKey;
  district?: ConstructionDistrictKey;
  /** Нормативная ссылка в шапке: «СН 2.01.01-2019», «СТБ EN 206-1» */
  standard?: string;
  lines: EstimateLine[];
  /** Итоговые цифры, выведенные калькулятором (для контроля расчёта) */
  totals?: Array<{ label: string; value: string }>;
  /** Примечание внизу сметы */
  footer?: string;
}

export interface EstimateTotals {
  material: number;
  labor: number;
  total: number;
}

/**
 * Итоги по смете. Материалы и работы считаются ОТДЕЛЬНО, потому что
 * региональные коэффициенты у них разные, а заказчик платит одну сумму.
 */
export function computeEstimateTotals(lines: EstimateLine[]): EstimateTotals {
  let material = 0;
  let labor = 0;
  for (const line of lines) {
    const sum = line.qty * line.price;
    // Работа отличается подписью единицы, а не флагом: в смете позиция
    // «Работа: кладка» должна читаться как работа.
    if (line.label.startsWith('Работа')) labor += sum;
    else material += sum;
  }
  return {
    material: round2(material),
    labor: round2(labor),
    total: round2(material + labor),
  };
}

/**
 * Собирает готовый текст сметы.
 *
 * Порядок строк сохраняется как дан: калькулятор уже сгруппировал материалы
 * перед работами, и переставлять их здесь было бы вторжением в расчёт.
 */
export function buildEstimateText(input: EstimateInput): string {
  const coefficients = REGION_COEFFICIENTS[input.region];
  const lines: string[] = [];

  lines.push(`СМЕТА — ${input.title.toUpperCase()}`);
  if (input.object) lines.push(`Объект: ${input.object}`);
  lines.push(
    `Регион: ${coefficients.label} (материалы ×${coefficients.material.toFixed(
      2
    )}, работы ×${coefficients.labor.toFixed(2)})`
  );
  if (input.district) lines.push(`Область: ${DISTRICT_LABELS[input.district] ?? input.district}`);
  if (input.standard) lines.push(`Нормативная база: ${input.standard}`);
  lines.push(`Дата: ${formatDateRu()} · Валюта: BYN`);
  lines.push('');

  // Ширина колонок подобрана под самую длинную подпись позиции, иначе
  // смета «едет» при смене расчёта.
  const labelWidth = Math.max(
    24,
    ...input.lines.map((line) => line.label.length)
  );
  const unitWidth = Math.max(
    8,
    ...input.lines.map((line) => line.unit.length)
  );

  input.lines.forEach((line, index) => {
    const previousIsWork = index > 0 && input.lines[index - 1].label.startsWith('Работа');
    const currentIsWork = line.label.startsWith('Работа');
    if (currentIsWork && !previousIsWork) {
      lines.push('РАБОТЫ');
    }

    const sum = line.qty * line.price;
    lines.push(
      [
        line.label.padEnd(labelWidth, ' '),
        formatNumber(line.qty, 2).padStart(9, ' '),
        line.unit.padEnd(unitWidth, ' '),
        formatNumber(line.price, 2).padStart(10, ' '),
        formatByn(sum).padStart(14, ' '),
        line.note ? ` (${line.note})` : '',
      ].join(' ')
    );
  });

  const totals = computeEstimateTotals(input.lines);
  lines.push('');
  lines.push('-'.repeat(64));
  lines.push(`Материалы: ${formatByn(totals.material)}`);
  lines.push(`Работы:     ${formatByn(totals.labor)}`);
  lines.push(`ВСЕГО:      ${formatByn(totals.total)}`);

  if (input.totals && input.totals.length > 0) {
    lines.push('');
    lines.push('РАСЧЁТНЫЕ ПОКАЗАТЕЛИ');
    input.totals.forEach((item) => {
      lines.push(`${item.label}: ${item.value}`);
    });
  }

  if (input.footer) {
    lines.push('');
    lines.push(input.footer);
  }

  return lines.join('\n');
}

/**
 * Копирование сметы в буфер обмена.
 *
 * `navigator.clipboard` доступен только в защищённом контексте (HTTPS или
 * localhost), поэтому при отказе используется запасной путь через execCommand —
 * на объекте прораб часто заходит по http-адресу из мобильного интернета.
 * Если не сработал и он, текст всё равно возвращается в компонент, который
 * показывает его в модальном окне, чтобы данные не потерялись.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Падаем в запасной путь ниже
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
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}