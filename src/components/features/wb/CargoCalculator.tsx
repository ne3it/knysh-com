'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { useLinkedForm, CARGO_LINKS } from '@/lib/hooks/useLinkedForm';
import type { Feature } from '@/types/section';

/** Одна стандартная европаллета вмещает до 1.5 м³ */
const CUBIC_METERS_PER_PALLET = 1.5;

/** Размер европаллеты, см */
const PALLET_LENGTH = 120;
const PALLET_WIDTH = 80;

export interface DeliveryDirection {
  id: string;
  name: string;
  /** Тариф доставки коробками россыпью, BYN за 1 м³ */
  rateBox: number;
  /** Тариф паллетоместа, BYN за 1 паллету */
  ratePallet: number;
  group: string;
}

export const DELIVERY_DIRECTIONS: DeliveryDirection[] = [
  // РЕСПУБЛИКА БЕЛАРУСЬ (СЦ и транзитные хабы)
  { id: 'by_minsk_skrip', name: 'Минск → СЦ Минск (ул. Скрипникова)', rateBox: 15, ratePallet: 40, group: 'Республика Беларусь' },
  { id: 'by_minsk_trost', name: 'Минск → СЦ Минск (Тростенецкий / Щомыслица)', rateBox: 15, ratePallet: 40, group: 'Республика Беларусь' },
  { id: 'by_gomel', name: 'Минск → СЦ Гомель', rateBox: 25, ratePallet: 55, group: 'Республика Беларусь' },
  { id: 'by_brest', name: 'Минск → СЦ Брест', rateBox: 30, ratePallet: 65, group: 'Республика Беларусь' },
  { id: 'by_grodno', name: 'Минск → СЦ Гродно', rateBox: 30, ratePallet: 65, group: 'Республика Беларусь' },
  { id: 'by_vitebsk', name: 'Минск → СЦ Витебск', rateBox: 25, ratePallet: 60, group: 'Республика Беларусь' },
  { id: 'by_mogilev', name: 'Минск → СЦ Могилев', rateBox: 25, ratePallet: 55, group: 'Республика Беларусь' },
  { id: 'by_baranovichi', name: 'Минск → СЦ Барановичи', rateBox: 20, ratePallet: 45, group: 'Республика Беларусь' },

  // МОСКВА И ПОДМОСКОВЬЕ (Главный кластер)
  { id: 'msk_koledino', name: 'Минск → Коледино / Подольск', rateBox: 75, ratePallet: 140, group: 'Центральная Россия' },
  { id: 'msk_radumlya', name: 'Минск → Радумля (Новый северный мегахаб)', rateBox: 80, ratePallet: 145, group: 'Центральная Россия' },
  { id: 'msk_domodedovo', name: 'Минск → Белые Столбы / Домодедово (КГТ)', rateBox: 80, ratePallet: 150, group: 'Центральная Россия' },
  { id: 'msk_vnukovo', name: 'Минск → Внуково', rateBox: 75, ratePallet: 140, group: 'Центральная Россия' },
  { id: 'cfo_aleksin', name: 'Минск → Алексин / Тула / Узловая', rateBox: 90, ratePallet: 165, group: 'Центральная Россия' },
  { id: 'cfo_north', name: 'Минск → Ярославль / Иваново / Владимир', rateBox: 95, ratePallet: 175, group: 'Центральная Россия' },
  { id: 'voronezh', name: 'Минск → Воронеж (Радчино)', rateBox: 100, ratePallet: 185, group: 'Центральная Россия' },

  // СЕВЕРО-ЗАПАДНЫЙ КЛАСТЕР
  { id: 'spb_kolpino', name: 'Минск → Санкт-Петербург (Колпино / Шушары)', rateBox: 100, ratePallet: 190, group: 'Северо-Запад' },

  // ПОВОЛЖЬЕ И ЦЕНТРАЛЬНАЯ СУША
  { id: 'kazan', name: 'Минск → Казань (Зеленодольск)', rateBox: 110, ratePallet: 210, group: 'Поволжье' },
  { id: 'samara', name: 'Минск → Самара (Новосемейкино)', rateBox: 115, ratePallet: 220, group: 'Поволжье' },
  { id: 'ufa', name: 'Минск → Уфа', rateBox: 125, ratePallet: 240, group: 'Поволжье' },

  // ЮГ РОССИИ
  { id: 'rostov', name: 'Минск → Ростов-на-Дону (Новочеркасск)', rateBox: 125, ratePallet: 240, group: 'Юг России' },
  { id: 'nevinnomyssk', name: 'Минск → Невинномысск / Ставрополь', rateBox: 135, ratePallet: 260, group: 'Юг России' },

  // УРАЛ, СИБИРЬ И ДАЛЬНИЙ ВОСТОК
  { id: 'ekb', name: 'Минск → Екатеринбург (Перспективный)', rateBox: 150, ratePallet: 290, group: 'Урал и Сибирь' },
  { id: 'novosibirsk', name: 'Минск → Новосибирск', rateBox: 180, ratePallet: 350, group: 'Урал и Сибирь' },
  { id: 'habarovsk', name: 'Минск → Хабаровск (Дальний Восток)', rateBox: 240, ratePallet: 490, group: 'Урал и Сибирь' },

  // СТРАНЫ СНГ
  { id: 'kazakhstan', name: 'Минск → Казахстан (Астана / Алматы)', rateBox: 210, ratePallet: 420, group: 'Страны СНГ' },
];

/** Направления, сгруппированные по макрорегионам, в порядке появления в базе */
export const DIRECTION_GROUPS: { group: string; directions: DeliveryDirection[] }[] =
  DELIVERY_DIRECTIONS.reduce<{ group: string; directions: DeliveryDirection[] }[]>((acc, direction) => {
    const existing = acc.find((item) => item.group === direction.group);
    if (existing) {
      existing.directions.push(direction);
    } else {
      acc.push({ group: direction.group, directions: [direction] });
    }
    return acc;
  }, []);

export const DEFAULT_DIRECTION_ID = 'msk_koledino';

export function getDirection(id: string): DeliveryDirection {
  return (
    DELIVERY_DIRECTIONS.find((direction) => direction.id === id) ??
    DELIVERY_DIRECTIONS.find((direction) => direction.id === DEFAULT_DIRECTION_ID) ??
    DELIVERY_DIRECTIONS[0]
  );
}

interface FormState {
  length: string;
  width: string;
  height: string;
  quantity: string;
  route: string;
}

const DEFAULT_FORM: FormState = {
  length: '60',
  width: '40',
  height: '40',
  quantity: '10',
  route: DEFAULT_DIRECTION_ID,
};

const inputClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

const selectClass =
  'w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

interface CargoResult {
  boxVolume: number;
  totalVolume: number;
  pallets: number;
  cost: number;
  isPallet: boolean;
  direction: DeliveryDirection;
}

export function calculateCargo(form: FormState): CargoResult {
  const length = Math.max(0, parseFloat(form.length) || 0);
  const width = Math.max(0, parseFloat(form.width) || 0);
  const height = Math.max(0, parseFloat(form.height) || 0);
  const quantity = Math.max(0, parseInt(form.quantity, 10) || 0);

  const direction = getDirection(form.route);

  const boxVolume = (length * width * height) / 1_000_000;
  const totalVolume = boxVolume * quantity;

  if (totalVolume < CUBIC_METERS_PER_PALLET) {
    return {
      boxVolume,
      totalVolume,
      pallets: 0,
      cost: totalVolume * direction.rateBox,
      isPallet: false,
      direction,
    };
  }

  const pallets = Math.ceil(totalVolume / CUBIC_METERS_PER_PALLET);
  return {
    boxVolume,
    totalVolume,
    pallets,
    cost: pallets * direction.ratePallet,
    isPallet: true,
    direction,
  };
}

const format = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });

/**
 * Схема европаллеты 120х80 см с сеткой коробок.
 * Рисует паллету в масштабе и укладывает коробки в два варианта ориентации,
 * выбирая тот, где помещается больше коробок.
 */
function PalletCanvas({
  boxLength,
  boxWidth,
  quantity,
}: {
  boxLength: number;
  boxWidth: number;
  quantity: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 480;
    const cssHeight = Math.round((cssWidth * PALLET_WIDTH) / PALLET_LENGTH);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const scale = Math.min(cssWidth / PALLET_LENGTH, cssHeight / PALLET_WIDTH);
    const palletW = PALLET_LENGTH * scale;
    const palletH = PALLET_WIDTH * scale;
    const offsetX = (cssWidth - palletW) / 2;
    const offsetY = (cssHeight - palletH) / 2;

    // Паллета
    ctx.fillStyle = '#f5f5f4';
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2;
    ctx.fillRect(offsetX, offsetY, palletW, palletH);
    ctx.strokeRect(offsetX, offsetY, palletW, palletH);

    // Слотовые доски паллеты (декор)
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const y = offsetY + (palletH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + palletW, y);
      ctx.stroke();
    }

    if (boxLength <= 0 || boxWidth <= 0) {
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Укажите размеры коробки', cssWidth / 2, cssHeight / 2);
      return;
    }

    // Две ориентации: коробка вдоль паллеты и поперек
    const layouts = [
      { w: boxLength, h: boxWidth, rotated: false },
      { w: boxWidth, h: boxLength, rotated: true },
    ].map((l) => ({
      ...l,
      cols: Math.floor(PALLET_LENGTH / l.w),
      rows: Math.floor(PALLET_WIDTH / l.h),
    }));
    layouts.sort((a, b) => b.cols * b.rows - a.cols * a.rows);
    const best = layouts[0];
    const capacity = best.cols * best.rows;

    const boxW = best.w * scale;
    const boxH = best.h * scale;
    const gridW = best.cols * boxW;
    const gridH = best.rows * boxH;
    const startX = offsetX + (palletW - gridW) / 2;
    const startY = offsetY + (palletH - gridH) / 2;

    const drawn = Math.min(quantity, capacity, 400);
    const gap = boxW > 14 ? 1.5 : 0.75;

    for (let i = 0; i < drawn; i += 1) {
      const row = Math.floor(i / best.cols);
      const col = i % best.cols;
      const x = startX + col * boxW;
      const y = startY + row * boxH;

      const gradient = ctx.createLinearGradient(x, y, x, y + boxH);
      gradient.addColorStop(0, 'rgba(123, 31, 162, 0.28)');
      gradient.addColorStop(1, 'rgba(123, 31, 162, 0.12)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + gap / 2, y + gap / 2, boxW - gap, boxH - gap);

      ctx.strokeStyle = 'rgba(123, 31, 162, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + gap / 2, y + gap / 2, boxW - gap, boxH - gap);
    }

    // Подписи
    ctx.fillStyle = '#7b1fa2';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('120 см', offsetX, cssHeight - 4);
    ctx.textAlign = 'right';
    ctx.fillText('80 см', offsetX + palletW, cssHeight - 4);

    ctx.fillStyle = '#57534e';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Вместимость: ${capacity} шт.${best.rotated ? ' (поворот 90°)' : ''}`,
      cssWidth / 2,
      cssHeight - 4
    );
  }, [boxLength, boxWidth, quantity]);

  return <canvas ref={canvasRef} className="w-full h-auto" aria-label="Схема укладки коробок на европаллете 120х80 см" />;
}

export default function CargoCalculator({ feature }: { feature: Feature }) {
  const { form, setForm } = useLinkedForm<FormState>(DEFAULT_FORM, CARGO_LINKS);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const boxLength = Math.max(0, parseFloat(form.length) || 0);
  const boxWidth = Math.max(0, parseFloat(form.width) || 0);
  const boxHeight = Math.max(0, parseFloat(form.height) || 0);
  const quantity = Math.max(0, parseInt(form.quantity, 10) || 0);

  const result = useMemo(() => calculateCargo(form), [form]);
  const activeRoute = result.direction;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Параметры груза */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Параметры груза</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="cargo-length">
                    Длина коробки, см
                  </label>
                  <input
                    id="cargo-length"
                    type="number"
                    step="1"
                    min="0"
                    value={form.length}
                    onChange={(e) => updateField('length', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="cargo-width">
                    Ширина коробки, см
                  </label>
                  <input
                    id="cargo-width"
                    type="number"
                    step="1"
                    min="0"
                    value={form.width}
                    onChange={(e) => updateField('width', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="cargo-height">
                    Высота коробки, см
                  </label>
                  <input
                    id="cargo-height"
                    type="number"
                    step="1"
                    min="0"
                    value={form.height}
                    onChange={(e) => updateField('height', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="cargo-quantity">
                    Количество коробок, шт.
                  </label>
                  <input
                    id="cargo-quantity"
                    type="number"
                    step="1"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => updateField('quantity', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="cargo-route">
                    Направление доставки
                  </label>
                  <select
                    id="cargo-route"
                    value={form.route}
                    onChange={(e) => updateField('route', e.target.value)}
                    className={selectClass}
                  >
                    {DIRECTION_GROUPS.map(({ group, directions }) => (
                      <optgroup key={group} label={group}>
                        {directions.map((direction) => (
                          <option key={direction.id} value={direction.id}>
                            {direction.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
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

          {/* Схема паллеты */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Укладка на европаллету</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Размер паллетоместа 120×80 см, одна коробка занимает {boxLength}×{boxWidth} см
            </p>
            <PalletCanvas boxLength={boxLength} boxWidth={boxWidth} quantity={quantity} />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Объём одной коробки</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(result.boxVolume, 3)} м³
                </p>
              </div>
              <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">Высота в сборе</p>
                </div>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {format(boxHeight, 1)} см
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Результат */}
        <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6 text-center">
          <p className="text-sm text-neutral-600 mb-1">Общий объем груза</p>
          <p className="text-3xl font-bold text-neutral-900 mb-4">
            {format(result.totalVolume, 3)} м³
          </p>

          <p className="text-sm text-neutral-600">
            Ориентировочная стоимость доставки Минск — Москва:{' '}
            <span className="font-semibold text-neutral-900">
              {Math.round(result.cost).toLocaleString('ru-RU')} BYN
            </span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">Направление: {activeRoute.name}</p>

          <div
            className={cn(
              'mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              result.isPallet
                ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                : 'bg-emerald-50 text-emerald-700'
            )}
          >
            {result.isPallet
              ? `Выгоднее оформить доставку паллетоместом (потребуется паллет: ${result.pallets} шт.)`
              : 'Рекомендуется отправка сборным грузом (коробками)'}
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
          <p className="text-sm text-neutral-600">
            Тарифы по выбранному направлению «{activeRoute.name}»: сборный груз — {activeRoute.rateBox} BYN за 1 м³;
            паллетоместо — {activeRoute.ratePallet} BYN за паллету (1 паллета = до {CUBIC_METERS_PER_PALLET} м³).
            Всего в партии: {quantity} шт.
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            В базе {DELIVERY_DIRECTIONS.length} направлений в {DIRECTION_GROUPS.length} макрорегионах.
          </p>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
