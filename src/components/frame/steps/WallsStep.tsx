'use client';

import React, { useMemo } from 'react';
import { Ruler, Triangle, Layers } from 'lucide-react';
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
  BRACE_SIZE_MM,
  HOUSE_MAX_SIDE_M,
  HOUSE_MIN_SIDE_M,
  LEDGER_HEIGHT_M,
  LUMBER_CUT_WASTE_PERCENT,
  STUD_SIZES,
  STUD_STEP_MAX_MM,
  STUD_STEP_MIN_MM,
  STUD_STEP_MM,
  bracesPerWall,
  braceVolumePerWallM3,
  computeStuds,
  perimeterM,
  safeNum,
  useFrameStore,
} from '@/lib/frame';

/**
 * ШАГ 2 «СТЕНЫ» — стойки, укосины, ригели.
 *
 * ЧТО ЗДЕСЬ СЧИТАЕТСЯ
 *   - объём стоек по шагу 590 мм (под плиты утеплителя 600 мм);
 *   - укосины 25×100 мм — по гипотенузе под углом 58°, шаг не реже 3 м;
 *   - ригели 25×100 мм на отм. 1,35 м и под верхней обвязкой;
 *   - объём с запасом 8 % на подрезку при раскрое.
 *
 * КЛЮЧЕВАЯ МАТЕМАТИКА, КОТОРАЯ ЧАЩЕ ВСЕГО ВЫГЛЯДИТ ПОДОЗРИТЕЛЬНО
 * ------------------------------------------------------------------
 * 1. ШАГ 590 ММ, А НЕ 600. Плита утеплителя 600 мм при шаге 600 не встаёт без
 *    зазора: бригада подрезает каждую плиту вдоль и теряет ~10 мм на пролёт.
 *    При 590 мм получается зазор, в который вата заводится с перехлёстом, и
 *    расход не растёт. Это решение в шаге, а не «в среднем 590 мм».
 *
 * 2. ВЫСОТА СТОЙКИ = ВЫСОТА СТЕНЫ − 2 × 150 ММ. Обвязка сверху и снизу
 *    занимает 300 мм. Если этого не вычесть, стойка оказывается длиннее проёма
 *    и каркас физически не собирается — верхняя обвязка некуда класть.
 *
 * 3. УКОСИНА — ГИПОТЕНУЗА. Под углом 58° к горизонту её длина в 1,53 раза
 *    больше высоты участка. Считать по высоте — ошибка −35 % материала на
 *    диагоналях. Именно здесь чаще всего «экономят» и получают дом без
 *    диагональной жёсткости, который складывается под ветром.
 */

const STUD_OPTIONS: FrameSelectOption[] = STUD_SIZES.map((stud) => ({
  value: stud.id,
  label: stud.label,
  hint: stud.note,
}));

export function WallsStep() {
  const form = useFrameStore((s) => s.form);
  const setForm = useFrameStore((s) => s.setForm);

  const result = useMemo(() => {
    const lengthM = safeNum(form.lengthM, 10, HOUSE_MIN_SIDE_M, HOUSE_MAX_SIDE_M);
    const depthM = safeNum(form.depthM, 8, HOUSE_MIN_SIDE_M, HOUSE_MAX_SIDE_M);
    const heightM = safeNum(form.heightM, 2.7, 2, 3.5);
    const storeys = Math.max(1, Math.min(3, Math.round(safeNum(form.storeys, 1))));
    const stud = STUD_SIZES.find((s) => s.id === form.studId) ?? STUD_SIZES[0];

    const stepM = STUD_STEP_MM / 1000;
    const studs = computeStuds({ lengthM, depthM, heightM, storeys }, stud, stepM);

    const bracesCount = bracesPerWall(heightM);
    const braceVolumeAll = braceVolumePerWallM3(heightM, bracesCount, lengthM + depthM) * 2;
    // Ригели: 2 шт на стену (опорный + под верхней обвязкой), длина стены.
    const ledgerSectionM = (25 * 100) / 1e6;
    const ledgerVolumeAll = perimeterM({ lengthM, depthM, heightM, storeys: 1 }) * ledgerSectionM * 2;

    return {
      lengthM,
      depthM,
      heightM,
      storeys,
      stud,
      studs,
      bracesCount,
      braceVolumeAll,
      ledgerVolumeAll,
      studsPerWallFrontal: Math.floor(lengthM / stepM) + 1,
      studsPerWallSide: Math.floor(depthM / stepM) + 1,
    };
  }, [form]);

  const {
    lengthM,
    depthM,
    heightM,
    stud,
    studs,
    bracesCount,
    braceVolumeAll,
    ledgerVolumeAll,
    studsPerWallFrontal,
    studsPerWallSide,
  } = result;

  return (
    <FrameCard
      step={2}
      title="Стены"
      subtitle="Стойки 150×50/200×50 с шагом 590 мм, укосины, ригели"
      icon={<Ruler className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="space-y-4">
        <SelectField
          label="Сечение стойки"
          value={form.studId}
          onChange={(value) => setForm({ studId: value as typeof form.studId })}
          options={STUD_OPTIONS}
          hint="Типоразмер определяет, сколько утеплителя влезет в стену и как часто свай"
        />

        {/* Шаг — жёстко зашит, но показан явно: это ключевое решение норматива */}
        <div className="border-2 border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
                Шаг стоек под утеплитель
              </span>
              <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-white">
                {STUD_STEP_MM} мм
              </span>
            </div>
            <p className="max-w-[240px] text-[10px] leading-snug text-[var(--kc-muted)]">
              Не 600 мм: плита утеплителя 600 мм встаёт с зазором 10 мм, без
              продуваемых щелей. Допустимый коридор {STUD_STEP_MIN_MM}–{STUD_STEP_MAX_MM} мм,
              уменьшение шага удорожает каркас без роста жёсткости.
            </p>
          </div>
        </div>

        {/* Показатели каркаса */}
        <FrameStatGrid columns={4}>
          <FrameStat label="Стоек всего" value={String(studs.count)} unit="шт" accent hint={`шаг ${STUD_STEP_MM} мм`} />
          <FrameStat
            label="Объём стоек"
            value={studs.volumeWithWasteM3.toFixed(2)}
            unit="м³"
            hint={`с запасом ${LUMBER_CUT_WASTE_PERCENT} % на подрезку`}
          />
          <FrameStat
            label="Укосин"
            value={String(bracesCount)}
            unit="на стену"
            hint={`${BRACE_SIZE_MM.widthMm}×${BRACE_SIZE_MM.thicknessMm} мм под 58°`}
          />
          <FrameStat
            label="Объём диагоналей"
            value={braceVolumeAll.toFixed(2)}
            unit="м³"
            hint="укосин + ригели"
          />
        </FrameStatGrid>

        {/* Число стоек по сторонам — для проверки на объекте */}
        <FrameStatGrid columns={3}>
          <FrameStat
            label="Стоек в длинной стене"
            value={String(studsPerWallFrontal)}
            unit="шт"
            hint={`стена ${lengthM} м`}
          />
          <FrameStat
            label="Стоек в короткой стене"
            value={String(studsPerWallSide)}
            unit="шт"
            hint={`стена ${depthM} м`}
          />
          <FrameStat
            label="Высота стойки"
            value={studs.lengthEachM.toFixed(2)}
            unit="м"
            hint={`высота стены ${heightM} м − 2×150 мм обвязка`}
          />
        </FrameStatGrid>

        {/* Чертёж стены в разрезе */}
        <WallSectionDiagram
          studDepthMm={stud.depthMm}
          studThicknessMm={stud.thicknessMm}
          heightM={heightM}
          stepMm={STUD_STEP_MM}
          bracesCount={bracesCount}
        />

        <StandardNote>
          Стойка {stud.label}, шаг {STUD_STEP_MM} мм — под плиты утеплителя 600 мм без
          подрезки вдоль. Укосины {BRACE_SIZE_MM.widthMm}×{BRACE_SIZE_MM.thicknessMm} мм с шагом не реже 3 м по высоте: без них каркас складывается под собственным ветром ещё до сдачи. Ригели {BRACE_SIZE_MM.widthMm}×{BRACE_SIZE_MM.thicknessMm} мм — опорный на отм. {LEDGER_HEIGHT_M} м и под верхней обвязкой. Запас на подрезку {LUMBER_CUT_WASTE_PERCENT} %.
        </StandardNote>
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                    ЧЕРТЕЖ СТЕНЫ В РАЗРЕЗЕ (УЗЕЛ)                              */
/* ========================================================================== */

/**
 * Узел стены в разрезе: стойка, утеплитель между стойками, укосина.
 *
 * Это самая полезная картинка в разделе: прораб по ней объясняет бригаде, что
 * именно куда вставлять. Масштаб условный (утеплитель нарисован по толщине
 * стойки), но пропорции слоёв соответствуют реальным, поэтому диаграмма
 * работает как объяснение, а не как украшение.
 */
function WallSectionDiagram({
  studDepthMm,
  studThicknessMm,
  heightM,
  stepMm,
  bracesCount,
}: {
  studDepthMm: number;
  studThicknessMm: number;
  heightM: number;
  stepMm: number;
  bracesCount: number;
}) {
  const viewW = 520;
  const viewH = 300;
  const baseY = 250;
  const scale = 0.9; // во сколько раз чертёж мельче реального

  const studW = studThicknessMm * scale;
  const studH = studDepthMm * scale;
  const gapW = stepMm * scale - studW; // расстояние между стойками (утеплитель)
  const heightPx = Math.min(200, heightM * 1000 * scale * 0.09);

  const leftX = 40;

  return (
    <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
      <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        Узел стены в разрезе (масштаб условный)
      </h4>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Разрез стены: стойка ${studDepthMm} на ${studThicknessMm} миллиметров, шаг ${stepMm} миллиметров, утеплитель ${studDepthMm} миллиметров между стойками`}
      >
        {/* Утеплитель (прозрачный хаки) */}
        {Array.from({ length: 4 }).map((_, i) => (
          <rect
            key={`ins-${i}`}
            x={leftX + i * (studW + gapW) + studW}
            y={baseY - heightPx}
            width={gapW}
            height={heightPx}
            fill="rgba(168,180,140,0.35)"
            stroke="var(--kc-khaki-text)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        ))}

        {/* Стойки (белые) */}
        {Array.from({ length: 5 }).map((_, i) => (
          <rect
            key={`stud-${i}`}
            x={leftX + i * (studW + gapW)}
            y={baseY - heightPx}
            width={studW}
            height={heightPx}
            fill="#FFFFFF"
            opacity="0.9"
          />
        ))}

        {/* Укосина — диагональ через две стойки */}
        {bracesCount > 0 && (
          <line
            x1={leftX + studW}
            y1={baseY}
            x2={leftX + 3 * (studW + gapW) + studW}
            y2={baseY - heightPx}
            stroke="var(--kc-khaki-text)"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.95"
          />
        )}

        {/* Подписи слоёв */}
        <line x1={leftX} y1={baseY + 30} x2={leftX + 4 * (studW + gapW) + studW} y2={baseY + 30} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <text x={leftX} y={baseY + 48} fill="var(--kc-khaki-text)" fontSize="13" fontWeight="700">
          шаг стоек {stepMm} мм (утеплитель между ними)
        </text>
        <text x={leftX} y={baseY + 68} fill="#FFFFFF" fontSize="13" fontWeight="700">
          стойка {studDepthMm}×{studThicknessMm} мм
        </text>
        <text x={leftX} y={baseY + 88} fill="var(--kc-khaki-text)" fontSize="13" fontWeight="700">
          укосина под 58° ({bracesCount} шт на стену)
        </text>
      </svg>
    </div>
  );
}
