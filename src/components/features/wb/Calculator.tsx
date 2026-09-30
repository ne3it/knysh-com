'use client';

import React, { useState } from 'react';
import { Calculator as CalculatorIcon, Send, TrendingUp, Package, Truck, DollarSign, Percent, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

const API_BASE: string = '/api/v1';

interface CalculationResult {
  recommended_price_rub: number;
  recommended_price_byn: number;
  cost_rub: number;
  cost_byn: number;
  desired_profit_rub: number;
  desired_profit_byn: number;
  volume_liters: number;
  single_delivery_rub: number;
  single_delivery_byn: number;
  back_delivery_rub: number;
  back_delivery_byn: number;
  total_delivery_rub: number;
  total_delivery_byn: number;
  transit_rub: number;
  transit_byn: number;
  commission_rub: number;
  commission_byn: number;
  tax_rub: number;
  tax_byn: number;
  roi_percent: number;
  warehouse_coefficient: number;
  exchange_rate_rub_to_byn: number;
}

interface FormState {
  cost_price: string;
  currency: 'BYN' | 'RUB';
  desired_profit_byn: string;
  commission_rate: string;
  buyout_rate: string;
  length: string;
  width: string;
  height: string;
  warehouse_coefficient: string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  note?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}

function StatCard({ label, value, sub, note, icon: Icon, iconColor, bgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', bgColor)}>
          <Icon className={cn('w-5 h-5', iconColor)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="text-lg font-semibold text-neutral-900 truncate">{value}</p>
          {sub && <p className="text-xs text-neutral-400">{sub}</p>}
          {note && <p className="text-[11px] leading-tight text-neutral-400">{note}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Calculator({ feature }: { feature: Feature }) {
  const defaultForm: FormState = {
    cost_price: '15',
    currency: 'BYN',
    desired_profit_byn: '5',
    commission_rate: '0.23',
    buyout_rate: '0.40',
    length: '20',
    width: '15',
    height: '10',
    warehouse_coefficient: '1',
  };

  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCurrency = (currency: 'BYN' | 'RUB') => {
    setForm((prev) => ({ ...prev, currency }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/calculate-wb-unit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_price: parseFloat(form.cost_price),
          currency: form.currency,
          desired_profit_byn: parseFloat(form.desired_profit_byn),
          commission_rate: parseFloat(form.commission_rate),
          buyout_rate: parseFloat(form.buyout_rate),
          length: parseFloat(form.length),
          width: parseFloat(form.width),
          height: parseFloat(form.height),
          warehouse_coefficient: parseFloat(form.warehouse_coefficient),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Ошибка ${response.status}`);
      }

      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(defaultForm);
    setResult(null);
    setError(null);
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчета</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cost Price */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Себестоимость</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price}
                    onChange={(e) => updateField('cost_price', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <select
                    value={form.currency}
                    onChange={(e) => updateCurrency(e.target.value as 'BYN' | 'RUB')}
                    className="px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  >
                    <option value="BYN">BYN</option>
                    <option value="RUB">RUB</option>
                  </select>
                </div>
              </div>

              {/* Desired Profit */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Желаемая прибыль</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.desired_profit_byn}
                    onChange={(e) => updateField('desired_profit_byn', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">BYN</span>
                </div>
              </div>

              {/* Commission */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Комиссия WB</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={form.commission_rate}
                    onChange={(e) => updateField('commission_rate', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 text-sm">или 23%</span>
                </div>
              </div>

              {/* Buyout Rate */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Процент выкупа</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={form.buyout_rate}
                    onChange={(e) => updateField('buyout_rate', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 text-sm">или 40%</span>
                </div>
              </div>

              {/* Warehouse logistics coefficient */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Коэффициент логистики склада
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.warehouse_coefficient}
                    onChange={(e) => updateField('warehouse_coefficient', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 text-sm">или 100%</span>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Длина (см)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.length}
                  onChange={(e) => updateField('length', e.target.value)}
                   className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Ширина (см)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.width}
                  onChange={(e) => updateField('width', e.target.value)}
                   className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Высота (см)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.height}
                  onChange={(e) => updateField('height', e.target.value)}
                   className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
                  loading
                    ? 'bg-[var(--primary)]/50 cursor-not-allowed'
                    : 'bg-[var(--primary)] hover:bg-[var(--primary)]/90'
                )}
              >
                {loading ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Рассчитываем...
                  </>
                ) : (
                  <>
                    <CalculatorIcon className="w-4 h-4" />
                    Рассчитать за один клик
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Сбросить
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Recommended Price */}
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6 text-center">
              <p className="text-sm text-neutral-600 mb-1">Рекомендованная РРЦ (WB)</p>
              <p className="text-3xl font-bold text-neutral-900 mb-1">
                {result.recommended_price_rub.toLocaleString('ru-RU')} ₽ /{' '}
                {result.recommended_price_byn.toLocaleString('ru-RU')} Br
              </p>
              <p className="text-sm text-neutral-500">
                ROI: <span className="font-semibold text-[var(--primary)]">{result.roi_percent}%</span>
              </p>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Разбор расходов</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Себестоимость"
                  value={`${result.cost_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.cost_byn.toLocaleString('ru-RU')} Br`}
                  icon={DollarSign}
                  iconColor="text-neutral-600"
                  bgColor="bg-neutral-100"
                />
                <StatCard
                  label="Желаемая прибыль"
                  value={`${result.desired_profit_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.desired_profit_byn.toLocaleString('ru-RU')} Br`}
                  icon={TrendingUp}
                  iconColor="text-green-600"
                  bgColor="bg-green-100"
                />
                <StatCard
                  label="Объем"
                  value={`${result.volume_liters} л`}
                  icon={Package}
                  iconColor="text-blue-600"
                  bgColor="bg-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Доставка (1 шт)"
                  value={`${result.single_delivery_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.single_delivery_byn.toLocaleString('ru-RU')} Br`}
                  note={`Включая транзит РБ->РФ: ${result.transit_rub.toLocaleString('ru-RU')} рублей`}
                  icon={Truck}
                  iconColor="text-purple-600"
                  bgColor="bg-purple-100"
                />
                <StatCard
                  label="Невыкупы (back-delivery)"
                  value={`${result.back_delivery_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.back_delivery_byn.toLocaleString('ru-RU')} Br`}
                  icon={Truck}
                  iconColor="text-orange-600"
                  bgColor="bg-orange-100"
                />
                <StatCard
                  label="Итого логистика"
                  value={`${result.total_delivery_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.total_delivery_byn.toLocaleString('ru-RU')} Br`}
                  note={`Включая транзит РБ->РФ: ${result.transit_rub.toLocaleString('ru-RU')} рублей`}
                  icon={Percent}
                  iconColor="text-red-600"
                  bgColor="bg-red-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Комиссия WB"
                  value={`${result.commission_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.commission_byn.toLocaleString('ru-RU')} Br`}
                  icon={Percent}
                  iconColor="text-indigo-600"
                  bgColor="bg-indigo-100"
                />
                <StatCard
                  label="Налог (УСН 6%)"
                  value={`${result.tax_rub.toLocaleString('ru-RU')} ₽`}
                  sub={`${result.tax_byn.toLocaleString('ru-RU')} Br`}
                  icon={Scale}
                  iconColor="text-cyan-600"
                  bgColor="bg-cyan-100"
                />
                <StatCard
                  label="Курс валют"
                  value={`1 RUB = ${result.exchange_rate_rub_to_byn.toFixed(4)} Br`}
                  icon={DollarSign}
                  iconColor="text-neutral-600"
                  bgColor="bg-neutral-100"
                />
              </div>
            </div>

            {/* Transit breakdown */}
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-600">
                Транзит РБ → РФ: <span className="font-semibold">{result.transit_rub.toLocaleString('ru-RU')} ₽</span> ({result.transit_byn.toLocaleString('ru-RU')} Br)
              </p>
            </div>
          </div>
        )}

        {/* No result yet */}
        {!result && !loading && !error && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center text-neutral-400">
            <CalculatorIcon className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>Введите параметры и нажмите «Рассчитать за один клик»</p>
          </div>
        )}
      </div>
    </SectionContentWrapper>
  );
}
