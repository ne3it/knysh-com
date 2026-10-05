import type { DraftValue } from '@/lib/store/constructionStore';

/**
 * Форматирование чисел, денег и единиц измерения для раздела «Строительный» (/const).
 *
 * Всё считается в BYN и показывается в белорусском формате: неразрывный пробел
 * между разрядами и запятая в дробной части. На объекте это важно — «1200,5»
 * читается как «двенадцать с половиной», а «1 200,5» как «тысяча двести».
 *
 * Числа в сметах — ТАБУЛИЧНЫЕ (на инпуте), поэтому почти все функции
 * возвращают строку, а не число: React не должен превращать «12,5» в «12.5».
 */

const NBSP = '\u00A0';
const RU = 'ru-RU';

/** Денежная сумма: 1 234,56 BYN */
export function formatByn(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat(RU, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}${NBSP}BYN`;
}

/** Деньги без копеек — для крупных итогов сметы, где копейки не читаются */
export function formatBynShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat(RU, { maximumFractionDigits: 0 }).format(value)}${NBSP}BYN`;
}

/** Цена единицы: 172,00 BYN/м³ */
export function formatUnitPrice(value: number, unit: string): string {
  return `${formatByn(value)}/${unit}`;
}

/** Обычное число с фиксированной точностью */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(RU, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Целое число без дробной части: 240 блоков, 15 стропил */
export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(RU, { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** Площадь: 30 м² */
export function formatM2(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}${NBSP}м²`;
}

/** Объём: 12 м³ */
export function formatM3(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}${NBSP}м³`;
}

/** Длина в метрах с тремя знаками — так подрядчики передают размеры */
export function formatM(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}${NBSP}м`;
}

/** Миллиметры: 625 мм */
export function formatMm(value: number): string {
  return `${formatInt(value)}${NBSP}мм`;
}

/** Килограммы: 225 кг */
export function formatKg(value: number, digits = 1): string {
  return `${formatNumber(value, digits)}${NBSP}кг`;
}

/** Тонны: 0,245 т */
export function formatT(value: number, digits = 3): string {
  return `${formatNumber(value, digits)}${NBSP}т`;
}

/**
 * Русские склонения по числу: 1 блок / 2 блока / 5 блоков.
 *
 * На объекте «блоков» вместо «блока» в смете выглядит как ошибка сметчика,
 * поэтому склонение не украшение, а часть расчёта.
 */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.round(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** «240 блоков» одной строкой */
export function pluralize(count: number, forms: [string, string, string]): string {
  return `${formatInt(count)}${NBSP}${plural(count, forms)}`;
}

/** Готовые формы под основные единицы раздела */
export const PLURALS = {
  block: ['блок', 'блока', 'блоков'] as [string, string, string],
  bag: ['мешок', 'мешка', 'мешков'] as [string, string, string],
  pallet: ['паллета', 'паллеты', 'паллет'] as [string, string, string],
  piece: ['шт', 'шт', 'шт'] as [string, string, string],
  rafter: ['стропило', 'стропила', 'стропил'] as [string, string, string],
  bar: ['стержень', 'стержня', 'стержней'] as [string, string, string],
  row: ['ряд', 'ряда', 'рядов'] as [string, string, string],
  hour: ['час', 'часа', 'часов'] as [string, string, string],
  meter: ['пог. м', 'пог. м', 'пог. м'] as [string, string, string],
  layer: ['слой', 'слоя', 'слоёв'] as [string, string, string],
} satisfies Record<string, [string, string, string]>;

/** Процент: 5 % */
export function formatPercent(value: number, digits = 0): string {
  return `${formatNumber(value, digits)}${NBSP}%`;
}

/** Время автосохранения: «сохранено в 14:32» */
export function formatSavedAt(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `сохранено в ${date.toLocaleTimeString(RU, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Текущая дата для шапки сметы: 04.10.2026 */
export function formatDateRu(date = new Date()): string {
  return date.toLocaleDateString(RU, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Значение инпута → строка для показа в поле результата.
 *
 * Пустая строка и «0» — разные вещи для пользователя: «0 блоков» это ошибка
 * ввода, а пустое поле это «ещё не введено». Разводим их явно.
 */
export function displayValue(raw: DraftValue | undefined): string {
  if (raw === undefined || raw === '') return '';
  if (typeof raw === 'boolean') return raw ? 'да' : 'нет';
  return String(raw);
}