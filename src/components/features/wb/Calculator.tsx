'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator as CalculatorIcon,
  ChevronDown,
  ChevronUp,
  Coins,
  Leaf,
  Package,
  Percent,
  RefreshCw,
  RotateCcw,
  Ruler,
  Scale,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  BREAK_EVEN_ERROR_MESSAGE,
  DEFAULT_MEGA_FORM,
  ECO_FEE_OPTIONS,
  MEGA_CONFIG,
  calculateMegaUnitEconomics,
  roundMoney,
  toNumber,
  type EcoFeeKind,
  type MegaUnitForm,
} from '@/lib/services/megaUnitEconomics';
import {
  PRICE_CONTROL_CATEGORIES,
  PRICE_CONTROL_CUSTOM_ID,
  PRICE_CONTROL_GROUPS,
  limitToPercent,
  type PriceControlCategory,
} from '@/lib/services/priceControl713';
import type { Feature } from '@/types/section';

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent disabled:opacity-50';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

/** Все денежные величины перед выводом проходят через roundMoney (защита от float-багов) */
const formatMoney = (value: number) =>
  roundMoney(value).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const format = (value: number, digits = 2) =>
  (Number.isFinite(value) ? value : 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

type Tone = 'default' | 'muted' | 'accent' | 'success' | 'warn' | 'danger';

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-neutral-900',
  muted: 'text-neutral-500',
  accent: 'text-[var(--primary)]',
  success: 'text-emerald-700',
  warn: 'text-amber-700',
  danger: 'text-red-600',
};

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

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  min = 0,
  max,
  step = '0.01',
  disabled = false,
}: NumberFieldProps) {
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
          min={min}
          max={max}
          value={value}
          disabled={disabled}
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

interface MetricRowProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

function MetricRow({ label, value, sub, tone = 'default' }: MetricRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        {sub && <p className="text-[11px] leading-tight text-neutral-400">{sub}</p>}
      </div>
      <p className={cn('text-sm font-semibold tabular-nums text-right shrink-0', TONE_TEXT[tone])}>
        {value}
      </p>
    </div>
  );
}

function categoryLabel(category: PriceControlCategory): string {
  return `${category.name} — макс. надбавка ${limitToPercent(category.limit)}%`;
}

export default function Calculator({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<MegaUnitForm>(DEFAULT_MEGA_FORM);
  const [rate, setRate] = useState<number>(MEGA_CONFIG.FALLBACK_RUB_TO_BYN);
  const [rateSource, setRateSource] = useState<'nbrb' | 'fallback'>('fallback');
  const [rateError, setRateError] = useState<string | null>(null);
  const [tariffSettingsOpen, setTariffSettingsOpen] = useState(false);

  const loadRate = React.useCallback(async (force = false) => {
    setRateError(null);
    try {
      const response = await fetch(
        `/api/v1/exchange-rate${force ? `?t=${Date.now()}` : ''}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Курс недоступен (${response.status})`);
      const data = (await response.json()) as { rub_to_byn?: number; source?: string };
      const nextRate = toNumber(String(data.rub_to_byn ?? ''));
      if (nextRate <= 0) throw new Error('НБРБ вернул некорректный курс');
      setRate(nextRate);
      setRateSource(data.source === 'nbrb' ? 'nbrb' : 'fallback');
    } catch (err) {
      setRateSource('fallback');
      setRateError(err instanceof Error ? err.message : 'Курс недоступен, используем резервный');
    }
  }, []);

  useEffect(() => {
    void loadRate();
  }, [loadRate]);

  const updateField = <K extends keyof MegaUnitForm>(field: K, value: MegaUnitForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateText = (field: keyof MegaUnitForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value } as MegaUnitForm));
  };

  const result = useMemo(() => calculateMegaUnitEconomics(form, rate), [form, rate]);

  const ecoEnabled = form.eco_fee !== 'none';
  const ecoWeightDisabled = !ecoEnabled;
  const retailAuto = form.retail_price.trim() === '';
  const buyoutPercent = toNumber(form.buyout_rate) || MEGA_CONFIG.DEFAULT_BUYOUT_RATE;

  const heroTone: Tone = !result.denominatorValid
    ? 'danger'
    : result.netProfitByn >= 0
      ? 'success'
      : 'danger';

  const heroBox = !result.denominatorValid
    ? 'bg-red-600 border-red-800 text-white'
    : result.netProfitByn >= 0
      ? 'bg-emerald-50 border-emerald-500 text-neutral-900'
      : 'bg-red-50 border-red-500 text-red-900';

  const selectedCategory = form.p713_category === PRICE_CONTROL_CUSTOM_ID ? null : result.priceControl.category;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ═══ БЛОК 6: ТОЧКА БЕЗУБЫТОЧНОСТИ — самая видная точка экрана ═══ */}
        <section
          className={cn('rounded-xl border-2 p-6 sm:p-8 text-center shadow-sm', heroBox)}
          aria-live="polite"
        >
          <p
            className={cn(
              'text-sm sm:text-base font-medium',
              heroTone === 'danger' ? 'text-white/90' : 'text-neutral-600'
            )}
          >
            Точка безубыточности (ниже опускаться нельзя)
          </p>

          {result.denominatorValid ? (
            <>
              <p
                className={cn(
                  'mt-2 text-4xl sm:text-5xl lg:text-6xl font-extrabold tabular-nums tracking-tight',
                  heroTone === 'danger' ? 'text-white' : 'text-emerald-700'
                )}
              >
                {formatMoney(result.breakEvenByn)} BYN
                <span className="mx-2 text-2xl sm:text-3xl font-bold opacity-50">/</span>
                {formatMoney(result.breakEvenRub)} ₽
              </p>
              <p
                className={cn(
                  'mt-3 text-xs sm:text-sm',
                  heroTone === 'danger' ? 'text-white/90' : 'text-neutral-600'
                )}
              >
                Минимальная цена продажи = (закупка + экосбор + логистика с учётом покатушек + ФСЗН) ÷{' '}
                (1 − {format(result.commissionPercent, 1)}% комиссия − {format(result.taxPercent, 1)}% налог)
              </p>
              <p
                className={cn(
                  'mt-1 text-sm font-semibold',
                  heroTone === 'danger' ? 'text-white' : 'text-neutral-700'
                )}
              >
                {result.netProfitByn >= 0
                  ? `Ваша цена ${formatMoney(result.retailPriceByn)} BYN выше точки безубыточности — запас ${formatMoney(result.netToLiveByn)} BYN с продажи.`
                  : `ВНИМАНИЕ: цена ${formatMoney(result.retailPriceByn)} BYN НИЖЕ точки безубыточности — убыток ${formatMoney(Math.abs(result.netToLiveByn))} BYN с каждой продажи!`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-4xl sm:text-5xl lg:text-6xl font-extrabold tabular-nums tracking-tight text-white">
                {formatMoney(result.breakEvenByn)} BYN
                <span className="mx-2 text-2xl sm:text-3xl font-bold opacity-50">/</span>
                {formatMoney(result.breakEvenRub)} ₽
              </p>
              <p className="mt-3 text-base sm:text-lg font-bold text-white">
                {result.denominatorError ?? BREAK_EVEN_ERROR_MESSAGE}
              </p>
              <p className="mt-1 text-sm text-white/90">
                Знаменатель (1 − комиссия {format(result.commissionPercent, 1)}% − налог{' '}
                {format(result.taxPercent, 1)}%) ≤ 0 — формула не имеет решения, расчёт возвращает 0.
                Снизьте ставки комиссии и налога.
              </p>
            </>
          )}
        </section>

        {/* ═══ Ключевые метрики ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--primary)]/10">
                <TrendingUp className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">Рекомендованная РРЦ</p>
                <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                  {formatMoney(result.recommendedPriceByn)} BYN
                </p>
                <p className="text-xs text-neutral-400 tabular-nums">{formatMoney(result.recommendedPriceRub)} ₽</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-lg',
                  result.netProfitByn >= 0 ? 'bg-emerald-100' : 'bg-red-100'
                )}
              >
                <Wallet
                  className={cn(
                    'w-5 h-5',
                    result.netProfitByn >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">Чистый остаток «на жизнь»</p>
                <p
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    result.netToLiveByn >= 0 ? 'text-emerald-700' : 'text-red-600'
                  )}
                >
                  {formatMoney(result.netToLiveByn)} BYN
                </p>
                <p className="text-xs text-neutral-400 tabular-nums">{formatMoney(result.retailPriceRub)} ₽ цена</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Percent className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">ROI на 1 единицу</p>
                <p
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    result.roiPercent >= 0 ? 'text-indigo-700' : 'text-red-600'
                  )}
                >
                  {format(result.roiPercent, 1)}%
                </p>
                <p className="text-xs text-neutral-400">закупка {formatMoney(result.costWithEcoByn)} BYN</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="w-5 h-5 text-blue-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">Объём упаковки</p>
                <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                  {format(result.trip.volumeLiters, 2)} л
                </p>
                <p className="text-xs text-neutral-400">
                  {result.trip.excessLiters > 0
                    ? `сверх лимита ${format(result.trip.excessLiters, 2)} л`
                    : `в лимите ${MEGA_CONFIG.WB_VOLUME_LIMIT_L} л`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ══════════════ ЛЕВАЯ КОЛОНКА: ВВОД ══════════════ */}
          <div className="space-y-6">
            <BlockCard
              title="Блок 1–2. Закупка, комиссия WB и налог"
              subtitle="Исходные параметры юнит-экономики"
              icon={Coins}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="mega-cost">
                    Себестоимость закупки
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="mega-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.cost_price}
                      onChange={(e) => updateText('cost_price')(e.target.value)}
                      onInput={(e) => updateText('cost_price')(e.currentTarget.value)}
                      className={inputClass}
                    />
                    <select
                      value={form.currency}
                      aria-label="Валюта закупки"
                      onChange={(e) => updateField('currency', e.target.value as MegaUnitForm['currency'])}
                      className="px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    >
                      <option value="BYN">BYN</option>
                      <option value="RUB">RUB</option>
                    </select>
                  </div>
                </div>

                <NumberField
                  id="mega-retail"
                  label="Розничная цена продажи на WB, BYN"
                  value={form.retail_price}
                  onChange={updateText('retail_price')}
                  min={0}
                  hint={
                    retailAuto
                      ? `Пусто = автоподстановка РРЦ ${formatMoney(result.recommendedPriceByn)} BYN`
                      : 'Ручная цена: используется для расчёта прибыли и надбавки № 713'
                  }
                />

                <NumberField
                  id="mega-commission"
                  label="Комиссия маркетплейса, %"
                  value={form.commission_rate}
                  onChange={updateText('commission_rate')}
                  unit="%"
                  hint={`Обычно 21–30% · берётся от итоговой цены (сейчас ${format(result.commissionPercent, 1)}%)`}
                />

                <NumberField
                  id="mega-tax"
                  label="Ставка налога (УСН), %"
                  value={form.tax_rate}
                  onChange={updateText('tax_rate')}
                  unit="%"
                  hint="Берётся от итоговой цены продажи"
                />

                <div className="md:col-span-2">
                  <NumberField
                    id="mega-profit"
                    label="Желаемая прибыль с 1 единицы, BYN"
                    value={form.desired_profit}
                    onChange={updateText('desired_profit')}
                    unit="BYN"
                    hint="Не входит в точку безубыточности: показывает цель по РРЦ"
                  />
                </div>
              </div>
            </BlockCard>

            <BlockCard
              title="Блок 3. Экосбор РБ и взносы ФСЗН / Белгосстрах"
              subtitle="Регуляторные расходы идут в себестоимость единицы"
              icon={Leaf}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="mega-eco">
                    Экосбор за упаковку
                  </label>
                  <select
                    id="mega-eco"
                    value={form.eco_fee}
                    onChange={(e) => updateField('eco_fee', e.target.value as EcoFeeKind)}
                    onInput={(e) => updateField('eco_fee', e.currentTarget.value as EcoFeeKind)}
                    className={selectClass}
                  >
                    {ECO_FEE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {form.eco_fee === 'custom' && (
                  <NumberField
                    id="mega-eco-rate"
                    label="Кастомная ставка экосбора, BYN/т"
                    value={form.eco_custom_rate}
                    onChange={updateText('eco_custom_rate')}
                    unit="BYN/т"
                  />
                )}

                <NumberField
                  id="mega-eco-weight"
                  label="Вес упаковки 1 единицы"
                  value={form.eco_weight}
                  onChange={updateText('eco_weight')}
                  unit="г"
                  step="0.1"
                  disabled={ecoWeightDisabled}
                  hint={
                    ecoEnabled
                      ? `${format(toNumber(form.eco_weight), 1)} г × ${formatMoney(result.ecoRateBynPerTon)} BYN/т`
                      : 'Экосбор не начисляется'
                  }
                />

                <div
                  className={cn(
                    'rounded-lg border p-3',
                    ecoEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'
                  )}
                >
                  <p className="text-xs text-neutral-500">Экосбор на 1 единицу</p>
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums mt-1',
                      ecoEnabled ? 'text-emerald-700' : 'text-neutral-400'
                    )}
                  >
                    {formatMoney(result.ecoFeeKopecks)} коп.
                  </p>
                  <p className="text-[11px] leading-tight text-neutral-400">
                    {formatMoney(result.ecoFeeByn)} BYN прибавлено к себестоимости
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-start gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.fszn_enabled}
                      onChange={(e) => updateField('fszn_enabled', e.target.checked)}
                      onInput={(e) => updateField('fszn_enabled', e.currentTarget.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="font-medium">Учесть фиксированные взносы ФСЗН и Белгосстрах за квартал</span>
                  </label>
                </div>

                {form.fszn_enabled && (
                  <>
                    <NumberField
                      id="mega-fszn-sum"
                      label="Сумма взносов за квартал, BYN"
                      value={form.fszn_quarter}
                      onChange={updateText('fszn_quarter')}
                      unit="BYN"
                      step="1"
                    />
                    <NumberField
                      id="mega-fszn-batch"
                      label="Объём партии"
                      value={form.batch_volume}
                      onChange={updateText('batch_volume')}
                      unit="шт"
                      step="1"
                      hint={`Доля на 1 шт: ${formatMoney(result.fsznPerUnitByn)} BYN (${format(
                        result.fsznPerUnitByn * 100
                      )} коп.)`}
                    />
                  </>
                )}
              </div>
            </BlockCard>

            <BlockCard
              title="Блок 4. Габариты упаковки, объём и покатушки"
              subtitle={`Лимит WB ${MEGA_CONFIG.WB_VOLUME_LIMIT_L} л · доплата за лишний литр настраивается в инженерных настройках`}
              icon={Ruler}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberField
                  id="mega-length"
                  label="Длина"
                  value={form.length}
                  onChange={updateText('length')}
                  unit="см"
                  step="0.5"
                />
                <NumberField
                  id="mega-width"
                  label="Ширина"
                  value={form.width}
                  onChange={updateText('width')}
                  unit="см"
                  step="0.5"
                />
                <NumberField
                  id="mega-height"
                  label="Высота"
                  value={form.height}
                  onChange={updateText('height')}
                  unit="см"
                  step="0.5"
                />
              </div>

              <p className="mt-2 text-xs text-neutral-400">
                Объём = (Д × Ш × В) ÷ 1000 = {format(result.trip.volumeLiters, 2)} л
                {result.trip.excessLiters > 0 && (
                  <span className="text-red-600 font-semibold">
                    {' '}
                    · доплата за {format(result.trip.excessLiters, 2)} л сверх лимита ={' '}
                    {formatMoney(result.trip.excessFeeByn)} BYN за поездку
                  </span>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <NumberField
                  id="mega-transit"
                  label="Транзит РБ → РФ, BYN"
                  value={form.transit}
                  onChange={updateText('transit')}
                  unit="BYN"
                />
                <NumberField
                  id="mega-batch"
                  label="Объём партии"
                  value={form.batch_volume}
                  onChange={updateText('batch_volume')}
                  unit="шт"
                  step="1"
                  hint="Делит взносы ФСЗН и множит экономию от оптимизации тары"
                />
                <NumberField
                  id="mega-tariff-5l"
                  label={`Базовый тариф логистики за ${MEGA_CONFIG.WB_VOLUME_LIMIT_L} литров, BYN`}
                  value={form.base_tariff_5l}
                  onChange={updateText('base_tariff_5l')}
                  unit="BYN"
                  hint={`С учётом коэффициента: ${formatMoney(
                    result.trip.weightedTariffByn
                  )} BYN`}
                />
              </div>

              {/* Режим неуязвимости: скрытые поля ручной корректировки тарифов */}
              <div className="mt-4 border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTariffSettingsOpen((prev) => !prev)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                  aria-expanded={tariffSettingsOpen}
                >
                  <Settings2 className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <span className="flex-1 text-left">Инженерные настройки тарифов WB</span>
                  {tariffSettingsOpen ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                {tariffSettingsOpen && (
                  <div className="p-4 space-y-4">
                    <p className="text-xs text-neutral-400">
                      Тарифы WB меняются каждый сезон. Эти поля используются в расчёте вместо
                      фиксированных цифр — калькулятор останется рабочим при любых новых тарифах.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <NumberField
                        id="mega-tariff-base"
                        label="Базовый тариф логистики за 5 литров, BYN"
                        value={form.base_tariff_5l}
                        onChange={updateText('base_tariff_5l')}
                        unit="BYN"
                      />
                      <NumberField
                        id="mega-over-liter"
                        label="Стоимость избыточного литра, BYN"
                        value={form.over_liter_cost}
                        onChange={updateText('over_liter_cost')}
                        unit="BYN"
                        hint={`За каждый литр сверх ${MEGA_CONFIG.WB_VOLUME_LIMIT_L} л`}
                      />
                      <NumberField
                        id="mega-clothing-coef"
                        label="Повышающий коэффициент логистики для Одежды"
                        value={form.clothing_coefficient}
                        onChange={updateText('clothing_coefficient')}
                        unit="×"
                        hint="1.5 = +50% к тарифной части логистики"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="mega-buyout">
                    Процент выкупа
                  </label>
                  <span className="text-2xl font-bold text-[var(--primary)] tabular-nums">
                    {format(buyoutPercent, 0)}%
                  </span>
                </div>
                <input
                  id="mega-buyout"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={form.buyout_rate || String(MEGA_CONFIG.DEFAULT_BUYOUT_RATE)}
                  onChange={(e) => updateText('buyout_rate')(e.target.value)}
                  onInput={(e) => updateText('buyout_rate')(e.currentTarget.value)}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>1%</span>
                  <span>100%</span>
                </div>
                <p className="text-[11px] leading-tight text-neutral-400 mt-1">
                  Логистика на 1 успешную продажу = поездка × (1 + (100 − выкуп) ÷ выкуп ×{' '}
                  {MEGA_CONFIG.BUYOUT_TRIP_FACTOR}) = {formatMoney(result.trip.totalByn)} ×{' '}
                  {format(result.tripsPerSale, 2)} = {formatMoney(result.deliveryPerSaleByn)} BYN
                </p>
              </div>
            </BlockCard>

            <BlockCard
              title="Блок 5. Постановление № 713 КГК РБ"
              subtitle="Защита от штрафов за ценовое регулирование"
              icon={Scale}
            >
              <label className="flex items-start gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.p713_enabled}
                  onChange={(e) => updateField('p713_enabled', e.target.checked)}
                  onInput={(e) => updateField('p713_enabled', e.currentTarget.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="font-medium">
                  Товар подпадает под ценовое регулирование Постановления № 713
                </span>
              </label>

              {form.p713_enabled && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="mega-p713">
                      Категория товара и предельная надбавка
                    </label>
                    <select
                      id="mega-p713"
                      value={form.p713_category}
                      onChange={(e) => updateText('p713_category')(e.target.value)}
                      onInput={(e) => updateText('p713_category')(e.currentTarget.value)}
                      className={selectClass}
                    >
                      {PRICE_CONTROL_GROUPS.map(({ group, categories }) => (
                        <optgroup key={group} label={`${group} (${categories.length})`}>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryLabel(category)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-[11px] leading-tight text-neutral-400 mt-1">
                      Справочник Пост. № 713: {PRICE_CONTROL_CATEGORIES.length} позиций в{' '}
                      {PRICE_CONTROL_GROUPS.length} секторах розничной торговли РБ. Сектор:{' '}
                      <span className="font-medium text-neutral-600">
                        {result.priceControl.category.group}
                      </span>
                      , лимит{' '}
                      <span className="font-medium text-neutral-600">
                        {format(result.priceControl.limitPercent, 1)}%
                      </span>
                    </p>
                  </div>

                  {form.p713_category === PRICE_CONTROL_CUSTOM_ID && (
                    <NumberField
                      id="mega-p713-limit"
                      label="Кастомный лимит надбавки, %"
                      value={form.p713_custom_limit}
                      onChange={updateText('p713_custom_limit')}
                      unit="%"
                      max={100}
                    />
                  )}

                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      result.priceControl.exceeded
                        ? 'bg-red-100 border-red-400'
                        : 'bg-emerald-50 border-emerald-200'
                    )}
                  >
                    <p className="text-xs text-neutral-500">Чистая надбавка импортёра</p>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums mt-1',
                        result.priceControl.exceeded ? 'text-red-700' : 'text-emerald-700'
                      )}
                    >
                      {format(result.priceControl.markupPercent, 1)}%
                    </p>
                    <p className="text-[11px] leading-tight text-neutral-400">
                      ((цена {formatMoney(result.retailPriceByn)} − себестоимость{' '}
                      {formatMoney(result.costWithEcoByn)}) ÷ {formatMoney(result.costWithEcoByn)}) × 100%
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-[11px] font-medium',
                        result.priceControl.exceeded ? 'text-red-700' : 'text-emerald-700'
                      )}
                    >
                      {result.priceControl.exceeded
                        ? `ПРЕВЫШЕНИЕ на ${format(
                            result.priceControl.markupPercent - result.priceControl.limitPercent,
                            1
                          )} п.п. сверх лимита ${format(result.priceControl.limitPercent, 1)}%`
                        : `в пределах лимита ${format(result.priceControl.limitPercent, 1)}% (запас ${format(
                            result.priceControl.limitPercent - result.priceControl.markupPercent,
                            1
                          )} п.п.)`}
                    </p>
                  </div>
                </div>
              )}
            </BlockCard>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={() => setForm(DEFAULT_MEGA_FORM)}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Сбросить
              </button>
              <button
                type="button"
                onClick={() => void loadRate(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Обновить курс
              </button>
              <span className="flex-1 text-xs text-neutral-400">
                Расчёт обновляется автоматически на лету · 1 RUB = {format(result.rate, 4)} BYN{' '}
                {rateSource === 'nbrb' ? '(НБРБ)' : '(резервный курс)'}
              </span>
            </div>
            {rateError && <p className="text-xs text-amber-700">{rateError}</p>}
          </div>

          {/* ══════════════ ПРАВАЯ КОЛОНКА: РЕЗУЛЬТАТЫ ══════════════ */}
          <div className="space-y-6">
            {/* Блок 5: контроль 713 */}
            <BlockCard
              title="Контроль цены по Постановлению № 713"
              subtitle={
                form.p713_enabled
                  ? selectedCategory
                    ? `${selectedCategory.group}: ${selectedCategory.name}`
                    : `Кастомный лимит надбавки (${format(result.priceControl.limitPercent, 1)}%)`
                  : 'Регулирование выключено — включите чекбокс в блоке 5'
              }
              icon={Scale}
              tone={result.priceControl.exceeded ? 'danger' : 'default'}
            >
              {result.priceControl.exceeded ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-red-700">
                    КРИТИЧЕСКИЙ РИСК ШТРАФА КГК! Ваша чистая надбавка (
                    {format(result.priceControl.markupPercent, 1)}%) превышает лимит государства (
                    {format(result.priceControl.limitPercent, 1)}%). Снизьте розничную цену или уменьшите
                    расходы!
                  </p>
                  <p className="mt-3 text-xs text-red-800">
                    Максимально допустимая розничная цена по Пост. 713:{' '}
                    <strong>{formatMoney(result.priceControl.maxRetailPriceByn)} BYN</strong>. Превышение — крупный
                    штраф КГК и предписание вернуть разницу с покупателей.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-600">
                    Лимит надбавки:{' '}
                    <span className="font-semibold text-neutral-900">
                      {format(result.priceControl.limitPercent, 1)}%
                    </span>{' '}
                    · Ваша чистая надбавка:{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        form.p713_enabled ? 'text-emerald-700' : 'text-neutral-500'
                      )}
                    >
                      {format(result.priceControl.markupPercent, 1)}%
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {form.p713_enabled
                      ? `Розничная цена укладывается в регулирование. Потолок цены — ${formatMoney(
                          result.priceControl.maxRetailPriceByn
                        )} BYN (${formatMoney(result.priceControl.maxRetailPriceRub)} ₽).`
                      : 'Включите регулирование, чтобы контролировать предельную надбавку по каждой категории товара.'}
                  </p>
                </>
              )}
            </BlockCard>

            {/* Блок 4: умный оптимизатор */}
            {result.optimizer ? (
              <div className="rounded-xl border-2 border-[var(--primary)]/40 bg-[var(--primary)]/5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--primary)]/10">
                    <Ruler className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900">
                      Умный оптимизатор упаковки
                    </h3>
                    <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
                      Если уменьшить коробку по каждой грани всего на {MEGA_CONFIG.OPTIMIZER_SHRINK_CM} см
                      (до {format(result.optimizer.length, 1)} × {format(result.optimizer.width, 1)} ×{' '}
                      {format(result.optimizer.height, 1)} см), объём упадёт до{' '}
                      <strong>{format(result.optimizer.volumeLiters, 2)} л</strong> — это на{' '}
                      <strong>{format(result.optimizer.excessLitersSaved, 2)} л</strong> меньше лимита WB,
                      и вы сэкономите <strong className="text-emerald-700">
                        {formatMoney(result.optimizer.perItemSavingByn)} BYN
                      </strong>{' '}
                      на каждом товаре.
                    </p>
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 font-semibold">
                      Экономия на объёме всей партии ({format(result.batchVolume, 0)} шт):{' '}
                      <span className="text-emerald-700">
                        {formatMoney(result.optimizer.batchSavingByn)} BYN
                      </span>{' '}
                      (≈ {formatMoney(result.optimizer.batchSavingRub)} ₽)
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Формула: ({format(result.trip.volumeLiters, 2)} − max(
                      {MEGA_CONFIG.WB_VOLUME_LIMIT_L}, {format(result.optimizer.volumeLiters, 2)})) ×{' '}
                      {formatMoney(toNumber(form.over_liter_cost))} BYN ×{' '}
                      {format(result.batchVolume, 0)} шт. Сейчас объём на{' '}
                      {format(result.trip.excessLiters, 2)} л больше лимита WB, доплата{' '}
                      {formatMoney(result.trip.excessFeeByn)} BYN за каждую поездку.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <BlockCard
                title="Упаковка в рамках лимита WB"
                subtitle={`Объём ${format(result.trip.volumeLiters, 2)} л ≤ ${MEGA_CONFIG.WB_VOLUME_LIMIT_L} л`}
                icon={Package}
              >
                <p className="text-sm text-neutral-600">
                  Оптимизировать тару не нужно: доплата за объём не начисляется. Но помните, что
                  псевдообъём &gt; {MEGA_CONFIG.WB_VOLUME_LIMIT_L} л у WB — это всегда +{' '}
                  {formatMoney(toNumber(form.over_liter_cost))} BYN за литр на каждую поездку,
                  включая холостые возвраты.
                </p>
              </BlockCard>
            )}

            {/* Разбор расхода на 1 единицу */}
            <BlockCard
              title="Разбор расхода на 1 единицу товара"
              subtitle="Сквозная себестоимость с учётом РБ и WB"
              icon={CalculatorIcon}
            >
              <MetricRow
                label="Закупка"
                value={`${formatMoney(result.costByn)} BYN`}
                sub={form.currency === 'RUB' ? 'введено в RUB, пересчитано по курсу' : 'введено в BYN'}
              />
              <MetricRow
                label="Экосбор на 1 шт"
                value={`${formatMoney(result.ecoFeeKopecks)} коп.`}
                sub={
                  ecoEnabled
                    ? `${format(toNumber(form.eco_weight), 1)} г × ${formatMoney(result.ecoRateBynPerTon)} BYN/т`
                    : 'не начисляется'
                }
                tone={ecoEnabled ? 'warn' : 'muted'}
              />
              <MetricRow
                label={`Логистика на 1 продажу (выкуп ${format(buyoutPercent, 0)}%)`}
                value={`${formatMoney(result.deliveryPerSaleByn)} BYN`}
                sub={`${formatMoney(result.trip.totalByn)} BYN × ${format(result.tripsPerSale, 2)} поездки`}
              />
              <MetricRow
                label="Доля ФСЗН и Белгосстраха"
                value={`${formatMoney(result.fsznPerUnitByn)} BYN`}
                sub={
                  form.fszn_enabled
                    ? `${formatMoney(result.fsznTotalByn)} BYN ÷ ${format(result.batchVolume, 0)} шт`
                    : 'взносы не учтены'
                }
                tone={form.fszn_enabled ? 'warn' : 'muted'}
              />
              <MetricRow
                label="Итого себестоимость 1 шт"
                value={`${formatMoney(result.totalCostByn)} BYN`}
                tone="accent"
              />

              <div className="mt-4 pt-3 border-t border-neutral-200">
                <MetricRow
                  label={`Комиссия WB ${format(result.commissionPercent, 1)}% от цены`}
                  value={`${formatMoney(result.commissionByn)} BYN`}
                  sub={`от РРЦ ${formatMoney(result.recommendedPriceByn)} BYN`}
                  tone="muted"
                />
                <MetricRow
                  label={`Налог ${format(result.taxPercent, 1)}% от цены`}
                  value={`${formatMoney(result.taxByn)} BYN`}
                  sub={`от РРЦ ${formatMoney(result.recommendedPriceByn)} BYN`}
                  tone="muted"
                />
                <MetricRow
                  label="Чистый остаток «на жизнь»"
                  value={`${formatMoney(result.netToLiveByn)} BYN`}
                  sub={`цена ${formatMoney(result.retailPriceRub)} ₽ за вычетом всех расходов`}
                  tone={result.netToLiveByn >= 0 ? 'success' : 'danger'}
                />
              </div>
            </BlockCard>

            {/* Логистика и покатушки */}
            <BlockCard
              title="Логистика WB: поездки и покатушки"
              subtitle="Холостые возвраты уже заложены в юнит-экономику"
              icon={Truck}
            >
              <MetricRow
                label="Тариф за 5 литров WB"
                value={`${formatMoney(result.trip.tariffByn)} BYN`}
                sub={`${formatMoney(toNumber(form.base_tariff_5l))} BYN базовый + ${formatMoney(
                  result.trip.excessFeeByn
                )} BYN доплата за ${format(result.trip.excessLiters, 2)} л`}
              />
              <MetricRow
                label="Тариф с коэффициентом (одежда)"
                value={`${formatMoney(result.trip.weightedTariffByn)} BYN`}
                sub={`коэффициент ×${format(toNumber(form.clothing_coefficient), 2)}`}
              />
              <MetricRow
                label="Транзит РБ → РФ"
                value={`${formatMoney(result.trip.transitByn)} BYN`}
                sub={`≈ ${formatMoney(result.trip.transitByn / result.rate)} ₽`}
              />
              <MetricRow
                label="Стоимость одной поездки"
                value={`${formatMoney(result.trip.totalByn)} BYN`}
                tone="accent"
              />
              <MetricRow
                label="Поездок на 1 успешную продажу"
                value={`${format(result.tripsPerSale, 2)}`}
                sub={`из них холостых (возвраты): ${format(result.idleTripsPerSale, 2)}`}
                tone={result.idleTripsPerSale > 1 ? 'warn' : 'default'}
              />
              <MetricRow
                label="Итоговая логистика на 1 продажу"
                value={`${formatMoney(result.deliveryPerSaleByn)} BYN`}
                tone="danger"
              />

              <p className="mt-3 text-[11px] leading-tight text-neutral-400">
                Формула: Логистика = Поездка × (1 + (100 − {format(buyoutPercent, 0)}) ÷{' '}
                {format(buyoutPercent, 0)} ×{' '}
                {MEGA_CONFIG.BUYOUT_TRIP_FACTOR}). Коэффициент {MEGA_CONFIG.BUYOUT_TRIP_FACTOR} — стоимость
                обратной поездки товара на склад WB.
              </p>
            </BlockCard>

            {/* Юридические заметки */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-amber-900">
                  <strong>Учтены требования законодательства РБ:</strong> экосбор за упаковку (оплата
                  ежеквартально оператору ВМР), фиксированные взносы ФСЗН и Белгосстрах (уплата не позднее
                  25-го числа месяца после отчётного квартала), предельные надбавки Постановления № 713 КГК и
                  налог УСН 6%, который вместе с комиссией WB берётся от итоговой цены продажи, а не от
                  себестоимости.
                </p>
              </div>
            </div>

            {result.netProfitByn < 0 && result.denominatorValid && (
              <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-800">
                  Текущая цена {formatMoney(result.retailPriceByn)} BYN даёт убыток{' '}
                  <strong>{format(Math.abs(result.netToLiveByn))} BYN</strong> с каждой продажи. Поднимите
                  цену минимум до {formatMoney(result.breakEvenByn)} BYN или сократите расходы.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
