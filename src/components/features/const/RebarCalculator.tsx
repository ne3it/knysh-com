'use client';

import React, { useMemo } from 'react';
import { Grid3x3, Link2, Ruler } from 'lucide-react';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  AutoSaveBadge,
  Card,
  CopyEstimateButton,
  EstimateRow,
  Field,
  ResetDraftButton,
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
  LUMBER_STANDARD_LENGTH_M,
  OVERLAP_ABSOLUTE_MIN_MM,
  OVERLAP_DIAMETERS_FACTOR,
  OVERLAP_DEFAULT_PERCENT,
  OVERLAP_MAX_PERCENT,
  OVERLAP_MIN_PERCENT,
  REINFORCEMENT_DIAMETERS_MM,
  buildEstimateText,
  computeRebar,
  formatByn,
  formatInt,
  formatKg,
  formatM,
  formatMm,
  formatNumber,
  formatT,
  getPrice,
  rebarOverlapM,
  rebarWeightPerMeterKg,
  safeNum,
  type ReinforcementClass,
} from '@/lib/construction';
import { useConstructionForm, useConstructionRegion } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-rebar';

const DEFAULTS = {
  kind: 'slab',
  steelClass: 'A500',
  diameterMm: '12',
  barLengthM: '6',
  overlapPercent: String(OVERLAP_DEFAULT_PERCENT),
  lengthM: '10',
  widthM: '8',
  spacingM: '0,2',
  layers: '2',
  stripsCount: '1',
};

/** 4 стержня в поперечном сечении ленты: 2 нижних и 2 верхних */
const BARS_PER_STRIP_SECTION = 4;

const CLASS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'A400', label: 'А400 — гладкая, для сеток и хомутов' },
  { value: 'A500', label: 'А500С — рифлёная, для силовой арматуры' },
];

const DIAMETER_OPTIONS = REINFORCEMENT_DIAMETERS_MM.map((diameter) => ({
  value: String(diameter),
  label: `${diameter} мм · ${formatNumber(rebarWeightPerMeterKg(diameter), 3)} кг/м`,
}));

export default function RebarCalculator({ feature }: { feature: Feature }) {
  const { values, set } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    const kind = values.kind === 'strip' ? ('strip' as const) : ('slab' as const);
    const diameterMm = safeNum(values.diameterMm, 12);
    const barLengthM = safeNum(values.barLengthM, LUMBER_STANDARD_LENGTH_M);
    const overlapPercent = Math.min(
      OVERLAP_MAX_PERCENT,
      Math.max(OVERLAP_MIN_PERCENT, safeNum(values.overlapPercent, OVERLAP_DEFAULT_PERCENT))
    );
    const spacingM = safeNum(values.spacingM, 0.2);
    const layersCount = Math.max(1, safeNum(values.layers, 2));

    const overlapM = rebarOverlapM(barLengthM, diameterMm, overlapPercent);
    const effectiveStepM = Math.max(0.1, barLengthM - overlapM);

    let rebar;
    if (kind === 'slab') {
      const lengthM = safeNum(values.lengthM);
      const widthM = safeNum(values.widthM);
      // Сетка: стержни вдоль длины и вдоль ширины, каждая линия — со своим рядом
      rebar = computeRebar({
        totalRunM: lengthM,
        diameterMm,
        barLengthM,
        overlapPercent,
        spacingM,
        layLengthM: widthM,
      });
      rebar.layersCount = Math.max(2, rebar.layersCount * layersCount);
    } else {
      // Лента: на каждый метр длины — 4 стержня в сечении, ряды идут вдоль оси
      const lengthM = safeNum(values.lengthM);
      const stripsCount = Math.max(1, safeNum(values.stripsCount, 1));
      rebar = computeRebar({
        totalRunM: lengthM * stripsCount,
        diameterMm,
        barLengthM,
        overlapPercent,
        spacingM: effectiveStepM,
      });
      // Каждая линия каркаса — это BARS_PER_STRIP_SECTION стержня в сечении
      rebar.barsPerLine = rebar.barsPerLine * BARS_PER_STRIP_SECTION * layersCount;
      rebar.layersCount = layersCount;
    }

    const barsTotal = rebar.barsPerLine * rebar.layersCount;
    const totalLengthM = barsTotal * barLengthM;
    const weightKg = totalLengthM * rebarWeightPerMeterKg(diameterMm);
    const weightT = weightKg / 1000;
    // Проволока на вязку: 40 % массы металла (практическая норма вручную)
    const wireKg = weightKg * 0.4;

    const rebarPrice = getPrice('rebar', region);
    const wirePrice = getPrice('rebarWire', region);

    const lines = [
      {
        label: `Арматура ${values.steelClass} d${formatInt(diameterMm)}`,
        unit: 'т',
        qty: Math.round(weightT * 1000) / 1000,
        price: rebarPrice,
        note: `${formatInt(barsTotal)} шт × ${formatNumber(barLengthM)} м × ${formatNumber(
          rebarWeightPerMeterKg(diameterMm),
          3
        )} кг/м`,
      },
      {
        label: 'Проволока вязальная d1,2',
        unit: 'кг',
        qty: Math.round(wireKg * 10) / 10,
        price: wirePrice,
        note: '40 % массы металла',
      },
    ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object:
        kind === 'slab'
          ? `Сетка плиты ${formatM(safeNum(values.lengthM))} × ${formatM(safeNum(values.widthM))}, шаг ${formatNumber(spacingM)} м`
          : `Каркас ленты ${formatM(safeNum(values.lengthM))}, ${safeNum(values.stripsCount, 1)} шт`,
      region,
      standard: 'СТБ 4274-2006 (А400/А500), СН 5.03.01-2018',
      lines,
      totals: [
        { label: 'Нахлёст стержня', value: `${formatNumber(overlapM, 3)} м (${overlapPercent} %)` },
        {
          label: 'Условия нормы',
          value: `≥ 10 % длины, ≥ ${OVERLAP_ABSOLUTE_MIN_MM} мм, ≥ ${OVERLAP_DIAMETERS_FACTOR}Ø — взято максимальное`,
        },
        { label: 'Полезный шаг стержня', value: `${formatNumber(effectiveStepM, 3)} м` },
        { label: 'Стержней в каркасе', value: `${formatInt(barsTotal)} шт` },
        { label: 'Общая длина металла', value: formatM(totalLengthM, 1) },
        { label: 'Масса металла', value: `${formatKg(weightKg, 0)} (${formatT(weightT, 3)})` },
      ],
      footer:
        'Нахлёст взят как максимум из трёх требований: доля от длины стержня, 250 мм и 20 диаметров. Число стержней округлено вверх — недобор сетки в центре плиты бригада «добивает» сваркой и платит за это отдельно.',
    });

    return {
      kind,
      diameterMm,
      barLengthM,
      overlapPercent,
      overlapM,
      effectiveStepM,
      spacingM,
      layersCount,
      barsTotal,
      totalLengthM,
      weightKg,
      weightT,
      wireKg,
      lines,
      estimateText,
      steelClass: values.steelClass as ReinforcementClass,
    };
  }, [values, region, feature.label]);

  const {
    kind,
    diameterMm,
    barLengthM,
    overlapPercent,
    overlapM,
    effectiveStepM,
    spacingM,
    barsTotal,
    totalLengthM,
    weightKg,
    weightT,
    wireKg,
    lines,
    estimateText,
  } = result;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutoSaveBadge toolId={TOOL_ID} />
          <ResetDraftButton toolId={TOOL_ID} />
        </div>

        <Card title="Каркас" icon={<Grid3x3 className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <Segmented
              label="Конструкция"
              value={values.kind}
              onChange={(value) => set({ kind: value })}
              options={[
                { value: 'slab', label: 'Сетка плиты' },
                { value: 'strip', label: 'Каркас ленты' },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Длина"
                value={values.lengthM}
                onChange={(value) => set({ lengthM: value })}
                unit="м"
                placeholder="10"
              />
              {kind === 'slab' ? (
                <Field
                  label="Ширина"
                  value={values.widthM}
                  onChange={(value) => set({ widthM: value })}
                  unit="м"
                  placeholder="8"
                />
              ) : (
                <Field
                  label="Число лент"
                  value={values.stripsCount}
                  onChange={(value) => set({ stripsCount: value })}
                  unit="шт"
                  placeholder="1"
                />
              )}
              <Field
                label="Шаг стержней"
                value={values.spacingM}
                onChange={(value) => set({ spacingM: value })}
                unit="м"
                placeholder="0,2"
                hint="По СН 5.03.01-2018: 150–200 мм для сеток плиты"
              />
              <Field
                label="Число сеток / рядов"
                value={values.layers}
                onChange={(value) => set({ layers: value })}
                unit="шт"
                placeholder="2"
                hint="Плита: 2 (нижняя и верхняя). Лента: 2 ряда"
              />
            </div>
          </div>
        </Card>

        <Card title="Стержень и нахлёст" icon={<Link2 className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <SelectField
              label="Класс арматуры (СТБ 4274)"
              value={values.steelClass}
              onChange={(value) => set({ steelClass: value })}
              options={CLASS_OPTIONS}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Диаметр"
                value={values.diameterMm}
                onChange={(value) => set({ diameterMm: value })}
                options={DIAMETER_OPTIONS}
              />
              <Field
                label="Длина стержня"
                value={values.barLengthM}
                onChange={(value) => set({ barLengthM: value })}
                unit="м"
                placeholder="6"
                hint="Стандартная длина с завода — 6 м"
              />
              <Field
                label="Нахлёст"
                value={values.overlapPercent}
                onChange={(value) => set({ overlapPercent: value })}
                unit="%"
                placeholder="11"
                hint={`Норматив ${OVERLAP_MIN_PERCENT}–${OVERLAP_MAX_PERCENT} %, но не менее ${OVERLAP_ABSOLUTE_MIN_MM} мм и ${OVERLAP_DIAMETERS_FACTOR}Ø`}
              />
            </div>

            <div className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-surface-2)] p-3">
              <span className="kc-stat-label">Полезный шаг стержня</span>
              <span className="kc-stat-value">
                {formatNumber(effectiveStepM, 3)}
                <span className="ml-1 text-sm font-normal text-[var(--kc-muted)]">
                  м = длина {formatNumber(barLengthM)} м − нахлёст {formatNumber(overlapM, 3)} м
                </span>
              </span>
            </div>

            <StatGrid columns={4}>
              <Stat label="Нахлёст" value={formatNumber(overlapM, 3)} unit="м" accent hint={`${overlapPercent} %`} />
              <Stat label="Полезный шаг" value={formatNumber(effectiveStepM, 3)} unit="м" />
              <Stat label="Стержней" value={formatInt(barsTotal)} unit="шт" />
              <Stat label="Длина металла" value={formatNumber(totalLengthM, 1)} unit="м" />
            </StatGrid>

            <StandardNote>
              Нахлёст берётся как максимум из трёх требований: 10–12 % от длины
              стержня, не менее {OVERLAP_ABSOLUTE_MIN_MM} мм и не менее {OVERLAP_DIAMETERS_FACTOR} диаметров.
              При длине {formatNumber(barLengthM)} м и {overlapPercent} % это {formatNumber(overlapM, 3)} м.
            </StandardNote>
          </div>
        </Card>

        <Card title="Схема сетки и нахлёста" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <RebarScheme
            kind={kind}
            bars={barsTotal}
            spacingM={spacingM}
            layers={safeNum(values.layers, 2)}
            barLengthM={barLengthM}
            overlapM={overlapM}
            diameterMm={diameterMm}
          />
        </Card>

        <Card title="Металл и смета" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <StatGrid columns={3}>
            <Stat label="Масса металла" value={formatKg(weightKg, 0)} accent hint={formatT(weightT, 3)} />
            <Stat label="Проволока на вязку" value={formatKg(wireKg, 0)} hint="40 % массы" />
            <Stat
              label="Диаметр"
              value={formatMm(diameterMm)}
              hint={`${formatNumber(rebarWeightPerMeterKg(diameterMm), 3)} кг/м`}
            />
          </StatGrid>

          <div className="mt-3 space-y-1">
            {lines.map((line, index) => (
              <EstimateRow
                key={`${line.label}-${index}`}
                label={line.label}
                qty={formatNumber(line.qty, 3)}
                unit={line.unit}
                sum={formatByn(line.qty * line.price)}
                note={line.note}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kc-border-strong)] pt-4">
            <div>
              <span className="kc-stat-label">Всего</span>
              <span className="block font-mono text-xl font-bold tabular-nums text-white">
                {formatByn(lines.reduce((acc, line) => acc + line.qty * line.price, 0))}
              </span>
            </div>
            <CopyEstimateButton text={estimateText} />
          </div>
        </Card>
      </div>
    </SectionContentWrapper>
  );
}

/**
 * Схема: слева план сетки (число линий берётся из расчёта), справа — узел
 * нахлёста, где зелёным выделен именно захлёстнутый участок стержня.
 */
function RebarScheme({
  kind,
  bars,
  spacingM,
  layers,
  barLengthM,
  overlapM,
  diameterMm,
}: {
  kind: 'slab' | 'strip';
  bars: number;
  spacingM: number;
  layers: number;
  barLengthM: number;
  overlapM: number;
  diameterMm: number;
}) {
  const VIEW_W = 420;
  const VIEW_H = 220;
  const PLAN_W = 190;
  const PLAN_H = 150;
  const PLAN_X = 20;
  const PLAN_Y = 30;

  // Геометрия узла нахлёста. Объявлена ДО return: внутри JSX объявление
  // const превратилось бы в текст узла, и линии схемы потеряли бы координаты.
  const NODE_X = 250;
  const BAR_Y = 100;
  const BAR_W = 130;
  const OVERLAP_PX = Math.max(18, (overlapM / barLengthM) * BAR_W);

  // План сетки: рисуем не все стержни (их может быть 400), а характерное
  // число линий — по одной на каждый ряд, но сжатое до 12, плюс счётчик.
  const visualBars = Math.max(3, Math.min(12, layers * 4));
  const gap = PLAN_H / (visualBars + 1);

  return (
    <Scheme
      caption={
        <>
          {kind === 'slab' ? 'План сетки плиты' : 'Схема каркаса ленты'}: {formatInt(bars)} стержней,
          шаг {formatNumber(spacingM)} м, длина {formatNumber(barLengthM)} м. Нахлёст{' '}
          {formatNumber(overlapM, 3)} м — {formatNumber((overlapM / diameterMm) * 1000, 0)}Ø.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Схема армирования: ${formatInt(bars)} стержней с нахлёстом ${formatNumber(overlapM, 3)} метра`}
      >
        {/* План */}
        <rect
          x={PLAN_X}
          y={PLAN_Y}
          width={PLAN_W}
          height={PLAN_H}
          fill="none"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />
        {Array.from({ length: visualBars }).map((_, index) => (
          <line
            key={`h-${index}`}
            x1={PLAN_X + 6}
            y1={PLAN_Y + gap * (index + 1)}
            x2={PLAN_X + PLAN_W - 6}
            y2={PLAN_Y + gap * (index + 1)}
            stroke={index % 2 === 0 ? SCHEME_STROKE : SCHEME_ACCENT}
            strokeWidth="1.5"
          />
        ))}
        {Array.from({ length: visualBars }).map((_, index) => (
          <line
            key={`v-${index}`}
            x1={PLAN_X + gap * (index + 1)}
            y1={PLAN_Y + 6}
            x2={PLAN_X + gap * (index + 1)}
            y2={PLAN_Y + PLAN_H - 6}
            stroke={index % 2 === 0 ? SCHEME_ACCENT : SCHEME_STROKE}
            strokeWidth="1.5"
          />
        ))}
        <text x={PLAN_X} y={PLAN_Y - 8} fill={SCHEME_STROKE} fontSize="11">
          план: {formatInt(bars)} стержней (показана сетка {visualBars}×{visualBars})
        </text>

        {/* Узел нахлёста */}
        <text x={NODE_X} y={BAR_Y - 42} fill={SCHEME_STROKE} fontSize="11">
          стык стержней, нахлёст
        </text>
        {/* Верхний стержень */}
        <line
          x1={NODE_X}
          y1={BAR_Y - 14}
          x2={NODE_X + BAR_W}
          y2={BAR_Y - 14}
          stroke={SCHEME_STROKE}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Нижний стержень заходит на верхний на длину нахлёста */}
        <line
          x1={NODE_X + BAR_W - OVERLAP_PX}
          y1={BAR_Y + 12}
          x2={NODE_X + BAR_W + OVERLAP_PX * 1.6}
          y2={BAR_Y + 12}
          stroke={SCHEME_STROKE}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Выделенный участок захлёстывания */}
        <line
          x1={NODE_X + BAR_W - OVERLAP_PX}
          y1={BAR_Y + 12}
          x2={NODE_X + BAR_W}
          y2={BAR_Y + 12}
          stroke={SCHEME_ACCENT}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <line
          x1={NODE_X}
          y1={BAR_Y - 26}
          x2={NODE_X + OVERLAP_PX}
          y2={BAR_Y - 26}
          stroke={SCHEME_ACCENT}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <line
          x1={NODE_X + OVERLAP_PX}
          y1={BAR_Y - 31}
          x2={NODE_X + OVERLAP_PX}
          y2={BAR_Y - 21}
          stroke={SCHEME_ACCENT}
          strokeWidth="1.5"
        />
        <text x={NODE_X + OVERLAP_PX / 2} y={BAR_Y - 34} fill={SCHEME_ACCENT} fontSize="11" textAnchor="middle">
          {formatNumber(overlapM, 2)} м
        </text>

        {/* Проволока */}
        <circle cx={NODE_X + BAR_W - OVERLAP_PX / 2} cy={BAR_Y - 1} r="4" fill="none" stroke={SCHEME_ACCENT} strokeWidth="2" />
        <circle cx={NODE_X + BAR_W - OVERLAP_PX / 2} cy={BAR_Y + 25} r="4" fill="none" stroke={SCHEME_ACCENT} strokeWidth="2" />
        <text x={NODE_X} y={BAR_Y + 52} fill={SCHEME_GRID} fontSize="11">
          вязка проволокой d1,2
        </text>
        <line
          x1={NODE_X}
          y1={BAR_Y + 58}
          x2={VIEW_W - 20}
          y2={BAR_Y + 58}
          stroke={SCHEME_GRID}
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      </svg>
    </Scheme>
  );
}