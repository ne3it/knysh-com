'use client';

import React, { useMemo } from 'react';
import { Home, Layers, Ruler, TreePine } from 'lucide-react';
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
  BATTEN_STEP_OPTIONS_M,
  LUMBER_STANDARD_LENGTH_M,
  RAFTER_BOARD,
  RAFTER_STEP_OPTIONS_M,
  ROOF_MIN_SLOPE_PERCENT,
  ROOF_SLOPES,
  buildEstimateText,
  computeRoof,
  formatByn,
  formatInt,
  formatM,
  formatM2,
  formatNumber,
  getPrice,
  plural,
  safeNum,
} from '@/lib/construction';
import { useConstructionForm, useConstructionRegion } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-roof';

const DEFAULTS = {
  shape: 'gable',
  material: 'metal',
  spanM: '8',
  lengthM: '10',
  slopePercent: '20',
  ridgeHeightM: '',
  overhangM: '0,5',
  rafterStepM: '0,9',
  battenStepM: '0,3',
  insulationMm: '200',
  withOsb: 'yes',
  withGutter: 'yes',
};

const MATERIAL_OPTIONS = ROOF_SLOPES.map((slope) => ({
  value: slope.id,
  label: `${slope.label} — от ${slope.min} % (типично ${slope.typical} %)`,
}));

const RAFTER_STEP_OPTIONS = RAFTER_STEP_OPTIONS_M.map((step) => ({
  value: String(step),
  label: `${formatNumber(step)} м`,
}));

const BATTEN_STEP_OPTIONS = BATTEN_STEP_OPTIONS_M.map((item) => ({
  value: String(item.stepM),
  label: `${item.label} — ${formatNumber(item.stepM)} м`,
}));

export default function RoofCalculator({ feature }: { feature: Feature }) {
  const { values, set } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    const shape = values.shape === 'hip' ? ('hip' as const) : ('gable' as const);
    const material = ROOF_SLOPES.find((item) => item.id === values.material) ?? ROOF_SLOPES[1];
    const spanM = safeNum(values.spanM);
    const lengthM = safeNum(values.lengthM);

    /*
      Уклон вводится числом, но при смене кровельного материала подставляется
      его типичный уклон. Минимум ограничен снизу: при плоском скате вода стоит
      на кровле, а это не кровля, а лужа.
    */
    const slopePct = Math.max(ROOF_MIN_SLOPE_PERCENT, safeNum(values.slopePercent, material.typical));
    const ridgeFromSlope = (spanM / 2) * (slopePct / 100);
    const ridgeHeightM = safeNum(values.ridgeHeightM, 0) || ridgeFromSlope;

    const roof = computeRoof({
      spanM,
      lengthM,
      ridgeHeightM,
      slopePercent: slopePct,
      overhangM: safeNum(values.overhangM, 0.5),
      shape,
      rafterStepM: safeNum(values.rafterStepM, 0.9),
      battenStepM: safeNum(values.battenStepM, 0.3),
      insulationMm: safeNum(values.insulationMm, 200),
    });

    /* ---- Пиломатериал в штуках: меряется стандартной длиной 5,5 м ---- */
    const rafterBoardCount = Math.ceil(
      (roof.raftersCount * roof.slopeLengthM * 1.05) / LUMBER_STANDARD_LENGTH_M
    );
    // Обрешётка: ряды идут поперёк ската с шагом по длине ската, каждый ряд
    // равен ширине ската (длина дома со свесами). Отсюда и число брусков.
    const battenStep = Math.max(0.2, safeNum(values.battenStepM, 0.3));
    const battenRows = Math.ceil(roof.slopeLengthM / battenStep);
    const battenCount = Math.ceil((battenRows * roof.slopeWidthM) / LUMBER_STANDARD_LENGTH_M);

    const rafterPrice = getPrice('rafterBoard', region);
    const battenPrice = getPrice('battenBoard', region);
    const osbPrice = getPrice('osb', region);
    const membranePrice = getPrice('membrane', region);
    const metalPrice = getPrice('profiledMetal', region);
    const gutterPrice = getPrice('gutterSystem', region);
    const xpsPrice = getPrice('xps', region);
    const workPrice = getPrice('workRoof', region);

    const underlayAreaM2 = roof.underlaymentAreaM2;

    const lines = [
      {
        label: `Стропильная доска ${RAFTER_BOARD.widthMm}×${RAFTER_BOARD.thicknessMm} мм`,
        unit: 'м³',
        qty: roof.rafterVolumeM3,
        price: rafterPrice,
        note: `${formatInt(roof.raftersCount)} шт по ${formatNumber(roof.slopeLengthM)} м · ${rafterBoardCount} досок по 5,5 м · шаг ${formatNumber(roof.rafterStepM)} м`,
      },
      {
        label: 'Брусок обрешётки 50×50 мм',
        unit: 'м³',
        qty: roof.battenVolumeM3,
        price: battenPrice,
        note: `шаг ${formatNumber(safeNum(values.battenStepM, 0.3))} м · ${formatInt(battenCount)} брусков`,
      },
      {
        label: 'Наплавляемая мембрана / рубероид (пирог)',
        unit: 'м²',
        qty: underlayAreaM2,
        price: membranePrice,
        note: '+15 % на нахлёсты',
      },
      {
        label: 'Материал кровли (профнастил / металлочерепица)',
        unit: 'м²',
        qty: roof.totalAreaM2,
        price: metalPrice,
        note: material.label,
      },
      ...(values.withOsb === 'yes'
        ? [
            {
              label: 'Плита OSB/3 (основание под металл)',
              unit: 'м²',
              qty: underlayAreaM2,
              price: osbPrice,
              note: 'толщина 12 мм',
            },
          ]
        : []),
      ...(values.withGutter === 'yes'
        ? [
            {
              label: 'Водосточная система',
              unit: 'пог. м',
              qty: roof.eavesLengthM,
              price: gutterPrice,
              note: 'два ската',
            },
          ]
        : []),
      {
        label: 'Утеплитель XPS в кровельном пироге',
        unit: 'м³',
        qty: roof.insulationM3,
        price: xpsPrice,
        note: `${formatNumber(safeNum(values.insulationMm, 200))} мм по площади скатов`,
      },
      {
        label: 'Работа: монтаж стропильной системы и кровли',
        unit: 'м²',
        qty: roof.totalAreaM2,
        price: workPrice,
      },
    ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object: `${shape === 'hip' ? 'Вальмовая' : 'Двускатная'} кровля: пролёт ${formatM(spanM)}, длина ${formatM(lengthM)}, свес ${formatNumber(safeNum(values.overhangM, 0.5))} м`,
      region,
      standard: 'СП 4.13330 (расчётные нагрузки), СП 20.13330 (уклоны и свесы)',
      lines,
      totals: [
        { label: 'Уклон ската', value: `${formatNumber(roof.slopePercent)} % = ${formatNumber(roof.slopeAngleDeg, 1)}°` },
        { label: 'Высота конька', value: formatM(ridgeHeightM) },
        { label: 'Длина ската (стропило)', value: formatM(roof.slopeLengthM) },
        { label: 'Прямоугольная часть (трапеции)', value: formatM2(roof.trapezoidAreaM2) },
        { label: 'Треугольные свесы фронтонов', value: formatM2(roof.triangleAreaM2) },
        { label: 'Общая площадь кровли', value: formatM2(roof.totalAreaM2) },
        { label: 'Стропил', value: `${formatInt(roof.raftersCount)} шт с шагом ${formatNumber(roof.rafterStepM)} м` },
      ],
      footer:
        'Площадь кровли включает прямоугольную часть скатов и треугольные свесы фронтонов — обычно их забывают, а это 5–7 % площади на небольших домах. Уклон не может быть ниже 10 %.',
    });

    return { shape, material, roof, lines, estimateText, ridgeHeightM, slopePct };
  }, [values, region, feature.label]);

  const { shape, material, roof, lines, estimateText, ridgeHeightM, slopePct } = result;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutoSaveBadge toolId={TOOL_ID} />
          <ResetDraftButton toolId={TOOL_ID} />
        </div>

        <Card title="Дом и форма кровли" icon={<Home className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <Segmented
              label="Форма кровли"
              value={values.shape}
              onChange={(value) => set({ shape: value })}
              options={[
                { value: 'gable', label: 'Двускатная' },
                { value: 'hip', label: 'Вальмовая (4 ската)' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Пролёт здания"
                value={values.spanM}
                onChange={(value) => set({ spanM: value })}
                unit="м"
                placeholder="8"
                hint="Ширина дома по фронтону"
              />
              <Field
                label="Длина здания"
                value={values.lengthM}
                onChange={(value) => set({ lengthM: value })}
                unit="м"
                placeholder="10"
              />
              <Field
                label="Ширина свеса"
                value={values.overhangM}
                onChange={(value) => set({ overhangM: value })}
                unit="м"
                placeholder="0,5"
                hint="Норма для РБ — 0,5 м"
              />
              <Field
                label="Высота конька"
                value={values.ridgeHeightM}
                onChange={(value) => set({ ridgeHeightM: value })}
                unit="м"
                placeholder={formatNumber((safeNum(values.spanM) / 2) * (slopePct / 100))}
                hint="Пусто = считать от уклона"
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Кровельный материал и уклон" icon={<Layers className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <SelectField
                label="Материал кровли"
                value={values.material}
                onChange={(value) => {
                  const found = ROOF_SLOPES.find((item) => item.id === value);
                  // Смена материала подтягивает его типичный уклон: под черепицу
                  // кровля круче, иначе вода идёт под крепёж.
                  set({ material: value, slopePercent: String(found?.typical ?? values.slopePercent) });
                }}
                options={MATERIAL_OPTIONS}
              />
              <Field
                label="Уклон ската"
                value={values.slopePercent}
                onChange={(value) => set({ slopePercent: value })}
                unit="%"
                placeholder={String(material.typical)}
                hint={`Не ниже ${ROOF_MIN_SLOPE_PERCENT} %, у ${material.label.toLowerCase()} — от ${material.min} %`}
              />
              <StatGrid columns={2}>
                <Stat label="Угол ската" value={formatNumber(roof.slopeAngleDeg, 1)} unit="°" />
                <Stat label="Длина стропила" value={formatNumber(roof.slopeLengthM)} unit="м" accent />
              </StatGrid>
            </div>
          </Card>

          <Card title="Шаги и пирог" icon={<TreePine className="h-4 w-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <SelectField
                label="Шаг стропил"
                value={values.rafterStepM}
                onChange={(value) => set({ rafterStepM: value })}
                options={RAFTER_STEP_OPTIONS}
                hint="При пролёте до 3 м — 0,6–0,9 м"
              />
              <SelectField
                label="Шаг обрешётки"
                value={values.battenStepM}
                onChange={(value) => set({ battenStepM: value })}
                options={BATTEN_STEP_OPTIONS}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Утеплитель"
                  value={values.insulationMm}
                  onChange={(value) => set({ insulationMm: value })}
                  unit="мм"
                  placeholder="200"
                />
                <Segmented
                  label="Подложка OSB"
                  value={values.withOsb}
                  onChange={(value) => set({ withOsb: value })}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
              </div>
              <Segmented
                label="Водосточная система"
                value={values.withGutter}
                onChange={(value) => set({ withGutter: value })}
                options={[
                  { value: 'yes', label: 'Да' },
                  { value: 'no', label: 'Нет' },
                ]}
              />
            </div>
          </Card>
        </div>

        <Card title="Схема скатов" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <RoofScheme
            shape={shape}
            spanM={safeNum(values.spanM)}
            lengthM={safeNum(values.lengthM)}
            ridgeHeightM={ridgeHeightM}
            overhangM={safeNum(values.overhangM, 0.5)}
            slopePercentResult={roof.slopePercent}
            slopeLength={roof.slopeLengthM}
            totalAreaM2={roof.totalAreaM2}
            triangleAreaM2={roof.triangleAreaM2}
          />
        </Card>

        <Card title="Площади и конструкция">
          <StatGrid columns={4}>
            <Stat
              label="Трапеции скатов"
              value={formatNumber(roof.trapezoidAreaM2)}
              unit="м²"
              hint={`${roof.slopesCount} ${plural(roof.slopesCount, ['скат', 'ската', 'скатов'])}`}
            />
            <Stat
              label="Треугольные свесы"
              value={formatNumber(roof.triangleAreaM2)}
              unit="м²"
              hint={
                roof.totalAreaM2 > 0
                  ? `${formatNumber((roof.triangleAreaM2 / roof.totalAreaM2) * 100, 1)} % площади`
                  : undefined
              }
            />
            <Stat label="Всего кровли" value={formatNumber(roof.totalAreaM2)} unit="м²" accent />
            <Stat label="Конёк" value={formatNumber(roof.ridgeLengthM)} unit="м" />
          </StatGrid>

          <div className="mt-3">
            <StatGrid columns={2}>
              <Stat
                label="Стропил"
                value={`${formatInt(roof.raftersCount)} шт`}
                hint={`шаг ${formatNumber(roof.rafterStepM)} м · ${formatNumber(roof.slopeLengthM)} м каждое`}
              />
              <Stat label="Объём стропил" value={formatNumber(roof.rafterVolumeM3, 3)} unit="м³" />
              <Stat
                label="Объём обрешётки"
                value={formatNumber(roof.battenVolumeM3, 3)}
                unit="м³"
                hint={`шаг ${formatNumber(safeNum(values.battenStepM, 0.3))} м`}
              />
              <Stat
                label="Пирог с нахлёстами"
                value={formatNumber(roof.underlaymentAreaM2)}
                unit="м²"
                hint="кровля +15 % на нахлёсты"
              />
            </StatGrid>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-[var(--kc-muted)]">
            Расчётный уклон {formatNumber(slopePct)} % даёт высоту конька{' '}
            {formatNumber(ridgeHeightM)} м при пролёте {formatNumber(safeNum(values.spanM))} м.
          </p>
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
          Треугольные свесы фронтонов считаются отдельно от прямоугольной части
          скатов: на домах с небольшим пролётом это 5–7 % площади кровли, и они
          чаще всего «теряются» в ручном расчёте. Уклон кровли не может быть ниже{' '}
          {ROOF_MIN_SLOPE_PERCENT} %, иначе вода стоит на скате.
        </StandardNote>
      </div>
    </SectionContentWrapper>
  );
}

/**
 * Фасад дома со скатами: конёк, стропильные ноги, свесы и треугольник фронтона.
 * Пропорции пересчитываются из введённых чисел, поэтому при смене пролёта или
 * уклона чертёж меняется вместе с расчётом.
 */
function RoofScheme({
  shape,
  spanM,
  lengthM,
  ridgeHeightM,
  overhangM,
  slopePercentResult,
  slopeLength,
  totalAreaM2,
  triangleAreaM2,
}: {
  shape: 'gable' | 'hip';
  spanM: number;
  lengthM: number;
  ridgeHeightM: number;
  overhangM: number;
  slopePercentResult: number;
  slopeLength: number;
  totalAreaM2: number;
  triangleAreaM2: number;
}) {
  const VIEW_W = 420;
  const VIEW_H = 230;
  const WALL_Y = 170;
  const SCALE = Math.min(340 / Math.max(spanM + overhangM * 2, 1), 300 / Math.max(ridgeHeightM + 8, 1));
  const CENTER = VIEW_W / 2;
  const halfSpan = (spanM / 2) * SCALE;
  const eaveX = halfSpan + overhangM * SCALE;
  const ridgeY = WALL_Y - Math.max(6, ridgeHeightM * SCALE);

  return (
    <Scheme
      caption={
        <>
          {shape === 'hip' ? 'Вальмовая' : 'Двускатная'} кровля: пролёт {formatNumber(spanM)} м,
          конёк {formatNumber(ridgeHeightM)} м, уклон {formatNumber(slopePercentResult)} %, свес{' '}
          {formatNumber(overhangM)} м. Стропило {formatNumber(slopeLength)} м. Кровля{' '}
          {formatM2(totalAreaM2)}, из них треугольные свесы {formatM2(triangleAreaM2)}.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Схема кровли: ${shape === 'hip' ? 'вальмовая' : 'двускатная'}, уклон ${formatNumber(slopePercentResult)} процента, площадь ${formatNumber(totalAreaM2)} квадратных метров`}
      >
        {/* Стены дома */}
        <rect
          x={CENTER - halfSpan}
          y={WALL_Y}
          width={halfSpan * 2}
          height={46}
          fill="rgba(255,255,255,0.06)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />
        <line
          x1={CENTER - halfSpan}
          y1={WALL_Y}
          x2={CENTER + halfSpan}
          y2={WALL_Y}
          stroke={SCHEME_GRID}
          strokeWidth="1"
        />

        {/* Стропильные ноги */}
        <line
          x1={CENTER - eaveX}
          y1={ridgeY + Math.abs(WALL_Y - ridgeY) * (overhangM / Math.max(spanM / 2, 0.01))}
          x2={CENTER}
          y2={ridgeY}
          stroke={SCHEME_STROKE}
          strokeWidth="2.5"
        />
        <line
          x1={CENTER}
          y1={ridgeY}
          x2={CENTER + eaveX}
          y2={ridgeY + Math.abs(WALL_Y - ridgeY) * (overhangM / Math.max(spanM / 2, 0.01))}
          stroke={SCHEME_STROKE}
          strokeWidth="2.5"
        />

        {/* Покрытие кровли (свес выступает за стену) */}
        <line
          x1={CENTER - eaveX}
          y1={ridgeY + Math.abs(WALL_Y - ridgeY) * (overhangM / Math.max(spanM / 2, 0.01))}
          x2={CENTER + eaveX}
          y2={ridgeY + Math.abs(WALL_Y - ridgeY) * (overhangM / Math.max(spanM / 2, 0.01))}
          stroke={SCHEME_ACCENT}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Обрешётка — перпендикулярные чёрточки на скате */}
        {Array.from({ length: 7 }).map((_, index) => {
          const t = (index + 1) / 8;
          const x = CENTER - halfSpan * (1 - t);
          const y = WALL_Y - (WALL_Y - ridgeY) * (1 - t);
          return (
            <line
              key={`batten-${index}`}
              x1={x}
              y1={y - 4}
              x2={x}
              y2={y + 4}
              stroke={SCHEME_GRID}
              strokeWidth="1.5"
            />
          );
        })}

        {/* Конёк */}
        <line
          x1={CENTER}
          y1={ridgeY - 5}
          x2={CENTER + Math.min(lengthM * 0.18, 40)}
          y2={ridgeY - 5}
          stroke={SCHEME_ACCENT}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Заливка треугольника фронтона */}
        <path
          d={`M ${CENTER - halfSpan} ${WALL_Y} L ${CENTER} ${ridgeY} L ${CENTER + halfSpan} ${WALL_Y} Z`}
          fill="rgba(168,180,140,0.10)"
        />

        {/* Подписи */}
        <text x={CENTER} y={WALL_Y + 16} fill={SCHEME_STROKE} fontSize="11" textAnchor="middle">
          дом {formatNumber(spanM)} × {formatNumber(lengthM)} м
        </text>
        <text x={CENTER} y={ridgeY - 10} fill={SCHEME_ACCENT} fontSize="11" textAnchor="middle">
          конёк {formatNumber(ridgeHeightM)} м · уклон {formatNumber(slopePercentResult)} %
        </text>
        <text x={CENTER} y={WALL_Y + 32} fill={SCHEME_STROKE} fontSize="10" textAnchor="middle">
          стропило {formatNumber(slopeLength)} м · свес {formatNumber(overhangM)} м
        </text>
      </svg>
    </Scheme>
  );
}