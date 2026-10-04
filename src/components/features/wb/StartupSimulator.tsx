'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Lightbulb,
  Rocket,
  Sparkles,
  Store,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react';
import { cn, formatByn, roundByn } from '@/lib/utils';
import { SHARED_KEYS, useSharedEconomics } from '@/lib/store/sharedEconomicsStore';

/**
 * 🎓 Симулятор: Быстрый Старт
 *
 * Геймифицированный обучающий модуль для новичка, который первый раз выходит на WB из РБ.
 * Формат: выбор роли → два управляемых поля с пульсирующими стрелками и hint bubbles →
 * «Рассчитать экономику» → три последовательные анимированные карточки (УСН 6% от выручки;
 * логистика ПВЗ и выкуп 30%; постоянные расходы и блокирующая наценка 30%) →
 * canvas-confetti → вердикт и переход в «🚀 Планировщик старта».
 *
 * Все суммы — строго BYN. Результат симулятора переносится в общий стор экономики,
 * поэтому реальные калькуляторы открываются уже с числами новичка.
 */

/* ──────────────────────────── Константы учебной модели ──────────────────── */

/** Продавец: учебные значения по умолчанию */
const SELLER_DEFAULTS = {
  cost: 15, // закупка 1 единицы, BYN
  retail: 50, // розничная цена на WB, BYN
} as const;

/** ПВЗ: учебные значения по умолчанию */
const PVZ_DEFAULTS = {
  rent: 1200, // аренда пункта выдачи, BYN/мес
  salary: 900, // зарплата менеджера, BYN/мес
} as const;

const SIM = {
  taxRate: 6, // УСН РБ, % от выручки
  logistics: 300, // логистика ПВЗ, BYN/мес
  buyoutRate: 70, // процент выкупа, % (30% забирает WB)
  buyoutShare: 30, // доля невыкупленного товара, %
  fixedCosts: 713, // постоянные расходы продавца-новичка, BYN/мес
  markupThreshold: 30, // блокирующая наценка, %
  unitsPerMonth: 300, // учебный план: 300 продаж в месяц
  avgCheck: 50, // средний чек ПВЗ, BYN
} as const;

/** Итоговая выручка учебной модели при значениях по умолчанию: 300 × 50 = 15 000 BYN */
const DEMO_REVENUE = SIM.unitsPerMonth * SELLER_DEFAULTS.retail;

type Role = 'seller' | 'pvz';
type Step = 0 | 1 | 2;

interface Results {
  role: Role;
  revenue: number;
  tax: number;
  logisticsAndBuyout: number;
  fixed: number;
  profit: number;
  margin: number;
  costPerUnit: number;
  pricePerUnit: number;
  units: number;
}

interface SimulatorState {
  step: Step;
  role: Role | null;
  sellerCost: string;
  sellerRetail: string;
  pvzRent: string;
  pvzSalary: string;
  results: Results | null;
  revealed: number;
  setStep: (step: Step) => void;
  setRole: (role: Role | null) => void;
  setSellerCost: (value: string) => void;
  setSellerRetail: (value: string) => void;
  setPvzRent: (value: string) => void;
  setPvzSalary: (value: string) => void;
  calculate: () => void;
  nextCard: () => void;
  reset: () => void;
}

/**
 * Прогресс обучения живёт в zustand, поэтому шаг, ввод и результаты не теряются
 * при переключении вкладок блока и при перерисовках родителя.
 */
export const useStartupSimulatorStore = create<SimulatorState>((set, get) => ({
  step: 0,
  role: null,
  sellerCost: String(SELLER_DEFAULTS.cost),
  sellerRetail: String(SELLER_DEFAULTS.retail),
  pvzRent: String(PVZ_DEFAULTS.rent),
  pvzSalary: String(PVZ_DEFAULTS.salary),
  results: null,
  revealed: 0,

  setStep: (step) => set({ step }),
  setRole: (role) => set({ role }),
  setSellerCost: (sellerCost) => set({ sellerCost }),
  setSellerRetail: (sellerRetail) => set({ sellerRetail }),
  setPvzRent: (pvzRent) => set({ pvzRent }),
  setPvzSalary: (pvzSalary) => set({ pvzSalary }),

  calculate: () => {
    const { role, sellerCost, sellerRetail, pvzRent, pvzSalary } = get();
    const isSeller = role !== 'pvz';

    const costPerUnit = isSeller ? num(sellerCost, SELLER_DEFAULTS.cost) : 0;
    const pricePerUnit = isSeller
      ? num(sellerRetail, SELLER_DEFAULTS.retail)
      : SIM.avgCheck;
    const units = SIM.unitsPerMonth;
    const revenue = roundByn(units * pricePerUnit);

    const tax = roundByn((revenue * SIM.taxRate) / 100);

    // Логистика ПВЗ + товар, который забрал WB: 30% выручки не доходит до продавца,
    // а логистику и хранение платить приходится за весь объём.
    const takeRate = SIM.buyoutShare / 100;
    const buyoutLoss = roundByn(revenue * takeRate * (SIM.buyoutRate / 100));
    const logisticsAndBuyout = roundByn(SIM.logistics + buyoutLoss);

    const fixed = isSeller
      ? SIM.fixedCosts
      : roundByn(num(pvzRent, PVZ_DEFAULTS.rent) + num(pvzSalary, PVZ_DEFAULTS.salary));

    const profit = roundByn(
      revenue - tax - logisticsAndBuyout - fixed - costPerUnit * units
    );
    const margin = revenue > 0 ? roundByn((profit / revenue) * 100) : 0;

    set({
      step: 2,
      revealed: 1,
      results: { role: isSeller ? 'seller' : 'pvz', revenue, tax, logisticsAndBuyout, fixed, profit, margin, costPerUnit, pricePerUnit, units },
    });
  },

  nextCard: () => {
    const revealed = get().revealed;
    if (revealed >= 3) return;
    set({ revealed: revealed + 1 });
  },

  reset: () =>
    set({
      step: 0,
      role: null,
      sellerCost: String(SELLER_DEFAULTS.cost),
      sellerRetail: String(SELLER_DEFAULTS.retail),
      pvzRent: String(PVZ_DEFAULTS.rent),
      pvzSalary: String(PVZ_DEFAULTS.salary),
      results: null,
      revealed: 0,
    }),
}));

function num(value: string, fallback: number): number {
  const parsed = parseFloat(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/* ────────────────────────────────── UI ──────────────────────────────────── */

export default function StartupSimulator() {
  const step = useStartupSimulatorStore((state) => state.step);
  const role = useStartupSimulatorStore((state) => state.role);
  const results = useStartupSimulatorStore((state) => state.results);
  const revealed = useStartupSimulatorStore((state) => state.revealed);

  return (
    <div className="simulator-shell mx-auto w-full max-w-4xl space-y-5">
      <StepProgress step={step} />
      {step === 0 && <RoleStep />}
      {step === 1 && role && <InputStep role={role} />}
      {step === 2 && results && <ResultsStep results={results} revealed={revealed} />}
    </div>
  );
}

/* ───────────────────────── Шаг 0: выбор роли ─────────────────────────────── */

const STEP_LABELS = ['Выбор роли', 'Ввод цифр', 'Экономика'];

function StepProgress({ step }: { step: Step }) {
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3" aria-label="Шаги симулятора">
      {STEP_LABELS.map((label, index) => {
        const done = step > index;
        const active = step === index;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                done && 'bg-emerald-500 text-white',
                active && 'sim-pulse bg-[#7b1fa2] text-white',
                !done && !active && 'bg-neutral-100 text-neutral-400'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-xs font-medium sm:text-sm',
                active ? 'text-[#7b1fa2]' : done ? 'text-neutral-700' : 'text-neutral-400'
              )}
            >
              {label}
            </span>
            {index < STEP_LABELS.length - 1 && (
              <ChevronRight className="hidden h-4 w-4 text-neutral-300 sm:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RoleStep() {
  const setRole = useStartupSimulatorStore((state) => state.setRole);
  const setStep = useStartupSimulatorStore((state) => state.setStep);

  const choose = (role: Role) => {
    setRole(role);
    setStep(1);
  };

  return (
    <section className="sim-card space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <header className="text-center">
        <span className="sim-eyebrow mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          🎓 Обучающий модуль
        </span>
        <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl">
          Мой первый запуск на WB из РБ
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600">
          За 3 шага посчитаем экономику и покажем, где новички теряют деньги. Все расчёты — в
          белорусских рублях (BYN), без долларов и курсов.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleCard
          icon={<Store className="h-7 w-7" aria-hidden="true" />}
          title="Я продавец"
          subtitle="Закупаю товар и продаю на Wildberries"
          bullets={['Себестоимость и розница', 'УСН 6% от выручки', 'Логистика и 30% выкупа']}
          onClick={() => choose('seller')}
        />
        <RoleCard
          icon={<Truck className="h-7 w-7" aria-hidden="true" />}
          title="Я открываю ПВЗ"
          subtitle="Пункт выдачи заказов в Беларуси"
          bullets={['Аренда и менеджер', 'Постоянные расходы', 'Точка безубыточности']}
          onClick={() => choose('pvz')}
        />
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-900">
        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#7b1fa2]" aria-hidden="true" />
        <span>
          Если расчёт вышел в минус — это лучше, чем узнать об этом на складе. В конце ты получишь
          вердикт и перейдёшь к реальным калькуляторам с уже подставленными цифрами.
        </span>
      </p>
    </section>
  );
}

function RoleCard({
  icon,
  title,
  subtitle,
  bullets,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'sim-role group flex flex-col items-start gap-2 rounded-xl border-2 border-neutral-200 bg-white p-4 text-left',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7b1fa2] hover:shadow-lg',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b1fa2] focus-visible:ring-offset-2'
      )}
    >
      <span className="rounded-xl bg-violet-100 p-2.5 text-[#7b1fa2] transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <span className="text-base font-semibold text-neutral-900">{title}</span>
      <span className="text-xs text-neutral-500">{subtitle}</span>
      <ul className="mt-1 space-y-0.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-xs text-neutral-600">• {bullet}</li>
        ))}
      </ul>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#7b1fa2]">
        Начать
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

/* ───────────────────── Шаг 1: управляемый ввод с подсказками ───────────────── */

function InputStep({ role }: { role: Role }) {
  const isSeller = role === 'seller';
  const sellerCost = useStartupSimulatorStore((state) => state.sellerCost);
  const sellerRetail = useStartupSimulatorStore((state) => state.sellerRetail);
  const pvzRent = useStartupSimulatorStore((state) => state.pvzRent);
  const pvzSalary = useStartupSimulatorStore((state) => state.pvzSalary);
  const setSellerCost = useStartupSimulatorStore((state) => state.setSellerCost);
  const setSellerRetail = useStartupSimulatorStore((state) => state.setSellerRetail);
  const setPvzRent = useStartupSimulatorStore((state) => state.setPvzRent);
  const setPvzSalary = useStartupSimulatorStore((state) => state.setPvzSalary);
  const calculate = useStartupSimulatorStore((state) => state.calculate);
  const setStep = useStartupSimulatorStore((state) => state.setStep);
  const setRole = useStartupSimulatorStore((state) => state.setRole);

  return (
    <section className="sim-card space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <header className="text-center">
        <h2 className="text-xl font-bold text-neutral-900">
          {isSeller ? 'Сколько стоит твой товар?' : 'Сколько стоит твой ПВЗ?'}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Валюта — BYN. Под каждым полем есть подсказка: стрелки переключают советы,
          а лампочка показывает их текст.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {isSeller ? (
          <>
            <HintInput
              label="Закупка 1 штуки"
              suffix="BYN"
              value={sellerCost}
              onChange={setSellerCost}
              tips={[
                'Сколько ты платишь поставщику за одну единицу. Учебный пример — 15 BYN.',
                'Закупочная цена — самая частая причина ухода в минус на старте.',
                'Не забудь про доставку до склада РБ: её тоже дели на партию.',
              ]}
            />
            <HintInput
              label="Розничная цена на WB"
              suffix="BYN"
              value={sellerRetail}
              onChange={setSellerRetail}
              tips={[
                'Цена, которую платит покупатель. Учебный пример — 50 BYN.',
                'Цена должна покрывать закупку, налог и логистику, иначе работаешь в минус.',
                'После комиссии WB и СПП от 50 BYN на руках остаётся заметно меньше.',
              ]}
            />
          </>
        ) : (
          <>
            <HintInput
              label="Аренда пункта выдачи"
              suffix="BYN/мес"
              value={pvzRent}
              onChange={setPvzRent}
              tips={[
                'Ежемесячная аренда. Учебный пример — 1200 BYN.',
                'Аренда платится, даже если через твой ПВЗ не прошёл ни один заказ.',
                'Смотри на трафик: аренда в проходном месте быстро съедает выручку.',
              ]}
            />
            <HintInput
              label="Зарплата менеджера"
              suffix="BYN/мес"
              value={pvzSalary}
              onChange={setPvzSalary}
              tips={[
                'Фонд оплаты труда. Учебный пример — 900 BYN.',
                'Один менеджер справляется примерно с 500–700 выдачами в месяц.',
                'В месяц January и декабрь зарплата может вырасти из-за отпусков и премий WB.',
              ]}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={calculate}
          className="sim-cta inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#7b1fa2] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#7b1fa2]/25 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b1fa2] focus-visible:ring-offset-2"
        >
          <Calculator className="h-5 w-5" aria-hidden="true" />
          Рассчитать экономику
        </button>
        <button
          type="button"
          onClick={() => {
            setRole(null);
            setStep(0);
          }}
          className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          Сменить роль
        </button>
      </div>
    </section>
  );
}

/**
 * Поле ввода с «управляемым» поведением: пульсирующие фиолетовые стрелки переключают
 * подсказки, лампочка показывает hint bubble поверх поля.
 */
function HintInput({
  label,
  suffix,
  value,
  onChange,
  tips,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  tips: string[];
}) {
  const [tipIndex, setTipIndex] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const bubbleId = `sim-hint-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const cycle = (direction: 1 | -1) =>
    setTipIndex((index) => (index + direction + tips.length) % tips.length);

  return (
    <div className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={bubbleId} className="text-sm font-semibold text-neutral-800">
          {label}
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label={`Предыдущая подсказка к полю «${label}»`}
            className="sim-arrow-left rounded-lg p-1 text-[#7b1fa2] transition-colors hover:bg-violet-100"
          >
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label={`Следующая подсказка к полю «${label}»`}
            className="sim-arrow-right rounded-lg p-1 text-[#7b1fa2] transition-colors hover:bg-violet-100"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setBubbleOpen((open) => !open)}
            aria-expanded={bubbleOpen}
            aria-controls={bubbleId}
            aria-label="Показать подсказку"
            className="sim-bulb rounded-lg p-1 text-amber-600 transition-colors hover:bg-amber-100"
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={bubbleId}
          type="number"
          inputMode="numeric"
          min={0}
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums text-neutral-900 focus:border-[#7b1fa2] focus:outline-none focus:ring-2 focus:ring-[#7b1fa2]/30"
          aria-describedby={`${bubbleId}-text`}
        />
        <span className="shrink-0 text-sm font-semibold text-neutral-500">{suffix}</span>
      </div>

      <p
        id={`${bubbleId}-text`}
        role="note"
        className={cn(
          'sim-bubble mt-2 rounded-lg bg-[#7b1fa2] px-3 py-2 text-xs leading-snug text-white',
          bubbleOpen ? 'sim-bubble-visible' : ''
        )}
      >
        {tips[tipIndex]}
      </p>
    </div>
  );
}

/* ───────────────── Шаг 2: три анимированные карточки расчёта ─────────────── */

function ResultsStep({ results, revealed }: { results: Results; revealed: number }) {
  const nextCard = useStartupSimulatorStore((state) => state.nextCard);
  const reset = useStartupSimulatorStore((state) => state.reset);
  const setSharedValues = useSharedEconomics((state) => state.setValues);

  useCelebration(revealed >= 3);

  // Результат обучения подставляем в общие переменные блока:
  // реальные калькуляторы откроются уже с числами новичка.
  useEffect(() => {
    setSharedValues({
      [SHARED_KEYS.cost]: String(results.costPerUnit),
      [SHARED_KEYS.retailPrice]: String(results.pricePerUnit),
      [SHARED_KEYS.commissionRate]: String(SIM.taxRate),
      [SHARED_KEYS.taxRate]: String(SIM.taxRate),
      [SHARED_KEYS.batchVolume]: String(results.units),
      [SHARED_KEYS.dailySales]: String(Math.round(results.units / 30)),
    });
  }, [results, setSharedValues]);

  const markup =
    results.costPerUnit > 0
      ? roundByn(((results.pricePerUnit - results.costPerUnit) / results.costPerUnit) * 100)
      : 0;
  const verdict = useMemo(() => buildVerdict(results, markup), [results, markup]);

  return (
    <section className="space-y-4">
      {/* Карточка 1: УСН 6% от выручки */}
      <ResultCard
        step={1}
        visible={revealed >= 1}
        accent="violet"
        icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        title={`Налог УСН ${SIM.taxRate}% от выручки`}
      >
        <p className="text-sm text-neutral-700">
          Учебная выручка: {results.units} × {formatByn(results.pricePerUnit)} BYN ={' '}
          <strong className="tabular-nums">{formatByn(results.revenue)} BYN</strong> в месяц.
          Налог платится от оборота, а не от прибыли: заработал или нет — налог одинаковый.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Metric label="Выручка" value={`${formatByn(results.revenue)} BYN`} />
          <Metric label={`УСН ${SIM.taxRate}%`} value={`− ${formatByn(results.tax)} BYN`} tone="danger" />
        </div>
      </ResultCard>

      {/* Карточка 2: логистика ПВЗ и 30% выкупа */}
      <ResultCard
        step={2}
        visible={revealed >= 2}
        accent="amber"
        icon={<Truck className="h-5 w-5" aria-hidden="true" />}
        title="Логистика ПВЗ и 30% невыкупленного"
      >
        <p className="text-sm text-neutral-700">
          WB забирает 30% товара: он остаётся на складе маркетплейса и не приносит тебе денег.
          Логистику и хранение при этом платишь за весь объём — это и есть главная ловушка
          новичка.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label="Логистика и хранение" value={`${formatByn(SIM.logistics)} BYN`} />
          <Metric label="Забрал WB" value={`${SIM.buyoutShare}%`} tone="warn" />
          <Metric
            label="Итого расход"
            value={`− ${formatByn(results.logisticsAndBuyout)} BYN`}
            tone="danger"
          />
        </div>
      </ResultCard>

      {/* Карточка 3: постоянные расходы и блокирующая наценка */}
      <ResultCard
        step={3}
        visible={revealed >= 3}
        accent="rose"
        icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
        title="Постоянные расходы и блокирующая наценка"
      >
        <p className="text-sm text-neutral-700">
          {results.role === 'pvz'
            ? `Аренда ${formatByn(results.fixed - SIM.logistics - PVZ_DEFAULTS.salary)} BYN и менеджер 900 BYN платятся каждый месяц независимо от количества заказов. Добавь логистику — и получишь постоянные расходы ${formatByn(results.fixed + SIM.logistics)} BYN.`
            : `Постоянные расходы новичка — ${formatByn(SIM.fixedCosts)} BYN в месяц: аренда склада, менеджер и логистика. Их нужно покрывать до того, как появится прибыль.`}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label="Постоянные расходы" value={`${formatByn(results.fixed)} BYN`} />
          <Metric label="Цена продажи" value={`${formatByn(results.pricePerUnit)} BYN`} />
          <Metric label="Себестоимость" value={`${formatByn(results.costPerUnit)} BYN`} />
        </div>

        <div className="sim-threshold mt-4 flex items-start gap-3 rounded-xl border-2 border-dashed border-[#7b1fa2] bg-violet-50 p-3">
          <span className="rounded-lg bg-[#7b1fa2] p-2 text-white">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-violet-950">
            Блокирующая наценка — <strong className="tabular-nums">{SIM.markupThreshold}%</strong>.
            {results.role === 'pvz' ? (
              <>
                {' '}
                У ПВЗ нет закупочной цены: считаем прибыль с одного заказа —{' '}
                <strong className="tabular-nums">{formatByn(results.revenue - results.fixed - results.logisticsAndBuyout - results.tax)} BYN</strong>{' '}
                с {results.units} выдач в месяц.
              </>
            ) : (
              <>
                {' '}
                Твоя наценка —{' '}
                <strong className="tabular-nums">
                  {formatByn(markup, 1)}% ({formatByn(results.pricePerUnit - results.costPerUnit)}{' '}
                  BYN с штуки)
                </strong>
                .{' '}
                {markup >= SIM.markupThreshold
                  ? 'Наценка покрывает все расходы — товар можно закупать.'
                  : `Не хватает ${formatByn(SIM.markupThreshold - markup, 1)}%: снижай закупку или поднимай розницу, иначе первая же акция уведёт в минус.`}
              </>
            )}
          </p>
        </div>
      </ResultCard>

      {/* Итоговый вердикт */}
      {revealed >= 3 && (
        <div className="sim-verdict animate-fade-in space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col items-center text-center">
            <span
              className={cn(
                'rounded-2xl p-3',
                results.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              )}
            >
              {results.profit >= 0 ? (
                <Rocket className="h-8 w-8" aria-hidden="true" />
              ) : (
                <TriangleAlert className="h-8 w-8" aria-hidden="true" />
              )}
            </span>
            <h3 className="mt-3 text-xl font-bold text-neutral-900">{verdict.title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">{verdict.text}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Metric
              label="Прибыль в месяц"
              value={`${formatByn(results.profit)} BYN`}
              tone={results.profit >= 0 ? 'ok' : 'danger'}
              large
            />
            <Metric label="Рентабельность" value={`${formatByn(results.margin, 1)}%`} large />
            <Metric
              label="Прибыль с единицы"
              value={`${formatByn(
                results.units > 0 ? results.profit / results.units : 0
              )} BYN`}
              large
            />
          </div>

          <p className="rounded-xl bg-neutral-100 p-3 text-xs text-neutral-600">{verdict.advice}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <GoToPlannerButton />
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Пройти заново
            </button>
          </div>
        </div>
      )}

      {revealed < 3 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={nextCard}
            className="sim-next inline-flex items-center gap-2 rounded-xl bg-[#7b1fa2] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b1fa2] focus-visible:ring-offset-2"
          >
            {revealed === 1 ? 'Показать логистику и выкуп' : 'Показать постоянные расходы'}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

/** Кнопка перехода в «🚀 Планировщик старта» (инструмент вне меню, открывается по /wb?tool=startup-planner) */
function GoToPlannerButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push('/wb?tool=startup-planner')}
      className="sim-cta inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#7b1fa2] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#7b1fa2]/25 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b1fa2] focus-visible:ring-offset-2"
    >
      <Rocket className="h-5 w-5" aria-hidden="true" />
      Перейти к реальным расчетам
    </button>
  );
}

function ResultCard({
  step,
  visible,
  icon,
  title,
  accent,
  children,
}: {
  step: number;
  visible: boolean;
  icon: React.ReactNode;
  title: string;
  accent: 'violet' | 'amber' | 'rose';
  children: React.ReactNode;
}) {
  if (!visible) return null;

  return (
    <article
      className={cn(
        'sim-result-card animate-fade-in-up rounded-2xl border-2 bg-white p-5',
        accent === 'violet' && 'border-violet-200',
        accent === 'amber' && 'border-amber-200',
        accent === 'rose' && 'border-rose-200'
      )}
      aria-live="polite"
    >
      <header className="mb-2 flex items-center gap-3">
        <span
          className={cn(
            'rounded-xl p-2 text-white',
            accent === 'violet' && 'bg-[#7b1fa2]',
            accent === 'amber' && 'bg-amber-500',
            accent === 'rose' && 'bg-rose-500'
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Шаг {step} из 3
          </p>
          <h3 className="text-base font-bold text-neutral-900">{title}</h3>
        </div>
      </header>
      {children}
    </article>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  large = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  large?: boolean;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={cn(
          'tabular-nums font-bold',
          large ? 'mt-0.5 text-lg' : 'mt-0.5 text-sm',
          tone === 'ok' && 'text-emerald-700',
          tone === 'warn' && 'text-amber-700',
          tone === 'danger' && 'text-rose-700',
          tone === 'neutral' && 'text-neutral-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ────────────────────────────────── Вердикт ──────────────────────────────── */

function buildVerdict(results: Results, markup: number) {
  if (results.profit >= 0 && markup >= SIM.markupThreshold) {
    return {
      title: 'Экономика сходится 🎉',
      text: `Ты зарабатываешь ${formatByn(results.profit)} BYN в месяц при наценке ${formatByn(markup, 1)}%. Формат рабочий — его можно масштабировать.`,
      advice:
        'Следующий шаг — перенести эти цифры в «Планировщик старта» и посчитать стартовый капитал под первую партию.',
    };
  }
  if (results.profit >= 0) {
    return {
      title: 'В плюсе, но наценка хрупкая',
      text: `Прибыль ${formatByn(results.profit)} BYN есть, а наценка ${formatByn(markup, 1)}% ниже безопасных ${SIM.markupThreshold}%. Первая же акция WB уведёт тебя в минус.`,
      advice:
        'Снижай закупочную цену или поднимай розницу. Быстрый способ — блок «Планировщик старта», вкладка «Защита от акций (Сплит)».',
    };
  }
  return {
    title: 'Пока в минусе — и это нормально',
    text: `При текущих цифрах ты теряешь ${formatByn(Math.abs(results.profit))} BYN в месяц. Ничего не потеряно: считать на бумаге дешевле, чем терять деньги на складе.`,
    advice:
      'Разберись с наценкой и постоянными расходами в «Планировщике старта»: там есть сплит-калькулятор под акции и расчёт взносов ФСЗН.',
  };
}

/* ─────────────────────── Конфетти на третьем шаге ────────────────────────── */

function useCelebration(active: boolean) {
  const fired = useRef(false);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;

    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const colors = ['#7b1fa2', '#f59e0b', '#10b981', '#ffffff'];
    const burst = (particleRatio: number, options: Record<string, unknown>) =>
      confetti({
        colors,
        origin: { y: 0.6 },
        particleCount: Math.floor(200 * particleRatio),
        ...options,
      });

    burst(0.25, { spread: 26, startVelocity: 55 });
    burst(0.2, { spread: 60 });
    burst(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    burst(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    burst(0.1, { spread: 120, startVelocity: 45 });
  }, [active]);
}
