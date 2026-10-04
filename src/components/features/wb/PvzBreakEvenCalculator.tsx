'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator as CalculatorIcon,
  ChevronDown,
  Coins,
  Landmark,
  Percent,
  Plus,
  RotateCcw,
  Store,
  Timer,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  DEFAULT_FINE_SELECTION,
  DEFAULT_PVZ_FORM,
  PVZ_CONFIG,
  PVZ_FINES,
  PVZ_FINE_CUSTOM_DEFAULT,
  PVZ_FINE_CUSTOM_ID,
  PVZ_FINE_TOTAL,
  PVZ_ZONES_BY_GROUP,
  PVZ_ZONE_CUSTOM_ID,
  PVZ_TAX_SYSTEMS,
  calculatePvzBreakEven,
  createPvzEmployee,
  formatZonePercent,
  roundMoney,
  sumSelectedFines,
  toNumber,
  type PvzBreakEvenForm,
  type PvzEmployee,
  type PvzEmployeeValues,
  type PvzFineId,
  type PvzFineSelection,
  type PvzTaxId,
} from '@/lib/services/pvzBreakEven';
import type { Feature } from '@/types/section';

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

/** Все денежные величины перед выводом проходят через roundMoney (защита от float-багов) */
const formatMoney = (value: number) =>
  roundMoney(toNumber(value)).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const format = (value: number, digits = 2) =>
  roundMoney(toNumber(value)).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

interface BlockCardProps {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}

function BlockCard({ title, subtitle, icon: Icon, tone = 'default', children }: BlockCardProps) {
  const isDanger = tone === 'danger';

  return (
    <section
      className={cn(
        'rounded-xl border p-5 sm:p-6 transition-colors',
        isDanger ? 'bg-red-50 border-red-400' : 'bg-white border-neutral-200'
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('p-2 rounded-lg', isDanger ? 'bg-red-100' : 'bg-[var(--primary)]/10')}>
          <Icon
            className={cn('w-5 h-5', isDanger ? 'text-red-600' : 'text-[var(--primary)]')}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <h3 className={cn('text-base font-semibold', isDanger ? 'text-red-900' : 'text-neutral-900')}>
            {title}
          </h3>
          {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'muted' | 'accent' | 'warn' | 'danger';
}

function MetricRow({ label, value, sub, tone = 'default' }: MetricRowProps) {
  const toneText: Record<NonNullable<MetricRowProps['tone']>, string> = {
    default: 'text-neutral-900',
    muted: 'text-neutral-500',
    accent: 'text-[var(--primary)]',
    warn: 'text-amber-700',
    danger: 'text-red-600',
  };

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        {sub && <p className="text-[11px] leading-tight text-neutral-400">{sub}</p>}
      </div>
      <p
        className={cn(
          'text-sm font-semibold tabular-nums text-right shrink-0',
          toneText[tone]
        )}
      >
        {value}
      </p>
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  hint?: string;
  step?: string;
}

function NumberField({ id, label, value, onChange, unit, hint, step = '0.01' }: NumberFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="number"
          step={step}
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => onChange(e.currentTarget.value)}
          className={inputClass}
        />
        {unit && <span className={badgeClass}>{unit}</span>}
      </div>
      {hint && <p className="text-[11px] leading-tight text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function PvzBreakEvenCalculator({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<PvzBreakEvenForm>(DEFAULT_PVZ_FORM);
  /** Отметки чекбоксов панели штрафов WB: id штрафа → выбран ли */
  const [fineSelection, setFineSelection] = useState<PvzFineSelection>(DEFAULT_FINE_SELECTION);
  /** Сумма кастомного штрафа, вводится вручную и учитывается только вместе с его чекбоксом */
  const [customFine, setCustomFine] = useState(PVZ_FINE_CUSTOM_DEFAULT);
  const [finesOpen, setFinesOpen] = useState(true);

  const updateText = (field: keyof PvzBreakEvenForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateZone = (value: string) => {
    setForm((prev) => ({ ...prev, zone: value }));
  };

  const updateTaxSystem = (value: PvzTaxId) => {
    setForm((prev) => ({ ...prev, tax_system: value }));
  };

  /** Правка одного поля конкретной строки персонала */
  const updateEmployee = (id: string, field: keyof PvzEmployeeValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      employees: prev.employees.map((employee) =>
        employee.id === id ? { ...employee, [field]: value } : employee
      ),
    }));
  };

  /** Добавление новой строки сотрудника в конец списка */
  const addEmployee = () => {
    setForm((prev) => ({ ...prev, employees: [...prev.employees, createPvzEmployee()] }));
  };

  /** Удаление строки; последний сотрудник не удаляется, чтобы остаться минимум один */
  const removeEmployee = (id: string) => {
    setForm((prev) =>
      prev.employees.length <= 1
        ? prev
        : { ...prev, employees: prev.employees.filter((employee) => employee.id !== id) }
    );
  };

  /** Отметка конкретного штрафа чекбоксом */
  const toggleFine = (fineId: PvzFineId, checked: boolean) => {
    setFineSelection((prev) => ({ ...prev, [fineId]: checked }));
  };

  /** Снятие всех штрафов стрес��-теста */
  const resetFines = () => {
    setFineSelection(DEFAULT_FINE_SELECTION);
    setCustomFine(PVZ_FINE_CUSTOM_DEFAULT);
  };

  const result = useMemo(
    () => calculatePvzBreakEven(form, sumSelectedFines(fineSelection, customFine)),
    [form, fineSelection, customFine]
  );

  /** Сколько штрафов отмечено (для подписи в панели) */
  const selectedFinesCount = PVZ_FINES.filter((fine) => fineSelection[fine.id]).length;
  /** TotalFines — динамическая сумма отмеченных чекбоксов и ручного ввода, BYN */
  const finesTotal = result.finesTotal;

  const isCustomZone = form.zone === PVZ_ZONE_CUSTOM_ID;
  /** Отмечен хотя бы один штраф — расходы выросли, плашка прибыли перекрашивается */
  const hasFines = result.hasFines;
  /** Расходы точки, распределённые на один выданный заказ */
  const expensesPerOrder =
    result.ordersPerMonth > 0 ? roundMoney(result.fixedExpenses / result.ordersPerMonth) : 0;
  /** Чистый доход ушёл в минус (штрафы WB или слабый оборот) */
  const isNetLoss = result.netProfitByn < 0;
  /** При убытке налог не начисляется — иначе точка безубыточность поехала бы в минус */
  const taxApplied = result.preTaxProfitByn > 0 && result.taxAmountByn > 0;
  /**
   * Плашка чистой прибыли: КРАСНАЯ — точка в кассовом разрыве,
   * ЖЁЛТАЯ — штрафы уменьшили прибыль, но плюс остался, обычная — штрафов нет.
   */
  const netProfitTone = isNetLoss
    ? { box: 'bg-red-100 border-red-400', value: 'text-red-700' }
    : hasFines
      ? { box: 'bg-amber-100 border-amber-400', value: 'text-amber-800' }
      : { box: 'bg-white border-emerald-300', value: 'text-emerald-700' };

  /** Главный блок безубыточности повторяет ту же логику цветов */
  const heroTone = isNetLoss
    ? {
        box: 'bg-red-50 border-red-500',
        icon: 'bg-red-100',
        iconText: 'text-red-600',
        label: 'text-red-900',
        value: 'text-red-700',
        valueSoft: 'text-red-600',
        accent: 'text-red-700',
      }
    : hasFines
      ? {
          box: 'bg-amber-50 border-amber-500',
          icon: 'bg-amber-100',
          iconText: 'text-amber-700',
          label: 'text-amber-900',
          value: 'text-amber-800',
          valueSoft: 'text-amber-700',
          accent: 'text-amber-800',
        }
      : {
          box: 'bg-emerald-50 border-emerald-500',
          icon: 'bg-white',
          iconText: 'text-[var(--primary)]',
          label: 'text-neutral-900',
          value: 'text-emerald-700',
          valueSoft: 'text-emerald-600',
          accent: 'text-[var(--primary)]',
        };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ══════════════ ЛЕВАЯ КОЛОНКА: ВВОД ПАРАМЕТРОВ ПВЗ ══════════════ */}
          <div className="space-y-6">
            <BlockCard
              title="Параметры пункта выдачи в РБ"
              subtitle="Тарифная зона WB и ежемесячные расходы точки"
              icon={Store}
            >
              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="pvz-zone"
                  >
                    Тарифная зона ПВЗ в РБ (процент выплат от оборота)
                  </label>
                  <select
                    id="pvz-zone"
                    value={form.zone}
                    onChange={(e) => updateZone(e.target.value)}
                    onInput={(e) => updateZone(e.currentTarget.value)}
                    className={selectClass}
                  >
                    {PVZ_ZONES_BY_GROUP.map(({ group, options }) => (
                      <optgroup key={group} label={group}>
                        {options.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.label} (Выплата: {formatZonePercent(zone.rate)} от оборота)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[11px] leading-tight text-neutral-400 mt-1">
                    Выплата ПВЗ от оборота:{' '}
                    <span className="font-semibold text-neutral-600">
                      {formatZonePercent(result.rate)}
                    </span>{' '}
                    · при обороте {formatMoney(result.requiredTurnoverByn)} BYN это{' '}
                    {formatMoney(result.payoutByn)} BYN выплаты
                  </p>
                </div>

                {/* Скрытое поле включается ТОЛЬКО для «Другая зона» — неуязвимость к правкам оферты WB */}
                {isCustomZone && (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5">
                    <p className="text-sm font-medium text-neutral-700 mb-3">
                      Ручная настройка тарифа (режим неуязвимости к изменениям оферты WB)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <NumberField
                        id="pvz-custom-rate"
                        label="Кастомный тариф зоны, %"
                        value={form.custom_rate}
                        onChange={updateText('custom_rate')}
                        unit="%"
                        step="0.1"
                        hint={`В расчёте используется ${formatZonePercent(result.rate)} от оборота · по умолчанию 3.5%`}
                      />
                    </div>
                  </div>
                )}

                {/* ═══ Юридический блок-подсказка: Закон о платформенной экономике ═══ */}
                <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--primary)]/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[var(--primary)]/10 flex-shrink-0">
                      <Timer className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--primary)] mb-1">
                        Защитный таймер (45 дней) по новому закону
                      </p>
                      <p className="text-xs leading-relaxed text-neutral-700">
                        С 1 октября закон о платформенной экономике запрещает маркетплейсам менять тарифы или
                        вводить новые штрафы для ПВЗ внезапно. Они обязаны уведомить вас минимум за 45 дней. По
                        закону у вас всегда есть 45 дней запаса. Если WB снизит тариф вашей зоны, вы сможете
                        вовремя пересчитать модель на нашем сайте и успеть оптимизировать расходы (сократить
                        смены или договориться о снижении аренды).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumberField
                    id="pvz-rent"
                    label="Ежемесячная аренда помещения, BYN"
                    value={form.rent}
                    onChange={updateText('rent')}
                    unit="BYN"
                    step="1"
                  />
                  <NumberField
                    id="pvz-utilities"
                    label="Коммуналка, интернет и охрана точки в месяц"
                    value={form.utilities}
                    onChange={updateText('utilities')}
                    unit="BYN"
                    step="1"
                  />
                  <NumberField
                    id="pvz-avg-check"
                    label="Средний чек одного заказа на WB в вашем регионе, BYN"
                    value={form.avg_check}
                    onChange={updateText('avg_check')}
                    unit="BYN"
                    step="0.5"
                    hint={`${PVZ_CONFIG.DAYS_IN_MONTH} дней в расчётном месяце`}
                  />
                  <NumberField
                    id="pvz-traffic"
                    label="Ожидаемый поток клиентов, чел./день"
                    value={form.traffic}
                    onChange={updateText('traffic')}
                    unit="чел/день"
                    step="1"
                    hint={`для безубыточности нужно минимум ${result.clientsPerDay} чел/день`}
                  />
                  <div className="md:col-span-2">
                    <NumberField
                      id="pvz-turnover"
                      label="Фактический оборот выданных заказов в месяц, BYN"
                      value={form.turnover}
                      onChange={updateText('turnover')}
                      unit="BYN"
                      step="100"
                      hint={`База для чистого дохода: ${formatZonePercent(result.rate)} от этого оборота = ${formatMoney(result.grossRevenueByn)} BYN валового дохода ПВЗ`}
                    />
                  </div>
                </div>

                {/* ═══ Динамический блок персонала (по аналогии со спецификацией ТТН-1) ═══ */}
                <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                    <p className="text-sm font-semibold text-neutral-900">
                      Сотрудники / Менеджеры ПВЗ
                    </p>
                  </div>
                  <p className="text-[11px] leading-tight text-neutral-400 mb-3">
                    Оклады суммируются автоматически. Сверху начисляются взносы в ФСЗН{' '}
                    {PVZ_CONFIG.FSZN_EMPLOYEE_RATE}% и Белгосстрах {PVZ_CONFIG.BGS_EMPLOYEE_RATE}% — итоговый ФОТ
                    идёт в постоянные расходы.
                  </p>

                  {/* Подписи граф — скрыты на узких экранах */}
                  <div className="hidden lg:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-neutral-500">
                    <span className="col-span-7">Должность / Имя сотрудника</span>
                    <span className="col-span-4">Оклад за месяц на руки</span>
                    <span className="col-span-1" />
                  </div>

                  <div className="space-y-3 mt-2">
                    {form.employees.map((employee: PvzEmployee, index: number) => {
                      const isOnlyRow = form.employees.length <= 1;

                      return (
                        <div
                          key={employee.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3"
                        >
                          <div className="grid grid-cols-2 lg:grid-cols-12 gap-2 items-end">
                            <div className="col-span-2 lg:col-span-7">
                              <label
                                className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                                htmlFor={`pvz-employee-position-${employee.id}`}
                              >
                                Должность / Имя сотрудника
                              </label>
                              <input
                                id={`pvz-employee-position-${employee.id}`}
                                type="text"
                                value={employee.position}
                                onChange={(e) =>
                                  updateEmployee(employee.id, 'position', e.target.value)
                                }
                                onInput={(e) =>
                                  updateEmployee(employee.id, 'position', e.currentTarget.value)
                                }
                                className={inputClass}
                                placeholder="Например: Менеджер смены 1"
                              />
                            </div>

                            <div className="lg:col-span-4">
                              <label
                                className="block text-xs font-medium text-neutral-600 mb-1 lg:hidden"
                                htmlFor={`pvz-employee-salary-${employee.id}`}
                              >
                                Оклад / Зарплата за месяц на руки, BYN
                              </label>
                              <div className="flex gap-2">
                                <input
                                  id={`pvz-employee-salary-${employee.id}`}
                                  type="number"
                                  step="1"
                                  min="0"
                                  inputMode="numeric"
                                  value={employee.salary}
                                  onChange={(e) =>
                                    updateEmployee(employee.id, 'salary', e.target.value)
                                  }
                                  onInput={(e) =>
                                    updateEmployee(employee.id, 'salary', e.currentTarget.value)
                                  }
                                  className={inputClass}
                                  placeholder="0"
                                />
                                <span className={badgeClass}>BYN</span>
                              </div>
                            </div>

                            <div className="flex justify-end lg:col-span-1">
                              <button
                                type="button"
                                onClick={() => removeEmployee(employee.id)}
                                disabled={isOnlyRow}
                                title={
                                  isOnlyRow
                                    ? 'В точке должен остаться хотя бы один сотрудник'
                                    : 'Удалить сотрудника'
                                }
                                aria-label={`Удалить сотрудника ${index + 1}`}
                                className={cn(
                                  'flex items-center justify-center w-full px-2 py-2 rounded-lg border transition-colors',
                                  isOnlyRow
                                    ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                                    : 'border-neutral-300 text-neutral-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                                )}
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={addEmployee}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-[#7b1fa2] hover:bg-[#6a1b91] transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Добавить сотрудника
                  </button>

                  {/* Живой расчёт ФОТ по всем строкам */}
                  <div className="mt-3 pt-3 border-t border-[var(--primary)]/20 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
                    <span>
                      Сотрудников: <b className="text-neutral-900">{result.payroll.headcount}</b>
                    </span>
                    <span>
                      Оклады:{' '}
                      <b className="text-neutral-900">{formatMoney(result.payroll.salariesTotal)} BYN</b>
                    </span>
                    <span>
                      ФСЗН {PVZ_CONFIG.FSZN_EMPLOYEE_RATE}%:{' '}
                      <b className="text-neutral-900">{formatMoney(result.payroll.fsznTotal)} BYN</b>
                    </span>
                    <span>
                      Белгосстрах {PVZ_CONFIG.BGS_EMPLOYEE_RATE}%:{' '}
                      <b className="text-neutral-900">{formatMoney(result.payroll.bgsTotal)} BYN</b>
                    </span>
                    <span>
                      Итоговый ФОТ:{' '}
                      <b className="text-[var(--primary)]">{formatMoney(result.payroll.total)} BYN</b>
                    </span>
                  </div>
                </div>
                <fieldset className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <legend className="px-1 text-sm font-semibold text-neutral-900">
                    Система налогообложения ИП в РБ
                  </legend>
                  <div className="space-y-2 mt-1">
                    {PVZ_TAX_SYSTEMS.map((system) => (
                      <label
                        key={system.id}
                        className="flex items-start gap-2 text-sm text-neutral-700 cursor-pointer select-none"
                      >
                        <input
                          type="radio"
                          name="pvz-tax-system"
                          value={system.id}
                          checked={form.tax_system === system.id}
                          onChange={(e) => updateTaxSystem(e.target.value as PvzTaxId)}
                          onInput={(e) => updateTaxSystem(e.currentTarget.value as PvzTaxId)}
                          className="w-4 h-4 mt-0.5 border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{system.label}</span>
                          <span className="block text-[11px] leading-tight text-neutral-400">
                            {system.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-tight text-neutral-400">
                    Формула: чистая прибыль = (валовый доход ПВЗ − постоянные расходы) × (1 −{' '}
                    {format(result.taxRatePercent, 0)}%). Налог удерживается только с прибыли: при убытке точки он
                    равен 0, поэтому точка безубыточность не искажается.
                  </p>
                </fieldset>

                {/* ═══ Симулятор рисков и штрафов WB: аккордеон с чекбоксами ═══ */}
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
                  <button
                    type="button"
                    onClick={() => setFinesOpen((prev) => !prev)}
                    aria-expanded={finesOpen}
                    aria-controls="pvz-fines-panel"
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-red-900">
                        Симулятор рисков и штрафов WB (Стресс-тест модели)
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 flex-shrink-0 text-red-600 transition-transform',
                        finesOpen && '-rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  <p className="mt-1 text-[11px] leading-tight text-neutral-500">
                    Отметьте штрафы, которые реально получили бы в этом месяце: их сумма прибавится к постоянным
                    расходам. Все типовые штрафы разом = {formatMoney(PVZ_FINE_TOTAL)} BYN.
                  </p>

                  <div
                    id="pvz-fines-panel"
                    className={cn(
                      'grid transition-all duration-200 ease-out',
                      finesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    )}
                    role="region"
                    aria-label="Штрафы и удержания Wildberries"
                  >
                    <div className="overflow-hidden">
                      <ul className="space-y-2 mt-3">
                        {PVZ_FINES.map((fine) => {
                          const isChecked = fineSelection[fine.id] ?? false;
                          const isCustomChecked = isChecked && fine.custom === true;

                          return (
                            <li key={fine.id}>
                              <label className="flex items-start gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                                <input
                                  id={`pvz-fine-${fine.id}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => toggleFine(fine.id, e.target.checked)}
                                  onInput={(e) => toggleFine(fine.id, e.currentTarget.checked)}
                                  className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500"
                                />
                                <span className="min-w-0">
                                  <span className="font-medium">{fine.reason}</span>
                                  <span className="block text-[11px] leading-tight text-neutral-400">
                                    {fine.custom
                                      ? 'сумма вводится вручную в поле ниже'
                                      : `штраф: ${formatMoney(fine.amount)} BYN`}
                                  </span>
                                </span>
                              </label>

                              {/* Скрытое поле появляется ТОЛЬКО при отмеченном кастомном штрафе */}
                              {fine.custom && (
                                <div
                                  className={cn(
                                    'grid transition-all duration-200 ease-out',
                                    isCustomChecked
                                      ? 'grid-rows-[1fr] opacity-100'
                                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                                  )}
                                  role="region"
                                  aria-label="Сумма кастомного штрафа"
                                >
                                  <div className="overflow-hidden">
                                    <div className="pt-2 pl-6">
                                      <label
                                        className="block text-xs font-medium text-neutral-600 mb-1"
                                        htmlFor="pvz-fine-custom-amount"
                                      >
                                        Сумма кастомного штрафа, BYN
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          id="pvz-fine-custom-amount"
                                          type="number"
                                          step="1"
                                          min="0"
                                          inputMode="numeric"
                                          value={customFine}
                                          onChange={(e) => setCustomFine(e.target.value)}
                                          onInput={(e) => setCustomFine(e.currentTarget.value)}
                                          disabled={!isCustomChecked}
                                          className={cn(inputClass, !isCustomChecked && 'opacity-50')}
                                          placeholder="0"
                                        />
                                        <span className={badgeClass}>BYN</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-xs text-neutral-600">
                          Выбрано: <b className="text-neutral-900">{selectedFinesCount}</b> · Итого штрафов:{' '}
                          <b className={cn('tabular-nums', finesTotal > 0 ? 'text-red-600' : 'text-neutral-400')}>
                            {formatMoney(finesTotal)} BYN
                          </b>
                        </span>
                        {selectedFinesCount > 0 && (
                          <button
                            type="button"
                            onClick={resetFines}
                            className="ml-auto px-3 py-1.5 text-xs border border-neutral-300 text-neutral-700 rounded-lg hover:bg-white transition-colors"
                          >
                            Снять все штрафы
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(DEFAULT_PVZ_FORM);
                      setFineSelection(DEFAULT_FINE_SELECTION);
                      setCustomFine(PVZ_FINE_CUSTOM_DEFAULT);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    Сбросить
                  </button>
                  <span className="flex-1 self-center text-xs text-neutral-400">
                    Расчёт обновляется автоматически при изменении полей
                  </span>
                </div>
              </div>
            </BlockCard>
          </div>

          {/* ══════════════ ПРАВАЯ КОЛОНКА: РЕЗУЛЬТАТЫ ══════════════ */}
          <div className="space-y-6">
            {/* Главный блок окупаемости: красный в разрыве, жёлтый при штрафах, зелёный без штрафов */}
            <section
              className={cn(
                'rounded-xl border-2 p-6 sm:p-8 text-center shadow-sm transition-colors',
                heroTone.box
              )}
              aria-live="polite"
            >
              <div
                className={cn(
                  'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full',
                  heroTone.icon
                )}
              >
                {hasFines ? (
                  <AlertTriangle
                    className={cn('w-6 h-6', heroTone.iconText)}
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingUp className="w-6 h-6 text-[var(--primary)]" aria-hidden="true" />
                )}
              </div>

              <p className={cn('text-sm sm:text-base font-medium', heroTone.label)}>
                Минимальный оборот ПВЗ для выхода в ноль
              </p>

              <p
                className={cn(
                  'mt-2 text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight',
                  heroTone.value
                )}
              >
                {formatMoney(result.requiredTurnoverByn)} BYN
              </p>

              <p
                className={cn(
                  'mt-2 text-lg sm:text-2xl font-bold tabular-nums',
                  heroTone.valueSoft
                )}
              >
                (~{formatMoney(result.requiredTurnoverRub)} RUB) в месяц
              </p>

              <p className={cn('mt-4 text-base sm:text-lg font-bold leading-snug', heroTone.label)}>
                Чтобы просто окупать аренду и зарплаты, ваш ПВЗ должен ежедневно выдавать заказы минимум{' '}
                <span className={heroTone.accent}>{result.clientsPerDay}</span> клиентам.
              </p>

              {/* ═══ Сравнение теории с реальностью: ожидаемый трафик vs точка безубыточности ═══ */}
              <div
                className={cn(
                  'mt-4 rounded-lg border p-3 text-sm font-bold leading-snug',
                  result.trafficCoversBreakEven
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-red-100 border-red-400 text-red-800'
                )}
              >
                {result.trafficCoversBreakEven ? (
                  <>
                    Ваш прогноз трафика ({result.trafficPerDay} чел/день) покрывает точку безубыточности.
                    Проект потенциально прибыльный.
                  </>
                ) : (
                  <>
                    Внимание! Прогноз трафика ({result.trafficPerDay} чел/день) НИЖЕ точки безубыточности.
                    При таком потоке ПВЗ будет работать в убыток. Найдите локацию с большей проходимостью или
                    сократите расходы.
                  </>
                )}
              </div>

              {/* ═══ Чистый доход селлера после налогов РБ ═══ */}
              <div
                className={cn(
                  'mt-5 rounded-xl border p-4 transition-colors',
                  netProfitTone.box
                )}
              >
                <p className="text-xs sm:text-sm font-medium text-neutral-600">
                  Ваш чистый прогнозируемый доход (после налогов)
                </p>
                <p
                  className={cn(
                    'mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight',
                    netProfitTone.value
                  )}
                >
                  {formatMoney(result.netProfitByn)} BYN в месяц
                </p>
                <p className="text-[11px] leading-tight text-neutral-500">
                  {result.taxLabel} · ставка {format(result.taxRatePercent, 0)}% ·{' '}
                  {taxApplied
                    ? `налог ${formatMoney(result.taxAmountByn)} BYN удержан с прибыли`
                    : 'налог 0 BYN: точка в минусе, налог не начисляется'}
                </p>

                {/* ═══ Динамический лог удержаний: появляется при любом выбранном штрафе ═══ */}
                {hasFines && (
                  <p
                    className={cn(
                      'mt-3 rounded-lg border p-3 text-sm font-bold leading-snug',
                      isNetLoss
                        ? 'border-red-400 bg-red-100 text-red-800'
                        : 'border-amber-400 bg-amber-100 text-amber-900'
                    )}
                  >
                    Внимание! Из вашего валового дохода удержано {formatMoney(finesTotal)} BYN за нарушения
                    регламентов WB. Чистая прибыль снизилась до {formatMoney(result.netProfitByn)} BYN.
                  </p>
                )}
              </div>

              <p className={cn('mt-2 text-xs sm:text-sm', hasFines ? 'text-red-700' : 'text-neutral-500')}>
                {result.ordersPerMonth > 0 ? (
                  <>
                    Это {format(result.ordersPerMonth, 2)} заказов в месяц при среднем чеке{' '}
                    {formatMoney(toNumber(form.avg_check) || 0)} BYN и ставке выплаты{' '}
                    {formatZonePercent(result.rate)} (курс WB: 1 BYN = {result.rubPerByn} RUB).
                  </>
                ) : (
                  <>
                    Укажите тарифную зону и положительный средний чек — расчёт покажет, сколько заказов в день
                    нужно вашей точке.
                  </>
                )}
              </p>
            </section>

            {/* Разбор постоянных расходов */}
            <BlockCard
              title="Разбор постоянных расходов точки"
              subtitle={`Зона: ${result.zoneLabel}`}
              icon={Coins}
              tone={hasFines ? 'danger' : 'default'}
            >
              <MetricRow
                label="Аренда помещения"
                value={`${formatMoney(result.rent)} BYN`}
                sub={`введено ${formatMoney(toNumber(form.rent) || 0)} BYN`}
              />
              <MetricRow
                label="Оклады сотрудников (на руки)"
                value={`${formatMoney(result.payroll.salariesTotal)} BYN`}
                sub={`${result.payroll.headcount} сотрудник(ов) в штате`}
              />
              <MetricRow
                label={`Взносы в ФСЗН ${PVZ_CONFIG.FSZN_EMPLOYEE_RATE}%`}
                value={`${formatMoney(result.payroll.fsznTotal)} BYN`}
                sub={`${formatMoney(result.payroll.salariesTotal)} × ${PVZ_CONFIG.FSZN_EMPLOYEE_RATE}%`}
                tone="muted"
              />
              <MetricRow
                label={`Взносы в Белгосстрах ${PVZ_CONFIG.BGS_EMPLOYEE_RATE}%`}
                value={`${formatMoney(result.payroll.bgsTotal)} BYN`}
                sub={`${formatMoney(result.payroll.salariesTotal)} × ${PVZ_CONFIG.BGS_EMPLOYEE_RATE}%`}
                tone="muted"
              />
              <MetricRow
                label="Итого ФОТ с взносами"
                value={`${formatMoney(result.payroll.total)} BYN`}
                sub="оклады + ФСЗН + Белгосстрах"
                tone="accent"
              />
              <MetricRow
                label="Коммуналка, интернет и охрана"
                value={`${formatMoney(result.utilities)} BYN`}
                sub={`введено ${formatMoney(toNumber(form.utilities) || 0)} BYN`}
              />
              <MetricRow
                label="Штрафы и удержания WB"
                value={`${formatMoney(result.finesTotal)} BYN`}
                sub={
                  hasFines
                    ? `${selectedFinesCount} штраф(ов) из панели стрес��-теста прибавлено к постоянным расходам`
                    : 'ничего не отмечено — стресс-тест выключен'
                }
                tone={hasFines ? 'danger' : 'muted'}
              />
              <MetricRow
                label="Итого постоянные расходы (FixedExpenses)"
                value={`${formatMoney(result.fixedExpenses)} BYN`}
                sub="минимально необходимый доход ПВЗ для работы в ноль"
                tone="accent"
              />
              <MetricRow
                label="Выплата WB при обороте безубыточности"
                value={`${formatMoney(result.payoutByn)} BYN`}
                sub={`${formatMoney(result.requiredTurnoverByn)} BYN × ${formatZonePercent(result.rate)}`}
              />

              {/* ═══ Налоговый модуль РБ: налог удерживается с прибыли, а не плюсуется к расходам ═══ */}
              <div className="mt-4 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-neutral-900">{result.taxLabel}</p>
                </div>
                <MetricRow
                  label="Валовый доход ПВЗ (фактический оборот)"
                  value={`${formatMoney(result.grossRevenueByn)} BYN`}
                  sub={`${formatMoney(result.turnoverByn)} BYN × ${formatZonePercent(result.rate)}`}
                />
                <MetricRow
                  label="Прибыль до налогов"
                  value={`${formatMoney(result.preTaxProfitByn)} BYN`}
                  sub="валовый доход − постоянные расходы"
                  tone={isNetLoss ? 'danger' : 'default'}
                />
                <MetricRow
                  label={`Налог ${format(result.taxRatePercent, 0)}% от прибыли`}
                  value={`${formatMoney(result.taxAmountByn)} BYN`}
                  sub={
                    taxApplied
                      ? `(${formatMoney(result.preTaxProfitByn)} × ${format(result.taxRatePercent, 0)}%)`
                      : 'прибыли нет — налог автоматически 0'
                  }
                  tone={taxApplied ? 'warn' : 'muted'}
                />
                <MetricRow
                  label="Чистый прогнозируемый доход «на жизнь»"
                  value={`${formatMoney(result.netProfitByn)} BYN`}
                  sub="(валовый доход − расходы) × (1 − ставка налога)"
                  tone={isNetLoss ? 'danger' : 'accent'}
                />
              </div>
            </BlockCard>

            {/* Формула точки безубыточности */}
            <BlockCard
              title="Как получен этот расчёт"
              subtitle="Обратное раскручивание уравнения безубыточности"
              icon={CalculatorIcon}
            >
              <ol className="space-y-2 text-sm text-neutral-600">
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">1.</span>
                  <span>
                    Постоянные расходы = аренда {formatMoney(result.rent)} + ФОТ{' '}
                    {formatMoney(result.payroll.total)} (оклады {formatMoney(result.payroll.salariesTotal)} + ФСЗН{' '}
                    {formatMoney(result.payroll.fsznTotal)} + Белгосстрах{' '}
                    {formatMoney(result.payroll.bgsTotal)}) + коммуналка {formatMoney(result.utilities)}
                    {hasFines ? ` + штрафы ${formatMoney(result.finesTotal)}` : ''} ={' '}
                    <strong className="text-neutral-900">{formatMoney(result.fixedExpenses)} BYN</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">2.</span>
                  <span>
                    Минимально необходимый доход ПВЗ ={' '}
                    <strong className="text-neutral-900">{formatMoney(result.requiredRevenueByn)} BYN</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">3.</span>
                  <span>
                    Оборот выданных заказов = расходы ÷ выплату зоны ({formatZonePercent(result.rate)}) ={' '}
                    <strong className="text-neutral-900">{formatMoney(result.requiredTurnoverByn)} BYN</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">4.</span>
                  <span>
                    Оборот в RUB = {formatMoney(result.requiredTurnoverByn)} × {result.rubPerByn} ={' '}
                    <strong className="text-neutral-900">{formatMoney(result.requiredTurnoverRub)} RUB</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">5.</span>
                  <span>
                    Заказы в месяц = оборот ÷ средний чек ={' '}
                    <strong className="text-neutral-900">{format(result.ordersPerMonth, 2)}</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">6.</span>
                  <span>
                    Клиентов в день = Math.ceil(заказы ÷ {PVZ_CONFIG.DAYS_IN_MONTH}) ={' '}
                    <strong className="text-[var(--primary)]">{result.clientsPerDay}</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-neutral-900 tabular-nums">7.</span>
                  <span>
                    Чистый доход = (валовый доход {formatMoney(result.grossRevenueByn)} − расходы{' '}
                    {formatMoney(result.fixedExpenses)}) × (1 − {format(result.taxRatePercent, 0)}%) ={' '}
                    <strong className={isNetLoss ? 'text-red-600' : 'text-[var(--primary)]'}>
                      {formatMoney(result.netProfitByn)} BYN
                    </strong>
                  </span>
                </li>
              </ol>
            </BlockCard>

            {/* Ключевые уличные метрики */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={cn(
                  'rounded-xl border p-4',
                  hasFines ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn('p-2 rounded-lg', hasFines ? 'bg-red-100' : 'bg-[var(--primary)]/10')}
                  >
                    <Users
                      className={cn(
                        'w-5 h-5',
                        hasFines ? 'text-red-600' : 'text-[var(--primary)]'
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Клиентов в день</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        hasFines ? 'text-red-700' : 'text-neutral-900'
                      )}
                    >
                      {result.clientsPerDay}
                    </p>
                    <p className="text-xs text-neutral-400 tabular-nums">
                      {format(result.ordersPerMonth, 2)} заказов в месяц
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'rounded-xl border p-4',
                  hasFines ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn('p-2 rounded-lg', hasFines ? 'bg-red-100' : 'bg-[var(--primary)]/10')}
                  >
                    <Wallet
                      className={cn(
                        'w-5 h-5',
                        hasFines ? 'text-red-600' : 'text-[var(--primary)]'
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Валовый доход за месяц</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        isNetLoss ? 'text-red-700' : 'text-neutral-900'
                      )}
                    >
                      {formatMoney(result.grossRevenueByn)} BYN
                    </p>
                    <p className="text-xs text-neutral-400 tabular-nums">
                      ставка зоны {formatZonePercent(result.rate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Percent className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Оборот в RUB по курсу WB</p>
                    <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                      {formatMoney(result.requiredTurnoverRub)} RUB
                    </p>
                    <p className="text-xs text-neutral-400 tabular-nums">
                      1 BYN = {result.rubPerByn} RUB (фикс. курс)
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'rounded-xl border p-4',
                  hasFines ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', hasFines ? 'bg-red-100' : 'bg-emerald-100')}>
                    <CalculatorIcon
                      className={cn('w-5 h-5', hasFines ? 'text-red-600' : 'text-emerald-600')}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Расходы точки на 1 заказ</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        hasFines ? 'text-red-700' : 'text-neutral-900'
                      )}
                    >
                      {formatMoney(expensesPerOrder)} BYN
                    </p>
                    <p className="text-xs text-neutral-400">
                      {hasFines ? 'с учётом штрафов за месяц' : 'аренда + ФОТ + коммуналка на заказ'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}