'use client';

import React, { useMemo } from 'react';
import { Blocks, Hammer, Layers3, Ruler } from 'lucide-react';
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
  BLOCK_MANUFACTURERS,
  BLOCK_SIZES,
  BLOCK_VOLUME_M3,
  BREAKAGE_DEFAULT_PERCENT,
  BREAKAGE_MAX_PERCENT,
  BREAKAGE_MIN_PERCENT,
  JOINT_THICKNESS_MAX_MM,
  JOINT_THICKNESS_MIN_MM,
  MORTAR_KG_PER_M3,
  OPENING_CUT_WASTE_PERCENT,
  STANDARD_OPENINGS,
  buildEstimateText,
  computeMasonry,
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
  type BlockSizeKey,
  type WallOpening,
} from '@/lib/construction';
import { useConstructionForm, useConstructionRegion } from '@/lib/store/constructionStore';
import type { Feature } from '@/types/section';

const TOOL_ID = 'const-blocks';

const DEFAULTS = {
  blockSize: '625x300x200',
  manufacturer: 'zabudova',
  lengthM: '12',
  heightM: '3',
  jointMm: '2',
  breakagePercent: String(BREAKAGE_DEFAULT_PERCENT),
  open1Type: 'window-1214',
  open1Count: '3',
  open2Type: 'door-0921',
  open2Count: '1',
  open3Type: 'none',
  open3Count: '1',
  openCustom: 'no',
  customW: '1200',
  customH: '2100',
  customN: '1',
};

/** Ключ цены блоков по типоразмеру */
const BLOCK_PRICE_KEY = {
  '625x300x200': 'blocks625x300x200',
  '625x400x200': 'blocks625x400x200',
  '500x300x250': 'blocks500x300x250',
} as const;

const SIZE_OPTIONS = (Object.keys(BLOCK_SIZES) as BlockSizeKey[]).map((key) => {
  const size = BLOCK_SIZES[key];
  return {
    value: key,
    label: `${size.lengthMm}×${size.widthMm}×${size.heightMm} мм · ${formatNumber(
      BLOCK_VOLUME_M3[key],
      4
    )} м³/шт`,
  };
});

const MANUFACTURER_OPTIONS = BLOCK_MANUFACTURERS.map((maker) => ({
  value: maker.id,
  label: `${maker.name} — ${maker.material}, D${maker.densityKgM3}`,
}));

const OPENING_OPTIONS = [
  { value: 'none', label: '— нет проёма —' },
  ...STANDARD_OPENINGS.map((opening) => ({
    value: opening.id,
    label: `${opening.label} (${formatMm(opening.widthMm)}×${formatMm(opening.heightMm)})`,
  })),
];

/** Три стандартных проёма + один произвольный по размерам */
const OPENING_SLOTS = [
  { type: 'open1Type', count: 'open1Count' },
  { type: 'open2Type', count: 'open2Count' },
  { type: 'open3Type', count: 'open3Count' },
] as const;

export default function BlocksCalculator({ feature }: { feature: Feature }) {
  const { values, set } = useConstructionForm(TOOL_ID, DEFAULTS);
  const region = useConstructionRegion();

  const result = useMemo(() => {
    // values.blockSize приходит из стора как строка, поэтому проверяем ключ
    // по-настоящему, а не полагаемся на доверие к сохранённому значению.
    const selectedSize = values.blockSize as BlockSizeKey;
    const blockSize: BlockSizeKey = selectedSize in BLOCK_SIZES ? selectedSize : '625x300x200';
    const size = BLOCK_SIZES[blockSize];

    /* ---- Проёмы: стандартные по СН + произвольный ---- */
    const openings: WallOpening[] = [];
    OPENING_SLOTS.forEach((slot) => {
      const preset = STANDARD_OPENINGS.find((opening) => opening.id === values[slot.type]);
      if (!preset) return;
      openings.push({
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        count: Math.max(0, safeNum(values[slot.count], 1)),
        label: preset.label,
      });
    });
    if (values.openCustom === 'yes') {
      openings.push({
        widthMm: safeNum(values.customW, 1200),
        heightMm: safeNum(values.customH, 2100),
        count: Math.max(0, safeNum(values.customN, 1)),
        label: 'Проём по введённым размерам',
      });
    }

    const masonry = computeMasonry({
      lengthM: safeNum(values.lengthM),
      heightM: safeNum(values.heightM),
      blockSize,
      openings,
      breakagePercent: safeNum(values.breakagePercent, BREAKAGE_DEFAULT_PERCENT),
      jointMm: safeNum(values.jointMm, JOINT_THICKNESS_MIN_MM),
    });

    /* ---- Смета в BYN ---- */
    const blockPrice = getPrice(BLOCK_PRICE_KEY[blockSize], region);
    const mortarPrice = getPrice('mortarBag25', region);
    const deliveryPrice = getPrice('blockDelivery', region);
    const workPrice = getPrice('workMasonry', region);
    const maker = BLOCK_MANUFACTURERS.find((item) => item.id === values.manufacturer);

    // Блоки в смете считаем по метрам кубическим — так их и покупают.
    // Объём закупки = блоки к закупке × кубатура блока.
    const orderVolumeM3 =
      masonry.blocksToOrder * BLOCK_VOLUME_M3[blockSize];

    const lines = [
      {
        label: `Блоки ${size.lengthMm}×${size.widthMm}×${size.heightMm} (${maker?.name ?? 'завод РБ'})`,
        unit: 'м³',
        qty: orderVolumeM3,
        price: blockPrice,
        note: `${pluralize(masonry.blocksToOrder, PLURALS.block)} с запасом ${masonry.breakageAppliedPercent} % · ${pluralize(
          masonry.palletsCount,
          PLURALS.pallet
        )}`,
      },
      {
        label: 'Клеевая смесь для кладки',
        unit: 'мешок 25 кг',
        qty: masonry.mortarBags,
        price: mortarPrice,
        note: `${formatKg(masonry.mortarKg, 0)} · норма ${MORTAR_KG_PER_M3} кг/м³ кладки`,
      },
      {
        label: 'Доставка блоков манипулятором',
        unit: 'м³',
        qty: orderVolumeM3,
        price: deliveryPrice,
      },
      {
        label: 'Работа: кладка блоков на тонкий шов',
        unit: 'м³',
        qty: masonry.netVolumeM3,
        price: workPrice,
      },
    ];

    const estimateText = buildEstimateText({
      title: feature.label,
      object: `Стена ${formatNumber(masonry.grossAreaM2)} м², блок ${size.lengthMm}×${size.widthMm}×${size.heightMm} мм`,
      region,
      standard: 'СТБ 1417-2008 (блоки газобетонные), СН 2.03.01 (проёмы)',
      lines,
      totals: [
        { label: 'Объём кладки без проёмов', value: formatM3(masonry.grossVolumeM3, 3) },
        { label: 'Проёмы (вычет)', value: `${formatM2(masonry.openingsAreaM2)} · вырубка +${OPENING_CUT_WASTE_PERCENT} %` },
        { label: 'Чистый объём кладки', value: formatM3(masonry.netVolumeM3, 3) },
        {
          label: 'Блоков по рядам / по кубатуре',
          value: `${formatInt(masonry.blocksByRows)} / ${formatInt(masonry.blocksByVolume)} — взято большее`,
        },
        { label: 'К закупке с запасом', value: `${pluralize(masonry.blocksToOrder, PLURALS.block)}` },
        { label: 'Клея', value: `${formatKg(masonry.mortarKg, 0)} = ${pluralize(masonry.mortarBags, PLURALS.bag)}` },
      ],
      footer: `Запас на бой и подрезку ${masonry.breakageAppliedPercent} % (норматив ${BREAKAGE_MIN_PERCENT}–${BREAKAGE_MAX_PERCENT} %). Расход клея ${MORTAR_KG_PER_M3} кг на 1 м³ кладки при шве ${safeNum(values.jointMm, JOINT_THICKNESS_MIN_MM)} мм.`,
    });

    return { blockSize, size, masonry, openings, lines, estimateText, orderVolumeM3 };
  }, [values, region, feature.label]);

  const { blockSize, size, masonry, openings, lines, estimateText, orderVolumeM3 } = result;

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutoSaveBadge toolId={TOOL_ID} />
          <ResetDraftButton toolId={TOOL_ID} />
        </div>

        <Card title="Блок и стена" icon={<Blocks className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            <SelectField
              label="Типоразмер блока ( заводы РБ)"
              value={values.blockSize}
              onChange={(value) => set({ blockSize: value })}
              options={SIZE_OPTIONS}
              hint="Все три размера реально возят с Забудовы, Красносельскстройматериалов и МКСИ"
            />
            <SelectField
              label="Завод-изготовитель"
              value={values.manufacturer}
              onChange={(value) => set({ manufacturer: value })}
              options={MANUFACTURER_OPTIONS}
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
                label="Высота кладки"
                value={values.heightM}
                onChange={(value) => set({ heightM: value })}
                unit="м"
                placeholder="3"
              />
              <Field
                label="Толщина шва"
                value={values.jointMm}
                onChange={(value) => set({ jointMm: value })}
                unit="мм"
                placeholder="2"
                hint={`Тонкий шов ${JOINT_THICKNESS_MIN_MM}–${JOINT_THICKNESS_MAX_MM} мм`}
              />
              <Field
                label="Запас на бой и подрезку"
                value={values.breakagePercent}
                onChange={(value) => set({ breakagePercent: value })}
                unit="%"
                placeholder={String(BREAKAGE_DEFAULT_PERCENT)}
                hint={`Норматив ${BREAKAGE_MIN_PERCENT}–${BREAKAGE_MAX_PERCENT} %`}
              />
            </div>
          </div>
        </Card>

        <Card title="Проёмы (вычет по СН)" icon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
          <div className="space-y-3">
            {OPENING_SLOTS.map((slot, index) => (
              <div
                key={slot.type}
                className="grid grid-cols-[1fr_5rem] items-end gap-2 sm:grid-cols-[1fr_6rem]"
              >
                <SelectField
                  label={`Проём ${index + 1}`}
                  value={values[slot.type]}
                  onChange={(value) => set({ [slot.type]: value } as Partial<typeof DEFAULTS>)}
                  options={OPENING_OPTIONS}
                />
                <Field
                  label="Кол-во"
                  value={values[slot.count]}
                  onChange={(value) => set({ [slot.count]: value } as Partial<typeof DEFAULTS>)}
                  unit="шт"
                  placeholder="0"
                  className="min-w-0"
                />
              </div>
            ))}

            <Segmented
              label="Проём нестандартного размера"
              value={values.openCustom}
              onChange={(value) => set({ openCustom: value })}
              options={[
                { value: 'no', label: 'Не нужен' },
                { value: 'yes', label: 'Добавить по размерам' },
              ]}
            />

            {values.openCustom === 'yes' && (
              <div className="grid grid-cols-3 gap-3">
                <Field
                  label="Ширина"
                  value={values.customW}
                  onChange={(value) => set({ customW: value })}
                  unit="мм"
                />
                <Field
                  label="Высота"
                  value={values.customH}
                  onChange={(value) => set({ customH: value })}
                  unit="мм"
                />
                <Field
                  label="Кол-во"
                  value={values.customN}
                  onChange={(value) => set({ customN: value })}
                  unit="шт"
                />
              </div>
            )}

            <StandardNote>
              Проёмы вычитаются и из площади стены, и из числа блоков. На вырубку
              добавляется {OPENING_CUT_WASTE_PERCENT} % отходов — это подрезка краёв
              проёма, которая в смете всегда идёт отдельной строкой.
            </StandardNote>
          </div>
        </Card>

        <Card title="Схема кладки" icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}>
          <WallScheme
            lengthM={safeNum(values.lengthM)}
            heightM={safeNum(values.heightM)}
            rows={masonry.rowsCount}
            blocksPerRow={masonry.blocksPerRow}
            openings={openings}
            blockSize={blockSize}
          />
        </Card>

        <Card title="Блоки и клей" icon={<Hammer className="h-4 w-4" aria-hidden="true" />}>
          <StatGrid columns={4}>
            <Stat label="Площадь стены" value={formatNumber(masonry.grossAreaM2)} unit="м²" />
            <Stat label="Проёмы" value={formatNumber(masonry.openingsAreaM2)} unit="м²" hint={`−${OPENING_CUT_WASTE_PERCENT} % на вырубку`} />
            <Stat label="Чистый объём" value={formatNumber(masonry.netVolumeM3, 3)} unit="м³" accent />
            <Stat
              label="К закупке"
              value={pluralize(masonry.blocksToOrder, PLURALS.block)}
              hint={`+${masonry.breakageAppliedPercent} % · ${pluralize(masonry.palletsCount, PLURALS.pallet)}`}
            />
          </StatGrid>

          <div className="mt-3">
            <StatGrid columns={2}>
              <Stat
                label="Блоков по рядам"
                value={formatInt(masonry.blocksByRows)}
                hint={`${masonry.rowsCount} ${pluralize(masonry.rowsCount, PLURALS.row)} × ${masonry.blocksPerRow} в ряду`}
              />
              <Stat
                label="Блоков по кубатуре"
                value={formatInt(masonry.blocksByVolume)}
                hint={`${formatNumber(BLOCK_VOLUME_M3[blockSize], 4)} м³/шт`}
              />
              <Stat label="Клей" value={formatKg(masonry.mortarKg, 0)} hint={`${MORTAR_KG_PER_M3} кг/м³ кладки`} />
              <Stat label="Мешков клея" value={pluralize(masonry.mortarBags, PLURALS.bag)} hint="по 25 кг" />
            </StatGrid>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-[var(--kc-muted)]">
            Объём закупки блоков {formatM3(orderVolumeM3, 3)} — считается от числа блоков с
            запасом, а не от чистого объёма кладки.
          </p>
        </Card>

        <Card title="Смета в BYN">
          <div className="space-y-1">
            {lines.map((line, index) => (
              <EstimateRow
                key={`${line.label}-${index}`}
                label={line.label}
                qty={formatNumber(line.qty, line.qty >= 100 ? 0 : 3)}
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
 * Фасад кладки: ряды, вертикальные стыки со смещением (перевязка) и проёмы
 * белыми прямоугольниками. Число рядов и стыков берётся из расчёта, поэтому
 * при смене высоты стены схема меняет пропорции.
 */
function WallScheme({
  lengthM,
  heightM,
  rows,
  blocksPerRow,
  openings,
  blockSize,
}: {
  lengthM: number;
  heightM: number;
  rows: number;
  blocksPerRow: number;
  openings: WallOpening[];
  blockSize: BlockSizeKey;
}) {
  const VIEW_W = 420;
  const WALL_X = 24;
  const WALL_Y = 34;
  const WALL_W = 372;
  const WALL_H = 150;
  const VIEW_H = WALL_Y + WALL_H + 46;

  const size = BLOCK_SIZES[blockSize];
  const rowGapPx = WALL_H / Math.max(1, Math.min(rows, 15));
  const visibleRows = Math.max(1, Math.min(rows, 15));
  const visiblePerRow = Math.max(1, Math.min(blocksPerRow, 12));
  const blockGapPx = WALL_W / visiblePerRow;

  return (
    <Scheme
      caption={
        <>
          Стена {formatNumber(lengthM)}×{formatNumber(heightM)} м, блок{' '}
          {size.lengthMm}×{size.widthMm}×{size.heightMm} мм. Показано рядов: {visibleRows} из{' '}
          {rows}, блоков в ряду: {visiblePerRow} из {blocksPerRow}. Проёмы вычтены.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Схема кладки стены ${formatNumber(lengthM)} на ${formatNumber(heightM)} метра с проёмами`}
      >
        <text x={WALL_X} y={WALL_Y - 10} fill={SCHEME_STROKE} fontSize="11">
          фасад стены, рядов: {rows}, блоков в ряду: {blocksPerRow}
        </text>

        {/* Тело стены */}
        <rect
          x={WALL_X}
          y={WALL_Y}
          width={WALL_W}
          height={WALL_H}
          fill="rgba(255,255,255,0.05)"
          stroke={SCHEME_STROKE}
          strokeWidth="2"
        />

        {/* Ряды и перевязка */}
        {Array.from({ length: visibleRows }).map((_, rowIndex) => {
          const y = WALL_Y + rowGapPx * (rowIndex + 1);
          const offset = rowIndex % 2 === 0 ? 0 : blockGapPx / 2;
          const joints = Array.from({ length: Math.ceil(visiblePerRow / 2) }).map((_, index) => {
            const x = WALL_X + offset + blockGapPx * (index * 2 + 1);
            return x;
          }).filter((x) => x > WALL_X && x < WALL_X + WALL_W);

          return (
            <g key={`row-${rowIndex}`}>
              <line x1={WALL_X} y1={y} x2={WALL_X + WALL_W} y2={y} stroke={SCHEME_GRID} strokeWidth="1" />
              {joints.map((x, jointIndex) => (
                <line
                  key={`joint-${rowIndex}-${jointIndex}`}
                  x1={x}
                  y1={y - rowGapPx}
                  x2={x}
                  y2={y}
                  stroke={SCHEME_GRID}
                  strokeWidth="1"
                />
              ))}
            </g>
          );
        })}

        {/* Проёмы */}
        {openings.map((opening, index) => {
          const perOpeningArea = (opening.widthMm / 1000) * (opening.heightMm / 1000);
          if (perOpeningArea <= 0 || wallArea(lengthM, heightM) <= 0) return null;
          const totalArea = wallArea(lengthM, heightM);
          const share = Math.min(1, (perOpeningArea * (opening.count ?? 1)) / totalArea);
          const doorHeight = opening.heightMm > 1800;
          const drawW = Math.max(10, Math.min(WALL_W * share * Math.sqrt(3), 70));
          const drawH = doorHeight ? Math.min(WALL_H * 0.68, (WALL_H * drawW) / 2.2) : WALL_H * share * 1.6;
          const x = WALL_X + 20 + index * 96;
          const y = WALL_Y + WALL_H - drawH;
          return (
            <g key={`opening-${index}`}>
              <rect
                x={x}
                y={y}
                width={drawW}
                height={drawH}
                fill="rgba(18,20,18,0.92)"
                stroke={SCHEME_ACCENT}
                strokeWidth="2"
              />
              <text
                x={x + drawW / 2}
                y={y + drawH / 2}
                fill={SCHEME_ACCENT}
                fontSize="10"
                textAnchor="middle"
              >
                {opening.count ?? 1}× {opening.widthMm}×{opening.heightMm}
              </text>
            </g>
          );
        })}

        {/* Отметка уровня */}
        <line
          x1={WALL_X}
          y1={WALL_Y + WALL_H + 16}
          x2={WALL_X + WALL_W}
          y2={WALL_Y + WALL_H + 16}
          stroke={SCHEME_ACCENT}
          strokeWidth="1"
          strokeDasharray="6 4"
        />
        <text x={WALL_X} y={WALL_Y + WALL_H + 30} fill={SCHEME_ACCENT} fontSize="11">
          ±0,000 — уровень чистого пола
        </text>
      </svg>
    </Scheme>
  );
}

function wallArea(lengthM: number, heightM: number): number {
  return Math.max(0, lengthM) * Math.max(0, heightM);
}