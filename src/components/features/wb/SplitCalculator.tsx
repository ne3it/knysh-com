'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Percent, RotateCcw, ShieldCheck, Tag, TrendingDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { useLinkedForm, SPLIT_LINKS } from '@/lib/hooks/useLinkedForm';
import type { Feature } from '@/types/section';

export interface SplitCategory {
  id: string;
  name: string;
  /** Комиссия WB по категории, % */
  commission: number;
}

export interface SplitCategoryGroup {
  group: string;
  categories: SplitCategory[];
}

export const CUSTOM_CATEGORY_ID = 'cat_custom';

/** Минимальная комиссия WB после применения СПП */
export const MIN_COMMISSION = 1;

export const SPLIT_CATEGORY_GROUPS: SplitCategoryGroup[] = [
  {
    group: 'Одежда и текстиль',
    categories: [
      { id: 'clothes_top', name: 'Одежда верхняя', commission: 23 },
      { id: 'clothes_light', name: 'Одежда легкая', commission: 23 },
      { id: 'knitwear', name: 'Трикотаж', commission: 23 },
      { id: 'underwear', name: 'Нижнее белье', commission: 25 },
      { id: 'shoes', name: 'Обувь', commission: 23 },
      { id: 'bedding', name: 'Постельное белье', commission: 19 },
      { id: 'headwear', name: 'Головные уборы', commission: 21 },
    ],
  },
  {
    group: 'Детские товары',
    categories: [
      { id: 'kids_clothes', name: 'Детская одежда', commission: 21 },
      { id: 'kids_shoes', name: 'Детская обувь', commission: 21 },
      { id: 'toys', name: 'Игрушки', commission: 19 },
      { id: 'kids_food', name: 'Детское питание', commission: 10 },
      { id: 'kids_transport', name: 'Коляски и автокресла', commission: 12 },
    ],
  },
  {
    group: 'Красота и гигиена',
    categories: [
      { id: 'cosmetics_care', name: 'Косметика уходовая', commission: 22 },
      { id: 'cosmetics_decor', name: 'Декоративная косметика', commission: 22 },
      { id: 'perfumery', name: 'Парфюмерия', commission: 22 },
      { id: 'personal_hygiene', name: 'Личная гигиена', commission: 18 },
      { id: 'bads', name: 'БАДы', commission: 15 },
    ],
  },
  {
    group: 'Электроника и техника',
    categories: [
      { id: 'smartphones', name: 'Смартфоны и гаджеты', commission: 10 },
      { id: 'phone_cases', name: 'Чехлы и аксессуары', commission: 15 },
      { id: 'appliances_large', name: 'Крупная бытовая техника', commission: 10 },
      { id: 'appliances_small', name: 'Малая бытовая техника', commission: 13 },
      { id: 'headphones', name: 'Наушники', commission: 11 },
    ],
  },
  {
    group: 'Дом и ремонт',
    categories: [
      { id: 'furniture', name: 'Мебель корпусная', commission: 12 },
      { id: 'kitchenware', name: 'Посуда и кухонная утварь', commission: 17 },
      { id: 'interior', name: 'Предметы интерьера и декор', commission: 17 },
      { id: 'tools', name: 'Инструменты', commission: 12 },
      { id: 'household_chemistry', name: 'Бытовая химия', commission: 16 },
      { id: 'lighting', name: 'Светильники и люстры', commission: 15 },
    ],
  },
  {
    group: 'Остальное',
    categories: [
      { id: 'auto_goods', name: 'Автотовары', commission: 14 },
      { id: 'stationery', name: 'Канцелярия', commission: 15 },
      { id: 'hobby', name: 'Товары для хобби', commission: 15 },
      { id: 'sports', name: 'Спортивный инвентарь', commission: 14 },
      { id: 'zoogoods', name: 'Зоотовары', commission: 15 },
      { id: 'bags', name: 'Сумки и аксессуары', commission: 21 },
      { id: 'jewelry', name: 'Бижутерия', commission: 23 },
      { id: 'food', name: 'Продукты питания', commission: 12 },
    ],
  },
  {
    group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
    categories: [
      { id: CUSTOM_CATEGORY_ID, name: 'Другая категория (ввести комиссию вручную)', commission: 15 },
    ],
  },
];

export const DEFAULT_CATEGORY_ID = 'clothes_top';

export function getCategory(id: string): SplitCategory {
  for (const group of SPLIT_CATEGORY_GROUPS) {
    const found = group.categories.find((category) => category.id === id);
    if (found) return found;
  }
  return (
    SPLIT_CATEGORY_GROUPS[0].categories[0]
  );
}

interface FormState {
  category: string;
  manualCommission: string;
  currentPrice: string;
  cost: string;
  spp: string;
  discount: string;
}

const DEFAULT_FORM: FormState = {
  category: DEFAULT_CATEGORY_ID,
  manualCommission: '15',
  currentPrice: '50',
  cost: '20',
  spp: '15',
  discount: '15',
};

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

export interface SplitResult {
  actionPrice: number;
  commission: number;
  effectiveCommission: number;
  commissionApplied: boolean;
  revenue: number;
  profit: number;
  category: SplitCategory;
}

const toNumber = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateSplit(form: FormState): SplitResult {
  const currentPrice = Math.max(0, toNumber(form.currentPrice));
  const cost = Math.max(0, toNumber(form.cost));
  const spp = Math.max(0, toNumber(form.spp));
  const discount = Math.min(100, Math.max(0, toNumber(form.discount)));

  const category = getCategory(form.category);
  const isCustom = form.category === CUSTOM_CATEGORY_ID;
  const commission = isCustom ? Math.max(0, toNumber(form.manualCommission)) : category.commission;

  const actionPrice = currentPrice * (1 - discount / 100);

  const rawEffective = commission - spp;
  const effectiveCommission = Math.max(MIN_COMMISSION, rawEffective);

  const revenue = actionPrice * (1 - effectiveCommission / 100);
  const profit = revenue - cost;

  return {
    actionPrice,
    commission,
    effectiveCommission,
    commissionApplied: rawEffective < MIN_COMMISSION,
    revenue,
    profit,
    category,
  };
}

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });

type StatusTone = 'profit' | 'zero' | 'loss';

function getTone(profit: number): StatusTone {
  if (profit > 1) return 'profit';
  if (profit >= 0) return 'zero';
  return 'loss';
}

const TONE_STYLES: Record<StatusTone, { box: string; text: string }> = {
  profit: {
    box: 'bg-emerald-50 border-emerald-500',
    text: 'text-emerald-800',
  },
  zero: {
    box: 'bg-amber-50 border-amber-500',
    text: 'text-amber-900',
  },
  loss: {
    box: 'bg-red-600 border-red-800',
    text: 'text-white',
  },
};

const TONE_MESSAGES: Record<StatusTone, (profit: number) => string> = {
  profit: (profit) =>
    `Вы в плюсе! Чистая прибыль: ${format(profit)} BYN. Отличная цена для участия в акции.`,
  zero: (profit) =>
    `Торговля в ноль. Чистая прибыль: ${format(profit)} BYN. Вы работаете на оборачиваемость, но ничего не зарабатываете.`,
  loss: (profit) =>
    `УБЫТОК! Акция загоняет вас в минус на ${format(Math.abs(profit))} BYN! Немедленно исключите этот товар из акции во избежание слива бюджета!`,
};

export default function SplitCalculator({ feature }: { feature: Feature }) {
  const { form, setForm } = useLinkedForm<FormState>(DEFAULT_FORM, SPLIT_LINKS);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCustom = form.category === CUSTOM_CATEGORY_ID;

  const result = useMemo(() => calculateSplit(form), [form]);
  const tone = getTone(result.profit);
  const toneStyles = TONE_STYLES[tone];

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Параметры акции */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры акции</h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="split-category"
                >
                  Категория товара (для определения комиссии)
                </label>
                <select
                  id="split-category"
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className={selectClass}
                >
                  {SPLIT_CATEGORY_GROUPS.map(({ group, categories }) => (
                    <optgroup key={group} label={group}>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} — {category.commission}%
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {isCustom && (
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="split-manual-commission"
                  >
                    Ручная комиссия WB, %
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="split-manual-commission"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.manualCommission}
                      onChange={(e) => updateField('manualCommission', e.target.value)}
                      onInput={(e) => updateField('manualCommission', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>%</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="split-current-price"
                  >
                    Текущая установленная цена на WB (до акции), BYN
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="split-current-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.currentPrice}
                      onChange={(e) => updateField('currentPrice', e.target.value)}
                      onInput={(e) => updateField('currentPrice', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>BYN</span>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="split-cost"
                  >
                    Себестоимость товара + логистика до клиента, BYN
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="split-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.cost}
                      onChange={(e) => updateField('cost', e.target.value)}
                      onInput={(e) => updateField('cost', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>BYN</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="split-spp">
                    СПП (Скидка постоянного покупателя от WB), %
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="split-spp"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.spp}
                      onChange={(e) => updateField('spp', e.target.value)}
                      onInput={(e) => updateField('spp', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>%</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="split-discount">
                    Требуемая скидка по акции, %
                  </label>
                  <span className="text-2xl font-bold text-[var(--primary)]">
                    {Math.round(toNumber(form.discount))}%
                  </span>
                </div>
                <input
                  id="split-discount"
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={form.discount}
                  onChange={(e) => updateField('discount', e.target.value)}
                  onInput={(e) => updateField('discount', e.currentTarget.value)}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>0%</span>
                  <span>80%</span>
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

          {/* Разбор расчёта */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Разбор расчёта</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Категория: {result.category.name}
              {isCustom ? ' (комиссия введена вручную)' : ''}
            </p>

            <div className="space-y-3">
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Цена по акции</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.actionPrice)} BYN
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  {format(toNumber(form.currentPrice))} BYN − {Math.round(toNumber(form.discount))}%
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Итоговая комиссия WB с учётом СПП</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.effectiveCommission, 1)}%
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  {format(result.commission, 1)}% − СПП {format(toNumber(form.spp), 1)}%
                </p>
                {result.commissionApplied && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    Применён минимум WB — {MIN_COMMISSION}%
                  </p>
                )}
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Выручка от WB</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.revenue)} BYN
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  Цена по акции за вычетом итоговой комиссии
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Себестоимость + логистика</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(toNumber(form.cost))} BYN
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Результат */}
        <div className={cn('rounded-xl border-2 p-6 text-center transition-colors', toneStyles.box)}>
          <div
            className={cn(
              'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full',
              tone === 'loss' ? 'bg-white/20' : 'bg-white'
            )}
          >
            <ShieldCheck
              className={cn('w-6 h-6', tone === 'loss' ? 'text-white' : 'text-[var(--primary)]')}
              aria-hidden="true"
            />
          </div>
          <p className={cn('text-sm font-medium mb-1', tone === 'loss' ? 'text-red-50' : 'text-neutral-600')}>
            Чистая прибыль: {format(result.profit)} BYN
          </p>
          <p className={cn('text-lg sm:text-xl font-semibold', toneStyles.text)}>
            {TONE_MESSAGES[tone](result.profit)}
          </p>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
