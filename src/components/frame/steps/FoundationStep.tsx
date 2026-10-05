'use client';

import React, { useMemo } from 'react';
import { Anchor, Grid3x3 } from 'lucide-react';
import {
  Field,
  FrameCard,
  FrameStat,
  FrameStatGrid,
  SelectField,
  StandardNote,
  type FrameSelectOption,
} from '@/components/frame/ui';
import {
  HOUSE_MAX_SIDE_M,
  HOUSE_MIN_SIDE_M,
  PILE_CONCRETE_CLASS,
  PILE_CONCRETE_CLASS_HEAVY,
  PILE_SIZES,
  STUD_SIZES,
  WATERPROOF_LAYERS_BEAM,
  computePileField,
  safeNum,
  useFrameStore,
} from '@/lib/frame';

/**
 * ШАГ 1 «ОБВЯЗКА И ФУНДАМЕНТ» — конструктор каркасных домов.
 *
 * ЧТО ЗДЕСЬ СЧИТАЕТСЯ
 *   - сетка железобетонных свай: ряд по периметру + два внутренних ряда;
 *   - бетон, арматура (4 стержня на сваю + хомут), ПГС под сваи;
 *   - обвязка брусом 150×150 или 200×200 (выбор — по высоте стены);
 *   - гидроизоляция: 2 слоя рулона по торцам свай и под обвязкой.
 *
 * ПОЧЕМУ ГИДРОИЗОЛЯЦИЯ СЧИТАЕТСЯ В ДВА СЛОЯ И ПОКАЗЫВАЕТСЯ ОТДЕЛЬНО
 * ------------------------------------------------------------------
 * В смете /const гидроизоляция идёт «м² за один слой», и это нормально для
 * кладки. Здесь так нельзя: брус обвязки лежит НА бетоне, и влага идёт в торец
 * по капилляру. Один слой рубероида здесь — это «сгниёт через 8 лет вместо 15».
 * Поэтому в ТЗ и в интерфейсе всегда фигурирует «2 слоя», а площадь показана
 * ОДНА цифра (площадь под гидроизоляцию), чтобы не путать: 2 слоя × площадь =
 * расход материала считается в позиции, а не в этой плашке.
 *
 * СЕТКА СВАЙ НА ЧЕРТЕЖЕ
 * ------------------------------------------------------------------
 * Прораб проверяет сетку не по цифре «32 шт», а углами на объекте. Поэтому
 * схема рисует КАЖДУЮ сваю, и её можно сверить с чертежом подрядчика. Это
 * единственное место в конструкторе, где показ всех элементов честнее
 * усреднения.
 */

const PILE_OPTIONS: FrameSelectOption[] = PILE_SIZES.map((pile) => ({
  value: pile.id,
  label: pile.label,
  hint: `бетон ${pile.widthMm >= 350 ? PILE_CONCRETE_CLASS_HEAVY : PILE_CONCRETE_CLASS}`,
}));

const STUD_OPTIONS: FrameSelectOption[] = STUD_SIZES.map((stud) => ({
  value: stud.id,
  label: stud.label,
  hint: stud.note,
}));

/** Ширина стены на чертеже свай, мм — читается как реальный брус */
const DRAW_BEAM_MM = 150;

export function FoundationStep() {
  const form = useFrameStore((s) => s.form);
  const setForm = useFrameStore((s) => s.setForm);

  const result = useMemo(() => {
    const lengthM = safeNum(form.lengthM, 10, HOUSE_MIN_SIDE_M, HOUSE_MAX_SIDE_M);
    const depthM = safeNum(form.depthM, 8, HOUSE_MIN_SIDE_M, HOUSE_MAX_SIDE_M);
    const heightM = safeNum(form.heightM, 2.7, 2, 3.5);
    const storeys = Math.max(1, Math.min(3, Math.round(safeNum(form.storeys, 1))));
    const pile = PILE_SIZES.find((p) => p.id === form.pileId) ?? PILE_SIZES[0];

    const piles = computePileField(
      { lengthM, depthM, heightM, storeys },
      pile
    );
    const beamMm = heightM > 2.7 ? 200 : 150;
    const beamVolume = perimeterM2(lengthM, depthM) * ((beamMm * beamMm) / 1e6) * 2 * storeys;

    return { lengthM, depthM, heightM, storeys, pile, piles, beamMm, beamVolume };
  }, [form]);

  const { lengthM, depthM, heightM, storeys, pile, piles, beamMm, beamVolume } = result;

  const handleLength = (value: string) => setForm({ lengthM: value });
  const handleDepth = (value: string) => setForm({ depthM: value });
  const handleHeight = (value: string) => setForm({ heightM: value });
  const handleStoreys = (value: string) => setForm({ storeys: value });

  return (
    <FrameCard
      step={1}
      title="Обвязка и фундамент"
      subtitle="ЖБ сваи, брус 150×150/200×200, гидроизоляция, крепёж"
      icon={<Anchor className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {/* ── Габариты дома ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label="Длина (по X)"
            value={form.lengthM}
            onChange={handleLength}
            unit="м"
            placeholder="10"
          />
          <Field
            label="Глубина (по Y)"
            value={form.depthM}
            onChange={handleDepth}
            unit="м"
            placeholder="8"
          />
          <Field
            label="Высота стены"
            value={form.heightM}
            onChange={handleHeight}
            unit="м"
            placeholder="2,7"
            hint="2,7 → брус 150; выше → 200"
          />
          <Field
            label="Этажей"
            value={form.storeys}
            onChange={handleStoreys}
            unit="шт"
            placeholder="1"
            step="1"
          />
        </div>

        {/* ── Тип свай ── */}
        <SelectField
          label="Сваи и обвязка"
          value={form.pileId}
          onChange={(value) => setForm({ pileId: value as typeof form.pileId })}
          options={PILE_OPTIONS}
          hint={pile.note}
        />

        {/* ── Стойки (типразмер выбирается здесь же — от него зависит брус) ── */}
        <SelectField
          label="Сечение стойки (влияет на шаг и утеплитель)"
          value={form.studId}
          onChange={(value) => setForm({ studId: value as typeof form.studId })}
          options={STUD_OPTIONS}
        />

        {/* ── Показатели ── */}
        <FrameStatGrid columns={4}>
          <FrameStat
            label="Свай всего"
            value={String(piles.count)}
            unit="шт"
            accent
            hint={`${pile.widthMm}×${pile.widthMm} мм, шаг ${pile.stepM} м`}
          />
          <FrameStat
            label="Бетон"
            value={piles.concreteM3.toFixed(2)}
            unit="м³"
            hint={`М250 (${PILE_CONCRETE_CLASS})`}
          />
          <FrameStat
            label="Арматура"
            value={piles.rebarTotalT.toFixed(3)}
            unit="т"
            hint={`А500С d${pile.rebarMm}, ${piles.rebarEachKg} кг на сваю`}
          />
          <FrameStat
            label="Обвязка"
            value={beamVolume.toFixed(2)}
            unit="м³"
            hint={`брус ${beamMm}×${beamMm} мм`}
          />
        </FrameStatGrid>

        {/* ── Сетка свай на чертеже ── */}
        <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
          <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
            <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" />
            Сетка свай на чертеже ({piles.count} шт)
          </h4>
          <PileGridPlan lengthM={lengthM} depthM={depthM} pile={pile} />
        </div>

        {/* ── Гидроизоляция и ПГС ── */}
        <FrameStatGrid columns={3}>
          <FrameStat
            label="Гидроизоляция"
            value={piles.waterproofAreaM2.toFixed(2)}
            unit="м²"
            hint={`${WATERPROOF_LAYERS_BEAM} слоя рулонной под обвязкой + по торцам`}
            warn={piles.waterproofAreaM2 < 1}
          />
          <FrameStat
            label="ПГС под сваи"
            value={piles.gravelM3.toFixed(2)}
            unit="м³"
            hint="0,1 м под каждую сваю, трамбовка"
          />
          <FrameStat
            label="Обвязка (в 2 яруса)"
            value={beamVolume.toFixed(2)}
            unit="м³"
            hint={`${beamMm}×${beamMm} мм по периметру ${perimeterM2(lengthM, depthM).toFixed(2)} м`}
          />
        </FrameStatGrid>

        <StandardNote>
          Сваи — по СН 2.01.01-2019 (подошва ниже глубины промерзания), бетон
          С16/20 (М250) по СН 5.03.01-2018 / СТБ EN 206-1. Обвязка — брус{' '}
          {beamMm}×{beamMm} мм (выбор по высоте стены: до 2,7 м — 150, выше — 200).
          Гидроизоляция {WATERPROOF_LAYERS_BEAM} слоя между сваями и брусом: торец бруса
          на бетоне без прослойки набирает капиллярную влагу и гниёт за 8–10 лет.
        </StandardNote>
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                          ЧЕРТЕЖ СЕТКИ СВАЙ                                   */
/* ========================================================================== */

/**
 * План сетки свай.
 *
 * Рисует каждую сваю отдельным маркером в правильной сетке, чтобы прораб мог
 * положить на него линейку и проверить шаг на объекте. Это не схема-иллюстрация,
 * а рабочий чертёж: ряд по периметру + внутренние ряды, с подписями шага.
 */
function PileGridPlan({
  lengthM,
  depthM,
  pile,
}: {
  lengthM: number;
  depthM: number;
  pile: (typeof PILE_SIZES)[number];
}) {
  const grid = useMemo(() => {
    const step = Math.max(0.8, pile.stepM);
    const halfL = lengthM / 2;
    const halfD = depthM / 2;

    // Ряд по периметру: шаг от длины, стыки заходят внутрь на шаг/2 (с запасом).
    const nx = Math.max(2, Math.round(lengthM / step) + 1);
    const ny = Math.max(2, Math.round(depthM / step) + 1);
    const positions: Array<{ x: number; y: number; perimeter: boolean }> = [];

    for (let i = 0; i < nx; i++) {
      const x = -halfL + (i * lengthM) / (nx - 1);
      positions.push({ x, y: -halfD, perimeter: true });
      positions.push({ x, y: halfD, perimeter: true });
    }
    for (let j = 1; j < ny - 1; j++) {
      const y = -halfD + (j * depthM) / (ny - 1);
      positions.push({ x: -halfL, y, perimeter: true });
      positions.push({ x: halfL, y, perimeter: true });
    }

    // Внутренние ряды: по двум осям, без стыков периметра.
    const innerX = Math.max(0, Math.floor((lengthM - step) / step) - 1);
    const innerY = Math.max(0, Math.floor((depthM - step) / step) - 1);
    for (let i = 1; i <= innerX; i++) {
      for (let j = 1; j <= innerY; j++) {
        const x = -halfL + (i * step);
        const y = -halfD + (j * step);
        if (Math.abs(x) < halfL && Math.abs(y) < halfD) {
          positions.push({ x, y, perimeter: false });
        }
      }
    }

    return { positions, step };
  }, [lengthM, depthM, pile.stepM]);

  // viewBox в миллиметрах, дом центрирован в (0, 0)
  const w = lengthM * 1000 + 2000;
  const h = depthM * 1000 + 2000;
  const pileR = Math.max(60, (pile.widthMm * 1000) / 2000 * 0.6); // в мм user units → половина сечения

  return (
    <svg
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Сетка свай: ${grid.positions.length} штук с шагом ${pile.stepM} метра`}
    >
      {/* Обвязка брусом — периметр */}
      <rect
        x={-(lengthM * 1000) / 2}
        y={-(depthM * 1000) / 2}
        width={lengthM * 1000}
        height={depthM * 1000}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={DRAW_BEAM_MM}
        strokeDasharray="200 100"
      />

      {/* Сваи */}
      {grid.positions.map((pos, index) => (
        <circle
          key={index}
          cx={pos.x * 1000}
          cy={pos.y * 1000}
          r={pileR}
          fill={pos.perimeter ? 'var(--kc-khaki)' : 'var(--kc-surface-3)'}
          stroke="#FFFFFF"
          strokeWidth={40}
        />
      ))}

      {/* Подписи шага */}
      <text
        x={0}
        y={-(depthM * 1000) / 2 - 700}
        fill="var(--kc-khaki-text)"
        fontSize="220"
        fontWeight="700"
        textAnchor="middle"
      >
        шаг свай {pile.stepM} м · {grid.positions.length} шт
      </text>
    </svg>
  );
}

/* ========================================================================== */
/*                              ЛОКАЛЬНЫЕ ХЕЛПЕРЫ                               */
/* ========================================================================== */

/** Периметр стен, м — та же формула, что в геометрии, но для плашки */
function perimeterM2(lengthM: number, depthM: number): number {
  return 2 * (lengthM + depthM);
}
