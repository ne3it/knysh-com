'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ClipboardCopy, Info, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/construction/estimate';
import { formatSavedAt } from '@/lib/construction/format';
import { useConstructionStore } from '@/lib/store/constructionStore';

/**
 * Общие элементы интерфейса калькуляторов раздела «Строительный» (/const).
 *
 * Здесь собрано всё, что повторялось бы в семи компонентах: поля ввода,
 * плитки результатов, живая схема и кнопка экспорта сметы. Один набор
 * классов вместо семи копий — заодно гарантия, что все калькуляторы
 * одинаково выглядят и одинаково читаются с телефона.
 *
 * Эргономика заложена в примитивы, а не в разметку калькуляторов:
 *   - высота интерактивных элементов не меньше 44 px (палец в перчатке);
 *   - inputMode="decimal" вызывает числовую клавиатуру на телефоне;
 *   - шрифт цифр моноширинный, поэтому столбцы результатов не «прыгают»;
 *   - сетка результатов переходит в одну колонку на узком экране.
 */

const FIELD_CLASS =
  'w-full rounded-lg border border-[var(--kc-border-strong)] bg-[var(--kc-surface-2)] px-3 py-2.5 ' +
  'font-mono text-base tabular-nums text-white placeholder:font-sans placeholder:text-[var(--kc-faint)] ' +
  'transition-colors focus:outline-none focus:border-[var(--kc-khaki)] ' +
  'focus:ring-2 focus:ring-[var(--kc-khaki)]/50 min-h-[44px]';

const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--kc-muted)]';

/* ========================================================================== */
/*                                  Поля ввода                                */
/* ========================================================================== */

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Единица измерения, показывается справа внутри поля */
  unit?: string;
  placeholder?: string;
  /** Минимальный шаг для числовой клавиатуры */
  step?: string;
  /** Подсказка под полем: норма, допуск, примечание */
  hint?: string;
  /** Поле отключено (зависит от другого поля) */
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** Числовое поле с единицей измерения */
export function Field({
  label,
  value,
  onChange,
  unit,
  placeholder,
  step = 'any',
  hint,
  disabled,
  className,
  id,
}: FieldProps) {
  // useId обязан вызываться ВСЕГДА, иначе порядок хуков ломается между
// рендерами с явным id и без него. Поэтому генерируем всегда, а prop
// перекрывает значение только на этапе подстановки.
const generatedId = React.useId();
const inputId = id ?? generatedId;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          step={step}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(FIELD_CLASS, unit && 'pr-12', disabled && 'opacity-50')}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--kc-muted)]">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-[var(--kc-faint)]">{hint}</p>}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Выпадающий список: марки бетона, марки смесей, типоразмеры блоков */
export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  hint?: string;
  className?: string;
}) {
  const inputId = React.useId();
  return (
    <div className={className}>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>
      <select
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CLASS, 'font-sans pr-8')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[11px] leading-snug text-[var(--kc-faint)]">{hint}</p>}
    </div>
  );
}

/** Переключатель-сегмент: лента/плита, двускатная/вальмовая, смесь/раствор */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={LABEL_CLASS}>{label}</span>
      <div
        className="inline-flex w-full overflow-hidden rounded-lg border border-[var(--kc-border-strong)]"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'min-h-[44px] flex-1 px-3 py-2 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--kc-khaki-text)]',
              value === option.value
                ? 'bg-[var(--kc-khaki)] text-white'
                : 'bg-[var(--kc-surface-2)] text-[var(--kc-muted)] hover:bg-[var(--kc-surface-3)] hover:text-white'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                                  Результаты                                */
/* ========================================================================== */

interface CardProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Карточка расчёта */
export function Card({ title, icon, children, className }: CardProps) {
  return (
    <section className={cn('kc-card', className)}>
      {title && (
        <h3 className="kc-card-title">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/** Плитка одного числа: подпись сверху, значение снизу */
export function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  /** Выделить главный итог хаки-рамкой */
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        accent
          ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/10'
          : 'border-[var(--kc-border)] bg-[var(--kc-surface-2)]'
      )}
    >
      <span className={cn('kc-stat-label', accent && 'text-[var(--kc-khaki-text)]')}>{label}</span>
      <span className="kc-stat-value">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-[var(--kc-muted)]">{unit}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] leading-snug text-[var(--kc-faint)]">{hint}</span>}
    </div>
  );
}

/**
 * Сетка результатов: 2 колонки на телефоне, 3–4 на широком экране.
 * Именно 2, а не 1: прораб сравнивает объём и массу, и в одну колонку
 * приходится скроллить между связанными цифрами.
 */
export function StatGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const map = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };
  return <div className={cn('grid grid-cols-2 gap-2 sm:gap-3', map[columns])}>{children}</div>;
}

/** Строка позиции сметы: наименование · количество · сумма */
export function EstimateRow({
  label,
  qty,
  unit,
  sum,
  note,
}: {
  label: string;
  qty: string;
  unit: string;
  sum: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dashed border-[var(--kc-border)] py-2 last:border-0">
      <span className="min-w-0 flex-1 text-sm text-white">
        {label}
        {note && <span className="block text-[11px] text-[var(--kc-faint)]">{note}</span>}
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--kc-muted)]">
        {qty} {unit}
      </span>
      <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-white">
        {sum}
      </span>
    </div>
  );
}

/* ========================================================================== */
/*                             Живая SVG-схема                                */
/* ========================================================================== */

/**
 * Контейнер живой схемы.
 *
 * Пропорции линий внутри пересчитываются калькулятором на лету, поэтому
 * здесь важны две вещи: SVG обязан тянуться по ширине телефона
 * (preserveAspectRatio + viewBox) и не должен ломать страницу горизонтальной
 * прокруткой — поэтому ширина обрезается на min-w-0 у родителя.
 */
export function Scheme({
  children,
  caption,
  className,
}: {
  children: React.ReactNode;
  caption?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('kc-scheme', className)}>
      {children}
      {caption && (
        <p className="mt-2 border-t border-dashed border-[var(--kc-border-strong)] pt-2 text-[11px] leading-snug text-[var(--kc-muted)]">
          {caption}
        </p>
      )}
    </div>
  );
}

/** Общие стили линий схем: белые штрихи на графите */
export const SCHEME_STROKE = '#FFFFFF';
export const SCHEME_ACCENT = '#A8B48C';
export const SCHEME_GRID = 'rgba(255,255,255,0.16)';

/* ========================================================================== */
/*                        Экспорт сметы и автосохранение                      */
/* ========================================================================== */

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Кнопка «Скопировать смету».
 *
 * Анимация «Успешно скопировано» — не украшение: на объекте копирование
 * вслепую не работает, прораб должен видеть подтверждение. Состояние ошибки
 * тоже обязательно: буфер обмена блокируется в http-контексте, и молчаливое
 * «ничего не скопировалось» стоило бы ему часа пересчёта вручную.
 */
export function CopyEstimateButton({ text, label = 'Скопировать смету' }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Таймер надо гасить при размонтировании: иначе setState после ухода
  // со страницы даст предупреждение React и лишнюю работу.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = useCallback(async () => {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'error');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), 2400);
  }, [text]);

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'kc-btn-khaki min-h-[44px] w-full sm:w-auto',
          state === 'copied' && 'bg-[var(--kc-khaki-deep)]',
          state === 'error' && 'border-[var(--kc-khaki-text)] text-[var(--kc-khaki-text)]'
        )}
        aria-live="polite"
      >
        {state === 'copied' ? (
          <>
            <Check className="h-4 w-4 animate-pulse-slow" aria-hidden="true" />
            Успешно скопировано
          </>
        ) : state === 'error' ? (
          <>
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Не удалось скопировать
          </>
        ) : (
          <>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            {label}
          </>
        )}
      </button>
      {state === 'error' && (
        <p className="text-[11px] leading-snug text-[var(--kc-khaki-text)] sm:max-w-[260px]">
          Браузер заблокировал буфер обмена. Скопируйте текст вручную или откройте страницу по HTTPS.
        </p>
      )}
    </div>
  );
}

/** Индикатор автосохранения: видно, что введённые данные не потеряются */
export function AutoSaveBadge({ toolId }: { toolId: string }) {
  const savedAt = useConstructionStore((state) => state.savedAt[toolId]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(formatSavedAt(savedAt));
  }, [savedAt]);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-[var(--kc-faint)]"
      role="status"
    >
      {savedAt ? (
        <>
          <Save className="h-3 w-3 text-[var(--kc-khaki-text)]" aria-hidden="true" />
          Автосохранение: {label}
        </>
      ) : (
        <>
          <Info className="h-3 w-3" aria-hidden="true" />
          Введённые данные сохраняются автоматически
        </>
      )}
    </span>
  );
}

/** Кнопка сброса черновика инструмента */
export function ResetDraftButton({ toolId, label = 'Сбросить' }: { toolId: string; label?: string }) {
  const clearDraft = useConstructionStore((state) => state.clearDraft);
  return (
    <button
      type="button"
      onClick={() => clearDraft(toolId)}
      className="kc-btn-ghost min-h-[44px]"
      title="Очистить введённые значения этого расчёта"
    >
      {label}
    </button>
  );
}

/** Ссылка на нормативный документ в подписи блока */
export function StandardNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-dashed border-[var(--kc-border-strong)] px-3 py-2 text-[11px] leading-snug text-[var(--kc-muted)]">
      <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--kc-khaki-text)]" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}