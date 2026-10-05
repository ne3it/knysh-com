'use client';

import React, { useMemo } from 'react';
import { PaintRoller, Ruler, Wrench } from 'lucide-react';
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
  MIX_PRODUCTS,
  PLASTER_AREA_LOSS_PERCENT,
  PLASTER_KG_PER_M2_PER_MM_DEFAULT,
  PLASTER_KG_PER_M2_PER_MM_MAX,
  PLASTER_KG_PER_M2_PER_MM_MIN,
  PLASTER_LAYER_THICKNESS_MM,
  PLASTER_MIN_THICKNESS_MM,
  PLASTER_THICKNESS_OPTIONS_MM,
  buildEstimateText,
  computeMixConsumption,
  formatByn,
  formatInt,
  formatKg,
  formatM2,
  formatMm,
  formatNumber,
  getPrice,
  pluralize,
  PLURALS,
  safeNum,
} from '@/lib/construction';
import { useConstructionForm, useConstructionRegion } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-plaster';

const DEFAULTS = {
  surface: 'inside',
  lengthM: '12',
  heightM: '3',
  wallsCount: '4',
  ceilingM2: '0',
  openingsM2: '9',
  thicknessMm: '20',
  layers: '2',
  mixId: 'ilmax-plaster',
  customRate: String(PLASTER_KG_PER_M2_PER_MM_DEFAULT),
  useCustomRate: 'no',
  wastePercent: '5',
};

const PLASTER_MIXES = MIX_PRODUCTS.filter((mix) => mix.kind === 'plaster');

const THICKNESS_OPTIONS = PLASTER_THICKNESS_OPTIONS_MM.map((thickness) => ({
  value: String(thickness),
  label: `${thickness} мм${thickness % PLASTER_LAYER_THICKNESS_MM === 0 ? ` = ${thickness / PLASTER_LAYER_THICKNESS_MM} слоя по 10 мм` : ''}`,
}));

export default function PlasterCalculator({ feature }: { feature: Feature }) {
  const { values, set } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    const lengthM = safeNum(values.lengthM);
    const heightM = safeNum(values.heightM);
    const wallsCount = Math.max(0, safeNum(values.wallsCount));
    const ceilingM2 = Math.max(0, safeNum(values.ceilingM2));
    const openingsM2 = Math.max(0, safeNum(values.openingsM2));

    const wallsGrossM2 = lengthM * heightM * wallsCount;
    const grossAreaM2 = wallsGrossM2 + ceilingM2;
    const netAreaM2 = Math.max(0, grossAreaM2 - openingsM2);
    // Потери на углах, откосах и переходах — на стыках всегда есть неучтённая
    // площадь, и по факту бригада берёт смесь «на глаз»
    const areaWithLossM2 = netAreaM2 * (1 + PLASTER_AREA_LOSS_PERCENT / 100);

    const mix = PLASTER_MIXES.find((item) => item.id === values.mixId) ?? PLASTER_MIXES[0];
    const thicknessMm = safeNum(values.thicknessMm, 20);
    const layersCount = Math.max(1, safeNum(values.layers, 2));

    /*
      Норма расхода берётся из паспорта конкретной марки. Ручное значение нужно
      для смесей, которых нет в списке: паспорт производителя может отличаться,
      и молча усреднять его нельзя — прораб посчитает неверную закупку.
    */
    const rate = values.useCustomRate === 'yes'
      ? Math.min(
          PLASTER_KG_PER_M2_PER_MM_MAX,
          Math.max(PLASTER_KG_PER_M2_PER_MM_MIN, safeNum(values.customRate, PLASTER_KG_PER_M2_PER_MM_DEFAULT))
        )
      : mix.kgPerM2PerMm;

    const consumption = computeMixConsumption({
      areaM2: areaWithLossM2,
      thicknessMm,
      kgPerM2PerMm: rate,
      bagKg: mix.bagKg,
      wastePercent: safeNum(values.wastePercent, 5),
    });

    // Смета делится на слои: мешок покупают один раз, а расход на слой виден
    const perLayerMm = thicknessMm / layersCount;
    const perLayerKg = consumption.dryMixWithWasteKg / layersCount;

    const mixPrice = getPrice('plasterMix', region);
    const workPrice = getPrice('workPlaster', region);

    const lines = [
      {
        label: `${mix.brand}: ${mix.name}`,
        unit: `мешок ${mix.bagKg} кг`,
        qty: consumption.bags,
        price: mixPrice,
        note: `${formatNumber(rate, 2)} кг/м² на 1 мм · ${mix.manufacturer}`,
      },
      {
        label: 'Работа: штукатурка, 2 слоя',
        unit: 'м²',
        qty: netAreaM2,
        price: workPrice,
        note: `толщина ${formatMm(thicknessMm)}, ${layersCount} ${layersCount === 1 ? 'слой' : 'слоя'}`,
      },
    ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object: `${values.surface === 'inside' ? 'Внутренняя' : 'Наружная'} штукатурка: ${formatM2(netAreaM2)} чистой площади, слой ${formatMm(thicknessMm)}`,
      region,
      standard: 'СП 70.13330 (штукатурные работы), паспорт марки смеси',
      lines,
      totals: [
        { label: 'Площадь без проёмов', value: formatM2(grossAreaM2) },
        { label: 'Вычет проёмов', value: `−${formatM2(openingsM2)}` },
        { label: 'Потери на углах и откосах', value: `${PLASTER_AREA_LOSS_PERCENT} % = ${formatM2(areaWithLossM2 - netAreaM2)}` },
        { label: 'Расход нормы', value: `${formatNumber(rate, 2)} кг/м² на 1 мм (норма ${PLASTER_KG_PER_M2_PER_MM_MIN}–${PLASTER_KG_PER_M2_PER_MM_MAX})` },
        { label: 'Смеси без запаса', value: formatKg(consumption.dryMixKg, 1) },
        { label: 'Смеси с запасом', value: formatKg(consumption.dryMixWithWasteKg, 1) },
        { label: 'К закупке', value: pluralize(consumption.bags, PLURALS.bag) },
      ],
      footer: `Штукатурка наносится слоями по ${PLASTER_LAYER_THICKNESS_MM} мм, поэтому слой ${formatMm(thicknessMm)} — это ${layersCount} нанесения. Толщина меньше ${PLASTER_MIN_THICKNESS_MM} мм штукатуркой не считается.`,
    });

    return {
      mix,
      thicknessMm,
      layersCount,
      rate,
      wallsGrossM2,
      grossAreaM2,
      netAreaM2,
      areaWithLossM2,
      perLayerMm,
      perLayerKg,
      consumption,
      lines,
      estimateText,
    };
  }, [values, region, feature.label]);

  const {
    mix,
    thicknessMm,
    layersCount,
    rate,
    wallsGrossM2,
    netAreaM2,
    areaWithLossM2,
    perLayerMm,
    perLayerKg,
    consumption,
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

        <Card title="Площадь отделки" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <Segmented
              label="Поверхность"
              value={values.surface}
              onChange={(value) => set({ surface: value })}
              options={[
                { value: 'inside', label: 'Внутренние работы' },
                { value: 'outside', label: 'Наружные работы' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Длина стены"
                value={values.lengthM}
                onChange={(value) => set({ lengthM: value })}
                unit="м"
                placeholder="12"
              />
              <Field
                label="Высота стены"
                value={values.heightM}
                onChange={(value) => set({ heightM: value })}
                unit="м"
                placeholder="3"
              />
              <Field
                label="Число стен"
                value={values.wallsCount}
                onChange={(value) => set({ wallsCount: value })}
                unit="шт"
                placeholder="4"
                hint={`Периметр стен: ${formatM2(wallsGrossM2)}`}
              />
              <Field
                label="Потолок"
                value={values.ceilingM2}
                onChange={(value) => set({ ceilingM2: value })}
                unit="м²"
                placeholder="0"
              />
              <Field
                label="Проёмы (вычет)"
                value={values.openingsM2}
                onChange={(value) => set({ openingsM2: value })}
                unit="м²"
                placeholder="9"
                hint="Окна и двери в сумме"
              />
              <Field
                label="Запас на потери"
                value={values.wastePercent}
                onChange={(value) => set({ wastePercent: value })}
                unit="%"
                placeholder="5"
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Смесь и слой" icon={<PaintRoller className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <SelectField
                label="Марка сухой смеси (производство РБ)"
                value={values.mixId}
                onChange={(value) => set({ mixId: value })}
                options={PLASTER_MIXES.map((item) => ({
                  value: item.id,
                  label: `${item.brand} · ${formatNumber(item.kgPerM2PerMm, 2)} кг/м²/мм`,
                }))}
                hint={mix.manufacturer}
              />
              <SelectField
                label="Толщина штукатурки"
                value={values.thicknessMm}
                onChange={(value) => set({ thicknessMm: value })}
                options={THICKNESS_OPTIONS}
              />
              <Segmented
                label="Число слоёв"
                value={values.layers}
                onChange={(value) => set({ layers: value })}
                options={[
                  { value: '1', label: '1 слой' },
                  { value: '2', label: '2 слоя' },
                  { value: '3', label: '3 слоя' },
                ]}
              />
              <Segmented
                label="Своя норма расхода"
                value={values.useCustomRate}
                onChange={(value) => set({ useCustomRate: value })}
                options={[
                  { value: 'no', label: 'Из паспорта марки' },
                  { value: 'yes', label: 'Указать вручную' },
                ]}
              />
              {values.useCustomRate === 'yes' && (
                <Field
                  label="Расход на 1 мм слоя"
                  value={values.customRate}
                  onChange={(value) => set({ customRate: value })}
                  unit="кг/м²"
                  placeholder={String(PLASTER_KG_PER_M2_PER_MM_DEFAULT)}
                  hint={`Ограничен нормой ${PLASTER_KG_PER_M2_PER_MM_MIN}–${PLASTER_KG_PER_M2_PER_MM_MAX} кг/м² на 1 мм`}
                />
              )}
            </div>
          </Card>

          <Card title="Схема слоя на стене" icon={<Wrench className="h-4 w-4" aria-hidden="true" />}>
            <PlasterScheme
              thicknessMm={thicknessMm}
              layersCount={layersCount}
              netAreaM2={netAreaM2}
              ratePerMm={rate}
            />
          </Card>
        </div>

        <Card title="Расход и закупка">
          <StatGrid columns={4}>
            <Stat label="Чистая площадь" value={formatNumber(netAreaM2)} unit="м²" />
            <Stat
              label="С потерями"
              value={formatNumber(areaWithLossM2)}
              unit="м²"
              hint={`+${PLASTER_AREA_LOSS_PERCENT} % на углы и откосы`}
            />
            <Stat label="Смеси" value={formatKg(consumption.dryMixWithWasteKg, 0)} accent />
            <Stat label="Мешков" value={formatInt(consumption.bags)} hint={`по ${mix.bagKg} кг`} />
          </StatGrid>

          <div className="mt-3">
            <StatGrid columns={2}>
              <Stat label="Норма расхода" value={formatNumber(rate, 2)} unit="кг/м²/мм" hint={`норма ${PLASTER_KG_PER_M2_PER_MM_MIN}–${PLASTER_KG_PER_M2_PER_MM_MAX}`} />
              <Stat label="Слой за один проход" value={formatMm(perLayerMm)} hint={`${formatKg(perLayerKg, 1)} на всю площадь`} />
            </StatGrid>
          </div>

          {consumption.extraBags > 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-[var(--kc-border-strong)] px-3 py-2 text-[11px] leading-snug text-[var(--kc-khaki-text)]">
              По расчёту {formatNumber(consumption.bagsExact, 2)} мешка — докупить{' '}
              {pluralize(consumption.extraBags, PLURALS.bag)}, чтобы не встать на объекте
              посреди штукатурки.
            </p>
          )}
        </Card>

        <Card title="Смета в BYN">
          <div className="space-y-1">
            {lines.map((line, index) => (
              <EstimateRow
                key={`${line.label}-${index}`}
                label={line.label}
                qty={formatNumber(line.qty, 2)}
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

        <StandardNote>
          Расход штукатурной смеси — {PLASTER_KG_PER_M2_PER_MM_MIN}–{PLASTER_KG_PER_M2_PER_MM_MAX} кг/м² на
          1 мм слоя, и конкретная цифра берётся из паспорта выбранной марки.
          Штукатурку наносят слоями по {PLASTER_LAYER_THICKNESS_MM} мм; слой толщиной
          меньше {PLASTER_MIN_THICKNESS_MM} мм штукатуркой не считается.
        </StandardNote>
      </div>
    </SectionContentWrapper>
  );
}

/**
 * Разрез стены: штукатурный слой рисуется в масштабе (с усилением, иначе
 * 20 мм на чертеже не видно), отдельно показан каждый проход в 10 мм.
 */
function PlasterScheme({
  thicknessMm,
  layersCount,
  netAreaM2,
  ratePerMm,
}: {
  thicknessMm: number;
  layersCount: number;
  netAreaM2: number;
  ratePerMm: number;
}) {
  const VIEW_W = 420;
  const VIEW_H = 200;
  const WALL_X = 110;
  const WALL_W = 170;
  const WALL_H = 130;
  const WALL_Y = 40;
  // Усиление толщины: 1 мм → 3,5 px, иначе слой в 20 мм выродился бы в линию
  const SCALE_T = 3.5;
  const plasterPx = Math.min(WALL_W / 2 - 4, Math.max(2, thicknessMm * SCALE_T));
  const layerPx = thicknessMm > 0 ? plasterPx / layersCount : 0;

  return (
    <Scheme
      caption={
        <>
          Слой {formatMm(thicknessMm)} нанесён в {layersCount} прохода по{' '}
          {formatNumber(thicknessMm / Math.max(1, layersCount), 1)} мм. Норма {formatNumber(ratePerMm, 2)}{' '}
          кг/м²/мм даёт {formatNumber(netAreaM2 * thicknessMm * ratePerMm, 0)} кг смеси на всю площадь.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Разрез стены со штукатурным слоем ${formatMm(thicknessMm)} в ${layersCount} слоёв`}
      >
        {/* Основание — стена */}
        <rect
          x={WALL_X + plasterPx}
          y={WALL_Y}
          width={WALL_W - plasterPx * 2}
          height={WALL_H}
          fill="rgba(255,255,255,0.07)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />
        <text
          x={WALL_X + plasterPx + (WALL_W - plasterPx * 2) / 2}
          y={WALL_Y + WALL_H / 2 + 4}
          fill={SCHEME_STROKE}
          fontSize="11"
          textAnchor="middle"
        >
          стена (кладка)
        </text>

        {/* Штукатурный слой с каждой стороны */}
        {[
          { x: WALL_X, side: 'снаружи' },
          { x: WALL_X + WALL_W - plasterPx, side: 'внутри' },
        ].map((layer) => (
          <g key={layer.side}>
            <rect
              x={layer.x}
              y={WALL_Y}
              width={plasterPx}
              height={WALL_H}
              fill="rgba(168,180,140,0.28)"
              stroke={SCHEME_ACCENT}
              strokeWidth="1.5"
            />
            {Array.from({ length: layersCount }).map((_, index) => (
              <line
                key={`pass-${index}`}
                x1={layer.x}
                y1={WALL_Y + layerPx * (index + 1)}
                x2={layer.x + plasterPx}
                y2={WALL_Y + layerPx * (index + 1)}
                stroke={SCHEME_ACCENT}
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />
            ))}
          </g>
        ))}

        {/* Размерная линия толщины */}
        <line
          x1={WALL_X}
          y1={WALL_Y - 14}
          x2={WALL_X + plasterPx}
          y2={WALL_Y - 14}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <line x1={WALL_X} y1={WALL_Y - 19} x2={WALL_X} y2={WALL_Y - 9} stroke={SCHEME_STROKE} strokeWidth="1" />
        <line
          x1={WALL_X + plasterPx}
          y1={WALL_Y - 19}
          x2={WALL_X + plasterPx}
          y2={WALL_Y - 9}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <text
          x={WALL_X + plasterPx / 2}
          y={WALL_Y - 22}
          fill={SCHEME_ACCENT}
          fontSize="11"
          textAnchor="middle"
        >
          {formatMm(thicknessMm)}
        </text>

        {/* Пояснение */}
        <text x={WALL_X} y={WALL_Y + WALL_H + 22} fill={SCHEME_STROKE} fontSize="11">
          {layersCount} {layersCount === 1 ? 'проход' : 'прохода'} по{' '}
          {formatNumber(thicknessMm / Math.max(1, layersCount), 1)} мм
        </text>
        <text x={WALL_X} y={WALL_Y + WALL_H + 38} fill={SCHEME_GRID} fontSize="10">
          толщина показана с усилением ×3,5 — в масштабе 20 мм почти не видно
        </text>

        {/* Полоса площади */}
        <rect
          x={8}
          y={WALL_Y}
          width="70"
          height={WALL_H}
          fill="rgba(255,255,255,0.05)"
          stroke={SCHEME_GRID}
          strokeWidth="1"
        />
        <text x={43} y={WALL_Y + WALL_H / 2 - 4} fill={SCHEME_STROKE} fontSize="11" textAnchor="middle">
          {formatNumber(netAreaM2)}
        </text>
        <text x={43} y={WALL_Y + WALL_H / 2 + 10} fill={SCHEME_GRID} fontSize="10" textAnchor="middle">
          м² отделки
        </text>
      </svg>
    </Scheme>
  );
}