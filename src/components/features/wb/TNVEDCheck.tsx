'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck, FileText, RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { jsPDF } from 'jspdf';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from '@/lib/fonts';
import type { Feature } from '@/types/section';

type ProductStatus = 'clear' | 'declaration' | 'certificate';

export interface TNVEDProduct {
  name: string;
  tnved: string;
  status: ProductStatus;
  text: string;
}

const CLEAR_TEXT =
  'Товар не подлежит обязательной сертификации и декларированию в ЕАЭС. Достаточно отказного письма.';

/** Популярные категории товаров WB с вердиктом по обязательному подтверждению соответствия (ТР ТС) */
export const TNVED_PRODUCTS: TNVEDProduct[] = [
  // КАТЕГОРИИ ПОД ОТКАЗНОЕ ПИСЬМО (status: "clear")
  { name: 'Зеркала интерьерные без подсветки', tnved: '7009920000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Свечи восковые, парафиновые, стеариновые', tnved: '3406000000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Бижутерия и украшения для волос (не драгметаллы)', tnved: '7117190000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Чехлы и бамперы для мобильных телефонов', tnved: '4202321000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Рамки для фотографий и картин (дерево, пластик)', tnved: '4414001000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Искусственные цветы, растения и кашпо', tnved: '6702100000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Канцелярия для взрослых (ежедневники, ручки, папки)', tnved: '4820103000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Сумки, рюкзаки, городские кошельки (из кожзама/текстиля)', tnved: '4202921900', status: 'clear', text: CLEAR_TEXT },
  { name: 'Зонты от дождя и солнца', tnved: '6601992000', status: 'clear', text: CLEAR_TEXT },
  { name: 'Расчески, щетки для волос, спонжи для макияжа', tnved: '9615110000', status: 'clear', text: CLEAR_TEXT },

  // КАТЕГОРИИ ПОД ДЕКЛАРАЦИЮ (status: "declaration")
  {
    name: 'Одежда верхняя для взрослых (пальто, куртки, плащи)',
    tnved: '6201400000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Товар подлежит обязательному декларированию согласно ТР ТС 017/2011 (Одежда 3-го слоя).',
  },
  {
    name: 'Одежда легкая для взрослых (платья, брюки, юбки, блузки)',
    tnved: '6204430000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Товар подлежит обязательному декларированию согласно ТР ТС 017/2011 (Одежда 2-го слоя).',
  },
  {
    name: 'Обувь для взрослых (кроссовки, ботинки, туфли)',
    tnved: '6403999300',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Товар подлежит обязательному декларированию согласно ТР ТС 017/2011 (Обувь).',
  },
  {
    name: 'Косметика уходовая (кремы, маски для лица, лосьоны)',
    tnved: '3304990000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Продукция подлежит обязательному декларированию соответствия согласно ТР ТС 009/2011 (Косметика).',
  },
  {
    name: 'Парфюмерия, духи и туалетная вода',
    tnved: '3303001000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Продукция подлежит обязательному декларированию соответствия согласно ТР ТС 009/2011 (Парфюмерия).',
  },
  {
    name: 'Посуда столовая и кухонная из керамики или стекла',
    tnved: '6911100000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Требуется обязательное декларирование соответствия по национальным стандартам РБ / ГОСТ.',
  },
  {
    name: 'Постельное белье (простыни, пододеяльники, наволочки)',
    tnved: '6302210000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Товар подлежит обязательному декларированию соответствия согласно ТР ТС 017/2011 (Текстиль).',
  },
  {
    name: 'Продукты питания (орехи, сухофрукты, чай, кофе)',
    tnved: '0901210000',
    status: 'declaration',
    text: 'ВНИМАНИЕ! Пищевая продукция подлежит обязательному декларированию согласно ТР ТС 021/2011.',
  },

  // КАТЕГОРИИ ПОД ОБЯЗАТЕЛЬНУЮ СЕРТИФИКАЦИЮ (status: "certificate")
  {
    name: 'Белье нательное, пижамы, купальники, боди (1-й слой)',
    tnved: '6107110000',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Товар подлежит жесткой ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ согласно ТР ТС 017/2011 с испытанием образцов.',
  },
  {
    name: 'Игрушки детские пластмассовые, мягкие, настольные',
    tnved: '9503007000',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Детские игрушки подлежат ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ согласно жесткому ТР ТС 008/2011.',
  },
  {
    name: 'Детская одежда и трикотажные изделия (все слои)',
    tnved: '6111209000',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Продукция для детей подлежит ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ согласно ТР ТС 007/2011.',
  },
  {
    name: 'Детская обувь (любые виды)',
    tnved: '6403919600',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Детская обувь подлежит ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ согласно ТР ТС 007/2011.',
  },
  {
    name: 'Бытовая техника малая (чайники, тостеры, блендеры)',
    tnved: '8516797000',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Электроприборы подлежат ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ по ТР ТС 004/2011 и ТР ТС 020/2011.',
  },
  {
    name: 'Фены, выпрямители, плойки для волос электрические',
    tnved: '8516310000',
    status: 'certificate',
    text: 'КРИТИЧЕСКИ ОПАСНО! Приборы личной гигиены подлежат ОБЯЗАТЕЛЬНОЙ СЕРТИФИКАЦИИ по ТР ТС 004/2011.',
  },
  {
    name: 'Бытовая химия (стиральные порошки, гели, кондиционеры)',
    tnved: '3402500000',
    status: 'certificate',
    text: 'ВНИМАНИЕ! Требуется Свидетельство о государственной регистрации (СГР) Министерства здравоохранения РБ.',
  },
  {
    name: 'Биологически активные добавки к пище (БАДы)',
    tnved: '2106909809',
    status: 'certificate',
    text: 'ВНИМАНИЕ! БАДы требуют обязательного получения Свидетельства о госрегистрации (СГР) согласно ТР ТС 021/2011.',
  },
];

/** Подписи статусов для выпадающего списка и плашки вердикта */
const STATUS_LABELS: Record<ProductStatus, string> = {
  clear: 'отказное письмо',
  declaration: 'декларация соответствия',
  certificate: 'обязательный сертификат',
};

/**
 * Первые две цифры кода ТН ВЭД (код товарной группы), которые потенциально
 * подпадают под обязательное подтверждение соответствия по ТР ТС / ТР ЕАЭС.
 */
const REGULATED_GROUPS: Record<string, { status: ProductStatus; label: string }> = {
  '61': { status: 'certificate', label: 'Одежда и трикотажные изделия (в т.ч. детские)' },
  '62': { status: 'certificate', label: 'Одежда верхняя и лёгкая' },
  '64': { status: 'certificate', label: 'Обувь (в т.ч. детская)' },
  '85': { status: 'declaration', label: 'Электрооборудование и бытовая техника' },
  '95': { status: 'certificate', label: 'Игрушки' },
};

const REGULATED_WARNING =
  'Внимание! Данная товарная группа потенциально подпадает под технические регламенты ТР ТС (017/2011, 004/2011, 008/2011). Проверьте точные требования в реестре Госстандарта РБ.';

const MANUAL_CLEAR_TEXT =
  'Потенциально не подлежит обязательной сертификации. Вы можете сформировать проект заявления-запроса.';

/**
 * Ключевые слова для ручного ввода без кода ТН ВЭД: если название содержит один
 * из них, товар считается потенциально регулируемым, чтобы не выдать ложное
 * «отказное письмо» на детские или электрические товары.
 */
const RISKY_KEYWORDS = [
  'игрушк',
  'детск',
  'белье',
  'бельё',
  'пижам',
  'купальник',
  'одежд',
  'обув',
  'фен',
  'выпрямит',
  'плойк',
  'чайник',
  'тостер',
  'блендер',
  'миксер',
  'электр',
];

/** Результат проверки: либо запись из базы, либо универсальный ручной fallback */
export interface TNVEDResolution extends TNVEDProduct {
  /** true — запись найдена в базе, false — подобран автоматически по ручному вводу */
  fromDatabase: boolean;
}

interface FormState {
  query: string;
  organization: string;
  unp: string;
  address: string;
  director: string;
}

const DEFAULT_FORM: FormState = {
  query: 'Зеркала интерьерные без подсветки',
  organization: 'ИП Кныш А.А.',
  unp: '193674829',
  address: 'г. Минск, ул. Скрипникова, д. 12, кв. 45',
  director: 'Кныш Андрей Александрович',
};

const inputClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

/** Нормализация строки для «живого» поиска без учёта регистра и лишних пробелов */
function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Ищет товар в базе по точному названию или по вхождению числового кода ТН ВЭД */
function findInDatabase(query: string): TNVEDProduct | null {
  const normalized = normalize(query);
  if (!normalized) return null;

  const byName = TNVED_PRODUCTS.find((product) => normalize(product.name) === normalized);
  if (byName) return byName;

  const digits = normalized.replace(/\D/g, '');
  if (digits) {
    const byCode = TNVED_PRODUCTS.find((product) => product.tnved.includes(digits));
    if (byCode) return byCode;
  }

  return null;
}

/** Отделяет 10-значный код ТН ВЭД от произвольного названия товара */
function splitQuery(query: string): { name: string; code: string } {
  const codeMatch = query.match(/\b\d{10}\b/);
  if (!codeMatch) return { name: query.trim(), code: '' };

  const code = codeMatch[0];
  const codeIndex = codeMatch.index ?? query.indexOf(code);
  const name = (query.slice(0, codeIndex) + query.slice(codeIndex + code.length))
    .replace(/\s+/g, ' ')
    .trim();
  return { name, code };
}

/**
 * Определяет статус для товара, введённого вручную и отсутствующего в базе.
 * Решение принимается по первым двум цифрам кода ТН ВЭД (товарная группа).
 */
export function resolveManualProduct(query: string): TNVEDProduct | null {
  const { name, code } = splitQuery(query);
  const displayName = name || `Товар с кодом ТН ВЭД ${code}`;

  if (code) {
    const group = REGULATED_GROUPS[code.slice(0, 2)];
    if (group) {
      return {
        name: displayName,
        tnved: code,
        status: group.status,
        text: `${REGULATED_WARNING} Товарная группа: ${group.label}.`,
      };
    }

    return { name: displayName, tnved: code, status: 'clear', text: MANUAL_CLEAR_TEXT };
  }

  // Ручной ввод без кода ТН ВЭД: опираемся только на название товара
  if (!name) return null;

  const normalizedName = normalize(name);
  const risky = RISKY_KEYWORDS.some((keyword) => normalizedName.includes(keyword));
  if (risky) {
    return {
      name: displayName,
      tnved: 'не указан',
      status: 'certificate',
      text: `${REGULATED_WARNING} Код ТН ВЭД не указан — укажите его для точной проверки.`,
    };
  }

  return { name: displayName, tnved: 'не указан', status: 'clear', text: MANUAL_CLEAR_TEXT };
}

/**
 * Универсальное разрешение запроса: сначала точное совпадение с базой,
 * иначе — нейтральный режим ручного ввода без ошибки.
 */
export function resolveQuery(query: string): TNVEDResolution | null {
  if (!normalize(query)) return null;

  const fromDb = findInDatabase(query);
  if (fromDb) return { ...fromDb, fromDatabase: true };

  const manual = resolveManualProduct(query);
  return manual ? { ...manual, fromDatabase: false } : null;
}

function filterProducts(query: string): TNVEDProduct[] {
  const normalized = normalize(query);
  if (!normalized) return TNVED_PRODUCTS;

  const digits = normalized.replace(/\D/g, '');
  return TNVED_PRODUCTS.filter((product) => {
    if (digits && product.tnved.includes(digits)) return true;
    return normalize(product.name).includes(normalized);
  });
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'tovar'
  );
}

function registerPdfFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  return doc;
}

export default function TNVEDCheck({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const suggestions = useMemo(() => filterProducts(form.query), [form.query]);
  const product = useMemo(() => resolveQuery(form.query), [form.query]);
  const isClear = product?.status === 'clear';
  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelect = (selected: TNVEDProduct) => {
    setForm((prev) => ({ ...prev, query: selected.name }));
    setIsOpen(false);
  };

  const handleDownloadPdf = () => {
    if (!product || product.status !== 'clear') return;

    const doc = registerPdfFont(new jsPDF({ unit: 'mm', format: 'a4' }));
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const rightEdge = pageWidth - margin;
    const lineHeight = 5.2;
    let cursorY = 22;

    /** Сохраняет блок на той же странице, при нехватке места переносит на новую */
    const ensureSpace = (needed: number) => {
      if (cursorY + needed <= pageHeight - margin) return;
      doc.addPage();
      cursorY = margin;
    };

    /** Печатает текст с автоматическим переносом по ширине листа A4 */
    const writeWrapped = (
      text: string,
      options: {
        align?: 'left' | 'center' | 'right' | 'justify';
        width?: number;
        x?: number;
        style?: 'normal' | 'bold';
        size?: number;
        color?: [number, number, number];
        indent?: number;
      } = {}
    ) => {
      const {
        align = 'left',
        width = contentWidth,
        x = margin,
        style = 'normal',
        size = 11,
        color = [40, 40, 40],
        indent = 0,
      } = options;

      doc.setFont('Roboto', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);

      const available = width - indent;
      const lines = doc.splitTextToSize(text, available) as string[];
      ensureSpace(lines.length * lineHeight + 2);
      doc.text(text, x + indent, cursorY, { maxWidth: available, align });
      cursorY += lines.length * lineHeight;
    };

    // 1. Официальная шапка (правый блок)
    writeWrapped('Кому: Руководителю органа по сертификации', {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    writeWrapped('продукции и услуг', { align: 'right', x: margin, width: contentWidth });
    writeWrapped('(Аккредитованному органу по сертификации РБ)', {
      align: 'right',
      x: margin,
      width: contentWidth,
      size: 10,
      color: [100, 100, 100],
    });
    cursorY += 6;

    // 2. Данные заявителя
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY - 3, rightEdge, cursorY - 3);
    cursorY += 3;

    writeWrapped(`От кого: ${form.organization || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
      style: 'bold',
    });
    writeWrapped(`УНП: ${form.unp || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    writeWrapped(`Юридический адрес: ${form.address || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    writeWrapped('Контакты: тел. ________________, e-mail: ________________', {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    writeWrapped('Исх. № ________ от "___" ________ 202__ г.', {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    cursorY += 8;

    // 3. Заголовок по центру
    writeWrapped('ЗАЯВЛЕНИЕ-ЗАПРОС', {
      align: 'center',
      x: margin,
      width: contentWidth,
      style: 'bold',
      size: 14,
      color: [126, 27, 177],
    });
    writeWrapped('о необходимости обязательного подтверждения соответствия', {
      align: 'center',
      x: margin,
      width: contentWidth,
      style: 'bold',
      size: 12,
    });
    cursorY += 4;

    doc.setDrawColor(126, 27, 177);
    doc.setLineWidth(1.2);
    doc.line(margin, cursorY, rightEdge, cursorY);
    cursorY += 10;

    // 4. Официальный текст с выравниванием по ширине
    writeWrapped(
      'Просим Вас дать официальные разъяснения о необходимости обязательного подтверждения соответствия (сертификации или декларирования) в рамках технических регламентов Таможенного союза (ТР ТС / ТР ЕАЭС) и национального законодательства Республики Беларусь в отношении следующей продукции:',
      { align: 'justify' }
    );
    cursorY += 4;

    writeWrapped(`Наименование товара: ${product.name}`, { align: 'justify' });
    writeWrapped(
      product.tnved === 'не указан'
        ? 'Код ТН ВЭД ЕАЭС: ________________'
        : `Код ТН ВЭД ЕАЭС: ${product.tnved}`,
      { align: 'justify' }
    );
    writeWrapped('Назначение: Для реализации на маркетплейсах и в розничной сети.', {
      align: 'justify',
    });
    cursorY += 4;

    writeWrapped(
      'Настоящим письмом гарантируем, что указанная продукция не предназначена для детей и подростков, не является медицинским изделием и не имеет промышленного высококовольтного питания.',
      { align: 'justify' }
    );
    cursorY += 6;

    // 5. Подпись и печать (в подвале документа)
    ensureSpace(34);
    const footerY = Math.max(cursorY, pageHeight - margin - 26);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Руководитель ___________ / ' + (form.director || '________________'), margin, footerY, {
      maxWidth: contentWidth,
    });
    doc.text('М.П. (Место для печати)', margin, footerY + 8, { maxWidth: contentWidth });
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(`Сформировано ${new Date().toLocaleDateString('ru-RU')}`, margin, footerY + 18, {
      maxWidth: contentWidth,
    });

    doc.save(`Otkaznoe_Pismo_${sanitizeFileName(product.name)}.pdf`);
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Форма */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Данные для проверки</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Выберите категорию товара или укажите код ТН ВЭД
            </p>

            <div className="space-y-4">
              <div ref={containerRef}>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="tnved-query"
                >
                  Категория товара или код ТН ВЭД
                </label>
                <div className="relative">
                  <input
                    id="tnved-query"
                    type="text"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls="tnved-suggestions"
                    aria-autocomplete="list"
                    value={form.query}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                      updateField('query', e.target.value);
                      setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsOpen(false);
                    }}
                    className={cn(inputClass, 'pr-9')}
                    placeholder="Например: зеркала или 7009920000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Search className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>

                {isOpen && suggestions.length > 0 && (
                  <ul
                    id="tnved-suggestions"
                    role="listbox"
                    className="mt-2 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100"
                  >
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.name} role="option" aria-selected={normalize(suggestion.name) === normalize(form.query)}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(suggestion)}
                          className={cn(
                            'w-full text-left px-3 py-2 transition-colors hover:bg-neutral-50',
                            product?.name === suggestion.name && 'bg-neutral-50'
                          )}
                        >
                          <span className="block text-sm text-neutral-900">{suggestion.name}</span>
                          <span className="block text-xs text-neutral-500">
                            ТН ВЭД {suggestion.tnved} · {STATUS_LABELS[suggestion.status]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {isOpen && suggestions.length === 0 && (
                  <div className="mt-2 rounded-lg border border-[#7b1fa2]/30 bg-[#7b1fa2]/5 px-3 py-2 text-sm text-neutral-600">
                    Категория не найдена в базе — будет выполнена автоматическая проверка по коду
                    ТН ВЭД. Можно вписать своё название товара.
                  </div>
                )}

                <p className="mt-2 text-xs text-neutral-400">
                  В базе {TNVED_PRODUCTS.length} популярных категорий товаров WB · любой товар
                  вне базы проверяется автоматически по первым двум цифрам кода ТН ВЭД
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="tnved-organization"
                >
                  Название организации / ИП селлера
                </label>
                <input
                  id="tnved-organization"
                  type="text"
                  value={form.organization}
                  onChange={(e) => updateField('organization', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="tnved-unp">
                  УНП
                </label>
                <input
                  id="tnved-unp"
                  type="text"
                  value={form.unp}
                  onChange={(e) => updateField('unp', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="tnved-address">
                  Юридический адрес
                </label>
                <input
                  id="tnved-address"
                  type="text"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="tnved-director">
                  ФИО руководителя для подписи
                </label>
                <input
                  id="tnved-director"
                  type="text"
                  value={form.director}
                  onChange={(e) => updateField('director', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm(DEFAULT_FORM);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Сбросить
                </button>
                <span className="flex-1 self-center text-xs text-neutral-400">
                  Вердикт обновляется автоматически при выборе категории
                </span>
              </div>
            </div>
          </div>

          {/* Результат и превью */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Результат проверки</h3>
            <p className="text-sm text-neutral-500 mb-4">Обязательное подтверждение соответствия по ТР ТС</p>

            <div
              className={cn(
                'rounded-lg border p-4 flex items-start gap-3',
                !product
                  ? 'bg-neutral-50 border-neutral-200'
                  : isClear
                    ? 'bg-emerald-50 border-emerald-200'
                    : product.status === 'declaration'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
              )}
            >
              <span className="mt-0.5">
                {!product ? (
                  <Search className="w-5 h-5 text-neutral-400" aria-hidden="true" />
                ) : isClear ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                ) : product.status === 'declaration' ? (
                  <FileCheck className="w-5 h-5 text-amber-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                {product ? (
                  <>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isClear
                          ? 'text-emerald-800'
                          : product.status === 'declaration'
                            ? 'text-amber-800'
                            : 'text-red-800'
                      )}
                    >
                      {product.fromDatabase
                        ? isClear
                          ? 'Товар успешно проверен. Оформление дорогого сертификата не требуется!'
                          : product.status === 'declaration'
                            ? 'Требуется декларация о соответствии'
                            : 'Требуется обязательный сертификат соответствия'
                        : isClear
                          ? MANUAL_CLEAR_TEXT
                          : REGULATED_WARNING}
                    </p>
                    <p
                      className={cn(
                        'text-sm mt-1',
                        isClear
                          ? 'text-emerald-700'
                          : product.status === 'declaration'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      )}
                    >
                      {product.fromDatabase
                        ? product.text
                        : isClear
                          ? 'Наименование и код ТН ВЭД взяты из строки поиска и будут подставлены в бланк-запрос.'
                          : product.text}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Код ТН ВЭД: <span className="font-medium text-neutral-700">{product.tnved}</span>
                      {' · '}
                      <span className="font-medium text-neutral-700">
                        {STATUS_LABELS[product.status]}
                      </span>
                      {' · '}
                      <span className="italic">
                        {product.fromDatabase ? 'запись из базы' : 'ручной ввод, автоопределение'}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-neutral-700">Ожидание ввода товара</p>
                    <p className="text-sm mt-1 text-neutral-500">
                      Выберите категорию из списка, впишите свой товар или укажите 10-значный код
                      ТН ВЭД, чтобы получить вердикт.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Превью документа */}
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Превью отказного письма
              </p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-right text-xs text-neutral-600 space-y-0.5">
                  <p className="font-medium text-neutral-800">
                    Кому: Руководителю органа по сертификации
                  </p>
                  <p className="font-medium text-neutral-800">продукции и услуг</p>
                  <p className="text-neutral-400">(Аккредитованному органу по сертификации РБ)</p>
                </div>

                <div className="my-2 border-t border-neutral-300" />

                <div className="text-right text-xs text-neutral-600 space-y-0.5">
                  <p>
                    От кого: <span className="font-medium text-neutral-900">{form.organization || '—'}</span>
                  </p>
                  <p>
                    УНП: <span className="font-medium text-neutral-900">{form.unp || '—'}</span>
                  </p>
                  <p>
                    Юридический адрес:{' '}
                    <span className="font-medium text-neutral-900">{form.address || '—'}</span>
                  </p>
                  <p>Контакты: тел. ________________, e-mail: ________________</p>
                  <p>Исх. № ________ от &quot;___&quot; ________ 202__ г.</p>
                </div>

                <p className="mt-4 text-center text-sm font-semibold text-[#7b1fa2]">
                  ЗАЯВЛЕНИЕ-ЗАПРОС
                  <span className="block text-xs font-bold text-neutral-800">
                    о необходимости обязательного подтверждения соответствия
                  </span>
                </p>

                <div className="my-3 border-t-2 border-[#7b1fa2]" />

                <div className="text-xs text-neutral-700 leading-relaxed text-justify">
                  <p>
                    Просим Вас дать официальные разъяснения о необходимости обязательного
                    подтверждения соответствия (сертификации или декларирования) в рамках
                    технических регламентов Таможенного союза (ТР ТС / ТР ЕАЭС) и национального
                    законодательства Республики Беларусь в отношении следующей продукции:
                  </p>
                  <p className="mt-2">
                    Наименование товара:{' '}
                    <span className="font-medium text-neutral-900">{product?.name ?? '—'}</span>
                  </p>
                  <p>
                    Код ТН ВЭД ЕАЭС:{' '}
                    <span className="font-medium text-neutral-900">{product?.tnved ?? '—'}</span>
                  </p>
                  <p>Назначение: Для реализации на маркетплейсах и в розничной сети.</p>
                  <p className="mt-2">
                    Настоящим письмом гарантируем, что указанная продукция не предназначена для детей
                    и подростков, не является медицинским изделием и не имеет промышленного
                    высококовольтного питания.
                  </p>
                </div>

                <div className="mt-5 space-y-1 text-xs text-neutral-700">
                  <p>
                    Руководитель ___________ / {form.director || '—'}
                  </p>
                  <p>М.П. (Место для печати)</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!isClear}
              className={cn(
                'mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
                isClear
                  ? 'bg-[#7b1fa2] hover:bg-[#7b1fa2]/90'
                  : 'bg-[#7b1fa2]/50 cursor-not-allowed'
              )}
            >
              <Download className="w-4 h-4" />
              Скачать готовое Отказное письмо (PDF)
            </button>

            {!isClear && (
              <p className="mt-2 text-center text-xs text-neutral-400">
                {product
                  ? `Генерация отказного письма недоступна: по этой категории требуется ${STATUS_LABELS[product.status]}`
                  : 'Сначала выберите категорию товара из списка'}
              </p>
            )}

            <div className="mt-4 bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-600">
                  Проверка носит справочный характер. Окончательное решение о необходимости
                  подтверждения соответствия принимает орган по сертификации.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
