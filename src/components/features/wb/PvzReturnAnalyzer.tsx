'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, PackageCheck, RotateCcw, ShieldCheck, Truck, Undo2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

let chartJSRegistered = false;

export const CUSTOM_TARIFF_ID = 'log_custom';

export interface LogisticsOption {
  id: string;
  label: string;
  box: number;
  return: number;
}

export interface LogisticsGroup {
  group: string;
  options: LogisticsOption[];
}

export const LOGISTICS_GROUPS: LogisticsGroup[] = [
  {
    group: 'Стандартные габариты',
    options: [
      {
        id: 'clothes',
        label: 'Одежда и обувь (Доставка: 2.2 BYN, Возврат: 1.8 BYN)',
        box: 2.2,
        return: 1.8,
      },
      {
        id: 'cosmetics',
        label: 'Косметика, бытовая химия, гаджеты (Доставка: 1.9 BYN, Возврат: 1.8 BYN)',
        box: 1.9,
        return: 1.8,
      },
      {
        id: 'home',
        label: 'Товары для дома, хозтовары (Доставка: 2.5 BYN, Возврат: 2.0 BYN)',
        box: 2.5,
        return: 2.0,
      },
    ],
  },
  {
    group: 'Крупногабаритные товары (КГТ)',
    options: [
      {
        id: 'furniture',
        label: 'Мебель и крупная техника (Доставка: 12 BYN, Возврат: 10 BYN)',
        box: 12.0,
        return: 10.0,
      },
    ],
  },
  {
    group: 'УНИВЕРСАЛЬНЫЙ РУЧНОЙ ВВОД',
    options: [
      {
        id: CUSTOM_TARIFF_ID,
        label: 'Кастомный тариф (ввести стоимость логистики вручную)',
        box: 2.5,
        return: 2.0,
      },
    ],
  },
];

export const DEFAULT_LOGISTICS_ID = 'clothes';

export function getLogisticsOption(id: string): LogisticsOption {
  for (const group of LOGISTICS_GROUPS) {
    const found = group.options.find((option) => option.id === id);
    if (found) return found;
  }
  return LOGISTICS_GROUPS[0].options[0];
}

interface FormState {
  logistics: string;
  manualBox: string;
  manualReturn: string;
  cost: string;
  price: string;
  commission: string;
  buyout: string;
}

const DEFAULT_FORM: FormState = {
  logistics: DEFAULT_LOGISTICS_ID,
  manualBox: '2.5',
  manualReturn: '2.0',
  cost: '15',
  price: '45',
  commission: '23',
  buyout: '30',
};

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

const toNumber = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });

/** Максимум шагов по оси X, чтобы график оставался читаемым */
const MAX_CHART_POINTS = 8;

export interface PvzResult {
  box: number;
  returnLogistics: number;
  netRevenue: number;
  baseMargin: number;
  cycleCost: number;
  breakEvenN: number;
  compensation: number;
  profitAtBreakEven: number;
  points: { n: number; profit: number }[];
}

export function calculatePvz(form: FormState): PvzResult {
  const option = getLogisticsOption(form.logistics);
  const isCustom = form.logistics === CUSTOM_TARIFF_ID;

  const box = Math.max(0, isCustom ? toNumber(form.manualBox) : option.box);
  const returnLogistics = Math.max(0, isCustom ? toNumber(form.manualReturn) : option.return);
  const cost = Math.max(0, toNumber(form.cost));
  const price = Math.max(0, toNumber(form.price));
  const commission = Math.min(100, Math.max(0, toNumber(form.commission)));
  const buyout = Math.min(100, Math.max(1, toNumber(form.buyout))) / 100;

  // 1) Выручка чистыми (после комиссии WB)
  const netRevenue = price * (1 - commission / 100);
  // 2) Начальная маржа (0 возвратов)
  const baseMargin = netRevenue - cost - box;
  // 3) Стоимость одного цикла холостой покатушки
  const cycleCost = box + returnLogistics;

  // 4) Цикл: Прибыль(N) = Начальная маржа - N * Стоимость цикла.
  //    N — первый возврат, при котором прибыль уходит в минус («точка невозврата»)
  const profitAt = (n: number) => baseMargin - n * cycleCost;

  let breakEvenN = 0;
  if (cycleCost > 0) {
    for (let n = 0; n <= MAX_CHART_POINTS * 4; n += 1) {
      if (profitAt(n) < 0) {
        breakEvenN = n;
        break;
      }
      breakEvenN = n;
    }
  } else {
    breakEvenN = baseMargin < 0 ? 0 : MAX_CHART_POINTS * 4;
  }

  const profitAtBreakEven = profitAt(breakEvenN);

  // 5) Сумма компенсации = избыточный убыток от покатушек / процент выкупа
  const excessLoss = Math.max(0, -profitAtBreakEven);
  const compensation = buyout > 0 ? excessLoss / buyout : 0;

  const chartCount = Math.max(MAX_CHART_POINTS, breakEvenN + 2);
  const points = Array.from({ length: Math.min(chartCount, MAX_CHART_POINTS) + 1 }, (_, n) => ({
    n,
    profit: Math.round(profitAt(n) * 100) / 100,
  }));

  return {
    box,
    returnLogistics,
    netRevenue,
    baseMargin,
    cycleCost,
    breakEvenN,
    compensation,
    profitAtBreakEven,
    points,
  };
}

function ProfitChart({ result }: { result: PvzResult }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!chartJSRegistered) {
      ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
      chartJSRegistered = true;
    }
    setMounted(true);
  }, []);

  const isCritical = result.breakEvenN <= 2;
  const lineColor = isCritical ? '#dc2626' : '#16a34a';
  const fillColor = isCritical ? 'rgba(220, 38, 38, 0.12)' : 'rgba(22, 163, 74, 0.12)';

  const data = useMemo<ChartData<'line'>>(
    () => ({
      labels: result.points.map((p) => String(p.n)),
      datasets: [
        {
          label: 'Прибыль, BYN',
          data: result.points.map((p) => p.profit),
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2.5,
          pointRadius: result.points.map((p) => (p.n === result.breakEvenN ? 6 : 3)),
          pointBackgroundColor: result.points.map((p) => (p.n === result.breakEvenN ? '#dc2626' : lineColor)),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          tension: 0,
          fill: true,
        },
      ],
    }),
    [result.points, result.breakEvenN, lineColor, fillColor]
  );

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, family: 'Inter, sans-serif' },
            color: '#717182',
          },
        },
        tooltip: {
          callbacks: {
            title: (items: TooltipItem<'line'>[]) => `Возвратов: ${items[0]?.label ?? '0'}`,
            label: (ctx: TooltipItem<'line'>) =>
              `Прибыль: ${format(ctx.parsed.y ?? 0)} BYN`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Возвраты', color: '#717182', font: { size: 12 } },
          ticks: { precision: 0, color: '#a1a1aa' },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          title: { display: true, text: 'Прибыль, BYN', color: '#717182', font: { size: 12 } },
          ticks: {
            color: '#a1a1aa',
            callback: (value) => format(Number(value), 0),
          },
          grid: {
            color: (ctx) => (Number(ctx.tick?.value) === 0 ? '#a1a1aa' : 'rgba(0,0,0,0.05)'),
          },
        },
      },
      animation: { duration: 400 },
    }),
    []
  );

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-72 w-full">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative h-72 w-full">
      <Line data={data} options={options} />
    </div>
  );
}

export default function PvzReturnAnalyzer({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCustom = form.logistics === CUSTOM_TARIFF_ID;
  const result = useMemo(() => calculatePvz(form), [form]);
  const isCritical = result.breakEvenN <= 2;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Параметры расчёта */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчёта</h3>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-neutral-700 mb-1"
                htmlFor="pvz-logistics"
              >
                Тип товара / Логистическая группа
              </label>
              <select
                id="pvz-logistics"
                value={form.logistics}
                onChange={(e) => updateField('logistics', e.target.value)}
                onInput={(e) => updateField('logistics', e.currentTarget.value)}
                className={selectClass}
              >
                {LOGISTICS_GROUPS.map(({ group, options }) => (
                  <optgroup key={group} label={group}>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {isCustom && (
              <div className="p-4 rounded-xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5">
                <p className="text-sm font-medium text-neutral-700 mb-3">
                  Ручная настройка тарифов (режим неуязвимости)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-neutral-700 mb-1"
                      htmlFor="pvz-manual-box"
                    >
                      Прямая доставка к клиенту, BYN
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pvz-manual-box"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.manualBox}
                        onChange={(e) => updateField('manualBox', e.target.value)}
                        onInput={(e) => updateField('manualBox', e.currentTarget.value)}
                        className={inputClass}
                      />
                      <span className={badgeClass}>BYN</span>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-neutral-700 mb-1"
                      htmlFor="pvz-manual-return"
                    >
                      Обратная логистика (возврат), BYN
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pvz-manual-return"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.manualReturn}
                        onChange={(e) => updateField('manualReturn', e.target.value)}
                        onInput={(e) => updateField('manualReturn', e.currentTarget.value)}
                        className={inputClass}
                      />
                      <span className={badgeClass}>BYN</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="pvz-cost"
                >
                  Себестоимость товара (закупка + упаковка), BYN
                </label>
                <div className="flex gap-2">
                  <input
                    id="pvz-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(e) => updateField('cost', e.target.value)}
                    onInput={(e) => updateField('cost', e.currentTarget.value)}
                    className={inputClass}
                  />
                  <span className={badgeClass}>BYN</span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="pvz-price"
                >
                  Розничная цена продажи на WB, BYN
                </label>
                <div className="flex gap-2">
                  <input
                    id="pvz-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    onInput={(e) => updateField('price', e.currentTarget.value)}
                    className={inputClass}
                  />
                  <span className={badgeClass}>BYN</span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="pvz-commission"
                >
                  Комиссия WB для этой категории, %
                </label>
                <div className="flex gap-2">
                  <input
                    id="pvz-commission"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.commission}
                    onChange={(e) => updateField('commission', e.target.value)}
                    onInput={(e) => updateField('commission', e.currentTarget.value)}
                    className={inputClass}
                  />
                  <span className={badgeClass}>%</span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="pvz-buyout"
                >
                  Ожидаемый процент выкупа, %
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    id="pvz-buyout"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={form.buyout}
                    onChange={(e) => updateField('buyout', e.target.value)}
                    onInput={(e) => updateField('buyout', e.currentTarget.value)}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                  />
                  <span className="text-3xl font-bold text-[var(--primary)] tabular-nums w-16 text-right">
                    {Math.round(toNumber(form.buyout))}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>10%</span>
                  <span>100%</span>
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
                Расчёт обновляется автоматически при изменении полей
              </span>
            </div>
          </div>
        </div>

        {/* График */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">Зависимость прибыли от возвратов</h3>
          <p className="text-sm text-neutral-500 mb-4">
            Каждый возврат — это дополнительный цикл логистики ПВЗ (прямая доставка + обратная логистика).
          </p>
          <ProfitChart result={result} />
        </div>

        {/* Результат */}
        <div
          className={cn(
            'rounded-xl border-2 p-6 text-center transition-colors',
            isCritical ? 'bg-red-600 border-red-800' : 'bg-emerald-50 border-emerald-500'
          )}
        >
          <div
            className={cn(
              'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full',
              isCritical ? 'bg-white/20' : 'bg-white'
            )}
          >
            {isCritical ? (
              <AlertTriangle
                className="w-6 h-6 text-white"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck className="w-6 h-6 text-[var(--primary)]" aria-hidden="true" />
            )}
          </div>

          <p
            className={cn(
              'text-2xl sm:text-3xl font-bold mb-2',
              isCritical ? 'text-white' : 'text-neutral-900'
            )}
          >
            Точка невозврата: {result.breakEvenN}-й возврат
          </p>

          <p className={cn('text-base sm:text-lg font-medium', isCritical ? 'text-red-50' : 'text-emerald-800')}>
            {isCritical
              ? `КРИТИЧЕСКИЙ РИСК! При текущем проценте выкупа (${Math.round(
                  toNumber(form.buyout)
                )}%) этот товар начнет приносить чистый убыток уже после ${
                  result.breakEvenN
                }-го возврата. Рекомендуется поднять цену на ${format(result.compensation)} BYN для компенсации покатушек до ПВЗ.`
              : `Стабильная позиция. Товар выдерживает до ${result.breakEvenN} возвратов без ухода в минус. Текущая цена надежно защищает вашу юнит-экономику.`}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-xs text-neutral-500">
            {isCritical ? (
              <Undo2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PackageCheck className="w-4 h-4" aria-hidden="true" />
            )}
            Прибыль при {result.breakEvenN} возвратах: {format(result.profitAtBreakEven)} BYN
          </div>
        </div>

        {/* Разбор расчёта */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Разбор расчёта</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="text-xs text-neutral-500">Выручка чистыми (после комиссии)</p>
              </div>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{format(result.netRevenue)} BYN</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                Цена {format(toNumber(form.price))} BYN − комиссия {format(toNumber(form.commission))}%
              </p>
            </div>

            <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Начальная маржа (0 возвратов)</p>
              <p
                className={cn(
                  'text-lg font-semibold mt-1',
                  result.baseMargin >= 0 ? 'text-emerald-700' : 'text-red-600'
                )}
              >
                {format(result.baseMargin)} BYN
              </p>
              <p className="text-[11px] leading-tight text-neutral-400">
                Выручка чистыми − себестоимость {format(toNumber(form.cost))} − доставка {format(result.box)}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Стоимость цикла холостой покатушки</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{format(result.cycleCost)} BYN</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                Доставка {format(result.box)} + возврат {format(result.returnLogistics)}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Сумма компенсации покатушек</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{format(result.compensation)} BYN</p>
              <p className="text-[11px] leading-tight text-neutral-400">
                Избыточный убыток {format(Math.max(0, -result.profitAtBreakEven))} BYN ÷ выкуп{' '}
                {Math.round(toNumber(form.buyout))}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
