'use client';

import React, { useMemo } from 'react';
import { Layers2, Ruler, Scale } from 'lucide-react';
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
  SCREED_KG_PER_M2_PER_MM_DEFAULT,
  SCREED_KG_PER_M2_PER_MM_MAX,
  SCREED_KG_PER_M2_PER_MM_MIN,
  SCREED_THICKNESS_OPTIONS_MM,
  buildEstimateText,
  computeMixConsumption,
  computeScreedComponents,
  formatByn,
  formatInt,
  formatKg,
  formatM2,
  formatM3,
  formatMm,
  formatNumber,
  getPrice,
  pluralize,
  PLURALS,
  safeNum,
} from '@/lib/construction';
import { useConstructionForm, useConstructionRegion } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-screed';

const DEFAULTS = {
  mode: 'mix',
  lengthM: '10',
  widthM: '8',
  thicknessMm: '50',
  layers: '1',
  mixId: 'taifun-screed',
  useCustomRate: 'no',
  customRate: String(SCREED_KG_PER_M2_PER_MM_DEFAULT),
  wastePercent: '5',
  withWaterproofing: 'no',
};

const SCREED_MIXES = MIX_PRODUCTS.filter((mix) => mix.kind === 'screed');

const THICKNESS_OPTIONS = SCREED_THICKNESS_OPTIONS_MM.map((thickness) => ({
  value: String(thickness),
  label: `${thickness} мм`,
}));

export default function ScreedCalculator({ feature }: { feature: Feature }) {
  const { values, set } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    const mode = values.mode === 'solution' ? ('solution' as const) : ('mix' as const);
    const areaM2 = Math.max(0, safeNum(values.lengthM)) * Math.max(0, safeNum(values.widthM));
    const thicknessMm = safeNum(values.thicknessMm, 50);
    const layersCount = Math.max(1, safeNum(values.layers, 1));
    const thicknessM = thicknessMm / 1000;
    const volumeM3 = areaM2 * thicknessM;

    const mix = SCREED_MIXES.find((item) => item.id === values.mixId) ?? SCREED_MIXES[0];

    /*
      Норма расхода стяжки 1,8–2,0 кг/м² на 1 мм. Берётся из паспорта марки,
      а если паспорт неизвестен — из указанного прорабом значения, но не
      выходит за нормативный коридор.
    */
    const rate = values.useCustomRate === 'yes'
      ? Math.min(
          SCREED_KG_PER_M2_PER_MM_MAX,
          Math.max(SCREED_KG_PER_M2_PER_MM_MIN, safeNum(values.customRate, SCREED_KG_PER_M2_PER_MM_DEFAULT))
        )
      : mix.kgPerM2PerMm;

    const consumption = computeMixConsumption({
      areaM2,
      thicknessMm,
      kgPerM2PerMm: rate,
      bagKg: mix.bagKg,
      wastePercent: safeNum(values.wastePercent, 5),
    });

    // Классический раствор цемент + песок считается отдельно
    const components = computeScreedComponents(volumeM3, thicknessMm);
    const cementPrice = getPrice('cementM400', region);
    const sandPrice = getPrice('sand', region);
    const mixPrice = getPrice('screedMix', region);
    const waterproofPrice = getPrice('waterproofing', region);
    const workPrice = getPrice('workScreed', region);

    // Гидроизоляция нужна там, где стяжка контактирует с водой или «плавает»
    // по грунту: ванная, кухня, гараж, подвал. Площадь берём с запасом 5 %.
    const waterproofAreaM2 = Math.round(areaM2 * 1.05 * 100) / 100;

    const lines =
      mode === 'mix'
        ? [
            {
              label: `${mix.brand}: ${mix.name}`,
              unit: `мешок ${mix.bagKg} кг`,
              qty: consumption.bags,
              price: mixPrice,
              note: `${formatNumber(rate, 2)} кг/м² на 1 мм · ${mix.manufacturer}`,
            },
          ]
        : [
            {
              label: 'Портландцемент ПЦ 400',
              unit: 'мешок 50 кг',
              qty: components.cementBags50,
              price: cementPrice,
              note: `${formatKg(components.cementKg, 0)} · пропорция ${components.parts}`,
            },
            {
              label: 'Песок мытый (стяжка)',
              unit: 'м³',
              qty: components.sandM3,
              price: sandPrice,
              note: `часть ${components.parts.split(':')[1]?.trim() ?? '3'} по объёму`,
            },
          ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object: `Стяжка ${formatM2(areaM2)}, толщина ${formatMm(thicknessMm)}, ${
        mode === 'mix' ? 'готовая смесь' : `раствор ${components.parts}`
      }`,
      region,
      standard: 'СП 29.13330 (стяжка), паспорт марки смеси',
      lines: [
        ...lines,
        ...(values.withWaterproofing === 'yes'
          ? [
              {
                label: 'Гидроизоляция обмазочная, 2 слоя',
                unit: 'м²',
                qty: waterproofAreaM2,
                price: waterproofPrice,
                note: '+5 % на нахлёсты у стен',
              },
            ]
          : []),
        {
          label: 'Работа: стяжка с выравниванием по уровню',
          unit: 'м²',
          qty: areaM2,
          price: workPrice,
          note: `${layersCount} ${layersCount === 1 ? 'заливка' : 'заливки'}`,
        },
      ],
      totals: [
        { label: 'Площадь пола', value: formatM2(areaM2) },
        { label: 'Объём стяжки', value: formatM3(volumeM3, 3) },
        { label: 'Норма расхода', value: `${formatNumber(rate, 2)} кг/м² на 1 мм (норма ${SCREED_KG_PER_M2_PER_MM_MIN}–${SCREED_KG_PER_M2_PER_MM_MAX})` },
        { label: 'Смеси без запаса / с запасом', value: `${formatKg(consumption.dryMixKg, 0)} / ${formatKg(consumption.dryMixWithWasteKg, 0)}` },
        { label: 'К закупке', value: pluralize(consumption.bags, PLURALS.bag) },
        {
          label: 'Раствор цемент + песок',
          value: `${formatKg(components.cementKg, 0)} (${formatInt(components.cementBags50)} мешков), песок ${formatNumber(components.sandM3)} м³, вода ${formatNumber(components.waterL, 0)} л`,
        },
      ],
      footer: `Стяжка толщиной до 30 мм делается на пропорции 1:2, толще — 1:3 (${components.parts} для вашей толщины). Расход ${SCREED_KG_PER_M2_PER_MM_MIN}–${SCREED_KG_PER_M2_PER_MM_MAX} кг/м² на 1 мм — это норма для сухих смесей РБ.`,
    });

    return {
      mode,
      mix,
      rate,
      areaM2,
      thicknessMm,
      thicknessM,
      layersCount,
      volumeM3,
      consumption,
      components,
      lines,
      waterproofAreaM2,
      estimateText,
    };
  }, [values, region, feature.label]);

  const {
    mode,
    mix,
    rate,
    areaM2,
    thicknessMm,
    thicknessM,
    volumeM3,
    consumption,
    components,
    lines,
    waterproofAreaM2,
    estimateText,
  } = result;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutoSaveBadge toolId={TOOL_ID} />
          <ResetDraftButton toolId={TOOL_ID} />
        </div>

        <Card title="Пол и толщина" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Длина пола"
                value={values.lengthM}
                onChange={(value) => set({ lengthM: value })}
                unit="м"
                placeholder="10"
              />
              <Field
                label="Ширина пола"
                value={values.widthM}
                onChange={(value) => set({ widthM: value })}
                unit="м"
                placeholder="8"
              />
            </div>

            <SelectField
              label="Толщина стяжки"
              value={values.thicknessMm}
              onChange={(value) => set({ thicknessMm: value })}
              options={THICKNESS_OPTIONS}
              hint={
                thicknessMm < 30
                  ? 'До 30 мм — раствор на пропорции 1:2'
                  : 'Свыше 30 мм — раствор 1:3, обязательна армирующая сетка'
              }
            />

            <Segmented
              label="Материал стяжки"
              value={values.mode}
              onChange={(value) => set({ mode: value })}
              options={[
                { value: 'mix', label: 'Готовая сухая смесь' },
                { value: 'solution', label: 'Раствор цемент + песок' },
              ]}
            />

            <Segmented
              label="Гидроизоляция"
              value={values.withWaterproofing}
              onChange={(value) => set({ withWaterproofing: value })}
              options={[
                { value: 'no', label: 'Не нужна' },
                { value: 'yes', label: 'Обмазочная, 2 слоя' },
              ]}
            />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Смесь или раствор" icon={<Scale className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              {mode === 'mix' && (
                <>
                  <SelectField
                    label="Марка смеси (производство РБ)"
                    value={values.mixId}
                    onChange={(value) => set({ mixId: value })}
                    options={SCREED_MIXES.map((item) => ({
                      value: item.id,
                      label: `${item.brand} · ${formatNumber(item.kgPerM2PerMm, 2)} кг/м²/мм`,
                    }))}
                    hint={mix.manufacturer}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Segmented
                      label="Своя норма расхода"
                      value={values.useCustomRate}
                      onChange={(value) => set({ useCustomRate: value })}
                      options={[
                        { value: 'no', label: 'Из паспорта' },
                        { value: 'yes', label: 'Вручную' },
                      ]}
                    />
                    {values.useCustomRate === 'yes' && (
                      <Field
                        label="кг/м² на 1 мм"
                        value={values.customRate}
                        onChange={(value) => set({ customRate: value })}
                        placeholder={String(SCREED_KG_PER_M2_PER_MM_DEFAULT)}
                        hint={`${SCREED_KG_PER_M2_PER_MM_MIN}–${SCREED_KG_PER_M2_PER_MM_MAX}`}
                      />
                    )}
                  </div>
                  <Field
                    label="Запас на потери"
                    value={values.wastePercent}
                    onChange={(value) => set({ wastePercent: value })}
                    unit="%"
                    placeholder="5"
                  />
                </>
              )}

              {mode === 'solution' && (
                <StandardNote>
                  Классическая стяжка: цемент М400 + мытый песок. Пропорция{' '}
                  {components.parts} подобрана по толщине — до 30 мм раствор должен быть
                  плотнее, иначе он трескается по стыку с плитой перекрытия.
                </StandardNote>
              )}

              <Segmented
                label="Число заливок"
                value={values.layers}
                onChange={(value) => set({ layers: value })}
                options={[
                  { value: '1', label: '1 заливка' },
                  { value: '2', label: '2 заливки' },
                ]}
              />
            </div>
          </Card>

          <Card title="Схема пирога пола" icon={<Layers2 className="h-4 w-4" aria-hidden="true" />}>
            <ScreedScheme
              areaM2={areaM2}
              thicknessM={thicknessM}
              volumeM3={volumeM3}
              mode={mode}
              cementKg={components.cementKg}
              sandM3={components.sandM3}
              waterproofed={values.withWaterproofing === 'yes'}
            />
          </Card>
        </div>

        <Card title="Расход и закупка">
          <StatGrid columns={4}>
            <Stat label="Площадь пола" value={formatNumber(areaM2)} unit="м²" />
            <Stat label="Объём стяжки" value={formatNumber(volumeM3, 3)} unit="м³" accent />
            <Stat label="Смеси с запасом" value={formatKg(consumption.dryMixWithWasteKg, 0)} />
            <Stat label="Мешков" value={formatInt(consumption.bags)} hint={`по ${mix.bagKg} кг`} />
          </StatGrid>

          <div className="mt-3">
            <StatGrid columns={2}>
              <Stat
                label="Норма расхода"
                value={formatNumber(rate, 2)}
                unit="кг/м²/мм"
                hint={`норма ${SCREED_KG_PER_M2_PER_MM_MIN}–${SCREED_KG_PER_M2_PER_MM_MAX}`}
              />
              <Stat
                label="Гидроизоляция"
                value={values.withWaterproofing === 'yes' ? formatNumber(waterproofAreaM2) : '—'}
                unit="м²"
                hint={values.withWaterproofing === 'yes' ? '+5 % на нахлёсты' : 'не включена'}
              />
            </StatGrid>
          </div>

          {mode === 'solution' && (
            <div className="mt-3">
              <StatGrid columns={4}>
                <Stat label="Цемент ПЦ 400" value={formatKg(components.cementKg, 0)} accent />
                <Stat label="Мешков по 50 кг" value={formatInt(components.cementBags50)} />
                <Stat label="Песок" value={formatNumber(components.sandM3)} unit="м³" />
                <Stat label="Вода" value={formatNumber(components.waterL, 0)} unit="л" hint="0,5 л на 1 кг цемента" />
              </StatGrid>
            </div>
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
          Расход стяжечной смеси {SCREED_KG_PER_M2_PER_MM_MIN}–{SCREED_KG_PER_M2_PER_MM_MAX} кг/м² на
          1 мм слоя — норма для сухих смесей, производимых в РБ (Илмакс, Тайфун Мастер,
          Ceresit). Стяжка толще 30 мм обязательно армируется сеткой, а по грунту требует
          гидроизоляции.
        </StandardNote>
      </div>
    </SectionContentWrapper>
  );
}

/**
 * Разрез пола: стяжка толщиной до 50 мм на плите перекрытия, при необходимости —
 * гидроизоляция и армирующая сетка. Для раствора показывается расклад по
 * объёмам: цемент и песок отдельными слоями.
 */
function ScreedScheme({
  areaM2,
  thicknessM,
  volumeM3,
  mode,
  cementKg,
  sandM3,
  waterproofed,
}: {
  areaM2: number;
  thicknessM: number;
  volumeM3: number;
  mode: 'mix' | 'solution';
  cementKg: number;
  sandM3: number;
  waterproofed: boolean;
}) {
  const VIEW_W = 420;
  const VIEW_H = 210;
  const X = 40;
  const W = 340;
  const BASE_Y = 168;
  const BASE_H = 22;
  // Усиление толщины: стяжка 50 мм на чертеже дома — полторы линии
  const SCALE_T = 150;
  const screedPx = Math.max(6, Math.min(70, thicknessM * SCALE_T));
  const screedTop = BASE_Y - screedPx;
  const tileH = 12;
  const waterproofH = waterproofed ? 6 : 0;

  return (
    <Scheme
      caption={
        <>
          Стяжка {formatNumber(thicknessM * 1000, 0)} мм на площади {formatM2(areaM2)}: объём{' '}
          {formatM3(volumeM3, 3)}
          {mode === 'solution'
            ? ` · цемент ${formatKg(cementKg, 0)}, песок ${formatNumber(sandM3)} м³`
            : ''}
          {waterproofed ? ' · гидроизоляция предусмотрена' : ''}
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Схема пирога пола: стяжка ${formatNumber(thicknessM * 1000, 0)} миллиметров, объём ${formatNumber(volumeM3, 3)} кубометра`}
      >
        {/* Основание */}
        <rect
          x={X}
          y={BASE_Y}
          width={W}
          height={BASE_H}
          fill="rgba(255,255,255,0.07)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />
        <text x={X + W / 2} y={BASE_Y + 15} fill={SCHEME_STROKE} fontSize="11" textAnchor="middle">
          плита перекрытия / грунт
        </text>

        {/* Гидроизоляция */}
        {waterproofed && (
          <>
            <rect
              x={X}
              y={BASE_Y - waterproofH}
              width={W}
              height={waterproofH}
              fill="rgba(168,180,140,0.35)"
              stroke={SCHEME_ACCENT}
              strokeWidth="1"
            />
            <text x={X - 4} y={BASE_Y - waterproofH / 2 + 4} fill={SCHEME_ACCENT} fontSize="10" textAnchor="end">
              гидроизоляция
            </text>
          </>
        )}

        {/* Стяжка */}
        <rect
          x={X}
          y={screedTop}
          width={W}
          height={screedPx}
          fill="rgba(255,255,255,0.12)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />
        <text x={X + W / 2} y={screedTop + screedPx / 2 + 4} fill={SCHEME_STROKE} fontSize="11" textAnchor="middle">
          {mode === 'mix' ? 'стяжка из готовой смеси' : `раствор цемент + песок`} ·{' '}
          {formatNumber(volumeM3, 2)} м³
        </text>

        {/* Армирование для толстой стяжки */}
        {thicknessM >= 0.03 && (
          <line
            x1={X + 8}
            y1={screedTop + screedPx / 2}
            x2={X + W - 8}
            y2={screedTop + screedPx / 2}
            stroke={SCHEME_ACCENT}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Финишное покрытие */}
        <rect
          x={X}
          y={screedTop - tileH}
          width={W}
          height={tileH}
          fill="none"
          stroke={SCHEME_STROKE}
          strokeWidth="1.5"
        />
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={`tile-${index}`}
            x1={X + (W / 8) * (index + 1)}
            y1={screedTop - tileH}
            x2={X + (W / 8) * (index + 1)}
            y2={screedTop}
            stroke={SCHEME_GRID}
            strokeWidth="1"
          />
        ))}
        <text x={X + W / 2} y={screedTop - tileH - 6} fill={SCHEME_STROKE} fontSize="11" textAnchor="middle">
          финишное покрытие
        </text>

        {/* Размер стяжки */}
        <line
          x1={X + W + 10}
          y1={screedTop}
          x2={X + W + 10}
          y2={BASE_Y}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <line x1={X + W + 5} y1={screedTop} x2={X + W + 15} y2={screedTop} stroke={SCHEME_STROKE} strokeWidth="1" />
        <line x1={X + W + 5} y1={BASE_Y} x2={X + W + 15} y2={BASE_Y} stroke={SCHEME_STROKE} strokeWidth="1" />
        <text
          x={X + W + 20}
          y={(screedTop + BASE_Y) / 2}
          fill={SCHEME_ACCENT}
          fontSize="11"
          textAnchor="start"
        >
          {formatNumber(thicknessM * 1000, 0)} мм
        </text>

        <text x={X} y={BASE_Y + BASE_H + 14} fill={SCHEME_GRID} fontSize="10">
          толщина показана с усилением ×{Math.round(SCALE_T)}; площадь {formatM2(areaM2)}
        </text>
      </svg>
    </Scheme>
  );
}