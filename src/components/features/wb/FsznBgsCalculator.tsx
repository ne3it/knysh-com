'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, ChevronDown, ChevronUp, Coins, Percent, RotateCcw, Shield } from 'lucide-react';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export const MONTHS_OF_YEAR = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export const QUARTERS: ReadonlyArray<{
  label: string;
  months: ReadonlyArray<string>;
}> = [
  { label: 'Квартал 1', months: MONTHS_OF_YEAR.slice(0, 3) },
  { label: 'Квартал 2', months: MONTHS_OF_YEAR.slice(3, 6) },
  { label: 'Квартал 3', months: MONTHS_OF_YEAR.slice(6, 9) },
  { label: 'Квартал 4', months: MONTHS_OF_YEAR.slice(9, 12) },
];

/** Ставка подоходного налога для ИП в РБ, применяемая к вычету по ФСЗН. */
const INCOME_TAX_RATE = 0.2;

interface FormState {
  activeMonths: string[];
  netIncome: string;
  minWage: string;
  fsznRate: string;
  bgsRate: string;
}

const DEFAULT_FORM: FormState = {
  activeMonths: [],
  netIncome: '5000',
  minWage: '720',
  fsznRate: '35',
  bgsRate: '0.6',
};

export interface FsznBgsResult {
  activeMonths: number;
  fsznPerMonth: number;
  fsznTotal: number;
  bgsPerMonth: number;
  bgsTotal: number;
  incomeTaxDeduction: number;
}

const toNumber = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateFsznBgs(form: FormState): FsznBgsResult {
  const activeMonths = form.activeMonths.length;
  const minWage = Math.max(0, toNumber(form.minWage));
  const fsznRate = Math.max(0, toNumber(form.fsznRate));
  const bgsRate = Math.max(0, toNumber(form.bgsRate));
  const netIncome = Math.max(0, toNumber(form.netIncome));

  const fsznPerMonth = minWage * (fsznRate / 100);
  const bgsPerMonth = minWage * (bgsRate / 100);
  const fsznTotal = fsznPerMonth * activeMonths;
  const bgsTotal = bgsPerMonth * activeMonths;
  const incomeTaxDeduction = netIncome === 0 ? 0 : fsznTotal * INCOME_TAX_RATE;

  return {
    activeMonths,
    fsznPerMonth,
    fsznTotal,
    bgsPerMonth,
    bgsTotal,
    incomeTaxDeduction,
  };
}

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

export default function FsznBgsCalculator({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMonth = (month: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      activeMonths: checked
        ? [...prev.activeMonths, month]
        : prev.activeMonths.filter((m) => m !== month),
    }));
  };

  const toggleQuarter = (months: ReadonlyArray<string>, checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.activeMonths);
      months.forEach((month) => (checked ? next.add(month) : next.delete(month)));
      return { ...prev, activeMonths: MONTHS_OF_YEAR.filter((m) => next.has(m)) };
    });
  };

  const result = useMemo(() => calculateFsznBgs(form), [form]);

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчета</h3>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active months */}
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-neutral-700 mb-2">
                  Месяцы осуществления деятельности (выберите, когда шла торговля)
                </span>

                {QUARTERS.map((quarter) => {
                  const allChecked = quarter.months.every((month) => form.activeMonths.includes(month));
                  return (
                    <div key={quarter.label} style={{ marginBottom: 10 }}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={(e) => toggleQuarter(quarter.months, e.target.checked)}
                            onInput={(e) => toggleQuarter(quarter.months, e.currentTarget.checked)}
                            className="w-4 h-4 rounded border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                            aria-label={`${quarter.label}: выбрать все месяцы`}
                          />
                          {quarter.label}
                        </label>

                        {quarter.months.map((month) => (
                          <label
                            key={month}
                            className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={form.activeMonths.includes(month)}
                              onChange={(e) => toggleMonth(month, e.target.checked)}
                              onInput={(e) => toggleMonth(month, e.currentTarget.checked)}
                              className="w-4 h-4 rounded border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            {month}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <p className="text-xs text-neutral-400">
                  Отмечено месяцев: <span className="font-semibold text-neutral-600">{result.activeMonths}</span> из 12
                </p>
              </div>

              {/* Net income */}
              <div className="md:col-span-2">
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="fszn-net-income"
                >
                  Чистый доход ИП за выбранный период (выручка WB минус расходы), BYN
                </label>
                <div className="flex gap-2">
                  <input
                    id="fszn-net-income"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.netIncome}
                    onChange={(e) => updateField('netIncome', e.target.value)}
                    onInput={(e) => updateField('netIncome', e.currentTarget.value)}
                    className={inputClass}
                  />
                  <span className={badgeClass}>BYN</span>
                </div>
              </div>
            </div>

            {/* Resilience mode: editable statutory rates */}
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                aria-expanded={settingsOpen}
              >
                <Shield className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                <span className="flex-1 text-left">Настройки законодательных ставок</span>
                {settingsOpen ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </button>

              {settingsOpen && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-neutral-400">
                    Параметры ниже вынесены отдельно, чтобы калькулятор оставался рабочим при любых будущих
                    изменениях законодательства РБ.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-neutral-700 mb-1"
                        htmlFor="fszn-min-wage"
                      >
                        Размер Минимальной Заработной Платы (МЗП) на 2026 год, BYN
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="fszn-min-wage"
                          type="number"
                          step="1"
                          min="0"
                          value={form.minWage}
                          onChange={(e) => updateField('minWage', e.target.value)}
                          onInput={(e) => updateField('minWage', e.currentTarget.value)}
                          className={inputClass}
                        />
                        <span className={badgeClass}>BYN</span>
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-neutral-700 mb-1"
                        htmlFor="fszn-rate"
                      >
                        Ставка взносов ФСЗН, %
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="fszn-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.fsznRate}
                          onChange={(e) => updateField('fsznRate', e.target.value)}
                          onInput={(e) => updateField('fsznRate', e.currentTarget.value)}
                          className={inputClass}
                        />
                        <span className={badgeClass}>%</span>
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-neutral-700 mb-1"
                        htmlFor="fszn-bgs-rate"
                      >
                        Ставка Белгосстрах, %
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="fszn-bgs-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.bgsRate}
                          onChange={(e) => updateField('bgsRate', e.target.value)}
                          onInput={(e) => updateField('bgsRate', e.currentTarget.value)}
                          className={inputClass}
                        />
                        <span className={badgeClass}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setForm(DEFAULT_FORM)}
                className="px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Сбросить
                </span>
              </button>
              <span className="flex-1 self-center text-xs text-neutral-400">
                Расчёт обновляется автоматически при изменении полей
              </span>
            </div>
          </form>
        </div>

        {/* Results */}
        <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6">
          <div className="space-y-2 text-center">
            <p className="text-xl sm:text-2xl font-bold text-neutral-900">
              Итого к уплате в ФСЗН: <span className="text-[var(--primary)]">{format(result.fsznTotal)} BYN</span>
            </p>
            <p className="text-lg font-semibold text-neutral-700">
              Итого к уплате в Белгосстрах:{' '}
              <span className="text-[var(--primary)]">{format(result.bgsTotal)} BYN</span>
            </p>
            <p className="text-base font-semibold text-green-600">
              Вы можете уменьшить подоходный налог на: {format(result.incomeTaxDeduction)} BYN (за счет вычета ФСЗН)
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <div className="bg-white rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-500">ФСЗН за 1 месяц</p>
              </div>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{format(result.fsznPerMonth)} BYN</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                МЗП {format(toNumber(form.minWage), 0)} × {format(toNumber(form.fsznRate))}%
              </p>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-500">Белгосстрах за 1 месяц</p>
              </div>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{format(result.bgsPerMonth)} BYN</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                МЗП {format(toNumber(form.minWage), 0)} × {format(toNumber(form.bgsRate))}%
              </p>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-500">Активных месяцев</p>
              </div>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{result.activeMonths} мес.</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                Вычет ФСЗН × {Math.round(INCOME_TAX_RATE * 100)}% при доходе{' '}
                {format(toNumber(form.netIncome))} BYN
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs leading-relaxed text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" aria-hidden="true" />
              <strong>Внимание!</strong> Согласно законодательству РБ, индивидуальные предприниматели обязаны
              уплатить взносы в ФСЗН за отчетный год не позднее 1 марта следующего года. Сбор в Белгосстрах
              уплачивается ежеквартально не позднее 25-го числа месяца, следующего за отчетным кварталом. Нарушение
              сроков влечет начисление пени и приостановку операций по счетам со стороны ИМНС РБ.
            </p>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
