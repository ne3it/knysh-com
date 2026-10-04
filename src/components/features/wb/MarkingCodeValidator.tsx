'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export interface MarkingCategory {
  id: string;
  name: string;
  /** RegExp для проверки структуры кода; null — для пользовательского ввода */
  regex: RegExp | null;
}

export interface MarkingCategoryGroup {
  group: string;
  categories: MarkingCategory[];
}

export const CUSTOM_CATEGORY_ID = 'mark_custom';

/**
 * Стандартные маски кодов маркировки согласно Указу № 243 / Честный Знак.
 * Структура: 01 + GTIN-14 (14 цифр) + 21 + Serial (13 или 7 символов).
 */
const SERIAL_13_REGEX = new RegExp(
  "^01\\d{14}21[a-zA-Z0-9!\"&'()*+,\\-./:;<=>?_]{13}"
);
const SERIAL_7_REGEX = new RegExp(
  "^01\\d{14}21[a-zA-Z0-9!\"&'()*+,\\-./:;<=>?_]{7}"
);

/**
 * Ультимативный официальный список товарных групп от Оperator ВМР.
 * Группы соответствуют категориям товаров, подпадающим под обязательную маркировку.
 */
export const MARKING_CATEGORY_GROUPS: MarkingCategoryGroup[] = [
  {
    group: 'Легкая промышленность и обувь',
    categories: [
      {
        id: 'clothes',
        name: 'Одежда, блузки, куртки, пальто (Format: GTIN 14 + Serial 13)',
        regex: SERIAL_13_REGEX,
      },
      {
        id: 'shoes',
        name: 'Обувь и кожаные изделия (Format: GTIN 14 + Serial 13)',
        regex: SERIAL_13_REGEX,
      },
      {
        id: 'bedding',
        name: 'Постельное и кухонное белье',
        regex: SERIAL_13_REGEX,
      },
    ],
  },
  {
    group: 'Косметика и гигиена',
    categories: [
      {
        id: 'perfumes',
        name: 'Духи и туалетная вода (Format: GTIN 14 + Serial 7)',
        regex: SERIAL_7_REGEX,
      },
      {
        id: 'care',
        name: 'Средства ухода за кожей и волосами',
        regex: SERIAL_13_REGEX,
      },
    ],
  },
  {
    group: 'Прочие товары',
    categories: [
      {
        id: 'tires',
        name: 'Шины и автомобильные покрышки',
        regex: SERIAL_13_REGEX,
      },
      {
        id: 'medical',
        name: 'Медицинские изделия и БАДы',
        regex: SERIAL_13_REGEX,
      },
    ],
  },
  {
    group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
    categories: [
      {
        id: CUSTOM_CATEGORY_ID,
        name: 'Другой тип маркировки (ввести маску/регулярное выражение вручную)',
        regex: null,
      },
    ],
  },
];

export const DEFAULT_CATEGORY_ID = 'clothes';

export function getMarkingCategory(id: string): MarkingCategory {
  for (const group of MARKING_CATEGORY_GROUPS) {
    const found = group.categories.find((c) => c.id === id);
    if (found) return found;
  }
  return MARKING_CATEGORY_GROUPS[0].categories[0];
}

interface FormState {
  category: string;
  customRegex: string;
  invoiceCodes: string;
  shipmentCodes: string;
}

const DEFAULT_FORM: FormState = {
  category: DEFAULT_CATEGORY_ID,
  customRegex: '',
  invoiceCodes: '',
  shipmentCodes: '',
};

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const inputClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const textareaClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-y min-h-[120px] font-mono text-sm';

type ReportStatus = 'empty' | 'green' | 'yellow' | 'red';

const REPORT_TONES: Record<
  ReportStatus,
  {
    box: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }
> = {
  empty: {
    box: 'bg-neutral-50 border-neutral-200',
    text: 'text-neutral-500',
    icon: AlertTriangle,
    iconColor: 'text-neutral-400',
  },
  green: {
    box: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
  },
  yellow: {
    box: 'bg-violet-50 border-violet-300',
    text: 'text-violet-950',
    icon: AlertTriangle,
    iconColor: 'text-violet-700',
  },
  red: {
    box: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: XCircle,
    iconColor: 'text-red-600',
  },
};

/** Разбивает текст на массив строк, удаляя пробелы по краям и пустые строки */
function splitIntoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Диагностирует, почему код не прошёл валидацию */
function diagnoseCode(code: string, regex: RegExp | null): string {
  if (regex === null) {
    return 'регулярное выражение не задано';
  }

  if (!code.startsWith('01')) {
    return 'отсутствует префикс 01 (GTIN)';
  }

  if (!code.includes('21')) {
    return 'отсутствует маркер 21 (Serial)';
  }

  if (!regex.test(code)) {
    const validChars = /^[a-zA-Z0-9!"&'()*+,.\-/:;<=>?_\s]+$/;
    if (!validChars.test(code)) {
      return 'обнаружены недопустимые символы';
    }
    return 'не соответствует стандарту ТР ТС / Указа № 243 (неверная длина или структура)';
  }

  return '';
}

interface ValidationIssue {
  code: string;
  reason: string;
}

interface ValidationResult {
  status: ReportStatus;
  message: string;
  issues: ValidationIssue[];
  missingCount: number;
  duplicateCount: number;
  invoiceValidCount: number;
  invoiceTotalCount: number;
  shipmentValidCount: number;
  shipmentTotalCount: number;
}

function validateMarkingCodes(
  category: MarkingCategory,
  customRegex: string,
  invoiceText: string,
  shipmentText: string
): ValidationResult {
  const invoiceLines = splitIntoLines(invoiceText);
  const shipmentLines = splitIntoLines(shipmentText);

  const isCustom = category.id === CUSTOM_CATEGORY_ID;

  let regex: RegExp | null = null;
  if (isCustom) {
    if (customRegex.trim()) {
      try {
        regex = new RegExp(customRegex);
      } catch {
        regex = null;
      }
    }
  } else {
    regex = category.regex;
  }

  const issues: ValidationIssue[] = [];

  // 1. Валидация кодов из накладной
  const invoiceValid: string[] = [];
  for (const code of invoiceLines) {
    if (regex && regex.test(code)) {
      invoiceValid.push(code);
    } else {
      issues.push({ code, reason: diagnoseCode(code, regex) });
    }
  }

  // 2. Валидация кодов из отгрузки WB
  const shipmentValid: string[] = [];
  for (const code of shipmentLines) {
    if (regex && regex.test(code)) {
      shipmentValid.push(code);
    } else {
      issues.push({ code, reason: diagnoseCode(code, regex) });
    }
  }

  // 3. Проверка пересечения: коды из отгрузки, отсутствующие в накладной
  const invoiceSet = new Set(invoiceValid);
  const missing: string[] = [];
  for (const code of shipmentValid) {
    if (!invoiceSet.has(code)) {
      missing.push(code);
    }
  }

  // 4. Подсчёт дубликатов в отгрузке
  const shipmentCounts = new Map<string, number>();
  for (const code of shipmentLines) {
    shipmentCounts.set(code, (shipmentCounts.get(code) || 0) + 1);
  }
  const duplicateCount = Array.from(shipmentCounts.values()).filter((c) => c > 1).length;

  const missingCount = missing.length;

  // Приоритет: красный > жёлтый > зелёный
  if (issues.length > 0) {
    return {
      status: 'red',
      message: `Ошибка! ${issues.length} код(а/ов) не соответствуют стандарту ТР ТС / Указа № 243. Исправьте перед отправкой на WB, иначе грозит конкристация товара!`,
      issues,
      missingCount,
      duplicateCount,
      invoiceValidCount: invoiceValid.length,
      invoiceTotalCount: invoiceLines.length,
      shipmentValidCount: shipmentValid.length,
      shipmentTotalCount: shipmentLines.length,
    };
  }

  if (missingCount > 0) {
    return {
      status: 'yellow',
      message: `Внимание! Обнаружены коды, которых нет в накладной (Дубликаты или пересорт: ${missingCount} шт.). Проверьте партию.`,
      issues: missing.map((c) => ({ code: c, reason: 'не найден в накладной' })),
      missingCount,
      duplicateCount,
      invoiceValidCount: invoiceValid.length,
      invoiceTotalCount: invoiceLines.length,
      shipmentValidCount: shipmentValid.length,
      shipmentTotalCount: shipmentLines.length,
    };
  }

  return {
    status: 'green',
    message:
      'Успешно! Все коды прошли валидацию структуры и сопоставлены с накладной. Груз легален для продажи из РБ на РФ.',
    issues: [],
    missingCount: 0,
    duplicateCount,
    invoiceValidCount: invoiceValid.length,
    invoiceTotalCount: invoiceLines.length,
    shipmentValidCount: shipmentValid.length,
    shipmentTotalCount: shipmentLines.length,
  };
}

export default function MarkingCodeValidator({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const category = useMemo(() => getMarkingCategory(form.category), [form.category]);
  const isCustom = form.category === CUSTOM_CATEGORY_ID;

  const customRegexValid = useMemo(() => {
    if (!isCustom || !form.customRegex.trim()) return null;
    try {
      new RegExp(form.customRegex);
      return true;
    } catch {
      return false;
    }
  }, [isCustom, form.customRegex]);

  const result = useMemo(() => {
    if (!form.invoiceCodes.trim() && !form.shipmentCodes.trim()) {
      return undefined;
    }
    return validateMarkingCodes(
      category,
      form.customRegex,
      form.invoiceCodes,
      form.shipmentCodes
    );
  }, [category, form.customRegex, form.invoiceCodes, form.shipmentCodes]);

  const tone = result ? REPORT_TONES[result.status] : REPORT_TONES.empty;
  const Icon = tone.icon;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Форма параметров */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Параметры проверки
          </h3>

          <div className="space-y-4">
            {/* Выбор товарной группы */}
            <div>
              <label
                className="block text-sm font-medium text-neutral-700 mb-1"
                htmlFor="marking-category"
              >
                Товарная группа маркировки (Указ № 243 / Честный Знак)
              </label>
              <select
                id="marking-category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                onInput={(e) => updateField('category', e.currentTarget.value)}
                className={selectClass}
              >
                {MARKING_CATEGORY_GROUPS.map(({ group, categories }) => (
                  <optgroup key={group} label={group}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Пользовательское регулярное выражение */}
            {isCustom && (
              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="marking-custom-regex"
                >
                  Пользовательское регулярное выражение (Regex)
                </label>
                <input
                  id="marking-custom-regex"
                  type="text"
                  value={form.customRegex}
                  onChange={(e) => updateField('customRegex', e.target.value)}
                  onInput={(e) => updateField('customRegex', e.currentTarget.value)}
                  className={inputClass}
                  placeholder='^01\d{14}21[...]{...}'
                />
                {form.customRegex.trim() && customRegexValid === false && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Некорректное регулярное выражение
                  </p>
                )}
              </div>
            )}

            {/* Коды из накладной */}
            <div>
              <label
                className="block text-sm font-medium text-neutral-700 mb-1"
                htmlFor="marking-invoice"
              >
                Коды маркировки из накладной / Электронного знака
              </label>
              <textarea
                id="marking-invoice"
                value={form.invoiceCodes}
                onChange={(e) => updateField('invoiceCodes', e.target.value)}
                onInput={(e) => updateField('invoiceCodes', e.currentTarget.value)}
                className={textareaClass}
                placeholder="Вставьте сюда коды из накладной (каждый код с новой строкы)..."
                rows={5}
              />
            </div>

            {/* Коды из отгрузки WB */}
            <div>
              <label
                className="block text-sm font-medium text-neutral-700 mb-1"
                htmlFor="marking-shipment"
              >
                Коды маркировки из личного кабинета WB / УПД отгрузки
              </label>
              <textarea
                id="marking-shipment"
                value={form.shipmentCodes}
                onChange={(e) => updateField('shipmentCodes', e.target.value)}
                onInput={(e) => updateField('shipmentCodes', e.currentTarget.value)}
                className={textareaClass}
                placeholder="Вставьте сюда коды, подготовленные для Wildberries..."
                rows={5}
              />
            </div>

            {/* Кнопка сброса */}
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
                Валидация выполняется автоматически при изменении полей
              </span>
            </div>
          </div>
        </div>

        {/* Результат валидации */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Результат валидации
          </h3>

          {!result ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-neutral-400 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-700">
                  Ожидание ввода кодов маркировки
                </p>
                <p className="text-sm mt-1 text-neutral-500">
                  Выберите товарную группу и вставьте коды из накладной и из
                  личного кабинета WB, чтобы выполнить проверку.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn('rounded-lg border p-4 flex items-start gap-3', tone.box)}
            >
              <span className="mt-0.5">
                <Icon
                  className={cn('w-5 h-5', tone.iconColor)}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-semibold', tone.text)}>
                  {result.message}
                </p>

                {result.status === 'red' && result.issues.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-60 overflow-auto">
                    {result.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-red-800 bg-red-100/50 rounded p-1.5"
                      >
                        Ошибка! Код «
                        <span className="font-mono break-all">{issue.code}</span>» не
                        соответствует стандарту ТР ТС / Указа № 243. Обнаружено:{' '}
                        {issue.reason}. Исправьте перед отправкой на WB, иначе
                        грозит конкристация товара!
                      </div>
                    ))}
                  </div>
                )}

                {result.status === 'yellow' && result.issues.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-60 overflow-auto">
                    {result.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-violet-900 bg-violet-100/60 rounded p-1.5"
                      >
                        Код «
                        <span className="font-mono break-all">{issue.code}</span>» —{' '}
                        {issue.reason}
                      </div>
                    ))}
                  </div>
                )}

                {/* Сводка статистики */}
                <div
                  className={cn(
                    'mt-3 text-xs',
                    result.status === 'red'
                      ? 'text-red-700'
                      : result.status === 'yellow'
                        ? 'text-violet-900'
                        : 'text-neutral-600'
                  )}
                >
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Накладная: {result.invoiceValidCount}/{result.invoiceTotalCount}{' '}
                      валидных
                    </span>
                    <span>
                      Отгрузка WB:{' '}
                      {result.shipmentValidCount}/{result.shipmentTotalCount} валидных
                    </span>
                    {result.missingCount > 0 && (
                      <span>Пропущено в накладной: {result.missingCount} шт.</span>
                    )}
                    {result.duplicateCount > 0 && (
                      <span>
                        Дубликатов в отгрузке: {result.duplicateCount} позиций
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionContentWrapper>
  );
}
