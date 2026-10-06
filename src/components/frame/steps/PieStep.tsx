'use client';

import React, { useMemo } from 'react';
import { Snowflake, Layers, Thermometer } from 'lucide-react';
import {
  FrameCard,
  FrameStat,
  FrameStatGrid,
  SelectField,
  StandardNote,
  type FrameSelectOption,
} from '@/components/frame/ui';
import {
  INSULATION_PRODUCTS,
  MEMBRANE_G_PER_M2_DAY,
  OSB_THICKNESS_MM,
  REQUIRED_R_M2C_PER_W,
  VAPOR_BARRIER_MICRON,
  computePie,
  countByKind,
  insulationPriceM2,
  insulationPriceM3,
  openingAreaWithGapM2,
  openingAreaM2,
  safeNum,
  totalOpeningsAreaM2,
  useFrameStore,
  type FrameElementKind,
} from '@/lib/frame';
import { formatByn } from '@/lib/construction';

/**
 * ШАГ 3 «ПИРОГ СТЕНЫ» — утеплитель, пароизоляция, ветрозащита.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЧТО ЗДЕСЬ РЕАЛЬНО ВАЖНО ДЛЯ ЗДОРОВЬЯ ДОМА
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. ПЛОЩАДЬ УТЕПЛИТЕЛЯ = ПЛОЩАДЬ СТЕНЫ МИНУС ПРОЁМЫ.
 *    Каждый проём уже вырезан в стене — утеплять его нечего. Если считать от
 *    полной площади, покупается на 8–12 % лишнего (при 4 окнах и 2 дверях на
 *    доме 10×8 это ~4 м² лишней ваты и ~80 BYN впустую).
 *
 * 2. R — ЭТО НЕ УКРАШЕНИЕ, А ПРОВЕРКА.
 *    Нормативное сопротивление теплопередаче для жилого дома в РБ — 3,0
 *    м²·°C/Вт (СП 2.04.05 / СН 2.04.01). Считается по толщине и λ из паспорта
 *    марки, с поправкой на «мостик холода» по стойкам. Если R не хватает —
 *    шаг помечает это КРАСНЫМ и говорит прямо: увеличивайте толщину. Молча
 *    посчитать тонкий пирог и выдать смету — значит продать прорабу дом,
 *    который будет конденсировать влагу в точке росы.
 *
 * 3. ЦЕНА УТЕПЛИТЕЛЯ — ЗА М³ КОНКРЕТНОЙ ТОЛЩИНЫ.
 *    В прайсах РБ утеплитель идёт упаковками «0,25 м³» или «6 м² при 100 мм»,
 *    и цена за м³ зависит от толщины нелинейно. Считать «среднюю цену за м³»
 *    нельзя — на Paroc это ошибка в 30–50 %. Здесь цена считается функцией от
 *    толщины: `insulationPriceM3(марка, толщина)`.
 *
 * 4. БЕЛТЕП vs PAROC — СРАВНЕНИЕ В ДЕНЬГАХ, А НЕ В СЛОВАХ.
 *    Прораб не выбирает «марку», он выбирает «сколько стоит и не намокнет ли».
 *    Поэтому показываем: цена за м³, плотность (от неё зависит, стоит ли
 *    держать под мокрым фасадом), λ (термическое качество).
 */

/** Плотность: марки сгруппированы по назначению — стена это «лёгкая» вата */
const INSULATION_OPTIONS: FrameSelectOption[] = INSULATION_PRODUCTS.map((product) => ({
  value: product.id,
  label: `${product.brand} — ${product.densityKgM3} кг/м³, λ=${product.lambda}`,
  hint: product.name,
}));

export function PieStep() {
  const form = useFrameStore((s) => s.form);
  const setForm = useFrameStore((s) => s.setForm);
  const elements = useFrameStore((s) => s.elements);
  // Типоразмер стойки читается ПОДПИСКОЙ, а не через getState(): getState внутри
  // рендера не создаёт зависимости, и диаграмма пирога не перерисовалась бы
  // после смены 50×150 на 50×200 — осталась бы со старым объёмом утеплителя.
  const studDepthMm = useFrameStore((s) => (s.form.studId === '50x200' ? 200 : 150));

  const result = useMemo(() => {
    const lengthM = safeNum(form.lengthM, 10, 3, 30);
    const depthM = safeNum(form.depthM, 8, 3, 30);
    const heightM = safeNum(form.heightM, 2.7, 2, 3.5);
    const storeys = Math.max(1, Math.min(3, Math.round(safeNum(form.storeys, 1))));
    const geo = { lengthM, depthM, heightM, storeys };

    const product = INSULATION_PRODUCTS.find((p) => p.id === form.insulationId) ?? INSULATION_PRODUCTS[0];
    const thicknessMm = safeNum(
      form.insulationMm,
      product.defaultMm,
      Math.min(...product.thicknessesMm),
      Math.max(...product.thicknessesMm)
    );

    const placed = elements.map((el) => ({ kind: el.kind as FrameElementKind, positionM: el.positionM }));
    const openingsAreaM2 = totalOpeningsAreaM2(placed);
    const pie = computePie(geo, openingsAreaM2, thicknessMm, product.lambda, product.densityKgM3);

    const priceM3 = insulationPriceM3(product.id, thicknessMm);
    const priceM2 = insulationPriceM2(product.id, thicknessMm);

    return {
      geo,
      product,
      thicknessMm,
      pie,
      priceM3,
      priceM2,
      openingsAreaM2,
      counts: countByKind(placed),
    };
  }, [form, elements]);

  const { product, thicknessMm, pie, priceM3, priceM2, counts } = result;

  const availableThicknesses = product.thicknessesMm;
  const thicknessOptions: FrameSelectOption[] = availableThicknesses.map((mm) => ({
    value: String(mm),
    label: `${mm} мм — ${insulationPriceM2(product.id, mm).toFixed(2)} BYN/м²`,
  }));

  const wallAreaTotalM2 = result.pie.areaM2 + result.openingsAreaM2;

  return (
    <FrameCard
      step={3}
      title="Пирог стены"
      subtitle="Утеплитель Белтеп/Paroc в м³, пароизоляция, ветрозащита"
      icon={<Layers className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {/* Марка и толщина */}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Марка утеплителя"
            value={form.insulationId}
            onChange={(value) => setForm({ insulationId: value as typeof form.insulationId })}
            options={INSULATION_OPTIONS}
            hint={product.manufacturer}
          />
          <SelectField
            label="Толщина"
            value={String(thicknessMm)}
            onChange={(value) => setForm({ insulationMm: value })}
            options={thicknessOptions}
            hint="Только те толщины, которые выпускает завод"
          />
        </div>

        {/* Сравнение марок — в деньгах */}
        <InsulationComparison currentId={product.id} thicknessMm={thicknessMm} />

        {/* R — с предупреждением, если не хватает */}
        <div
          className={`border-2 p-3 ${pie.rSufficient ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10' : 'border-red-500/70 bg-red-950/30'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
                <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                Теплотехника стены
              </span>
              <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-white">
                R = {pie.rValue.toFixed(2)} м²·°C/Вт
              </span>
            </div>
            <p className={`max-w-[260px] text-[10px] leading-snug ${pie.rSufficient ? 'text-[var(--kc-muted)]' : 'text-red-200'}`}>
              {pie.rSufficient ? (
                <>
                  Норматив ≥ {REQUIRED_R_M2C_PER_W} — пирог проходит. По
                  «мостику холода» стоек учтено 14 % потери.
                </>
              ) : (
                <>
                  Норматив ≥ {REQUIRED_R_M2C_PER_W} — НЕ ХВАТАЕТ. Дом будет
                  конденсировать влагу в точке росы. Увеличьте толщину утеплителя.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Показатели пирога */}
        <FrameStatGrid columns={4}>
          <FrameStat
            label="Утеплитель"
            value={pie.volumeM3.toFixed(2)}
            unit="м³"
            accent
            hint={`с запасом на подрезку: ${pie.volumeWithWasteM3.toFixed(2)} м³`}
          />
          <FrameStat
            label="Площадь утепления"
            value={pie.areaM2.toFixed(2)}
            unit="м²"
            hint={`стена ${wallAreaTotalM2.toFixed(2)} м² − проёмы ${result.openingsAreaM2.toFixed(2)} м²`}
          />
          <FrameStat
            label="Пароизоляция"
            value={pie.vaporAreaM2.toFixed(2)}
            unit="м²"
            hint={`ПЭ ${VAPOR_BARRIER_MICRON} мкм, со стороны помещения`}
          />
          <FrameStat
            label="Ветрозащита"
            value={pie.windAreaM2.toFixed(2)}
            unit="м²"
            hint={`ОСП-3 ${OSB_THICKNESS_MM} мм или мембрана ${MEMBRANE_G_PER_M2_DAY} г/м²сут`}
          />
        </FrameStatGrid>

        {/* Цена утеплителя и масса */}
        <FrameStatGrid columns={3}>
          <FrameStat
            label="Цена утеплителя"
            value={priceM3.toFixed(2)}
            unit="BYN/м³"
            hint={`${priceM2.toFixed(2)} BYN за м² при ${thicknessMm} мм`}
          />
          <FrameStat
            label="Масса утеплителя"
            value={Math.round(pie.massKg).toString()}
            unit="кг"
            hint={`плотность ${product.densityKgM3} кг/м³`}
          />
          <FrameStat
            label="ГКЛ (внутри)"
            value={pie.innerAreaM2.toFixed(2)}
            unit="м²"
            hint="12,5 мм на каркас"
          />
        </FrameStatGrid>

        {/* Проёмы, вычтенные из утеплителя */}
        <OpeningsBreakdown counts={counts} />

        <PieDiagram
          studDepthMm={studDepthMm}
          thicknessMm={thicknessMm}
        />

        <StandardNote>
          Утеплитель {product.brand} {product.name.toLowerCase()}, {thicknessMm} мм. Объём{' '}
          {pie.volumeWithWasteM3.toFixed(2)} м³ с запасом 5 % на подрезку плит. Пароизоляция
          ПЭ {VAPOR_BARRIER_MICRON} мкм со стороны тёплого помещения, ветрозащита — ОСП-3{' '}
          {OSB_THICKNESS_MM} мм либо паропроницаемая мембрана {MEMBRANE_G_PER_M2_DAY} г/м²сут.
          Порядок слоёв: ветрозащита → утеплитель → пароизоляция → отделка. Расчётное R с
          учётом «мостика холода» стоек: {pie.rValue.toFixed(2)} м²·°C/Вт (норматив ≥{' '}
          {REQUIRED_R_M2C_PER_W}).
        </StandardNote>
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                      СРАВНЕНИЕ МАРОК УТЕПЛИТЕЛЯ                             */
/* ========================================================================== */

/**
 * Таблица марок с ценой за м³ при ВЫБРАННОЙ толщине.
 *
 * Это ответ на вопрос, который прораб задаёт всегда: «почему Paroc дороже
 * Белтепа, если ваты та же?» — потому что цена за м³ при 145 мм и при 150 мм
 * разная, и λ разная, и плотность разная. Таблица показывает все три.
 */
function InsulationComparison({
  currentId,
  thicknessMm,
}: {
  currentId: string;
  thicknessMm: number;
}) {
  const rows = INSULATION_PRODUCTS.map((product) => {
    const p = insulationPriceM3(product.id, thicknessMm);
    const isCurrent = product.id === currentId;
    return { product, price: p, isCurrent };
  });
  const cheapest = Math.min(...rows.map((r) => r.price));

  return (
    <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        Сравнение марок при {thicknessMm} мм (цена за м³)
      </h4>
      <ul className="space-y-1">
        {rows.map(({ product, price, isCurrent }) => (
          <li
            key={product.id}
            className={`flex items-baseline gap-2 border-b border-dashed border-[var(--kc-border)] py-1.5 last:border-0 ${isCurrent ? 'text-white' : 'text-[var(--kc-muted)]'}`}
          >
            <span className="min-w-0 flex-1 text-[11px] font-medium">
              {isCurrent ? '▶ ' : ''}
              {product.brand} {product.densityKgM3} кг/м³
            </span>
            <span className="shrink-0 font-mono text-[10px] text-[var(--kc-faint)]">
              λ={product.lambda} · {formatByn(price)}
            </span>
            {price === cheapest && !isCurrent && (
              <span className="shrink-0 text-[9px] font-bold uppercase text-[var(--kc-khaki-text)]">дешевле</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================================================================== */
/*                    ПРОЁМЫ, ВЫЧТЕННЫЕ ИЗ УТЕПЛИТЕЛЯ                            */
/* ========================================================================== */

/** Сколько м² утеплителя «съели» окна и двери — с расшифровкой по видам */
function OpeningsBreakdown({
  counts,
}: {
  counts: Record<FrameElementKind, number>;
}) {
  const specs = [
    { kind: 'window' as const, label: 'Окна', widthMm: 1200, heightMm: 1400, count: counts.window },
    { kind: 'door' as const, label: 'Двери', widthMm: 900, heightMm: 2100, count: counts.door },
  ];

  const total = specs.reduce((sum, spec) => {
    return sum + spec.count * openingAreaWithGapM2({ widthMm: spec.widthMm, heightMm: spec.heightMm });
  }, 0);

  return (
    <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        Проёмы вычтены из утеплителя
      </h4>
      {total === 0 ? (
        <p className="text-[10px] leading-snug text-[var(--kc-muted)]">
          Проёмов на схеме нет — утеплитель считается по полной площади стен.
          Добавьте окна и двери перетаскиванием, и утеплитель пересчитается.
        </p>
      ) : (
        <ul className="space-y-1">
          {specs.map((spec) => {
            const area = spec.count * openingAreaWithGapM2({ widthMm: spec.widthMm, heightMm: spec.heightMm });
            return (
              <li key={spec.kind} className="flex items-baseline gap-2 border-b border-dashed border-[var(--kc-border)] py-1 text-[11px] last:border-0">
                <span className="flex-1 text-white">
                  {spec.label}: {spec.count} шт по {spec.widthMm}×{spec.heightMm}
                </span>
                <span className="font-mono tabular-nums text-[var(--kc-muted)]">−{area.toFixed(2)} м²</span>
              </li>
            );
          })}
          <li className="flex items-baseline gap-2 pt-1 text-[11px] font-bold">
            <span className="flex-1 text-[var(--kc-khaki-text)]">Итого вычтено</span>
            <span className="font-mono tabular-nums text-[var(--kc-khaki-text)]">−{total.toFixed(2)} м²</span>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                        СХЕМА ПИРОГА (СЛОИ)                                   */
/* ========================================================================== */

/**
 * Схема пирога стены: пять слоёв слева направо.
 *
 * Порядок слоёв — это и есть нормативное требование, и именно его чаще всего
 * нарушают: утеплитель с внешней стороны стены без пароизоляции даёт точку
 * росы ВНУТРИ утеплителя, и через 3 зимы вата рассыпается.
 */
function PieDiagram({ studDepthMm, thicknessMm }: { studDepthMm: number; thicknessMm: number }) {
  const viewW = 520;
  const viewH = 140;
  const y = 30;
  const h = 70;

  // Слои по толщине (условной, но пропорциональной толщине):
  // ОСП 9 мм → узкий, вата 150 мм → толстый, ГКЛ 12,5 мм → узкий.
  const layerWidths = [9 / 260, thicknessMm / 260, 12.5 / 260, 2 / 260, 2 / 260].map((w) => w * viewW);
  const totalWidth = layerWidths.reduce((a, b) => a + b, 0);
  const scaleFactor = (viewW - 40) / totalWidth;
  const widths = layerWidths.map((w) => w * scaleFactor);

  const layers = [
    { name: `Ветрозащита ОСП-3 ${OSB_THICKNESS_MM} мм`, color: 'rgba(168,180,140,0.5)', border: 'var(--kc-khaki-text)' },
    { name: `Утеплитель ${thicknessMm} мм`, color: 'rgba(168,180,140,0.75)', border: 'var(--kc-khaki-text)' },
    { name: `Пароизоляция ПЭ ${VAPOR_BARRIER_MICRON} мкм`, color: 'rgba(255,255,255,0.25)', border: '#FFFFFF' },
    { name: 'Каркас (стойка)', color: '#FFFFFF', border: '#FFFFFF' },
    { name: `Отделка ГКЛ 12,5 мм`, color: 'rgba(255,255,255,0.15)', border: 'var(--kc-muted)' },
  ];

  let x = 20;
  return (
    <div className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
      <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
        Слои пирога (снаружи внутрь)
      </h4>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Порядок слоёв стены: ветрозащита, утеплитель ${thicknessMm} миллиметров, пароизоляция, каркас, отделка`}
      >
        {layers.map((layer, i) => {
          const width = widths[i];
          const cx = x + width / 2;
          x += width;
          return (
            <g key={layer.name}>
              <rect x={x - width} y={y} width={width} height={h} fill={layer.color} stroke={layer.border} strokeWidth="2" />
              {/* Подпись снизу, повёрнутая для узких слоёв */}
              <text
                x={cx}
                y={y + h + 22}
                fill="#FFFFFF"
                fontSize="12"
                fontWeight="700"
                textAnchor="middle"
                transform={`rotate(-40 ${cx} ${y + h + 22})`}
              >
                {layer.name}
              </text>
            </g>
          );
        })}
        {/* Стрелка «снаружи → внутрь» */}
        <line x1={20} y1={y - 16} x2={viewW - 20} y2={y - 16} stroke="var(--kc-khaki-text)" strokeWidth="2" />
        <text x={20} y={y - 22} fill="var(--kc-khaki-text)" fontSize="12" fontWeight="700">
          улица →
        </text>
      </svg>
      <p className="mt-2 text-[10px] leading-snug text-[var(--kc-faint)]">
        Порядок обязателен: утеплитель без пароизоляции со стороны помещения
        набирает влагу и разрушается за 3–5 зим. Стойка {studDepthMm} мм определяет,
        сколько ваты влезает в пирог.
      </p>
    </div>
  );
}
