'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator as CalculatorIcon,
  Coins,
  Percent,
  RotateCcw,
  Store,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  DEFAULT_PVZ_FORM,
  PVZ_BAD_MONTH_FINES,
  PVZ_CONFIG,
  PVZ_ZONES,
  PVZ_ZONE_CUSTOM_ID,
  calculatePvzBreakEven,
  formatZonePercent,
  roundMoney,
  toNumber,
  type PvzBreakEvenForm,
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
  tone?: 'default' | 'muted' | 'accent' | 'danger';
}

function MetricRow({ label, value, sub, tone = 'default' }: MetricRowProps) {
  const toneText: Record<NonNullable<MetricRowProps['tone']>, string> = {
    default: 'text-neutral-900',
    muted: 'text-neutral-500',
    accent: 'text-[var(--primary)]',
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
  const [badMonth, setBadMonth] = useState(false);

  const updateText = (field: keyof PvzBreakEvenForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateZone = (value: string) => {
    setForm((prev) => ({ ...prev, zone: value }));
  };

  const result = useMemo(() => calculatePvzBreakEven(form, badMonth), [form, badMonth]);

  const isCustomZone = form.zone === PVZ_ZONE_CUSTOM_ID;
  const isBadMonth = badMonth;
  /** Расходы точки, распределённые на один выданный заказ */
  const expensesPerOrder =
    result.ordersPerMonth > 0 ? roundMoney(result.fixedExpenses / result.ordersPerMonth) : 0;

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
                    {PVZ_ZONES.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.label}
                      </option>
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
                        hint={`В расчёте используется ${formatZonePercent(result.rate)} от оборота`}
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
                    id="pvz-staff"
                    label="ФОТ сотрудников в месяц (Зарплата 2-х менеджеров + налоги)"
                    value={form.staff}
                    onChange={updateText('staff')}
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
                </div>

                {/* ═══ Симулятор «плохого месяца» ═══ */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <button
                    type="button"
                    onClick={() => setBadMonth((prev) => !prev)}
                    aria-pressed={isBadMonth}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold border-2 transition-colors',
                      isBadMonth
                        ? 'bg-white text-red-700 border-red-500 hover:bg-red-50'
                        : 'bg-red-600 text-white border-red-800 hover:bg-red-700'
                    )}
                  >
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                    {isBadMonth
                      ? 'Выключить симулятор штрафов'
                      : 'Смоделировать жесткие штрафы за месяц'}
                  </button>

                  <label className="mt-3 flex items-start gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isBadMonth}
                      onChange={(e) => setBadMonth(e.target.checked)}
                      onInput={(e) => setBadMonth(e.currentTarget.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="font-medium">
                      Прибавить к постоянным расходам скрытые штрафы WB за месяц
                    </span>
                  </label>

                  <ul className="mt-3 space-y-1">
                    {PVZ_BAD_MONTH_FINES.map((fine) => (
                      <li
                        key={fine.id}
                        className="flex items-start justify-between gap-3 text-[11px] leading-tight"
                      >
                        <span className="text-neutral-500 min-w-0">{fine.reason}</span>
                        <span
                          className={cn(
                            'font-semibold tabular-nums shrink-0',
                            isBadMonth ? 'text-red-600' : 'text-neutral-400'
                          )}
                        >
                          +{formatMoney(fine.amount)} BYN
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 pt-3 border-t border-neutral-200 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(DEFAULT_PVZ_FORM);
                        setBadMonth(false);
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
              </div>
            </BlockCard>
          </div>

          {/* ══════════════ ПРАВАЯ КОЛОНКА: РЕЗУЛЬТАТЫ ══════════════ */}
          <div className="space-y-6">
            {/* Главный блок окупаемости: красный при активном «плохом месяце» */}
            <section
              className={cn(
                'rounded-xl border-2 p-6 sm:p-8 text-center shadow-sm transition-colors',
                isBadMonth ? 'bg-red-50 border-red-500' : 'bg-emerald-50 border-emerald-500'
              )}
              aria-live="polite"
            >
              <div
                className={cn(
                  'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full',
                  isBadMonth ? 'bg-red-100' : 'bg-white'
                )}
              >
                {isBadMonth ? (
                  <AlertTriangle className="w-6 h-6 text-red-600" aria-hidden="true" />
                ) : (
                  <TrendingUp className="w-6 h-6 text-[var(--primary)]" aria-hidden="true" />
                )}
              </div>

              <p
                className={cn(
                  'text-sm sm:text-base font-medium',
                  isBadMonth ? 'text-red-700' : 'text-neutral-600'
                )}
              >
                Минимальный оборот ПВЗ для выхода в ноль
              </p>

              <p
                className={cn(
                  'mt-2 text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight',
                  isBadMonth ? 'text-red-700' : 'text-emerald-700'
                )}
              >
                {formatMoney(result.requiredTurnoverByn)} BYN
              </p>

              <p
                className={cn(
                  'mt-2 text-lg sm:text-2xl font-bold tabular-nums',
                  isBadMonth ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                (~{formatMoney(result.requiredTurnoverRub)} RUB) в месяц
              </p>

              <p
                className={cn(
                  'mt-4 text-base sm:text-lg font-bold leading-snug',
                  isBadMonth ? 'text-red-900' : 'text-neutral-900'
                )}
              >
                Чтобы просто окупать аренду и зарплаты, ваш ПВЗ должен ежедневно выдавать заказы минимум{' '}
                <span className={isBadMonth ? 'text-red-700' : 'text-[var(--primary)]'}>
                  {result.clientsPerDay}
                </span>{' '}
                клиентам.
              </p>

              <p className={cn('mt-2 text-xs sm:text-sm', isBadMonth ? 'text-red-700' : 'text-neutral-500')}>
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

              {isBadMonth && (
                <p className="mt-4 rounded-lg border border-red-300 bg-red-100 p-3 text-sm font-bold text-red-800 leading-snug">
                  ВНИМАНИЕ: Из-за штрафов и падения рейтинга ваша точка уходит в кассовый разрыв на{' '}
                  {formatMoney(result.finesTotal)} BYN! Чистый остаток прибыли превратился в минус. Тщательно
                  контролируйте работу персонала и камеры видеонаблюдения.
                </p>
              )}
            </section>

            {/* Разбор постоянных расходов */}
            <BlockCard
              title="Разбор постоянных расходов точки"
              subtitle={`Зона: ${result.zoneLabel}`}
              icon={Coins}
              tone={isBadMonth ? 'danger' : 'default'}
            >
              <MetricRow
                label="Аренда помещения"
                value={`${formatMoney(result.rent)} BYN`}
                sub={`введено ${formatMoney(toNumber(form.rent) || 0)} BYN`}
              />
              <MetricRow
                label="ФОТ сотрудников (2 менеджера + налоги)"
                value={`${formatMoney(result.staff)} BYN`}
                sub={`введено ${formatMoney(toNumber(form.staff) || 0)} BYN`}
              />
              <MetricRow
                label="Коммуналка, интернет и охрана"
                value={`${formatMoney(result.utilities)} BYN`}
                sub={`введено ${formatMoney(toNumber(form.utilities) || 0)} BYN`}
              />
              <MetricRow
                label="Штрафы «плохого месяца»"
                value={`${formatMoney(result.finesTotal)} BYN`}
                sub={
                  isBadMonth
                    ? `${PVZ_BAD_MONTH_FINES.length} штрафа прибавлено к постоянным расходам`
                    : 'симулятор выключен'
                }
                tone={isBadMonth ? 'danger' : 'muted'}
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
              {isBadMonth && (
                <MetricRow
                  label="Чистый остаток прибыли"
                  value={`-${formatMoney(result.finesTotal)} BYN`}
                  sub="минус: постоянные расходы выросли на сумму штрафов"
                  tone="danger"
                />
              )}
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
                    Постоянные расходы = аренда {formatMoney(result.rent)} + ФОТ {formatMoney(result.staff)} +
                    коммуналка {formatMoney(result.utilities)}
                    {isBadMonth ? ` + штрафы ${formatMoney(result.finesTotal)}` : ''} ={' '}
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
              </ol>
            </BlockCard>

            {/* Ключевые уличные метрики */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={cn(
                  'rounded-xl border p-4',
                  isBadMonth ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn('p-2 rounded-lg', isBadMonth ? 'bg-red-100' : 'bg-[var(--primary)]/10')}
                  >
                    <Users
                      className={cn(
                        'w-5 h-5',
                        isBadMonth ? 'text-red-600' : 'text-[var(--primary)]'
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Клиентов в день</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        isBadMonth ? 'text-red-700' : 'text-neutral-900'
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
                  isBadMonth ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn('p-2 rounded-lg', isBadMonth ? 'bg-red-100' : 'bg-[var(--primary)]/10')}
                  >
                    <Wallet
                      className={cn(
                        'w-5 h-5',
                        isBadMonth ? 'text-red-600' : 'text-[var(--primary)]'
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Выплата WB за месяц</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        isBadMonth ? 'text-red-700' : 'text-neutral-900'
                      )}
                    >
                      {formatMoney(result.payoutByn)} BYN
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
                  isBadMonth ? 'bg-red-50 border-red-300' : 'bg-white border-neutral-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', isBadMonth ? 'bg-red-100' : 'bg-emerald-100')}>
                    <CalculatorIcon
                      className={cn('w-5 h-5', isBadMonth ? 'text-red-600' : 'text-emerald-600')}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">Расходы точки на 1 заказ</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        isBadMonth ? 'text-red-700' : 'text-neutral-900'
                      )}
                    >
                      {formatMoney(expensesPerOrder)} BYN
                    </p>
                    <p className="text-xs text-neutral-400">
                      {isBadMonth ? 'с учётом штрафов за месяц' : 'аренда + ФОТ + коммуналка на заказ'}
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