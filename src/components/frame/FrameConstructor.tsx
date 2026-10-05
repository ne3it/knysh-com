'use client';

import React, { useMemo } from 'react';
import {
  Banknote,
  ClipboardList,
  FileDown,
  Hammer,
  Layers,
  Ruler,
  Triangle,
  Anchor,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import {
  DownloadConceptButton,
  FrameButton,
  FrameCard,
  FrameEstimateRow,
  FrameStat,
  FrameStatGrid,
  StandardNote,
} from '@/components/frame/ui';
import { FoundationStep } from './steps/FoundationStep';
import { WallsStep } from './steps/WallsStep';
import { PieStep } from './steps/PieStep';
import { RoofStep } from './steps/RoofStep';
import { FramePlan, useFrameHotkeys } from './FramePlan';
import {
  FRAME_STEPS,
  REQUIRED_R_M2C_PER_W,
  STUD_STEP_MM,
  safeNum,
  useFrameEstimate,
  useFrameHydrated,
  useFrameStore,
  type FrameStepId,
} from '@/lib/frame';
import { formatByn } from '@/lib/construction';
import type { Feature } from '@/types/section';

/**
 * КОНСТРУКТОР КАРКАСНЫХ ДОМОВ (/frame) — полный цикл по ТКП 45-5.05-146-2009.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ПОРЯДОК ИЗ ЧЕТЫРЁХ ШАГОВ НЕ ПЕРЕСТАВЛЯЕТСЯ
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. Обвязка и фундамент (сваи, брус, гидроизоляция, крепёж)
 *   2. Стены (стойки с шагом 590 мм, укосины, ригели)
 *   3. Пирог стены (утеплитель в м³, пароизоляция, ветрозащита)
 *   4. Кровля (стропильная система, обрешётка)
 *
 * Каждый шаг опирается на геометрию предыдущего, и на объекте бригада идёт
 * именно в этой последовательности. Поэтому шаги идут по порядку и не
 * скрываются в аккордеон: прораб должен видеть весь цикл целиком.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЛИПКАЯ ПАНЕЛЬ ИТОГА — ГЛАВНОЕ РЕШЕНИЕ ЭРГОНОМИКИ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Прораб тянет окно мышью и СРАЗУ хочет видеть, что изменилось в деньгах. Если
 * итог внизу страницы, а схема наверху, он либо не видит цифру, либо скроллит
 * и теряет схему из виду. Поэтому итоговая панель (`sticky top-0`) следует за
 * пользователем по всей длине конструктора — это и есть «мгновенный пересчёт,
 * выведенный в BYN».
 *
 * НА ТЕЛЕФОНЕ липкая панель занимает место: на экране 5,5" шапка с шестью
 * цифрами съела бы треть экрана. Поэтому на мобильных показываются ТРИ главные
 * цифры (итого, материалы, работы), а полная разбивка — в раскрываемой панке.
 */

/** Иконки шагов: сопоставление id → компонент lucide */
const STEP_ICONS: Record<FrameStepId, React.ComponentType<{ className?: string }>> = {
  foundation: Anchor,
  walls: Ruler,
  pie: Layers,
  roof: Triangle,
};

export default function FrameConstructor({ feature }: { feature: Feature }) {
  const hydrated = useFrameHydrated();
  const estimate = useFrameEstimate();
  const activeStep = useFrameStore((s) => s.activeStep);
  const setActiveStep = useFrameStore((s) => s.setActiveStep);

  // Горячие клавиши: Ctrl+Z / Delete работают на всей странице конструктора
  useFrameHotkeys();

  const setStep = (step: FrameStepId) => setActiveStep(step);

  /**
   * Полный документ для копирования: сначала ТЗ (технология), затем смета
   * (деньги). Порядок неслучаен: прораб отправляет подрядчику сначала ТЗ, а
   * заказчику — смету, и в одном сообщении технология должна идти первой.
   */
  const conceptDocument = useMemo(() => {
    return `${estimate.specText}\n\n${'═'.repeat(72)}\n\n${estimate.estimateText}`;
  }, [estimate.specText, estimate.estimateText]);

  if (!hydrated) {
    return <FrameSkeleton />;
  }

  const { totals, lines } = estimate;
  const rWarning = estimate.specText.includes('НЕДОСТАТОЧНО');

  return (
    <SectionContentWrapper feature={feature}>
      <div className="mx-auto max-w-6xl space-y-4">
        {/* ── Липкая панель итога ── */}
        <TotalBar totals={totals} rWarning={rWarning} />

        {/* ── Навигация по шагам ── */}
        <StepNav activeStep={activeStep} onSelect={setStep} />

        {/* ── Шаги конструктора ── */}
        <div className="space-y-4">
          <FoundationStep />
          <WallsStep />
          <PieStep />
          <RoofStep />
        </div>

        {/* ── Схема и drag-and-drop ── */}
        <FramePlan />

        {/* ── Смета ── */}
        <CardEstimate
          lines={lines}
          totals={totals}
          conceptDocument={conceptDocument}
        />
      </div>
    </SectionContentWrapper>
  );
}

/* ========================================================================== */
/*                            ЛИПКАЯ ПАНЕЛЬ ИТОГА                                */
/* ========================================================================== */

/**
 * Панель итогов, липкая к верху экрана.
 *
 * Показывает ТРИ цифры: всего, материалы, работы. На широком экране — плюс
 * площадь и R стены, потому что там есть место. На телефоне лишние цифры
 * пришлось бы убирать: они не читаются в движении, а место занимают.
 */
function TotalBar({
  totals,
  rWarning,
}: {
  totals: { material: number; labor: number; total: number; materialSharePercent: number };
  rWarning: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="sticky top-0 z-20 border-2 border-[var(--kc-khaki)] bg-[var(--kc-surface)]/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-baseline gap-4">
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
              Всего по дому
            </span>
            <span className="block font-mono text-2xl font-bold tabular-nums leading-tight text-white sm:text-3xl">
              {formatByn(totals.total)}
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-[var(--kc-muted)]">
              Материалы ({totals.materialSharePercent} %)
            </span>
            <span className="block font-mono text-sm font-bold tabular-nums text-white">
              {formatByn(totals.material)}
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-[var(--kc-muted)]">
              Работы ({Math.round(100 - totals.materialSharePercent)} %)
            </span>
            <span className="block font-mono text-sm font-bold tabular-nums text-white">
              {formatByn(totals.labor)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-bg)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--kc-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ minHeight: 44 }}
          aria-expanded={expanded}
        >
          {expanded ? 'Скрыть' : 'Разбивка'}
        </button>
      </div>

      {/* Предупреждение о теплотехнике — важнее любых денег */}
      {rWarning && (
        <p className="flex items-center gap-2 border-t-2 border-red-500/60 bg-red-950/40 px-3 py-2 text-[11px] leading-snug text-red-200">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Толщины утеплителя не хватает до нормы {REQUIRED_R_M2C_PER_W} м²·°C/Вт.
          Дом будет конденсировать влагу — увеличьте толщину на шаге 3.
        </p>
      )}

      {expanded && (
        <div className="grid grid-cols-2 gap-2 border-t-2 border-dashed border-[var(--kc-border-strong)] p-3 sm:grid-cols-4">
          <FrameStat label="Материалы" value={formatByn(totals.material)} hint="с учётом региона" />
          <FrameStat label="Работы" value={formatByn(totals.labor)} hint="монтаж + установка" />
          <FrameStat label="Доля материалов" value={`${totals.materialSharePercent} %`} />
          <FrameStat label="Позиций в смете" value={String(FRAME_STEPS.length)} unit="шагов" hint="плюс проёмы" />
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                             НАВИГАЦИЯ ПО ШАГАМ                               */
/* ========================================================================== */

/**
 * Четыре кнопки шагов.
 *
 * Не вкладки с прокруткой, а сетка: на телефоне четыре кнопки в ряд не
 * помещаются (по 90 px каждая), поэтому на узком экране это две строки по две.
 * Активный шаг — заливка хаки, чтобы было видно с одного взгляда, где прораб
 * сейчас находится.
 */
function StepNav({
  activeStep,
  onSelect,
}: {
  activeStep: FrameStepId;
  onSelect: (step: FrameStepId) => void;
}) {
  return (
    <nav aria-label="Шаги конструктора">
      <ol className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        {FRAME_STEPS.map((step) => {
          const Icon = STEP_ICONS[step.id];
          const isActive = activeStep === step.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 border-2 p-2.5 text-left transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  isActive
                    ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)] text-white'
                    : 'border-[var(--kc-border-strong)] bg-[var(--kc-surface)] text-[var(--kc-muted)] hover:border-[var(--kc-khaki-text)] hover:text-white'
                )}
                style={{ minHeight: 56 }}
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-80">
                    Шаг {step.number}
                  </span>
                  <span className="block text-[12px] font-bold leading-tight">{step.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ========================================================================== */
/*                                СМЕТА                                        */
/* ========================================================================== */

/**
 * Полная смета с разбивкой по шагам и кнопкой скачивания.
 *
 * Позиции сгруппированы по шагу конструктора, а не по типу («все бетонные
 * работы вместе»). Причина: прораб сверяет смету с ТЗ, где порядок — шаги.
 * Если смета идёт в другом порядке, проверка превращается в ручной поиск.
 */
function CardEstimate({
  lines,
  totals,
  conceptDocument,
}: {
  lines: Array<{ label: string; unit: string; qty: number; price: number; note?: string; stepId?: string }>;
  totals: { material: number; labor: number; total: number };
  conceptDocument: string;
}) {
  // Группировка позиций по шагам сохраняет порядок первого появления.
  const groups = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.stepId ?? 'other';
      const existing = map.get(key);
      if (existing) existing.push(line);
      else map.set(key, [line]);
    }
    return Array.from(map.entries());
  }, [lines]);

  const groupLabel = (stepId: string) => {
    if (stepId === 'elements') return 'Окна, двери, терраса';
    const step = FRAME_STEPS.find((item) => item.id === stepId);
    return step ? `Шаг ${step.number}. ${step.title}` : 'Прочее';
  };

  return (
    <FrameCard
      title="Смета и техническое задание"
      subtitle="Все расчёты — в белорусских рублях, по средним ценам РБ"
      icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {groups.map(([stepId, items]) => (
          <div key={stepId}>
            <h4 className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
              <Hammer className="h-3 w-3" aria-hidden="true" />
              {groupLabel(stepId)}
            </h4>
            {items.map((line, index) => (
              <FrameEstimateRow
                key={`${line.label}-${index}`}
                label={line.label}
                qty={line.qty.toFixed(2)}
                unit={line.unit}
                sum={formatByn(line.qty * line.price)}
                note={line.note}
              />
            ))}
          </div>
        ))}

        <div className="border-t-2 border-[var(--kc-khaki)] pt-3">
          <FrameStatGrid columns={3}>
            <FrameStat label="Материалы" value={formatByn(totals.material)} />
            <FrameStat label="Работы" value={formatByn(totals.labor)} />
            <FrameStat label="Всего" value={formatByn(totals.total)} accent />
          </FrameStatGrid>
        </div>

        {/* Скачивание: ТЗ + смета одним документом, с автокопированием */}
        <div className="border-2 border-dashed border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-3">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--kc-khaki-text)]">
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Концепция для заказчика
          </h4>
          <p className="mb-3 text-[11px] leading-snug text-[var(--kc-muted)]">
            Одна кнопка собирает ТЗ (технология по шагам с нормативными ссылками)
            и смету в BYN, и кладёт всё в буфер обмена. Вставьте в Telegram,
            WhatsApp или «Смету» на объекте.
          </p>
          <DownloadConceptButton text={conceptDocument} />
        </div>

        <StandardNote>
          Нормативная база: ТКП 45-5.05-146-2009 «Деревянные каркасные здания»,
          СН 5.03.01-2018 (бетон и железобетон), СН 2.01.01-2019 (промерзание),
          СН 0.81-02 (снеговые нагрузки), СП 2.04.05 (сопротивление
          теплопередаче {REQUIRED_R_M2C_PER_W} м²·°C/Вт). Шаг стоек {STUD_STEP_MM} мм
          выбран под плиты утеплителя 600 мм. Цены — средние по РБ, склад, без
          доставки крупногабаритным. Расчёт предварительный: окончательная смета
          после выезда на объект.
        </StandardNote>
      </div>
    </FrameCard>
  );
}

/* ========================================================================== */
/*                              СКЕЛЕТОН                                       */
/* ========================================================================== */

/**
 * Заглушка на время гидрации localStorage.
 *
 * Не декоративная: без неё сервер отдаёт пустую схему, а клиент — полную, и
 * React выдаёт ошибку гидрации, которая выглядит как «разъехавшийся» экран.
 * Скелетон повторяет структуру конструктора, поэтому переход после гидрации
 * не вызывает скачка вёрстки.
 */
function FrameSkeleton() {
  return (
    <div className="flex h-full flex-col bg-[var(--kc-surface)]" data-section-theme="graphite">
      <div className="border-b-2 border-[var(--kc-border)] p-4">
        <div className="h-6 w-56 animate-pulse bg-[var(--kc-surface-3)]" />
      </div>
      <div className="space-y-4 p-4">
        <div className="h-20 animate-pulse border-2 border-[var(--kc-border)] bg-[var(--kc-surface-2)]" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse border-2 border-[var(--kc-border)] bg-[var(--kc-surface-2)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse border-2 border-[var(--kc-border)] bg-[var(--kc-surface-2)]" />
        <div className="h-40 animate-pulse border-2 border-[var(--kc-border)] bg-[var(--kc-surface-2)]" />
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          ЭКСПОРТ ВСПОМОГАТЕЛЬНЫХ                               */
/* ========================================================================== */

/** Быстрый доступ к итогу для будущих виджетов (виджет в шапке, печать) */
export { TotalBar };

/** Реэкспорт шага для мгновенной перерисовки при смене параметров */
export { FoundationStep, WallsStep, PieStep, RoofStep };
