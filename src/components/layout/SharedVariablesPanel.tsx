'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  DEFAULT_PRODUCT_CATEGORY_ID,
  GLOBAL_CONTEXT_FIELDS,
  GLOBAL_COST_FIELD,
  GLOBAL_QTY_FIELD,
  PRODUCT_CATEGORIES,
  SHARED_KEYS,
  getGlobalContextMode,
  sanitizeSharedInput,
  useSharedEconomics,
  type GlobalFieldMeta,
} from '@/lib/store/sharedEconomicsStore';

/**
 * Панель «↔ СКВОЗНЫЕ ПЕРЕМЕННЫЕ» — верхний блок рабочей области блока.
 *
 * Ровно 4 параметра, которые подставляются во все формы проекта:
 *
 *   1) Товар: `<select id="global-category">` — справочник категорий;
 *   2) Себестоимость: `<input id="global-cost">`, BYN за 1 единицу;
 *   3) Количество: `<input id="global-qty">`, шт в партии;
 *   4) контекстный `<input id="global-context-input">`, единственное поле,
 *      которое перестраивается по открытому блоку:
 *        • товарные блоки (Планировщик старта, Маркировка и Документы РБ,
 *          Налоги и Контроль, SEO) → «Выкуп», % — уходит в калькуляторы
 *          покатушек и юнит-экономики;
 *        • блок «Аналитика ПВЗ и Логистика» → «Трафик», чел/день — уходит
 *          в форму окупаемости ПВЗ; товарный контекст блока при этом уступает
 *          место потоку клиентов, но первые три поля панели остаются на месте
 *          и работают как обычно (по ним считаются отгрузка, экосбор и габариты).
 *
 * Связь двусторонняя: правка панели (события input и change) мгновенно
 * пересчитывает все калькуляторы, а правка того же поля в форме (через
 * useLinkedForm) обновляет цифру здесь. Пустые поля и буквы не проходят:
 * ввод санитайзится, чтение идёт через `parseFloat(value) || 0`.
 * Валюта панели — строго BYN.
 */
export function SharedVariablesPanel({ blockId }: { blockId?: string | null }) {
  const values = useSharedEconomics((state) => state.values);
  const setValue = useSharedEconomics((state) => state.setValue);
  const setValues = useSharedEconomics((state) => state.setValues);
  const rootRef = useRef<HTMLDivElement>(null);

  const contextMode = getGlobalContextMode(blockId);
  const contextField = GLOBAL_CONTEXT_FIELDS[contextMode];

  // Дефолты панели — источник истины для всех форм: если параметр ещё не задан,
  // записываем его дефолт в стор, иначе в панели и в калькуляторе были бы разные числа.
  useEffect(() => {
    const defaults: Record<string, string> = {
      [SHARED_KEYS.productCategory]: DEFAULT_PRODUCT_CATEGORY_ID,
      [GLOBAL_COST_FIELD.key]: GLOBAL_COST_FIELD.fallback,
      [GLOBAL_QTY_FIELD.key]: GLOBAL_QTY_FIELD.fallback,
      [GLOBAL_CONTEXT_FIELDS.product.key]: GLOBAL_CONTEXT_FIELDS.product.fallback,
      [GLOBAL_CONTEXT_FIELDS.pvz.key]: GLOBAL_CONTEXT_FIELDS.pvz.fallback,
    };
    const patch: Record<string, string> = {};
    Object.entries(defaults).forEach(([key, fallback]) => {
      if (!values[key]) patch[key] = fallback;
    });
    if (Object.keys(patch).length > 0) setValues(patch);
    // Один раз на монтирование: дальше значения живут в сторе и меняются только вводом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Запись числового поля: только цифры и одна точка, защита от букв и мусора.
   * Функция стабильна (берёт текущие значения из стора), поэтому её можно вешать
   * в обработчики событий и в зависимости эффектов.
   */
  const writeNumber = useCallback(
    (key: string, raw: string) => {
      const clean = sanitizeSharedInput(raw);
      if (useSharedEconomics.getState().values[key] === clean) return;
      setValue(key, clean);
    },
    [setValue]
  );

  /**
   * React не отдаёт нативное событие `change` в onChange: там срабатывает `input`.
   * Поэтому `change` слушаем напрямую на контейнере — так автозаполнение, шаги
   * стрелками и коммит по blur тоже запускают мгновенный пересчёт.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const key = target?.dataset.sharedKey;
      if (key) writeNumber(key, target.value);
    };

    root.addEventListener('change', handleChange);
    return () => root.removeEventListener('change', handleChange);
  }, [writeNumber]);

  return (
    <div className="shared-var" role="group" aria-label="Сквозные переменные" ref={rootRef}>
      <h2 className="shared-var__title">↔ СКВОЗНЫЕ ПЕРЕМЕННЫЕ</h2>

      <div className="shared-var__row">
        <label className="shared-var__field" htmlFor="global-category">
          <span className="shared-var__label">Товар</span>
          <select
            id="global-category"
            className="shared-var__select"
            value={values[SHARED_KEYS.productCategory] ?? DEFAULT_PRODUCT_CATEGORY_ID}
            onChange={(event) => setValue(SHARED_KEYS.productCategory, event.currentTarget.value)}
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <NumberField
          field={GLOBAL_COST_FIELD}
          inputId="global-cost"
          value={values[GLOBAL_COST_FIELD.key] ?? GLOBAL_COST_FIELD.fallback}
          onInput={writeNumber}
        />

        <NumberField
          field={GLOBAL_QTY_FIELD}
          inputId="global-qty"
          value={values[GLOBAL_QTY_FIELD.key] ?? GLOBAL_QTY_FIELD.fallback}
          onInput={writeNumber}
        />

        <NumberField
          field={contextField}
          inputId="global-context-input"
          value={values[contextField.key] ?? contextField.fallback}
          onInput={writeNumber}
          context
        />
      </div>
    </div>
  );
}

interface NumberFieldProps {
  field: GlobalFieldMeta;
  inputId: string;
  value: string;
  onInput: (key: string, raw: string) => void;
  /** Контекстный параметр — подсвечен фиолетовым */
  context?: boolean;
}

/** Компактное inline-поле панели: подпись слева, число в скруглении 6px, единица справа */
function NumberField({ field, inputId, value, onInput, context = false }: NumberFieldProps) {
  return (
    <label
      className={`shared-var__field${context ? ' shared-var__field--context' : ''}`}
      htmlFor={inputId}
    >
      <span className="shared-var__label">{field.label}</span>
      <span className="shared-var__control">
        <input
          id={inputId}
          className="shared-var__input"
          data-shared-key={field.key}
          type="number"
          inputMode="decimal"
          step={field.step}
          min={field.min}
          value={value}
          placeholder="—"
          onChange={(event) => onInput(field.key, event.currentTarget.value)}
          onInput={(event) => onInput(field.key, event.currentTarget.value)}
        />
        <span className="shared-var__unit">{field.unit}</span>
      </span>
    </label>
  );
}

export default SharedVariablesPanel;
