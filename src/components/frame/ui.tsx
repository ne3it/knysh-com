'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ClipboardCopy, Hammer, Undo2, Redo2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/frame/estimate';
import { MIN_TOUCH_TARGET_PX } from '@/lib/frame/constants';

/**
 * БРУТАЛЬНЫЕ ПРИМИТИВЫ КОНСТРУКТОРА КАРКАСНЫХ ДОМОВ (/frame).
 *
 * ОТЛИЧИЕ ОТ `components/construction/ui.tsx` — НЕ В КОЛИЧЕСТВЕ, А В СТИЛЕ:
 * там мягкие карточки с закруглёнными углами, здесь прямые углы и рамки в 2 px.
 * Причина не в моде, а в задаче: прораб смотрит в чертёж и параллельно ведёт
 * расчёт. Мягкие серые подписи на графите нечитаемы при дневном свете, а
 * тонкие 1-пиксельные рамки не видно в перчатке. Брутальный стиль решает обе
 * проблемы: толстая рамка = «за это можно схватиться», белый текст на графите
 * = максимальный контраст.
 *
 * ПАЛИТРА — РОВНО ТРИ ЦВЕТА, как в задании:
 *   Графит #121412 — фон (--fc-bg)
 *   Хаки   #4B5338 — акцент: активные кнопки, фокус, выделение итога (--fc-khaki)
 *   Белый           — весь текст и линии чертежа (--fc-text)
 *
 * Здесь используется `data-section-theme="graphite"`, поэтому CSS-переменные
 * `var(--kc-*)` наследуются из темы /const — палитра не дублируется.
 */

/* ========================================================================== */
/*                          КОНСТАНТЫ ОФОРМЛЕНИЯ                                */
/* ========================================================================== */

/** Рамка 2 px — та самая, за которую цепляется палец в перчатке */
const BRUTE_BORDER = 'border-2 border-[var(--kc-border-strong)]';

/** Активная хаки-кнопка */
const BRUTE_BTN = 'bg-[var(--kc-khaki)] border-[var(--kc-khaki)] hover:bg-[var(--kc-khaki-deep)]';

/* ========================================================================== */
/*                                ПОЛЯ ВВОДА                                    */
/* ========================================================================== */

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  step?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Числовое поле в брутальном стиле.
 *
 * Значение ХРАНИТСЯ СТРОКОЙ и никогда не приводится к числу на лету: иначе при
 * вводе «12,» на полпути React перезапишет поле числом 12 и пользователь
 * потеряет запятую — а это ровно тот случай, когда прораб думает «я ввожу
 * 12,75» и получает 12.
 *
 * Высота 48 px — с запасом над 44: на поле попадает ещё и системный жест
 * «свайпнуть вбок», и минимальная высота в 44 иногда даёт ложное срабатывание
 * навигации при фокусе.
 */
export function Field({ label, value, onChange, unit, placeholder, step = 'any', hint, disabled, className }: FieldProps) {
  const id = React.useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          step={step}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'w-full border-2 bg-[var(--kc-bg)] px-3 py-3',
            'font-mono text-base tabular-nums text-white placeholder:font-sans placeholder:text-[var(--kc-faint)]',
            'transition-colors focus:outline-none focus:border-[var(--kc-khaki-text)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            BRUTE_BORDER
          )}
          style={{ minHeight: MIN_TOUCH_TARGET_PX + 4 }}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--kc-muted)]">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[10px] leading-tight text-[var(--kc-faint)]">{hint}</p>}
    </div>
  );
}

export interface FrameSelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Выпадающий список в брутальном стиле.
 *
 * `hint` печатается справа от подписи мелким шрифтом: нормативная привязка
 * («ТКП 45-5.05-146-2009») должна быть видна при ВЫБОРЕ, а не искаться в
 * справке потом.
 */
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
  options: FrameSelectOption[];
  hint?: string;
  className?: string;
}) {
  const id = React.useId();
  const selected = options.find((option) => option.value === value);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">{label}</span>
        {selected?.hint && (
          <span className="truncate text-[10px] text-[var(--kc-faint)]">{selected.hint}</span>
        )}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full appearance-none border-2 bg-[var(--kc-bg)] px-3 py-3 pr-8',
          'font-sans text-sm text-white transition-colors focus:outline-none focus:border-[var(--kc-khaki-text)]',
          BRUTE_BORDER
        )}
        style={{ minHeight: MIN_TOUCH_TARGET_PX + 4 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[10px] leading-tight text-[var(--kc-faint)]">{hint}</p>}
    </div>
  );
}

/**
 * Переключатель-сегмент: брутальный, без скруглений.
 *
 * Активный сегмент — залитый хаки с белым текстом. Именно заливка, а не
 * подчёркивание: на телефоне подчёркивание не видно, заливку видно сразу.
 */
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
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--kc-khaki-text)]">
        {label}
      </span>
      <div className={cn('flex overflow-hidden', BRUTE_BORDER)} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'flex-1 px-2 py-2.5 text-xs font-bold transition-colors focus:outline-none',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white',
              value === option.value
                ? 'bg-[var(--kc-khaki)] text-white'
                : 'bg-[var(--kc-bg)] text-[var(--kc-muted)] hover:bg-[var(--kc-surface-2)] hover:text-white'
            )}
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          КАРТОЧКИ И РЕЗУЛЬТАТЫ                                */
/* ========================================================================== */

/**
 * Карточка шага конструктора.
 *
 * Прямые углы, рамка 2 px, нумерация шага слева крупным хаки — чтобы порядок
 * шагов 1→4 был виден с одного взгляда, без прокрутки.
 */
export function FrameCard({
  step,
  title,
  subtitle,
  icon,
  children,
  action,
}: {
  step?: number;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-2 border-[var(--kc-border-strong)] bg-[var(--kc-surface)] p-4">
      <header className="mb-4 flex items-start gap-3 border-b-2 border-dashed border-[var(--kc-border-strong)] pb-3">
        {step !== undefined && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-[var(--kc-khaki)] font-mono text-lg font-bold text-white">
            {step}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="mt-1 text-[11px] leading-snug text-[var(--kc-muted)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Плитка показателя.
 *
 * Крупная цифра моноширинным шрифтом: прораб сравнивает «14,2» и «14,8» в двух
 * плитках, и пропорциональный шрифт приводит к тому, что цифры «прыгают» при
 * обновлении расчёта.
 */
export function FrameStat({
  label,
  value,
  unit,
  hint,
  accent,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  /** Выделить главный итог хаки-рамкой */
  accent?: boolean;
  /** Показать проблему (например, не хватает толщины утеплителя) */
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        'border-2 p-2.5',
        warn
          ? 'border-red-500/70 bg-red-950/30'
          : accent
            ? 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)]/15'
            : 'border-[var(--kc-border)] bg-[var(--kc-bg)]'
      )}
    >
      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--kc-muted)]">
        {label}
      </span>
      <span className="mt-0.5 block font-mono text-lg font-bold tabular-nums leading-tight text-white">
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-[var(--kc-muted)]">{unit}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-[10px] leading-tight text-[var(--kc-faint)]">{hint}</span>}
    </div>
  );
}

/**
 * Сетка показателей: 2 колонки на телефоне, 4 на десктопе.
 *
 * Именно 2, а не 1: связанные цифры (объём и стоимость, площадь и R) должны
 * стоять рядом, иначе прораб сравнивает их по памяти и ошибается.
 */
export function FrameStatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const map = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' };
  return <div className={cn('grid gap-2', map[columns])}>{children}</div>;
}

/** Строка позиции сметы */
export function FrameEstimateRow({
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
    <div className="flex items-baseline gap-2 border-b border-dashed border-[var(--kc-border)] py-1.5 last:border-0">
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-white">
        {label}
        {note && <span className="mt-0.5 block text-[10px] leading-tight text-[var(--kc-faint)]">{note}</span>}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--kc-muted)]">
        {qty} {unit}
      </span>
      <span className="w-[92px] shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-white">
        {sum}
      </span>
    </div>
  );
}

/** Кнопка-действие в брутальном стиле (хаки или контурная) */
export function FrameButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className,
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center gap-2 border-2 px-3 py-2.5 text-xs font-bold',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'border-[var(--kc-khaki)] bg-[var(--kc-khaki)] text-white hover:bg-[var(--kc-khaki-deep)]',
        variant === 'ghost' && 'border-[var(--kc-border-strong)] bg-[var(--kc-bg)] text-white hover:border-[var(--kc-khaki-text)] hover:text-[var(--kc-khaki-text)]',
        variant === 'danger' && 'border-red-500/60 bg-red-950/40 text-red-200 hover:bg-red-900/50',
        className
      )}
      style={{ minHeight: MIN_TOUCH_TARGET_PX }}
    >
      {children}
    </button>
  );
}

/* ========================================================================== */
/*                            ЭКСПОРТ И ИСТОРИЯ                                 */
/* ========================================================================== */

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Кнопка скачивания ТЗ и сметы с автокопированием в буфер.
 *
 * ТО, ЧТО РЕАЛЬНО НУЖНО ПРОРАБУ: он жмёт одну кнопку и получает весь документ
 * в буфере обмена, чтобы вставить его в мессенджер заказчику. Поэтому «скачать»
 * здесь означает «скопировать» — а подтверждение обязательно, потому что на
 * http-объекте буфер недоступен и копирование может молча не сработать.
 */
export function DownloadConceptButton({
  text,
  label = 'Скачать ТЗ + смету (BYN)',
  variant = 'primary',
}: {
  text: string;
  label?: string;
  variant?: 'primary' | 'ghost';
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Таймер гасится при размонтировании: иначе setState после ухода со
  // страницы даст предупреждение React и лишнюю работу.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = useCallback(async () => {
    const ok = await copyToClipboard(text);
    setState(ok ? 'copied' : 'error');
    if (!ok) setShowManual(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), 2600);
  }, [text]);

  return (
    <div className="flex flex-col gap-2">
      <FrameButton onClick={handleClick} variant={variant} className="w-full sm:w-auto">
        {state === 'copied' ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Скопировано в буфер
          </>
        ) : state === 'error' ? (
          <>
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Браузер заблокировал — показать текст
          </>
        ) : (
          <>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            {label}
          </>
        )}
      </FrameButton>

      {state === 'copied' && (
        <p className="text-[10px] text-[var(--kc-khaki-text)]">
          ТЗ и смета в буфере — вставьте в Telegram или «Смету» на объекте.
        </p>
      )}

      {showManual && (
        <div className="border-2 border-red-500/50 bg-[var(--kc-bg)] p-2">
          <p className="mb-1.5 text-[10px] leading-snug text-red-200">
            Копирование недоступно в этом браузере (нет HTTPS). Выделите текст
            и скопируйте вручную:
          </p>
          <textarea
            readOnly
            value={text}
            onFocus={(event) => event.currentTarget.select()}
            className="h-40 w-full resize-none border-2 border-[var(--kc-border-strong)] bg-[var(--kc-surface-2)] p-2 font-mono text-[10px] leading-tight text-white focus:outline-none"
            aria-label="Текст ТЗ и сметы для ручного копирования"
          />
        </div>
      )}
    </div>
  );
}

/** Кнопки отмены и повтора действий */
export function HistoryButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="flex gap-1.5">
      <FrameButton variant="ghost" onClick={onUndo} disabled={!canUndo} title="Отменить последнее действие (Ctrl+Z)">
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Отменить</span>
      </FrameButton>
      <FrameButton variant="ghost" onClick={onRedo} disabled={!canRedo} title="Повторить действие (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Повтор</span>
      </FrameButton>
    </div>
  );
}

/** Кнопка сброса схемы — с подтверждением, потому что действие необратимо для невнимательного */
export function ClearSchemeButton({ onClear, count }: { onClear: () => void; count: number }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = useCallback(() => {
    if (!armed) {
      // Первое нажатие только «взводит» кнопку: удаление всех проёмов одной
      // кнопкой без подтверждения — классика потери часа работы.
      setArmed(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setArmed(false), 3500);
      return;
    }
    onClear();
    setArmed(false);
  }, [armed, onClear]);

  return (
    <FrameButton
      variant={armed ? 'danger' : 'ghost'}
      onClick={handleClick}
      disabled={count === 0}
      title="Удалить все проёмы и террасы со схемы"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {armed ? 'Точно очистить?' : 'Очистить схему'}
    </FrameButton>
  );
}

/** Ссылка на нормативный документ — обязательный элемент каждого шага */
export function StandardNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-2 border-dashed border-[var(--kc-border-strong)] bg-[var(--kc-bg)] p-2.5 text-[10px] leading-snug text-[var(--kc-muted)]">
      <Hammer className="mr-1.5 inline h-3 w-3 text-[var(--kc-khaki-text)]" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Полоса-разделитель между шагами конструктора */
export function StepDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-[2px] flex-1 bg-[var(--kc-border-strong)]" aria-hidden="true" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--kc-khaki-text)]">
        {label}
      </span>
      <span className="h-[2px] flex-1 bg-[var(--kc-border-strong)]" aria-hidden="true" />
    </div>
  );
}
