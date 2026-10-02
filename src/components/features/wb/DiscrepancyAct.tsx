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
  /** Номер накладной / заказа */
  waybill: string;
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
  waybill: 'МНСК-2026/10',
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

/** Текущая дата в формате «02.10.2026» для бланка акта */
function currentDateRu() {
  return new Date().toLocaleDateString('ru-RU');
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

/**
 * Текст мотивировочной части претензии, зависящий от типа нарушения.
 * Для law_custom используется вручную введённое юридическое обоснование —
 * это делает инструмент неуязвимым к изменениям регламентов перевозок.
 */
function buildClaimText(form: FormState, result: DiscrepancyResult): string[] {
  const waybill = form.waybill.trim() || '__________';
  const shortage = result.shortage;
  const amount = format(result.claimAmount);

  switch (form.violation) {
    case 'loss':
      return [
        `При приеме груза по накладной ${waybill} обнаружена недостача в количестве ${shortage} шт.`,
        'На основании Правил автомобильных перевозок грузов РБ (Пост. Совмина №970) и ст. 750 ГК РБ, требуем возместить убытки в размере ' +
          `${amount} BYN.`,
      ];
    case 'inside_loss':
      return [
        `При приеме груза по накладной ${waybill} установлено вскрытие грузовых мест и внутренняя недостача товара в количестве ${shortage} шт.`,
        'На основании Правил автомобильных перевозок грузов РБ (Пост. Совмина №970), ст. 750 и ст. 761 ГК РБ, а также п. 4.11 договора транспортной перевозки требуем возместить убытки в размере ' +
          `${amount} BYN.`,
      ];
    case 'damage':
      return [
        'При передаче груза обнаружено повреждение упаковки.',
        'Товар потерял товарный вид и не подлежит реализации на Wildberries.',
        `Требуем компенсировать стоимость поврежденного товара в размере ${amount} BYN.`,
      ];
    case 'temp_damage':
      return [
        `При приеме груза по накладной ${waybill} обнаружена порча товара в количестве ${shortage} шт. вследствие нарушения перевозчиком температурного режима.`,
        'На основании ст. 750, ст. 761 ГК РБ и Правил автомобильных перевозок грузов РБ (Пост. Совмина №970) требуем возместить убытки в размере ' +
          `${amount} BYN.`,
      ];
    case 'delay':
      return [
        `Груз по накладной ${waybill} доставлен с нарушением нормативных сроков перевозки.`,
        `На основание ст. 752 ГК РБ и Правил автомобильных перевозок грузов РБ (Пост. Совмина №970) требуем взыскать неустойку за просрочку доставки в размере ${amount} BYN.`,
      ];
    case 'law_custom':
    default: {
      const custom = form.customLaw.trim();
      const base = `По накладной ${waybill} зафиксировано расхождение в количестве ${shortage} шт. Сумма ущерба составляет ${amount} BYN.`;
      return custom ? [base, custom] : [base];
    }
  }
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

export default function DiscrepancyAct({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCustomLaw = form.violation === 'law_custom';

  const result = useMemo(() => calculateDiscrepancy(form), [form]);
  const claimParagraphs = useMemo(() => buildClaimText(form, result), [form, result]);

  const handleDownloadPdf = () => {
    const doc = registerPdfFont(new jsPDF({ unit: 'mm', format: 'a4' }));
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const rightEdge = pageWidth - margin;
    const lineHeight = 5.2;
    const date = currentDateRu();
    const waybill = form.waybill.trim() || '__________';
    const amount = format(result.claimAmount);
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
    writeWrapped(`Кому: Руководителю ${form.carrier.trim() || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    cursorY += 4;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY, rightEdge, cursorY);
    cursorY += 5;

    writeWrapped(`От кого: ${form.organization.trim() || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
      style: 'bold',
    });
    writeWrapped(`УНП: ${form.unp.trim() || '________________'}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    writeWrapped(`Исх. № ________ от ${date}`, {
      align: 'right',
      x: margin,
      width: contentWidth,
    });
    cursorY += 8;

    // 2. Заголовок документа
    writeWrapped('АКТ О РАСХОЖДЕНИЯХ И ПРЕТЕНЗИЯ', {
      align: 'center',
      x: margin,
      width: contentWidth,
      style: 'bold',
      size: 14,
      color: [126, 27, 177],
    });
    writeWrapped(`(Исх. №__ от ${date})`, {
      align: 'center',
      x: margin,
      width: contentWidth,
      style: 'bold',
      size: 11,
    });
    cursorY += 4;

    doc.setDrawColor(126, 27, 177);
    doc.setLineWidth(1.2);
    doc.line(margin, cursorY, rightEdge, cursorY);
    cursorY += 10;

    // 3. Установочная часть: реквизиты перевозки
    writeWrapped(`Перевозчик: ${form.carrier.trim() || '________________'}`, { align: 'justify' });
    writeWrapped(`Номер накладной/заказа: ${waybill}`, { align: 'justify' });
    writeWrapped('Характер нарушения: ' + result.violation.label, { align: 'justify' });
    cursorY += 3;
    writeWrapped(
      `Отправлено по накладной: ${result.shipped} шт. Фактически принято складом: ${result.accepted} шт.`,
      { align: 'justify' }
    );
    writeWrapped(`Обнаружено расхождение (недостача): ${result.shortage} шт.`, {
      align: 'justify',
      style: 'bold',
    });
    writeWrapped(
      `Стоимость 1 единицы товара (упущенная цена продажи): ${format(result.unitPrice)} BYN. Сумма претензии: ${amount} BYN.`,
      { align: 'justify', style: 'bold' }
    );
    cursorY += 4;

    // 4. Мотивировочная часть претензии (зависит от типа нарушения)
    claimParagraphs.forEach((paragraph) => {
      writeWrapped(paragraph, { align: 'justify' });
      cursorY += 2;
    });
    cursorY += 3;

    writeWrapped(
      'На основании изложенного, указанное расхождение является нарушением договора транспортной перевозки. Требуем в десятидневный срок с момента получения настоящего акта возместить причинённый ущерб.',
      { align: 'justify' }
    );
    writeWrapped('К акту прилагаются: документы транспортной накладной, фото/видеоматериалы, акт приёма-передачи, расчёт ущерба.', {
      align: 'justify',
    });
    cursorY += 6;

    // 5. Подпись и печать (в подвале документа)
    ensureSpace(34);
    const footerY = Math.max(cursorY, pageHeight - margin - 26);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Руководитель __________ / ' + (form.organization.trim() || '________________'), margin, footerY, {
      maxWidth: contentWidth,
    });
    doc.text('М.П. (Место для печати)', margin, footerY + 8, { maxWidth: contentWidth });
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(`Сформировано ${date}`, margin, footerY + 18, { maxWidth: contentWidth });

    doc.save(`Akt_Raskhozhdeniya_${sanitizeFileName(waybill)}.pdf`);
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Параметры акта */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Параметры акта</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Универсальная претензия к ТК / Фулфилменту по расхождению груза
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
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="act-waybill">
                    Номер накладной/заказа
                  </label>
                  <input
                    id="act-waybill"
                    type="text"
                    value={form.waybill}
                    onChange={(e) => updateField('waybill', e.target.value)}
                    className={inputClass}
                    required
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
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Сумма претензии</h3>
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

            {/* Превью официального документа */}
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Превью акта и претензии
              </p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 max-h-[520px] overflow-y-auto">
                <div className="text-right text-xs text-neutral-600 space-y-0.5">
                  <p className="font-medium text-neutral-800">
                    Кому: Руководителю {form.carrier || '—'}
                  </p>
                </div>

                <div className="my-2 border-t border-neutral-300" />

                <div className="text-right text-xs text-neutral-600 space-y-0.5">
                  <p>
                    От кого:{' '}
                    <span className="font-medium text-neutral-900">{form.organization || '—'}</span>
                  </p>
                  <p>
                    УНП: <span className="font-medium text-neutral-900">{form.unp || '—'}</span>
                  </p>
                  <p>Исх. № ________ от {currentDateRu()}</p>
                </div>

                <p className="mt-4 text-center text-sm font-semibold text-[#7b1fa2]">
                  АКТ О РАСХОЖДЕНИЯХ И ПРЕТЕНЗИЯ
                  <span className="block text-xs font-bold text-neutral-800">
                    (Исх. №__ от {currentDateRu()})
                  </span>
                </p>

                <div className="my-3 border-t-2 border-[#7b1fa2]" />

                <div className="text-xs text-neutral-700 leading-relaxed text-justify space-y-1.5">
                  <p>
                    Перевозчик: <span className="font-medium text-neutral-900">{form.carrier || '—'}</span>
                  </p>
                  <p>
                    Номер накладной/заказа:{' '}
                    <span className="font-medium text-neutral-900">{form.waybill || '—'}</span>
                  </p>
                  <p>Характер нарушения: {result.violation.label}</p>
                  <p>
                    Отправлено по накладной: {format(result.shipped, 0)} шт. Фактически принято
                    складом: {format(result.accepted, 0)} шт.
                  </p>
                  <p className="font-medium text-neutral-900">
                    Обнаружено расхождение (недостача): {format(result.shortage, 0)} шт.
                  </p>
                  <p>
                    Стоимость 1 единицы товара: {format(result.unitPrice)} BYN.{' '}
                    <span className="font-medium text-neutral-900">
                      Сумма претензии: {format(result.claimAmount)} BYN.
                    </span>
                  </p>
                  {claimParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                  <p>
                    На основании изложенного, указанное расхождение является нарушением договора
                    транспортной перевозки. Требуем в десятидневный срок с момента получения
                    настоящего акта возместить причинённый ущерб.
                  </p>
                </div>

                <div className="mt-5 space-y-1 text-xs text-neutral-700">
                  <p>Руководитель __________ / {form.organization || '—'}</p>
                  <p>М.П. (Место для печати)</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-[#7b1fa2] hover:bg-[#7b1fa2]/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачать готовый Акт и Претензию (PDF)
            </button>

            <div className="mt-4 bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-600">
                  Документ формируется в официальной форме и может быть использован для досудебного
                  урегулирования. При выборе пункта «Иное нарушение договора» добавьте собственное
                  юридическое обоснование — инструмент остаётся рабочим при любых изменениях
                  регламентов перевозок.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
