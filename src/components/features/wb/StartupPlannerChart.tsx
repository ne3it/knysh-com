'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import type { BudgetBreakdown } from './StartupPlanner';

let chartJSRegistered = false;

const CHART_COLORS: Record<string, string> = {
  purchase: '#3b82f6',
  logistics: '#f59e0b',
  certification: '#8b5cf6',
  marking: '#10b981',
  misc: '#ef4444',
};

export function BudgetDonut({ budget }: { budget: BudgetBreakdown }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!chartJSRegistered) {
      ChartJS.register(ArcElement, Tooltip, Legend);
      chartJSRegistered = true;
    }
    setMounted(true);
  }, []);

  const segments = useMemo(
    () => [
      { label: 'Закупка', value: budget.purchase, color: CHART_COLORS.purchase },
      { label: 'Логистика', value: budget.logistics, color: CHART_COLORS.logistics },
      { label: 'Сертификация', value: budget.certification, color: CHART_COLORS.certification },
      { label: 'Маркировка', value: budget.marking, color: CHART_COLORS.marking },
      { label: 'Прочие', value: budget.misc, color: CHART_COLORS.misc },
    ],
    [budget]
  );

  const data = useMemo(
    () => ({
      labels: segments.map((s) => s.label),
      datasets: [
        {
          data: segments.map((s) => s.value),
          backgroundColor: segments.map((s) => s.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
          hoverBorderWidth: 3,
        },
      ],
    }),
    [segments]
  );

  const options = useMemo<ChartOptions<'pie'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, family: 'Inter, sans-serif' },
            color: '#717182',
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<'pie'>) => {
              const value = ctx.parsed;
              const dataset = ctx.dataset;
              const total = (dataset?.data ?? []).reduce(
                (sum: number, val: number | null) => sum + (val ?? 0),
                0
              );
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${ctx.label}: ${value.toLocaleString('ru-RU')} BYN (${pct}%)`;
            },
          },
        },
      },
      animation: { animateScale: true, animateRotate: true, duration: 700 },
      transitions: {
        active: { animation: { duration: 300 } },
      },
    }),
    []
  );

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full">
      <Pie data={data} options={options} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <span className="text-xs text-neutral-500">Итого</span>
          <span className="block text-2xl font-bold text-neutral-900">
            {budget.total.toLocaleString('ru-RU')} BYN
          </span>
        </div>
      </div>
    </div>
  );
}

export const BUDGET_CHART_COLORS = CHART_COLORS;
