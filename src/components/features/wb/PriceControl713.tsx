'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AlertTriangle, ChevronDown, Scale } from 'lucide-react';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { PRICE_CONTROL_CATEGORIES, type PriceControlCategory } from '@/lib/services/priceControl713';
import type { Feature } from '@/types/section';

interface FormState {
  cost_price: string;
  additional_expenses: string;
}

export default function PriceControl713({ feature }: { feature: Feature }) {
  const defaultCategory = PRICE_CONTROL_CATEGORIES[0];
  const [selectedCategory, setSelectedCategory] = useState<PriceControlCategory>(defaultCategory);
  const [searchValue, setSearchValue] = useState(defaultCategory.name);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    cost_price: '15',
    additional_expenses: '3',
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const filteredOptions = useMemo(() => {
    const needle = searchValue.toLowerCase();
    if (!needle) return PRICE_CONTROL_CATEGORIES;
    return PRICE_CONTROL_CATEGORIES.filter((c) => c.name.toLowerCase().includes(needle));
  }, [searchValue]);

  const groupedOptions = useMemo(() => {
    return filteredOptions.reduce<Record<string, PriceControlCategory[]>>((acc, cat) => {
      (acc[cat.group] = acc[cat.group] || []).push(cat);
      return acc;
    }, {});
  }, [filteredOptions]);

  const selectCategory = (cat: PriceControlCategory) => {
    setSelectedCategory(cat);
    setSearchValue(cat.name);
    setOpen(false);
  };

  const clearCategory = () => {
    setSelectedCategory(defaultCategory);
    setSearchValue(defaultCategory.name);
    setOpen(false);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (!open) setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearchValue(selectedCategory ? selectedCategory.name : '');
      inputRef.current?.blur();
    }
    if (e.key === 'Backspace' && searchValue === '') {
      e.preventDefault();
      clearCategory();
    }
  };

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchValue(selectedCategory ? selectedCategory.name : '');
      }
    };
    if (open) {
      document.addEventListener('mousedown', onOutsideClick);
    }
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open, selectedCategory]);

  const cost = parseFloat(form.cost_price);
  const coeff = selectedCategory ? selectedCategory.limit / 100 : 0;
  const expenses = parseFloat(form.additional_expenses);
  const safeCost = Number.isFinite(cost) ? cost : 0;
  const safeExpenses = Number.isFinite(expenses) ? expenses : 0;
  const maxPrice = safeCost + (safeCost * coeff) + safeExpenses;
  const displayMaxPrice = maxPrice.toFixed(2);
  const markupPercent = Math.round(selectedCategory ? selectedCategory.limit : 0);

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчета</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category (Combobox) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Категория товара по Пост. 713
                </label>
                  <div className="flex gap-2">
                    <div
                      className="relative flex-1"
                      role="combobox"
                      aria-expanded={open}
                      aria-haspopup="listbox"
                      aria-controls="price-control-dropdown"
                      aria-autocomplete="list"
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Введите категорию для поиска..."
                        value={searchValue}
                        onChange={onInputChange}
                        onInput={(e) => {
                          setSearchValue(e.currentTarget.value);
                          if (!open) setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onKeyDown}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        required
                      />
                      <ChevronDown
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
                        aria-hidden="true"
                      />

                      {open && (
                        <div
                          id="price-control-dropdown"
                          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto bg-white border border-neutral-300 rounded-lg shadow-lg"
                          role="listbox"
                          aria-label="Категории товаров"
                        >
                          {Object.keys(groupedOptions).length === 0 ? (
                            <div className="px-3 py-3 text-sm text-neutral-500">
                              Ничего не найдено
                            </div>
                          ) : (
                            Object.entries(groupedOptions).map(([groupName, items]) => (
                              <div key={groupName}>
                                <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 bg-neutral-100 sticky top-0">
                                  {groupName}
                                </div>
                                {items.map((cat) => (
                                  <button
                                    key={cat.name}
                                    type="button"
                                    role="option"
                                    aria-selected={selectedCategory?.name === cat.name}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectCategory(cat);
                                    }}
                                    className="w-full flex flex-col items-start px-3 py-2 text-left text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:bg-neutral-100"
                                  >
                                    <span className="text-sm">{cat.name}</span>
                                    <span className="text-xs text-neutral-500">
                                      макс. надбавка {cat.limit}%
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm font-medium min-w-[60px] text-center">
                      {selectedCategory ? `${markupPercent}%` : '—'}
                    </span>
                  </div>
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Цена закупки / Себестоимость
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price}
                    onChange={(e) => updateField('cost_price', e.target.value)}
                    onInput={(e) => updateField('cost_price', e.currentTarget.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">BYN</span>
                </div>
              </div>

              {/* Additional Expenses */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Дополнительные обоснованные расходы (Транспорт, логистика, маркировка)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.additional_expenses}
                    onChange={(e) => updateField('additional_expenses', e.target.value)}
                    onInput={(e) => updateField('additional_expenses', e.currentTarget.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm">BYN</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Results */}
        {maxPrice > 0 && (
          <div className="space-y-4">
            {/* Max Price */}
            <div className="bg-[#28a745]/5 border border-[#28a745]/20 rounded-xl p-6 text-center">
              <p className="text-sm text-neutral-600 mb-2">Рассчёт по Постановлению № 713 РБ</p>
              <p className="text-3xl md:text-4xl font-bold text-[#28a745]">
                Максимально допустимая розничная цена: {displayMaxPrice} BYN
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                Коэффициент надбавки: {markupPercent}% (категория: «{selectedCategory?.name}»)
              </p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-yellow-800 leading-relaxed">
                Установление розничной цены выше указанной суммы является нарушением
                антимонопольного законодательства Республики Беларусь и влечет крупные штрафы.
              </p>
            </div>

            {/* Breakdown */}
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Себестоимость</p>
                  <p className="text-base font-semibold text-neutral-900">{safeCost.toFixed(2)} BYN</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Надбавка ({markupPercent}%)</p>
                  <p className="text-base font-semibold text-neutral-900">{(safeCost * coeff).toFixed(2)} BYN</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Доп. расходы</p>
                  <p className="text-base font-semibold text-neutral-900">{safeExpenses.toFixed(2)} BYN</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No result yet */}
        {maxPrice <= 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center text-neutral-400">
            <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>Введите параметры — расчёт выполняется автоматически на лету</p>
          </div>
        )}
      </div>
    </SectionContentWrapper>
  );
}
