'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

interface ChartInstance {
  destroy: () => void;
  update: () => void;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
  data: unknown;
  options: unknown;
}

type ChartConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: ChartConfig
) => ChartInstance;

declare global {
  interface Window {
    Chart: ChartConstructor;
  }
}

function loadChartJs(): Promise<ChartConstructor> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Chart) {
      resolve(window.Chart);
      return;
    }
    const script = document.createElement('script');
    script.src = CHART_JS_URL;
    script.async = true;
    script.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('Chart.js не инициализирован'));
    };
    script.onerror = () => reject(new Error('Не удалось загрузить Chart.js'));
    document.head.appendChild(script);
  });
}

interface FormState {
  daily_sales: string;
  retail_price_byn: string;
  stockout_days: string;
  margin_percent: string;
}

export default function Stockout({ feature }: { feature: Feature }) {
  const defaultForm: FormState = {
    daily_sales: '10',
    retail_price_byn: '45',
    stockout_days: '7',
    margin_percent: '30',
  };

  const [form, setForm] = useState<FormState>(defaultForm);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const sales = parseFloat(form.daily_sales) || 0;
  const price = parseFloat(form.retail_price_byn) || 0;
  const days = Math.max(1, parseInt(form.stockout_days) || 1);
  const margin = parseFloat(form.margin_percent) || 0;

  const missedRevenue = sales * price * days;
  const missedProfit = missedRevenue * (margin / 100);
  const dailyLoss = sales * price * (margin / 100);

  const dayLabels = Array.from({ length: days }, (_, i) => `День ${i + 1}`);
  const cumulativeProfit = Array.from({ length: days }, (_, i) => dailyLoss * (i + 1));

  useEffect(() => {
    let cancelled = false;
    loadChartJs()
      .then((Chart) => {
        if (cancelled) return;
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        chartRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dayLabels,
            datasets: [
              {
                label: 'Накопительная потерянная прибыль, BYN',
                data: cumulativeProfit,
                backgroundColor: 'rgba(179, 53, 111, 0.6)',
                borderColor: '#b33570',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 32,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 200 },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#6b7280', font: { size: 11 } },
                title: {
                  display: true,
                  text: 'Потерянная прибыль, BYN',
                  color: '#6b7280',
                  font: { size: 12 },
                },
              },
              x: {
                grid: { display: false },
                ticks: { color: '#6b7280', font: { size: 10 } },
              },
            },
            plugins: {
              legend: {
                labels: { color: '#6b7280', font: { size: 12 } },
              },
              tooltip: {
                callbacks: {
                  label: (ctx: { formattedValue: string }) =>
                    `${Number(ctx.formattedValue).toLocaleString('ru-RU')} BYN`,
                },
              },
            },
          },
        });
      })
      .catch((err: unknown) => console.error(err));

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [dayLabels, cumulativeProfit]);

  const fmt = (n: number) =>
    n.toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчета</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily sales */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Средние продажи в день, шт.
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.daily_sales}
                onChange={(e) => updateField('daily_sales', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                required
              />
            </div>

            {/* Retail price */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Розничная цена товара, BYN
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.retail_price_byn}
                  onChange={(e) => updateField('retail_price_byn', e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
                <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">BYN</span>
              </div>
            </div>

            {/* Stockout days */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Дней отсутствия товара на складе (Stockout)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.stockout_days}
                  onChange={(e) => updateField('stockout_days', e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
                <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">Дней</span>
              </div>
            </div>

            {/* Margin */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Маржинальность товара, %
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.margin_percent}
                  onChange={(e) => updateField('margin_percent', e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
                <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Накопительная потерянная прибыль по дням
          </h3>
          <div className="h-72 w-full">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm text-neutral-600 mb-1">Итог</p>
            <p className="text-3xl font-bold text-[#dc3545]">
              Итого упущенная прибыль: {fmt(missedProfit)} BYN
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              Потерянная выручка: {fmt(missedRevenue)} BYN
            </p>
          </div>

          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              Каждый день простоя этой позиции обходится вам в{' '}
              <span className="font-semibold text-[#dc3545]">{fmt(dailyLoss)} BYN</span>. Срочно планируйте поставку на склад WB!
            </p>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
