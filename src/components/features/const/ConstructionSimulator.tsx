'use client';

import React, { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ArrowRight, Check, GraduationCap, RotateCcw, Sparkles } from 'lucide-react';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  AutoSaveBadge,
  Card,
  CopyEstimateButton,
  Field,
  SCHEME_ACCENT,
  SCHEME_GRID,
  SCHEME_STROKE,
  Scheme,
  Segmented,
  SelectField,
  StandardNote,
  Stat,
  StatGrid,
} from '@/components/construction/ui';
import {
  BLOCK_SIZES,
  BLOCK_VOLUME_M3,
  BREAKAGE_DEFAULT_PERCENT,
  CONCRETE_MARKS,
  MORTAR_KG_PER_M3,
  buildEstimateText,
  computeFoundationGeometry,
  computeFrostDepth,
  computeMasonry,
  formatByn,
  formatInt,
  formatKg,
  formatM2,
  formatM3,
  formatNumber,
  getPrice,
  plural,
  pluralize,
  PLURALS,
  safeNum,
  type BlockSizeKey,
} from '@/lib/construction';
import { useConstructionRegion, useConstructionStore } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

/**
 * Обучающий модуль раздела «Строительный».
 *
 * Четыре шага ведут прораба от «есть коробка» до «есть смета»:
 *
 *   1. Геометрия   — размеры дома, площадь стен и периметр;
 *   2. Объёмы      — кладка блоками с вычетом проёмов и запасом на бой;
 *   3. Нормативы   — бетон, глубина промерзания по СН 2.01.01-2019;
 *   4. Смета       — итог в BYN и перенос чисел в рабочие калькуляторы.
 *
 * Прогресс живёт в отдельном сторе с persist: новичок может закрыть вкладку
 * посреди обучения и вернуться на тот же шаг. Последний шаг не просто
 * показывает сумму — он записывает введённые размеры в черновики трёх
 * калькуляторов, поэтому дальше прораб не вводит те же числа заново.
 */

interface SimulatorState {
  step: number;
  lengthM: string;
  widthM: string;
  wallHeightM: string;
  wallsCount: string;
  blockSize: string;
  windowsCount: string;
  breakagePercent: string;
  foundationType: string;
  concreteMark: string;
  soilType: string;
  done: boolean;
  setStep: (step: number) => void;
  next: () => void;
  back: () => void;
  set: (patch: Partial<SimulatorState>) => void;
  restart: () => void;
}

const SIM_DEFAULTS = {
  lengthM: '10',
  widthM: '8',
  wallHeightM: '3',
  wallsCount: '4',
  blockSize: '625x300x200',
  windowsCount: '6',
  breakagePercent: String(BREAKAGE_DEFAULT_PERCENT),
  foundationType: 'strip',
  concreteMark: 'М300',
  soilType: 'loam',
};

export const useConstructionSimulator = create<SimulatorState>()(
  persist(
    (set, get) => ({
      ...SIM_DEFAULTS,
      step: 0,
      done: false,
      setStep: (step) => set({ step: Math.max(0, Math.min(3, step)) }),
      next: () => set({ step: Math.min(3, get().step + 1) }),
      back: () => set({ step: Math.max(0, get().step - 1) }),
      set: (patch) => set(patch),
      restart: () => set({ ...SIM_DEFAULTS, step: 0, done: false }),
    }),
    {
      name: 'knysh-construction-simulator',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        step: state.step,
        lengthM: state.lengthM,
        widthM: state.widthM,
        wallHeightM: state.wallHeightM,
        wallsCount: state.wallsCount,
        blockSize: state.blockSize,
        windowsCount: state.windowsCount,
        breakagePercent: state.breakagePercent,
        foundationType: state.foundationType,
        concreteMark: state.concreteMark,
        soilType: state.soilType,
        done: state.done,
      }),
    }
  )
);

const STEPS = [
  { id: 0, title: 'Геометрия', subtitle: 'Размеры дома и площадь стен' },
  { id: 1, title: 'Объёмы', subtitle: 'Кладка блоками и проёмы' },
  { id: 2, title: 'Нормативы', subtitle: 'Бетон и глубина промерзания' },
  { id: 3, title: 'Смета', subtitle: 'Итог в BYN и перенос в калькуляторы' },
];

export default function ConstructionSimulator({ feature }: { feature: Feature }) {
  const sim = useConstructionSimulator();
  const region = useConstructionRegion();

  const calc = useMemo(() => {
    const lengthM = safeNum(sim.lengthM);
    const widthM = safeNum(sim.widthM);
    const heightM = safeNum(sim.wallHeightM);
    const wallsCount = Math.max(0, safeNum(sim.wallsCount));

    const perimeterM = 2 * (lengthM + widthM);
    const wallsGrossM2 = perimeterM * heightM * (wallsCount / 4);
    const selectedSize = sim.blockSize as BlockSizeKey;
    const blockSize: BlockSizeKey = selectedSize in BLOCK_SIZES ? selectedSize : '625x300x200';

    // Стандартное окно 1,2×1,4 м — самый частый проём в частном доме
    const windowsAreaM2 = 1.2 * 1.4 * Math.max(0, safeNum(sim.windowsCount));
    const masonry = computeMasonry({
      lengthM: perimeterM,
      heightM,
      blockSize,
      openings: windowsAreaM2 > 0
        ? [{ widthMm: 1200, heightMm: 1400, count: Math.max(0, safeNum(sim.windowsCount)), label: 'Окно 1200×1400' }]
        : [],
      breakagePercent: safeNum(sim.breakagePercent, BREAKAGE_DEFAULT_PERCENT),
    });

    const foundationType = sim.foundationType === 'slab' ? ('slab' as const) : ('strip' as const);
    const frost = computeFrostDepth({ district: 'minsk', soilFactor: 1 });
    const foundation = computeFoundationGeometry({
      type: foundationType,
      lengthM: perimeterM,
      widthMm: foundationType === 'slab' ? safeNum(widthM, 8) * 1000 : 400,
      thicknessMm: foundationType === 'slab' ? 200 : 1500,
      depthM: foundationType === 'strip' ? Math.max(0.1, frost.footingDepthM - 0.3) : undefined,
      beddingMm: 200,
      blindingMm: 100,
    });

    const mark = CONCRETE_MARKS.find((item) => item.mark === sim.concreteMark) ?? CONCRETE_MARKS[2];

    const concretePriceKey =
      mark.mark === 'М200'
        ? 'concreteM200'
        : mark.mark === 'М250'
          ? 'concreteM250'
          : mark.mark === 'М350'
            ? 'concreteM350'
            : 'concreteM300';
    const blockPriceKey =
      blockSize === '625x400x200'
        ? 'blocks625x400x200'
        : blockSize === '500x300x250'
          ? 'blocks500x300x250'
          : 'blocks625x300x200';

    const lines = [
      {
        label: `Блоки ${BLOCK_SIZES[blockSize].lengthMm}×${BLOCK_SIZES[blockSize].widthMm}×${BLOCK_SIZES[blockSize].heightMm} мм`,
        unit: 'м³',
        qty: Math.round(masonry.blocksToOrder * BLOCK_VOLUME_M3[blockSize] * 1000) / 1000,
        price: getPrice(blockPriceKey, region),
        note: `${pluralize(masonry.blocksToOrder, PLURALS.block)} · запас ${masonry.breakageAppliedPercent} %`,
      },
      {
        label: 'Клеевая смесь, мешок 25 кг',
        unit: 'мешок',
        qty: masonry.mortarBags,
        price: getPrice('mortarBag25', region),
        note: `${MORTAR_KG_PER_M3} кг/м³ кладки`,
      },
      {
        label: `Бетон ${mark.mark} (${mark.class})`,
        unit: 'м³',
        qty: foundation.volumeToOrderM3,
        price: getPrice(concretePriceKey, region),
        note: `с уплотнением 1,05 и потерями 3 %`,
      },
      {
        label: 'Арматура А500С, 10–14 мм',
        unit: 'т',
        qty: Math.round(foundation.volumeM3 * 0.06 * 1000) / 1000,
        price: getPrice('rebar', region),
        note: '≈ 60 кг на 1 м³ фундамента',
      },
      {
        label: 'Работа: кладка блоков',
        unit: 'м³',
        qty: masonry.netVolumeM3,
        price: getPrice('workMasonry', region),
      },
      {
        label: 'Работа: устройство фундамента',
        unit: 'м³',
        qty: foundation.volumeM3,
        price: getPrice('workFoundation', region),
      },
    ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object: `Дом ${formatNumber(lengthM)}×${formatNumber(widthM)} м, стены ${formatNumber(heightM)} м, ${formatInt(wallsCount)} ${plural(wallsCount, ['стена', 'стены', 'стен'])}`,
      region,
      standard: 'СН 2.01.01-2019, СН 5.03.01-2018, СТБ EN 206-1',
      lines,
      totals: [
        { label: 'Периметр', value: `${formatNumber(perimeterM)} м` },
        { label: 'Площадь стен', value: `${formatM2(wallsGrossM2)} (${formatM2(masonry.openingsAreaM2)} вычли проёмы)` },
        { label: 'Чистый объём кладки', value: formatM3(masonry.netVolumeM3, 3) },
        { label: 'Глубина промерзания Минск', value: `${formatNumber(frost.normativeM)} м, заложение ${formatNumber(frost.footingDepthM)} м` },
        { label: 'Бетона к закупке', value: `${formatM3(foundation.volumeToOrderM3, 3)} ${mark.mark}` },
        { label: 'Всего по смете', value: formatByn(lines.reduce((acc, line) => acc + line.qty * line.price, 0)) },
      ],
      footer: 'Обучающий расчёт: он показывает порядок величин и логику сметы. Точные объёмы соберите в отдельных калькуляторах раздела.',
    });

    return {
      lengthM,
      widthM,
      heightM,
      wallsCount,
      perimeterM,
      wallsGrossM2,
      blockSize,
      masonry,
      foundation,
      frost,
      mark,
      lines,
      estimateText,
    };
  }, [sim, region, feature.label]);

  /**
   * Перенос результата обучения в рабочие калькуляторы: числа из симулятора
   * становятся черновиками, и прораб сразу видит готовый расчёт, а не пустую
   * форму. Это экономит главное — повторный ввод одних и тех же чисел.
   */
  const applyToCalculators = () => {
    const store = useConstructionStore.getState();
    const size = BLOCK_SIZES[calc.blockSize];

    store.setValues('const-foundation', {
      type: calc.foundation.volumeM3 > 0 && sim.foundationType === 'slab' ? 'slab' : 'strip',
      lengthM: String(Math.round(calc.perimeterM * 100) / 100),
      widthMm: String(size.widthMm),
      concreteMark: sim.concreteMark,
    });
    store.setValues('const-blocks', {
      blockSize: calc.blockSize,
      lengthM: String(Math.round(calc.perimeterM * 100) / 100),
      heightM: String(calc.heightM),
      breakagePercent: sim.breakagePercent,
      manufacturer: 'zabudova',
    });
    store.setValues('const-plaster', {
      lengthM: String(Math.round(calc.perimeterM * 100) / 100),
      heightM: String(calc.heightM),
      wallsCount: String(calc.wallsCount),
      openingsM2: String(Math.round(calc.masonry.openingsAreaM2 * 100) / 100),
    });
    store.setValues('const-screed', {
      lengthM: String(calc.lengthM),
      widthM: String(calc.widthM),
    });
    sim.set({ done: true });
  };

  const canAdvance = sim.step < 3;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* ── Хаки-шапка модуля ───────────────────────────────────────── */}
        <header className="rounded-2xl border border-[var(--kc-khaki)] bg-[var(--kc-khaki)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-white/20 p-2.5">
              <GraduationCap className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
                Обучающий модуль
              </p>
              <h2 className="text-lg font-bold leading-snug text-white sm:text-xl">
                Симулятор расчётов [4 шага]
              </h2>
              <p className="mt-1 text-xs leading-snug text-white/80">
                Геометрия → объёмы → нормативы РБ → смета в BYN. Результат переносится
                в калькуляторы одним нажатием.
              </p>
            </div>
          </div>

          {/* Прогресс по шагам */}
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Шаги обучения">
            {STEPS.map((stepItem) => {
              const state = sim.step > stepItem.id ? 'done' : sim.step === stepItem.id ? 'current' : 'todo';
              return (
                <li key={stepItem.id}>
                  <button
                    type="button"
                    onClick={() => sim.setStep(stepItem.id)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      state === 'todo' ? 'bg-white/10 text-white/60 hover:bg-white/15' : 'bg-white text-[var(--kc-khaki-deep)]'
                    }`}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--kc-khaki-deep)] text-[10px] font-bold text-white">
                      {state === 'done' ? <Check className="h-3 w-3" aria-hidden="true" /> : stepItem.id + 1}
                    </span>
                    <span className="hidden truncate text-xs font-semibold sm:block">
                      {stepItem.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </header>

        <AutoSaveBadge toolId="const-simulator" />

        {/* ── Шаг 1: геометрия ────────────────────────────────────────── */}
        {sim.step === 0 && (
          <Card title="Шаг 1 из 4 · Геометрия">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Длина дома" value={sim.lengthM} onChange={(value) => sim.set({ lengthM: value })} unit="м" />
                <Field label="Ширина дома" value={sim.widthM} onChange={(value) => sim.set({ widthM: value })} unit="м" />
                <Field
                  label="Высота стен"
                  value={sim.wallHeightM}
                  onChange={(value) => sim.set({ wallHeightM: value })}
                  unit="м"
                />
                <Field
                  label="Число стен"
                  value={sim.wallsCount}
                  onChange={(value) => sim.set({ wallsCount: value })}
                  unit="шт"
                  hint="4 — прямоугольный дом, 3 — треугольный в плане"
                />
              </div>

              <StatGrid columns={3}>
                <Stat label="Периметр" value={formatNumber(calc.perimeterM)} unit="м" />
                <Stat label="Площадь стен" value={formatNumber(calc.wallsGrossM2)} unit="м²" accent />
                <Stat label="Объём стен" value={formatNumber(calc.perimeterM * calc.heightM * (calc.wallsCount / 4) * 0.3, 2)} unit="м³" hint="при толщине 300 мм" />
              </StatGrid>

              <HouseScheme
                lengthM={calc.lengthM}
                widthM={calc.widthM}
                heightM={calc.heightM}
                wallsCount={calc.wallsCount}
              />
            </div>
          </Card>
        )}

        {/* ── Шаг 2: объёмы ───────────────────────────────────────────── */}
        {sim.step === 1 && (
          <Card title="Шаг 2 из 4 · Объёмы кладки">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Типоразмер блока"
                  value={sim.blockSize}
                  onChange={(value) => sim.set({ blockSize: value })}
                  options={(Object.keys(BLOCK_SIZES) as BlockSizeKey[]).map((key) => ({
                    value: key,
                    label: `${BLOCK_SIZES[key].lengthMm}×${BLOCK_SIZES[key].widthMm}×${BLOCK_SIZES[key].heightMm} мм`,
                  }))}
                />
                <Field
                  label="Число окон 1200×1400"
                  value={sim.windowsCount}
                  onChange={(value) => sim.set({ windowsCount: value })}
                  unit="шт"
                />
                <Field
                  label="Запас на бой"
                  value={sim.breakagePercent}
                  onChange={(value) => sim.set({ breakagePercent: value })}
                  unit="%"
                  hint="5–7 % по нормам РБ"
                />
              </div>

              <StatGrid columns={4}>
                <Stat label="Проёмы" value={formatNumber(calc.masonry.openingsAreaM2)} unit="м²" />
                <Stat label="Чистый объём" value={formatNumber(calc.masonry.netVolumeM3, 2)} unit="м³" accent />
                <Stat label="Блоков" value={formatInt(calc.masonry.blocksToOrder)} hint={`+${calc.masonry.breakageAppliedPercent} %`} />
                <Stat label="Клея" value={formatKg(calc.masonry.mortarKg, 0)} hint={`${MORTAR_KG_PER_M3} кг/м³`} />
              </StatGrid>

              <MasonryScheme rows={calc.masonry.rowsCount} perRow={calc.masonry.blocksPerRow} blocks={calc.masonry.blocksToOrder} />
            </div>
          </Card>
        )}

        {/* ── Шаг 3: нормативы ────────────────────────────────────────── */}
        {sim.step === 2 && (
          <Card title="Шаг 3 из 4 · Нормативы РБ">
            <div className="space-y-3">
              <Segmented
                label="Тип фундамента"
                value={sim.foundationType}
                onChange={(value) => sim.set({ foundationType: value })}
                options={[
                  { value: 'strip', label: 'Лента по периметру' },
                  { value: 'slab', label: 'Плита' },
                ]}
              />
              <SelectField
                label="Марка бетона (СТБ EN 206-1)"
                value={sim.concreteMark}
                onChange={(value) => sim.set({ concreteMark: value })}
                options={CONCRETE_MARKS.map((item) => ({ value: item.mark, label: `${item.mark} / ${item.class}` }))}
                hint={calc.mark.usage}
              />

              <StatGrid columns={4}>
                <Stat
                  label="Промерзание"
                  value={formatNumber(calc.frost.normativeM)}
                  unit="м"
                  hint="СН 2.01.01-2019, Минск"
                />
                <Stat label="Заложение подошвы" value={formatNumber(calc.frost.footingDepthM)} unit="м" accent />
                <Stat label="Бетон в опалубке" value={formatNumber(calc.foundation.volumeM3, 2)} unit="м³" />
                <Stat label="К закупке" value={formatNumber(calc.foundation.volumeToOrderM3, 2)} unit="м³" hint="×1,05 + 3 %" />
              </StatGrid>

              <StandardNote>
                Подошва должна лежать ниже границы промерзания плюс 0,1 м на пучение.
                Объём бетона умножается на 1,05 за уплотнение глубинным вибратором и ещё
                на 3 % за потери при подаче.
              </StandardNote>
            </div>
          </Card>
        )}

        {/* ── Шаг 4: смета ────────────────────────────────────────────── */}
        {sim.step === 3 && (
          <Card title="Шаг 4 из 4 · Смета в BYN">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10 p-4">
                <span className="kc-stat-label text-[var(--kc-khaki-text)]">Ориентировочная стоимость</span>
                <span className="block font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                  {formatByn(calc.lines.reduce((acc, line) => acc + line.qty * line.price, 0))}
                </span>
                <p className="mt-1 text-[11px] leading-snug text-[var(--kc-muted)]">
                  Материалы и работа по средним ценам РБ. Это обучение, а не оферта:
                  точные позиции собираются в калькуляторах раздела.
                </p>
              </div>

              <div className="space-y-1">
                {calc.lines.map((line, index) => (
                  <div
                    key={`${line.label}-${index}`}
                    className="flex items-baseline gap-2 border-b border-dashed border-[var(--kc-border)] py-2 last:border-0"
                  >
                    <span className="min-w-0 flex-1 text-sm text-white">
                      {line.label}
                      {line.note && (
                        <span className="block text-[11px] text-[var(--kc-faint)]">{line.note}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--kc-muted)]">
                      {formatNumber(line.qty, 2)} {line.unit}
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-white">
                      {formatByn(line.qty * line.price)}
                    </span>
                  </div>
                ))}
              </div>

              <CopyEstimateButton text={calc.estimateText} />

              <div className="rounded-xl border border-dashed border-[var(--kc-khaki)] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--kc-khaki-text)]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Перенести расчёт в калькуляторы
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[var(--kc-muted)]">
                  Размеры из этого обучения станут черновиками в «Фундаменте», «Блоках»,
                  «Штукатурке» и «Стяжке» — их можно будет уточнить, а не вводить заново.
                </p>
                <button
                  type="button"
                  onClick={applyToCalculators}
                  className="kc-btn-khaki mt-3 w-full sm:w-auto"
                >
                  {sim.done ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Перенесено — откройте калькуляторы
                    </>
                  ) : (
                    <>
                      Перенести в калькуляторы
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ── Навигация ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={sim.back}
            disabled={sim.step === 0}
            className="kc-btn-ghost flex-1 sm:flex-none"
          >
            Назад
          </button>

          {canAdvance ? (
            <button type="button" onClick={sim.next} className="kc-btn-khaki flex-1 sm:flex-none">
              Дальше
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={sim.restart} className="kc-btn-ghost flex-1 sm:flex-none">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Пройти заново
            </button>
          )}
        </div>

        <p className="text-center text-[11px] leading-snug text-[var(--kc-faint)]">
          Шаг {sim.step + 1} из 4 · {STEPS[sim.step].title} — {STEPS[sim.step].subtitle}
        </p>
      </div>
    </SectionContentWrapper>
  );
}

/** Плана дома сверху: пропорции прямоугольника следуют введённым размерам */
function HouseScheme({
  lengthM,
  widthM,
  heightM,
  wallsCount,
}: {
  lengthM: number;
  widthM: number;
  heightM: number;
  wallsCount: number;
}) {
  const VIEW_W = 420;
  const VIEW_H = 210;
  const MAX_W = 300;
  const SCALE = MAX_W / Math.max(lengthM, widthM, 1);
  const boxW = Math.max(20, lengthM * SCALE);
  const boxH = Math.max(20, widthM * SCALE);
  const X = (VIEW_W - boxW) / 2;
  const Y = 70;

  return (
    <Scheme caption={`План дома ${formatNumber(lengthM)}×${formatNumber(widthM)} м, высота стен ${formatNumber(heightM)} м, стен: ${formatInt(wallsCount)}.`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full" role="img" aria-label={`План дома ${formatNumber(lengthM)} на ${formatNumber(widthM)} метров`}>
        <rect x={X} y={Y} width={boxW} height={boxH} fill="rgba(255,255,255,0.06)" stroke={SCHEME_STROKE} strokeWidth="3" />
        {/* Проёмы по периметру */}
        <line x1={X + boxW * 0.3} y1={Y} x2={X + boxW * 0.45} y2={Y} stroke={SCHEME_ACCENT} strokeWidth="5" />
        <line x1={X + boxW * 0.55} y1={Y + boxH} x2={X + boxW * 0.7} y2={Y + boxH} stroke={SCHEME_ACCENT} strokeWidth="5" />
        <text x={VIEW_W / 2} y={Y - 14} fill={SCHEME_STROKE} fontSize="12" textAnchor="middle">
          {formatNumber(lengthM)} м × {formatNumber(widthM)} м, высота {formatNumber(heightM)} м
        </text>
        <text x={VIEW_W / 2} y={Y + boxH + 20} fill={SCHEME_ACCENT} fontSize="11" textAnchor="middle">
          периметр {formatNumber(2 * (lengthM + widthM))} м · стен {formatInt(wallsCount)}
        </text>
      </svg>
    </Scheme>
  );
}

/** Ряд кладки крупным планом: сколько блоков в ряду и сколько рядов */
function MasonryScheme({ rows, perRow, blocks }: { rows: number; perRow: number; blocks: number }) {
  const VIEW_W = 420;
  const VIEW_H = 190;
  const X = 30;
  const WALL_W = 360;
  const rowsToDraw = Math.max(2, Math.min(rows, 8));
  const perRowToDraw = Math.max(2, Math.min(perRow, 8));
  const rowGap = Math.min(20, 110 / rowsToDraw);
  const colGap = WALL_W / perRowToDraw;

  return (
    <Scheme caption={`Кладка: ${formatInt(blocks)} блоков, ${formatInt(rows)} ${plural(rows, ['ряд', 'ряда', 'рядов'])}, ${formatInt(perRow)} блоков в ряду. Показано ${rowsToDraw} рядов по ${perRowToDraw} блоков.`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full" role="img" aria-label={`Схема кладки: ${formatInt(blocks)} блоков в ${formatInt(rows)} рядах`}>
        {Array.from({ length: rowsToDraw }).map((_, rowIndex) => (
          <rect
            key={`block-${rowIndex}`}
            x={X}
            y={30 + rowIndex * rowGap}
            width={WALL_W}
            height={rowGap - 2}
            fill="rgba(255,255,255,0.10)"
            stroke={SCHEME_GRID}
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: perRowToDraw }).map((_, colIndex) => (
          <line
            key={`joint-${colIndex}`}
            x1={X + colGap * (colIndex + 1)}
            y1={30}
            x2={X + colGap * (colIndex + 1)}
            y2={30 + rowsToDraw * rowGap}
            stroke={SCHEME_ACCENT}
            strokeWidth="1.5"
          />
        ))}
        <text x={X} y={22} fill={SCHEME_STROKE} fontSize="11">
          {formatInt(rows)} ${plural(rows, ['ряд', 'ряда', 'рядов'])} · {formatInt(perRow)} блоков в ряду
        </text>
        <text x={X} y={30 + rowsToDraw * rowGap + 18} fill={SCHEME_ACCENT} fontSize="11">
          итого {formatInt(blocks)} блоков с запасом на бой
        </text>
      </svg>
    </Scheme>
  );
}