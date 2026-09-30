'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Leaf, Scale, Truck, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export interface EcoMaterial {
  id: string;
  name: string;
  rate: number;
}

export interface EcoMaterialGroup {
  group: string;
  materials: EcoMaterial[];
}

export const CUSTOM_MATERIAL_ID = 'eco_custom';

export const ECO_MATERIAL_GROUPS: EcoMaterialGroup[] = [
  {
    group: 'Пластик и полимеры',
    materials: [
      { id: 'plastic_film', name: 'Пластмассовая упаковка, пленка ПВХ, пакеты, стрейч-пленка', rate: 180 },
      { id: 'polystyrene', name: 'Полистирол, пенопласт (защитные вкладыши)', rate: 180 },
    ],
  },
  {
    group: 'Бумага и дерево',
    materials: [
      { id: 'cardboard', name: 'Картонные коробки, бумага, крафт-упаковка', rate: 90 },
      { id: 'wood', name: 'Деревянная упаковка, ящики, деревянные элементы поддонов', rate: 50 },
    ],
  },
  {
    group: 'Стекло и металл',
    materials: [
      { id: 'glass', name: 'Стеклянная упаковка (банки, флаконы парфюмерии/косметики)', rate: 60 },
      { id: 'metal_ferrous', name: 'Металлическая упаковка из черных металлов / жесть', rate: 60 },
      { id: 'aluminum', name: 'Алюминиевая упаковка (банки, тубы)', rate: 110 },
    ],
  },
  {
    group: 'Комбинированные материалы',
    materials: [
      { id: 'paper_plastic', name: 'Упаковка на основе бумаги и картона с добавлением слоев пластика/фольги', rate: 150 },
      { id: 'combined_plastic', name: 'Комбинированная упаковка на основе пластмасс', rate: 180 },
    ],
  },
  {
    group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
    materials: [
      { id: CUSTOM_MATERIAL_ID, name: 'Другой материал (ввести ставку за тонну вручную)', rate: 100 },
    ],
  },
];

export const DEFAULT_MATERIAL_ID = 'plastic_film';

export function getMaterial(id: string): EcoMaterial {
  for (const group of ECO_MATERIAL_GROUPS) {
    const found = group.materials.find((material) => material.id === id);
    if (found) return found;
  }
  return ECO_MATERIAL_GROUPS[0].materials[0];
}

interface FormState {
  material: string;
  customRate: string;
  weightPerUnit: string;
  batchVolume: string;
}

const DEFAULT_FORM: FormState = {
  material: DEFAULT_MATERIAL_ID,
  customRate: '100',
  weightPerUnit: '40',
  batchVolume: '1000',
};

const inputClass =
  'flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const badgeClass = 'shrink-0 px-3 py-2 text-neutral-500 bg-neutral-50 rounded-lg text-sm';

export interface EcoFeeResult {
  totalWeightTons: number;
  ratePerTon: number;
  totalFee: number;
  feePerUnitKopecks: number;
  material: EcoMaterial;
}

const toNumber = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateEcoFee(form: FormState): EcoFeeResult {
  const weightPerUnit = Math.max(0, toNumber(form.weightPerUnit));
  const batchVolume = Math.max(0, toNumber(form.batchVolume));
  const isCustom = form.material === CUSTOM_MATERIAL_ID;
  const ratePerTon = isCustom ? Math.max(0, toNumber(form.customRate)) : getMaterial(form.material).rate;

  const totalWeightTons = (weightPerUnit / 1_000_000) * batchVolume;
  const totalFee = totalWeightTons * ratePerTon;
  const feePerUnitKopecks = batchVolume > 0 ? (totalFee / batchVolume) * 100 : 0;

  return {
    totalWeightTons,
    ratePerTon,
    totalFee,
    feePerUnitKopecks,
    material: getMaterial(form.material),
  };
}

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });

export default function EcoFeeCalculator({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCustom = form.material === CUSTOM_MATERIAL_ID;

  const result = useMemo(() => calculateEcoFee(form), [form]);

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Форма параметров */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры расчёта</h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-neutral-700 mb-1"
                  htmlFor="eco-material"
                >
                  Материал / тип упаковки товара
                </label>
                <select
                  id="eco-material"
                  value={form.material}
                  onChange={(e) => updateField('material', e.target.value)}
                  className={selectClass}
                >
                  {ECO_MATERIAL_GROUPS.map(({ group, materials }) => (
                    <optgroup key={group} label={group}>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} — {material.rate} BYN/т
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
                    htmlFor="eco-custom-rate"
                  >
                    Кастомная ставка сбора, BYN/тонна
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="eco-custom-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.customRate}
                      onChange={(e) => updateField('customRate', e.target.value)}
                      onInput={(e) => updateField('customRate', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>BYN/т</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="eco-weight"
                  >
                    Вес упаковки ОДНОЙ единицы товара
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="eco-weight"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.weightPerUnit}
                      onChange={(e) => updateField('weightPerUnit', e.target.value)}
                      onInput={(e) => updateField('weightPerUnit', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>грамм</span>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-1"
                    htmlFor="eco-volume"
                  >
                    Объём планируемой партии
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="eco-volume"
                      type="number"
                      step="1"
                      min="1"
                      value={form.batchVolume}
                      onChange={(e) => updateField('batchVolume', e.target.value)}
                      onInput={(e) => updateField('batchVolume', e.currentTarget.value)}
                      className={inputClass}
                      required
                    />
                    <span className={badgeClass}>шт.</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(DEFAULT_FORM)}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <Leaf className="w-4 h-4" />
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
              Материал: {result.material.name}
              {isCustom ? ' (ставка введена вручную)' : ''}
            </p>

            <div className="space-y-3">
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Общий вес упаковки партии</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.totalWeightTons, 4)} т
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  ({format(toNumber(form.weightPerUnit))} г × {format(toNumber(form.batchVolume))} шт) ÷ 1 000 000
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Ставка экосбора</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.ratePerTon)} BYN/т
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Сумма экосбора за партию</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.totalFee)} BYN
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  {format(result.totalWeightTons, 4)} т × {format(result.ratePerTon)} BYN/т
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Доля экосбора на 1 единицу</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.feePerUnitKopecks, 2)} коп.
                </p>
                <p className="text-[11px] leading-tight text-neutral-400">
                  ({format(result.totalFee)} BYN ÷ {format(toNumber(form.batchVolume))} шт) × 100
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Итоговый результат */}
        <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6">
          <div className="space-y-3 text-center">
            <p className="text-lg font-bold text-neutral-900">
              Сумма экосбора за партию: <span className="text-[var(--primary)]">{format(result.totalFee)} BYN</span>
            </p>
            <p className="text-lg font-medium text-neutral-700">
              Доля экосбора в себестоимости 1 товара: <span className="text-[var(--primary)]">{format(result.feePerUnitKopecks, 2)} коп.</span>
            </p>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>Внимание!</strong> Импортеры в РБ обязаны ежеквартально подавать декларацию и уплачивать сбор Оператору ВМР.
              Невключение этих затрат в юнит-экономику маркетплейса или неуплата сбора влечет крупные штрафы
              со стороны Министерства жилищно-коммунального хозяйства РБ.
            </p>
          </div>
        </div>
      </div>
    </SectionContentWrapper>
  );
}