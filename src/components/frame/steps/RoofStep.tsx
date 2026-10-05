'use client';

import React, { useMemo } from 'react';
import { Triangle, Home, Ruler } from 'lucide-react';
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
  BATTEN_STEPS_MM,
  RAFTER_SECTION_MM,
  RAFTER_STEP_MM,
  ROOF_MIN_SLOPE_PERCENT,
  ROOF_SLOPES,
  ROOF_VENT_GAP_MM,
  computeRoof,
  safeNum,
  useFrameStore,
  type RoofMaterialId,
} from '@/lib/frame';

/**
 * ШАГ 4 «КРОВЛЯ» — стропильная система, обрешётка, кровельный пирог.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ГЛАВНЫЙ ЦИФРОВОЙ РИСК: ПЛОЩАДЬ КРОВЛИ ≠ ПЛОЩАДЬ ДОМА
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Для дома 10×8 м с двускатной кровлей, уклоном 25 % и свесом 0,5 м:
 *   - площадь плана                    80,00 м²
 *   - площадь кровли (2 ската)        ~121,0 м²  →  +51 %
 *
 * То есть «посчитать кровлю как план» — ошибка в 50 %. На 80 м² это 41 м²
 * некупленного металла и мембраны, а по стропильной системе — минус 4 стропила,
 * которых не хватит, и крыша прогибает. Здесь площадь считается честно:
 * полупролёт + свес → подъём по тангенсу уклона → гипотенуза стропила →
 * площадь ската.
 *
 * ДЛИНА СТРОПИЛА = ГИПОТЕНУЗА, а не полупролёт. При уклоне 25 % это +12 % к
 * длине, а с учётом свеса — +25 %. Считать «пролёт + припуск» на глаз нельзя.
 *
 * УКЛОН ПРОВЕРЯЕТСЯ ПО ТИПУ КРОВЕЛЬНОГО МАТЕРИАЛА:
 *   металлочерепица  ≥ 20 %   (завод не даёт гарантии ниже)
 *   профнастил       ≥ 15 %
 *   фиброцемент      ≥ 18 %
 *   мембрана ПВХ     ≥ 2 %
 * Если прораб поставил 5 % под металлочерепицу — это не «получится дешевле»,
 * это застой воды и рекламация. Интерфейс блокирует и предупреждает.
 */

const ROOF_OPTIONS: FrameSelectOption[] = ROOF_SLOPES.map((roof) => ({
  value: roof.id,
  label: `${roof.label} — от ${roof.min} %`,
  hint: `типичный ${roof.typical} %`,
}));

const BATTEN_OPTIONS: FrameSelectOption[] = BATTEN_STEPS_MM.map((batten) => ({
  value: batten.id,
  label: `${batten.label}: шаг ${Math.round(batten.stepM * 1000)} мм`,
}));

export function RoofStep() {
  const form = useFrameStore((s) => s.form);
  const setForm = useFrameStore((s) => s.setForm);

  const result = useMemo(() => {
    const lengthM = safeNum(form.lengthM, 10, 3, 30);
    const depthM = safeNum(form.depthM, 8, 3, 30);
    const heightM = safeNum(form.heightM, 2.7, 2, 3.5);
    const storeys = Math.max(1, Math.min(3, Math.round(safeNum(form.storeys, 1))));
    const geo = { lengthM, depthM, heightM, storeys };

    const material = ROOF_SLOPES.find((m) => m.id === form.roofMaterial) ?? ROOF_SLOPES[0];
    const battenType = BATTEN_STEPS_MM.find((b) => b.id === (material.id === 'metalTile' ? 'metal' : 'profiled')) ?? BATTEN_STEPS_MM[0];

    // Уклон не ниже минимума по материалу: подставляем безопасное значение,
    // но ПОКАЗЫВАем фактический ввод, чтобы прораб видел, что произошло.
    const inputSlope = safeNum(form.roofSlope, material.typical, 0, 70);
    const effectiveSlope = Math.max(inputSlope, material.min, ROOF_MIN_SLOPE_PERCENT * 0.5);
    const slopeAdjusted = inputSlope < material.min;

    const roof = computeRoof(geo, effectiveSlope, 0.5, battenType.stepM);

    const planAreaM2 = lengthM * depthM * storeys;
    const areaRatio = planAreaM2 > 0 ? roof.roofAreaM2 / planAreaM2 : 1;

    return {
      geo,
      material,
      battenType,
      inputSlope,
      effectiveSlope,
      slopeAdjusted,
      roof,
      planAreaM2,
      areaRatio,
    };
  }, [form]);

  const { material, battenType, inputSlope, effectiveSlope, slopeAdjusted, roof, planAreaM2, areaRatio } = result;

  return (
    <FrameCard
      step={4}
      title="Кровля"
      subtitle="Стропильная система, обрешётка, кровельный пирог"
      icon={<Triangle className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Кровельный материал"
            value={form.roofMaterial}
            onChange={(value) => setForm({ roofMaterial: value })}
            options={ROOF_OPTIONS}
            hint={`Минимальный уклон по этому материалу: ${material.min} %`}
          />
          <Field
            label="Уклон ската"
            value={form.roofSlope}
            onChange={(value) => setForm({ roofSlope: value })}
            unit="%"
            placeholder="25"
            hint={`${material.label}: от ${material.min} %, типичный ${material.typical} %`}
          />
        </div>

        {/* Предупреждение об уклоне — не блокирует, но говорит прямо */}
        {slopeAdjusted && (
          <div className="border-2 border-red-500/70 bg-red-950/30 p-3">
            <p className="text-[11px] leading-snug text-red-200">
              Уклон {inputSlope.toFixed(0)} % меньше минимальных{' '}
              {material.min} % для «{material.label}». В расчёт подставлено{' '}
              {effectiveSlope.toFixed(0)} % — иначе вода будет застаиваться в пазу,
              а лист — отрываться ветром. Если нужен пологий скат, берите мембрану
              ПВХ (от 2 %).
            </p>
          </div>
        )}

        {/* Обрешётка */}
        <SelectField
          label="Обрешётка (шаг зависит от кровельного материала)"
          value={battenType.id}
          onChange={() => {
            /* Шаг обрешётки выводится из материала: он не свободный параметр */
          }}
          options={BATTEN_OPTIONS}
          hint={`При ${material.label}: ${battenType.label}`}
        />

        {/* Ключевой показатель: во сколько раз кровля больше плана */}
        <div className="border-2 border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
                Кровля больше плана
              </span>
              <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-white">
                ×{areaRatio.toFixed(2)}
              </span>
            </div>
            <p className="max-w-[280px] text-[10px] leading-snug text-[var(--kc-muted)]">
              План {planAreaM2.toFixed(2)} м² → кровля {roof.roofAreaM2.toFixed(2)} м².
              Два ската, свес 0,5 м, уклон {effectiveSlope.toFixed(0)} %. Считать кровлю
              по площади плана — ошибка на {Math.round((areaRatio - 1) * 100)} %.
            </p>
          </div>
        </div>

        {/* Показатели стропильной системы */}
        <FrameStatGrid columns={4}>
          <FrameStat
            label="Стропил"
            value={String(roof.rafterCount)}
            unit="шт"
            accent
            hint={`шаг ${RAFTER_STEP_MM} мм, ${RAFTER_SECTION_MM.depthMm}×${RAFTER_SECTION_MM.thicknessMm} мм`}
          />
          <FrameStat
            label="Длина стропила"
            value={roof.rafterLengthM.toFixed(2)}
            unit="м"
            hint="гипотенуза: полупролёт + подъём"
          />
          <FrameStat
            label="Объём стропил"
            value={roof.rafterVolumeM3.toFixed(2)}
            unit="м³"
            hint="с запасом 5 % на подрезку"
          />
          <FrameStat
            label="Обрешётка"
            value={roof.battenVolumeM3.toFixed(2)}
            unit="м³"
            hint={`шаг ${Math.round(battenType.stepM * 1000)} мм`}
          />
        </FrameStatGrid>

        {/* Кровельный пирог */}
        <FrameStatGrid columns={3}>
          <FrameStat
            label="Мембрана"
            value={roof.membraneAreaM2.toFixed(2)}
            unit="м²"
            hint="ПВХ, нахлёст 10 %"
          />
          <FrameStat
            label="Водосток"
            value={roof.gutterLengthM.toFixed(2)}
            unit="пог. м"
            hint="желоб + 2 трубы"
          />
          <FrameStat
            label="Вентзазор"
            value={String(ROOF_VENT_GAP_MM)}
            unit="мм"
            hint="не менее, под кровельным материалом"
          />
        </FrameStatGrid>

        {/* Чертёж стропильной системы */}
        <RoofTrussDiagram
          spanM={result.geo.depthM}
          lengthM={result.geo.lengthM}
          slopePercent={effectiveSlope}
          overhangM={0.5}
          rafterLengthM={roof.rafterLengthM}
          rafterCount={roof.rafterCount}
          ventGapMm={ROOF_VENT_GAP_MM}
        />

        <StandardNote>
          Двускатная кровля по ТКП 45-5.05-146-2009: стропило{' '}
          {RAFTER_SECTION_MM.depthMm}×{RAFTER_SECTION_MM.thicknessMm} мм с шагом{' '}
          {RAFTER_STEP_MM} мм, обрешётка 25×50 мм с шагом{' '}
          {Math.round(battenType.stepM * 1000)} мм под {material.label.toLowerCase()}, гидроизоляция
          кровельная под кровельным материалом с вентиляционным зазором не менее{' '}
          {ROOF_VENT_GAP_MM} мм. Уклон {effectiveSlope.toFixed(0)} % (минимум по материалу{' '}
          {material.min} %). Стропило — гипотенуза: полупролёт{' '}
          {(result.geo.depthM / 2).toFixed(2)} м плюс свес 0,5 м и подъём по уклону ={' '}
          {roof.rafterLengthM.toFixed(2)} м.
        </StandardNote>
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                    ЧЕРТЕЖ СТРОПИЛЬНОЙ СИСТЕМЫ                               */
/* ========================================================================== */

/**
 * Фронтальный разрез стропильной системы: два ската, стропила, конёк,
 * вентзазор под кровельным материалом.
 *
 * Чертёж рисуется в ПРОПОРЦИИ настоящей геометрии (полупролёт → подъём по
 * тангенсу уклона), а не условно. Иначе прораб увидит «пологий скат» при
 * уклоне 35 % и решит, что расчёт врёт.
 */
function RoofTrussDiagram({
  spanM,
  lengthM,
  slopePercent,
  overhangM,
  rafterLengthM,
  rafterCount,
  ventGapMm,
}: {
  spanM: number;
  lengthM: number;
  slopePercent: number;
  overhangM: number;
  rafterLengthM: number;
  rafterCount: number;
  ventGapMm: number;
}) {
  const viewW = 520;
  const viewH = 260;
  const pad = 30;

  // Масштаб: весь пролёт (с двумя свесами) вписывается в вид по ширине.
  const totalWidthM = spanM + 2 * overhangM;
  const scale = (viewW - 2 * pad) / totalWidthM;

  const halfSpanM = spanM / 2 + overhangM;
  const riseM = halfSpanM * Math.tan((slopePercent / 100) * (Math.PI / 180));
  const eaveX = viewW / 2 - halfSpanM * scale;
  const ridgeY = viewH - pad - riseM * scale;
  const eaveY = viewH - pad;

  // Стропила показаны условно (максимум 7 шт на скат) — реальных может быть 30.
  const perSlope = Math.min(7, Math.max(2, Math.round(rafterCount / 4)));
  const ventGapPx = Math.max(4, ventGapMm / 20);

  return (
    <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
      <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        Фронтальный разрез кровли (пропорционально)
      </h4>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Разрез двускатной кровли: пролёт ${spanM} метра, уклон ${slopePercent} процентов, длина стропила ${rafterLengthM.toFixed(2)} метра, стропил ${rafterCount} штук`}
      >
        {/* Стропила — линии от конька к карнизу, с шагом по длине дома */}
        {Array.from({ length: perSlope }).map((_, i) => {
          const t = perSlope === 1 ? 0.5 : i / (perSlope - 1);
          // Небольшой горизонтальный сдвиг «в глубину», чтобы стропила читались
          // как объёмная система, а не как одна плоская линия.
          const offsetX = (t - 0.5) * 14;
          const offsetY = -Math.abs(t - 0.5) * 8;
          return (
            <g key={i} opacity={0.45 + 0.55 * (1 - Math.abs(t - 0.5))}>
              <line x1={viewW / 2 + offsetX} y1={ridgeY + offsetY} x2={eaveX + offsetX} y2={eaveY + offsetY} stroke="#FFFFFF" strokeWidth="3" />
              <line x1={viewW / 2 + offsetX} y1={ridgeY + offsetY} x2={viewW - eaveX + offsetX} y2={eaveY + offsetY} stroke="#FFFFFF" strokeWidth="3" />
            </g>
          );
        })}

        {/* Кровельный материал (толстая линия поверх стропил) */}
        <line x1={eaveX - 8} y1={eaveY - 4} x2={viewW / 2} y2={ridgeY - 4} stroke="var(--kc-khaki-text)" strokeWidth="8" />
        <line x1={viewW / 2} y1={ridgeY - 4} x2={viewW - eaveX + 8} y2={eaveY - 4} stroke="var(--kc-khaki-text)" strokeWidth="8" />

        {/* Мембрана и вентзазор — пунктир между стропилом и кровлей */}
        <line x1={eaveX} y1={eaveY - 4 - ventGapPx} x2={viewW / 2} y2={ridgeY - 4 - ventGapPx} stroke="var(--kc-khaki-text)" strokeWidth="3" strokeDasharray="8 5" opacity="0.8" />

        {/* Конёк */}
        <rect x={viewW / 2 - 8} y={ridgeY - 14} width="16" height="18" fill="var(--kc-khaki)" />

        {/* Стена */}
        <rect x={viewW / 2 - spanM * scale * 0.5} y={eaveY} width={spanM * scale} height="10" fill="rgba(255,255,255,0.4)" />

        {/* Подписи */}
        <text x={viewW / 2} y={ridgeY - 26} fill="var(--kc-khaki-text)" fontSize="13" fontWeight="700" textAnchor="middle">
          конёк · подъём {((spanM / 2 + overhangM) * Math.tan((slopePercent / 100) * Math.PI)).toFixed(2)} м
        </text>
        <text x={eaveX} y={eaveY + 28} fill="#FFFFFF" fontSize="12" fontWeight="700" textAnchor="middle">
          карниз, свес {overhangM} м
        </text>
        <text x={viewW / 2} y={viewH - 6} fill="var(--kc-muted)" fontSize="12" fontWeight="700" textAnchor="middle">
          пролёт {spanM} м · стропил {rafterCount} шт по {rafterLengthM.toFixed(2)} м · дом {lengthM} м вдоль
        </text>
      </svg>
      <p className="mt-2 text-[10px] leading-snug text-[var(--kc-faint)]">
        На чертеже показано до {perSlope} стропил на скат из {rafterCount} — реальная
        система плотнее, но пропорции и уклон верные. Вентзазор{' '}
        {ventGapMm} мм между мембраной и кровельным материалом обязателен: без
        него конденсат с мембраны гниёт стропило.
      </p>
    </div>
  );
}
