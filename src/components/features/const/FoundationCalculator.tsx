'use client';

import React, { useMemo } from 'react';
import { Boxes, Layers, Ruler, Snowflake, Waves } from 'lucide-react';
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
  CONCRETE_LOSS_PERCENT,
  CONCRETE_MARKS,
  DISTRICT_LABELS,
  FROST_DEPTH_M,
  SOIL_TYPE_FROST_FACTOR,
  buildEstimateText,
  computeConcreteBatch,
  computeFoundationGeometry,
  computeFrostDepth,
  formatByn,
  formatInt,
  formatKg,
  formatM,
  formatM3,
  formatNumber,
  formatT,
  getPrice,
  mmToM,
  safeNum,
} from '@/lib/construction';
import {
  useConstructionForm,
  useConstructionRegion,
  type ConstructionDistrictKey,
} from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-foundation';

/** Поля формы. Объявлены константой модуля: useConstructionForm требует стабильной ссылки. */
const DEFAULTS = {
  type: 'strip',
  district: 'minsk',
  soilType: 'loam',
  lengthM: '24',
  widthMm: '400',
  depthMm: '1500',
  stripsCount: '1',
  beddingMm: '200',
  blindingMm: '100',
  concreteMark: 'М300',
  withPgs: 'yes',
  withXps: 'no',
};

/** Ключ цены бетона по марке */
const CONCRETE_PRICE_KEY = {
  М200: 'concreteM200',
  М250: 'concreteM250',
  М300: 'concreteM300',
  М350: 'concreteM350',
} as const;

const DISTRICT_OPTIONS = Object.entries(DISTRICT_LABELS).map(([value, label]) => ({ value, label }));
const SOIL_OPTIONS = SOIL_TYPE_FROST_FACTOR.map((soil) => ({ value: soil.id, label: `${soil.label} (×${soil.factor})` }));
const MARK_OPTIONS = CONCRETE_MARKS.map((mark) => ({
  value: mark.mark,
  label: `${mark.mark} / ${mark.class} · ${mark.usage}`,
}));

export default function FoundationCalculator({ feature }: { feature: Feature }) {
  const { values, set, reset } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    const type = values.type === 'slab' ? ('slab' as const) : ('strip' as const);
    const soil = SOIL_TYPE_FROST_FACTOR.find((item) => item.id === values.soilType);
    const mark = CONCRETE_MARKS.find((item) => item.mark === values.concreteMark) ?? CONCRETE_MARKS[2];

    const frost = computeFrostDepth({
      district: FROST_DEPTH_M[values.district] ? values.district : 'minsk',
      soilFactor: soil?.factor ?? 1,
    });

    /*
      Для ленты глубина бетона берётся как заложение ПОДШВЫ минус подушка и
      подготовка: сверху под землёй остаются только слои, которые в бетон не входят.
      Для плиты «глубина» — это её собственная толщина, и под землёй она целиком.
    */
    const beddingM = mmToM(safeNum(values.beddingMm, 200));
    const blindingM = mmToM(safeNum(values.blindingMm, 100));

    const geometry = computeFoundationGeometry({
      type,
      lengthM: safeNum(values.lengthM),
      widthMm: safeNum(values.widthMm, 400),
      thicknessMm: safeNum(values.depthMm, type === 'slab' ? 200 : 1500),
      stripsCount: type === 'strip' ? safeNum(values.stripsCount, 1) : 1,
      depthM:
        type === 'strip'
          ? Math.max(0.1, frost.footingDepthM - beddingM - blindingM)
          : undefined,
      beddingMm: safeNum(values.beddingMm, 200),
      blindingMm: safeNum(values.blindingMm, 100),
    });

    const batch = computeConcreteBatch(geometry.volumeCompactedM3, mark.mark);
    const usePgs = values.withPgs === 'yes';

    /* ---- Смета в BYN ---- */
    const concretePrice = getPrice(CONCRETE_PRICE_KEY[mark.mark], region);
    const formworkPrice = getPrice('formwork', region);
    const sandPrice = getPrice('sand', region);
    const gravelPrice = getPrice('gravel', region);
    const groutPrice = getPrice('groutFill', region);
    const xpsPrice = getPrice('xps', region);
    const workPrice = getPrice('workFoundation', region);

    // Подушка: если берём ПГС — одна позиция, иначе песок со щебнем отдельно
    const beddingLines = usePgs
      ? [
          {
            label: 'Песчано-гравийная смесь ПГС (подушка)',
            unit: 'м³',
            qty: geometry.beddingM3,
            price: groutPrice,
            note: `${formatNumber(geometry.beddingM2)} м² под подошвой`,
          },
        ]
      : [
          {
            label: 'Песок мытый (подушка, 40 %)',
            unit: 'м³',
            qty: Math.round(geometry.beddingM3 * 0.4 * 100) / 100,
            price: sandPrice,
            note: 'подстилающий слой под подошву',
          },
          {
            label: 'Щебень гранитный 5–20 (подушка, 60 %)',
            unit: 'м³',
            qty: Math.round(geometry.beddingM3 * 0.6 * 100) / 100,
            price: gravelPrice,
            note: 'отсев под подошву',
          },
        ];

    const lines = [
      {
        label: `Бетон ${mark.mark} (${mark.class}), с учётом уплотнения 1,05 и потерь ${CONCRETE_LOSS_PERCENT} %`,
        unit: 'м³',
        qty: geometry.volumeToOrderM3,
        price: concretePrice,
        note: `залито ${formatNumber(geometry.volumeM3, 3)} м³`,
      },
      {
        label: 'Опалубка (комплект)',
        unit: 'м²',
        qty: geometry.formworkM2,
        price: formworkPrice,
        note: 'развёртка примыканий',
      },
      ...beddingLines,
      ...(values.withXps === 'yes'
        ? [
            {
              label: 'Утепление XPS под лентой',
              unit: 'м³',
              qty: Math.round((type === 'slab' ? geometry.beddingM2 : geometry.beddingM2 * 0.5) * mmToM(100) * 100) / 100,
              price: xpsPrice,
              note: 'толщина 100 мм',
            },
          ]
        : []),
      {
        label: 'Работа: устройство фундамента',
        unit: 'м³',
        qty: geometry.volumeM3,
        price: workPrice,
        note: 'бетон, опалубка, распалубка',
      },
    ];

    const object =
      type === 'strip'
        ? `Лента ${formatM(geometry.planLengthM)} × ${formatNumber(geometry.planWidthM * 1000, 0)} мм${safeNum(values.stripsCount, 1) > 1 ? ` × ${formatInt(safeNum(values.stripsCount, 1))} полос` : ''}`
        : `Плита ${formatM(geometry.planLengthM)} × ${formatM(geometry.planWidthM)}`;

    const estimateText = buildEstimateText({
      title: feature.label,
      object,
      region,
      district: values.district as ConstructionDistrictKey,
      standard: 'СН 2.01.01-2019 (климатология РБ), СН 5.03.01-2018, СТБ EN 206-1',
      lines,
      totals: [
        {
          label: 'Глубина промерзания по СН 2.01.01-2019',
          value: `${formatM(frost.normativeM)} (грунт ×${soil?.factor ?? 1} → ${formatM(frost.adjustedM)})`,
        },
        {
          label: 'Рекомендуемая глубина заложения подошвы',
          value: formatM(frost.footingDepthM),
        },
        {
          label: 'Объём бетона в опалубке / к закупке',
          value: `${formatM3(geometry.volumeM3, 3)} / ${formatM3(geometry.volumeToOrderM3, 3)}`,
        },
        {
          label: 'Расход цемента ПЦ 400',
          value: `${formatKg(batch.cementKg)} (${formatInt(batch.cementBags50)} мешков по 50 кг)`,
        },
        {
          label: 'Пропорция бетонной смеси',
          value: batch.parts,
        },
      ],
      footer:
        'Цены — средние коммерческие по РБ, пересчитайте перед закупкой. Глубина заложения подошвы принята по нормативной глубине промерзания плюс 0,1 м.',
    });

    return { frost, geometry, batch, mark, lines, estimateText, soilFactor: soil?.factor ?? 1 };
  }, [values, region, feature.label]);

  const { frost, geometry, batch, mark, lines, estimateText, soilFactor } = result;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutoSaveBadge toolId={TOOL_ID} />
          <ResetDraftButton toolId={TOOL_ID} />
        </div>

        {/* ── Ввод ─────────────────────────────────────────────────────── */}
        <Card title="Геометрия фундамента" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <Segmented
              label="Тип фундамента"
              value={values.type}
              onChange={(value) => set({ type: value })}
              options={[
                { value: 'strip', label: 'Лента' },
                { value: 'slab', label: 'Плита' },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={values.type === 'slab' ? 'Длина плиты' : 'Длина ленты'}
                value={values.lengthM}
                onChange={(value) => set({ lengthM: value })}
                unit="м"
                placeholder="24"
              />
              <Field
                label="Ширина"
                value={values.widthMm}
                onChange={(value) => set({ widthMm: value })}
                unit="мм"
                placeholder="400"
              />
              <Field
                label={values.type === 'slab' ? 'Толщина плиты' : 'Глубина заложения'}
                value={values.depthMm}
                onChange={(value) => set({ depthMm: value })}
                unit="мм"
                placeholder={values.type === 'slab' ? '200' : '1500'}
              />
              {values.type === 'strip' ? (
                <Field
                  label="Число лент"
                  value={values.stripsCount}
                  onChange={(value) => set({ stripsCount: value })}
                  unit="шт"
                  placeholder="1"
                  hint="2 — лента с полостью, 4 — два дома"
                />
              ) : (
                <Field
                  label="Подстилающая подушка"
                  value={values.beddingMm}
                  onChange={(value) => set({ beddingMm: value })}
                  unit="мм"
                  placeholder="200"
                />
              )}
            </div>

            <StandardNote>
              Для ленты глубина бетона считается как заложение подошвы минус подушка и
              бетонная подготовка — сверху в бетон входит только то, что ниже линии промерзания.
            </StandardNote>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Грунт и промерзание" icon={<Snowflake className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <SelectField
                label="Область РБ"
                value={values.district}
                onChange={(value) => set({ district: value })}
                options={DISTRICT_OPTIONS}
                hint="Нормативная глубина промерзания нулевого граниса по СН 2.01.01-2019"
              />
              <SelectField
                label="Тип грунта под подошвой"
                value={values.soilType}
                onChange={(value) => set({ soilType: value })}
                options={SOIL_OPTIONS}
                hint="Поправка к глубине промерзания"
              />
              <StatGrid columns={2}>
                <Stat
                  label="Нормативная глубина"
                  value={formatNumber(frost.normativeM)}
                  unit="м"
                />
                <Stat
                  label="С поправкой на грунт"
                  value={formatNumber(frost.adjustedM)}
                  unit="м"
                  hint={`${SOIL_TYPE_FROST_FACTOR.find((s) => s.id === values.soilType)?.label} ×${soilFactor}`}
                />
                <Stat
                  label="Заложение подошвы"
                  value={formatNumber(frost.footingDepthM)}
                  unit="м"
                  accent
                  hint="Округлено вверх до 0,05 м"
                />
                <Stat
                  label="Запас на пучение"
                  value="0,10"
                  unit="м"
                  hint="Сверх нормативной глубины"
                />
              </StatGrid>
            </div>
          </Card>

          <Card title="Бетон и слои" icon={<Waves className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <SelectField
                label="Марка бетона (СТБ EN 206-1)"
                value={values.concreteMark}
                onChange={(value) => set({ concreteMark: value })}
                options={MARK_OPTIONS}
                hint={`${mark.frost} · расход цемента от ${mark.minCementKgM3} кг/м³`}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Подушка"
                  value={values.beddingMm}
                  onChange={(value) => set({ beddingMm: value })}
                  unit="мм"
                  placeholder="200"
                />
                <Field
                  label="Бетонная подготовка"
                  value={values.blindingMm}
                  onChange={(value) => set({ blindingMm: value })}
                  unit="мм"
                  placeholder="100"
                />
              </div>
              <Segmented
                label="Материал подушки"
                value={values.withPgs}
                onChange={(value) => set({ withPgs: value })}
                options={[
                  { value: 'yes', label: 'ПГС одной позицией' },
                  { value: 'no', label: 'Песок + щебень' },
                ]}
              />
              <Segmented
                label="Утепление XPS"
                value={values.withXps}
                onChange={(value) => set({ withXps: value })}
                options={[
                  { value: 'no', label: 'Не требуется' },
                  { value: 'yes', label: 'Под лентой, 100 мм' },
                ]}
              />
            </div>
          </Card>
        </div>

        {/* ── Живая схема ──────────────────────────────────────────────── */}
        <Card title="Схема сечения" icon={<Layers className="h-4 w-4" aria-hidden="true" />}>
          <FoundationScheme
            type={values.type === 'slab' ? 'slab' : 'strip'}
            widthM={geometry.planWidthM}
            depthM={values.type === 'slab' ? mmToM(safeNum(values.depthMm, 200)) : frost.footingDepthM}
            beddingM={mmToM(safeNum(values.beddingMm, 200))}
            blindingM={mmToM(safeNum(values.blindingMm, 100))}
            frostM={frost.adjustedM}
            volumeM3={geometry.volumeM3}
          />
        </Card>

        {/* ── Итоги ────────────────────────────────────────────────────── */}
        <Card title="Объём и материалы" icon={<Boxes className="h-4 w-4" aria-hidden="true" />}>
          <StatGrid columns={4}>
            <Stat label="Бетон в опалубке" value={formatNumber(geometry.volumeM3, 3)} unit="м³" />
            <Stat
              label="С уплотнением ×1,05"
              value={formatNumber(geometry.volumeCompactedM3, 3)}
              unit="м³"
              hint="Глубинный вибратор"
            />
            <Stat
              label="К закупке"
              value={formatNumber(geometry.volumeToOrderM3, 3)}
              unit="м³"
              accent
              hint={`+${CONCRETE_LOSS_PERCENT} % потери на подаче`}
            />
            <Stat label="Масса бетона" value={formatT(geometry.massKg / 1000, 2)} unit="т" />
          </StatGrid>

          <div className="mt-3">
            <StatGrid columns={2}>
              <Stat label="Опалубка" value={formatNumber(geometry.formworkM2)} unit="м²" />
              <Stat label="Подушка" value={formatNumber(geometry.beddingM3, 3)} unit="м³" />
              <Stat
                label="Цемент ПЦ 400"
                value={formatKg(batch.cementKg, 0)}
                hint={`${formatInt(batch.cementBags50)} мешков по 50 кг · ${batch.parts}`}
              />
              <Stat
                label="Песок и щебень"
                value={`${formatNumber(batch.sandM3)} / ${formatNumber(batch.gravelM3)}`}
                unit="м³"
                hint={`вода ${formatNumber(batch.waterL, 0)} л/м³`}
              />
            </StatGrid>
          </div>
        </Card>

        {/* ── Смета ────────────────────────────────────────────────────── */}
        <Card title="Смета в BYN">
          <div className="space-y-1">
            {lines.map((line, index) => (
              <EstimateRow
                key={`${line.label}-${index}`}
                label={line.label}
                qty={formatNumber(line.qty, line.qty >= 100 ? 0 : 2)}
                unit={line.unit}
                sum={formatByn(line.qty * line.price)}
                note={line.note}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kc-border-strong)] pt-4">
            <div>
              <span className="kc-stat-label">Всего по смете</span>
              <span className="block font-mono text-xl font-bold tabular-nums text-white">
                {formatByn(
                  lines.reduce((acc, line) => acc + line.qty * line.price, 0)
                )}
              </span>
            </div>
            <CopyEstimateButton text={estimateText} />
          </div>
        </Card>

        <StandardNote>
          Расчёт по средним коммерческим ценам РБ в BYN. Коэффициент уплотнения
          глубинным вибратором 1,05 и запас {CONCRETE_LOSS_PERCENT} % на потери при подаче
          заложены в объём «к закупке». Глубина промерзания — СН 2.01.01-2019, марки бетона —
          СТБ EN 206-1 (C12/15…C22/27), вибратор — регламент СН 5.03.01-2018.
        </StandardNote>
      </div>
    </SectionContentWrapper>
  );
}

/**
 * Живая схема сечения: пропорции линий пересчитываются из введённых чисел,
 * поэтому при смене глубины или ширины чертёж меняется вместе с расчётом.
 */
function FoundationScheme({
  type,
  widthM,
  depthM,
  beddingM,
  blindingM,
  frostM,
  volumeM3,
}: {
  type: 'strip' | 'slab';
  widthM: number;
  depthM: number;
  beddingM: number;
  blindingM: number;
  frostM: number;
  volumeM3: number;
}) {
  const VIEW_W = 420;
  const VIEW_H = 250;
  const GROUND_Y = 40;
  const CENTER_X = VIEW_W / 2;
  const MAX_DRAW_H = 165;
  const MAX_DRAW_W = 250;

  // Масштаб по глубине считается от большего значения, иначе схема «уезжает»
  // за границы при попытке показать и подошву, и линию промерзания.
  const depthSpan = Math.max(depthM, frostM, 1);
  const scaleY = MAX_DRAW_H / depthSpan;
  const scaleX = MAX_DRAW_W / Math.max(widthM, 0.3);

  const drawW = Math.max(18, Math.min(widthM * scaleX, MAX_DRAW_W));
  const bodyH = Math.max(10, depthM * scaleY);
  const beddingH = Math.max(4, beddingM * scaleY);
  const blindingH = Math.max(3, blindingM * scaleY);
  const frostY = GROUND_Y + Math.min(frostM * scaleY, MAX_DRAW_H + 14);

  const totalH = bodyH + beddingH + blindingH;
  const bodyTop = GROUND_Y + bodyH;
  const beddingTop = bodyTop + beddingH;
  const beddingBottom = beddingTop + blindingH;

  return (
    <Scheme
      caption={
        <>
          Сечение {type === 'slab' ? 'плиты' : 'ленты'}: бетон {formatNumber(depthM)} м, подушка{' '}
          {formatNumber(beddingM)} м, подготовка {formatNumber(blindingM)} м. Линия промерзания —{' '}
          {formatNumber(frostM)} м от земли. Объём бетона {formatM3(volumeM3, 3)}.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Схема сечения фундамента: ${type === 'slab' ? 'плита' : 'лента'} шириной ${formatNumber(widthM * 1000, 0)} миллиметров, глубина ${formatNumber(depthM)} метра`}
      >
        {/* Линия земли */}
        <line x1="0" y1={GROUND_Y} x2={VIEW_W} y2={GROUND_Y} stroke={SCHEME_STROKE} strokeWidth="2" />
        <text x="8" y={GROUND_Y - 8} fill={SCHEME_STROKE} fontSize="11">
          земля ±0,000
        </text>

        {/* Сетка грунта: даёт ощущение глубины */}
        {Array.from({ length: 6 }).map((_, index) => (
          <line
            key={index}
            x1={0}
            y1={GROUND_Y + 25 + index * 28}
            x2={VIEW_W}
            y2={GROUND_Y + 25 + index * 28}
            stroke={SCHEME_GRID}
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ))}

        {/* Бетонная подготовка */}
        <rect
          x={CENTER_X - drawW / 2 - 8}
          y={beddingTop}
          width={drawW + 16}
          height={blindingH}
          fill="none"
          stroke={SCHEME_GRID}
          strokeWidth="1.5"
        />

        {/* Подстилающая подушка */}
        <rect
          x={CENTER_X - drawW / 2 - 4}
          y={bodyTop}
          width={drawW + 8}
          height={beddingH}
          fill="rgba(255,255,255,0.08)"
          stroke={SCHEME_ACCENT}
          strokeWidth="1.5"
        />

        {/* Тело фундамента */}
        <rect
          x={CENTER_X - drawW / 2}
          y={GROUND_Y}
          width={drawW}
          height={bodyH}
          fill="rgba(255,255,255,0.14)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />

        {/* Арматурные сетки — по одной у верха и у низа тела */}
        {/*
          Арматурные сетки: защитный слой 40 мм сверху и снизу тела.
          Одинаковы для ленты и плиты — различается только расчёт шага,
          который делает отдельный инструмент «Арматура и нахлёсты».
        */}
        <line
          x1={CENTER_X - drawW / 2 + 4}
          y1={GROUND_Y + 10}
          x2={CENTER_X + drawW / 2 - 4}
          y2={GROUND_Y + 10}
          stroke={SCHEME_ACCENT}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1={CENTER_X - drawW / 2 + 4}
          y1={GROUND_Y + bodyH - 10}
          x2={CENTER_X + drawW / 2 - 4}
          y2={GROUND_Y + bodyH - 10}
          stroke={SCHEME_ACCENT}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Линия промерзания */}
        <line
          x1="0"
          y1={frostY}
          x2={VIEW_W}
          y2={frostY}
          stroke={SCHEME_ACCENT}
          strokeWidth="1.5"
          strokeDasharray="8 4"
        />
        <text x={VIEW_W - 8} y={frostY - 6} fill={SCHEME_ACCENT} fontSize="11" textAnchor="end">
          промерзание {formatNumber(frostM)} м
        </text>

        {/* Размерная линия ширины */}
        <line
          x1={CENTER_X - drawW / 2}
          y1={VIEW_H - 14}
          x2={CENTER_X + drawW / 2}
          y2={VIEW_H - 14}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <line
          x1={CENTER_X - drawW / 2}
          y1={VIEW_H - 19}
          x2={CENTER_X - drawW / 2}
          y2={VIEW_H - 9}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <line
          x1={CENTER_X + drawW / 2}
          y1={VIEW_H - 19}
          x2={CENTER_X + drawW / 2}
          y2={VIEW_H - 9}
          stroke={SCHEME_STROKE}
          strokeWidth="1"
        />
        <text
          x={CENTER_X}
          y={VIEW_H - 22}
          fill={SCHEME_STROKE}
          fontSize="11"
          textAnchor="middle"
        >
          {formatNumber(widthM * 1000, 0)} мм · глубина бетона {formatNumber(totalH > 0 ? depthM : 0)} м
        </text>

        {/* Подпись объёма внутри бетона */}
        <text
          x={CENTER_X}
          y={GROUND_Y + bodyH / 2 + 4}
          fill={SCHEME_STROKE}
          fontSize="11"
          textAnchor="middle"
        >
          {formatM3(volumeM3, 2)}
        </text>
      </svg>
    </Scheme>
  );
}