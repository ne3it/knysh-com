'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  GLOBAL_AVG_CHECK_FIELD,
  GLOBAL_BUYOUT_FIELD,
  GLOBAL_COST_FIELD,
  GLOBAL_PANEL_FIELDS,
  GLOBAL_QTY_FIELD,
  GLOBAL_RENT_FIELD,
  GLOBAL_TRAFFIC_FIELD,
  PVZ_BLOCK_ID,
  SHARED_KEYS,
  sanitizeSharedInput,
  useSharedEconomics,
  type GlobalFieldMeta,
} from '@/lib/store/sharedEconomicsStore';
import {
  DEFAULT_CATALOG_ITEM_ID,
  PRODUCT_CATALOG_GROUPS,
  getCatalogItem,
  isPvzFranchise,
} from '@/lib/services/productCatalog';
import { PRICE_CONTROL_CUSTOM_ID } from '@/lib/services/priceControl713';
import { useSectionStore } from '@/lib/store/sectionStore';

/** Вкладка «Калькулятор ПВЗ WB» — её открывает выбор франшизы ПВЗ в панели */
const PVZ_TAB_ID = 'pvz';

/** id полей панели: сохраняем прежние для товарного режима (#global-context-input — выкуп) */
const PANEL_INPUT_IDS: Partial<Record<string, string>> = {
  [GLOBAL_COST_FIELD.key]: 'global-cost',
  [GLOBAL_QTY_FIELD.key]: 'global-qty',
  [GLOBAL_BUYOUT_FIELD.key]: 'global-context-input',
  [GLOBAL_TRAFFIC_FIELD.key]: 'global-traffic',
  [GLOBAL_RENT_FIELD.key]: 'global-rent',
  [GLOBAL_AVG_CHECK_FIELD.key]: 'global-avg-check',
};

/**
 * Панель «↔ СКВОЗНЫЕ ПЕРЕМЕННЫЕ» — верхний блок рабочей области блока.
 *
 * Ровно 4 параметра, которые подставляются во все формы проекта:
 *
 *   1) Товар: `<select id="global-category">` — полная база категорий
 *      Постановления № 713 (60 позиций), сгруппированная по товарным секторам
 *      в `<optgroup>`, плюс позиция «Франшиза ПВЗ (Пункт выдачи заказов)»;
 *   2) Себестоимость: `<input id="global-cost">`, BYN за 1 единицу;
 *   3) Количество: `<input id="global-qty">`, шт в партии;
 *   4) три числовых поля, набор которых зависит от выбранного товара:
 *        • любая категория Постановления № 713 → себестоимость (BYN),
 *          количество (шт) и выкуп (%) — экономика единицы товара;
 *        • «Франшиза ПВЗ» → трафик (чел/день), аренда (BYN/мес) и средний чек
 *          (BYN) — окупаемость пункта выдачи, они сквозные для формы
 *          «Калькулятор ПВЗ WB».
 *
 * Сквозная синхронизация лимитов 713: значение селекта — это id из справочника
 * Постановления № 713, поэтому выбор сразу попадает и в `category` (его читают
 * «Контроль цен (Пост. 713)» и мега-калькулятор), и в мосты категорий
 * сплит-калькулятора и планировщика старта. Предельная надбавка берётся из того же
 * справочника, поэтому панель и расчёты считают один и тот же процент.
 *
 * Выбор «Франшизы ПВЗ» дополнительно: переводит 4-й параметр в режим «Трафик»,
 * обнуляет товарные параметры (себестоимость и количество) и открывает вкладку
 * «Калькулятор ПВЗ WB» блока «Аналитика ПВЗ и Логистика».
 *
 * Связь двусторонняя: правка панели (события input и change) мгновенно
 * пересчитывает все калькуляторы, а правка того же поля в форме (через
 * useLinkedForm) обновляет цифру здесь, включая категорию товара.
 * Пустые поля и буквы не проходят: ввод санитайзится, чтение идёт через
 * `parseFloat(value) || 0`. Валюта панели — строго BYN.
 */
export function SharedVariablesPanel() {
  const values = useSharedEconomics((state) => state.values);
  const setValue = useSharedEconomics((state) => state.setValue);
  const setValues = useSharedEconomics((state) => state.setValues);
  const rootRef = useRef<HTMLDivElement>(null);

  /** Значение селекта всегда существует в каталоге: старые значения из localStorage игнорируются */
  const storedId = values[SHARED_KEYS.productCategory] ?? '';
  const selectedId = getCatalogItem(storedId) ? storedId : DEFAULT_CATALOG_ITEM_ID;
  const selectedItem = getCatalogItem(selectedId);

  /** Франшиза ПВЗ меняет набор полей: вместо товарных — трафик, аренда, средний чек */
  const isPvz = isPvzFranchise(selectedId);
  const fields = GLOBAL_PANEL_FIELDS[isPvz ? 'pvz' : 'product'];

  /** Открыть вкладку «Калькулятор ПВЗ WB» (блок «Аналитика ПВЗ и Логистика») */
  const openPvzCalculator = useCallback(() => {
    const section = useSectionStore.getState();
    section.setCurrentBlock(PVZ_BLOCK_ID);
    section.setActiveTab(PVZ_BLOCK_ID, PVZ_TAB_ID);
  }, []);

  // Дефолты панели — источник истины для всех форм: если параметр ещё не задан,
  // записываем его дефолт в стор, иначе в панели и в калькуляторе были бы разные числа.
  useEffect(() => {
    const defaults: Record<string, string> = {
      [SHARED_KEYS.productCategory]: DEFAULT_CATALOG_ITEM_ID,
      // Тот же id уходит в поле категории форм 713 — предельная надбавка сразу в силе
      [SHARED_KEYS.category]: DEFAULT_CATALOG_ITEM_ID,
      [GLOBAL_COST_FIELD.key]: GLOBAL_COST_FIELD.fallback,
      [GLOBAL_QTY_FIELD.key]: GLOBAL_QTY_FIELD.fallback,
      [GLOBAL_BUYOUT_FIELD.key]: GLOBAL_BUYOUT_FIELD.fallback,
      [GLOBAL_TRAFFIC_FIELD.key]: GLOBAL_TRAFFIC_FIELD.fallback,
      [GLOBAL_RENT_FIELD.key]: GLOBAL_RENT_FIELD.fallback,
      [GLOBAL_AVG_CHECK_FIELD.key]: GLOBAL_AVG_CHECK_FIELD.fallback,
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
   * Выбор товара на панели.
   *
   * Обычная категория 713: её id уходит и в общую переменную товара, и в поле
   * категории форм Пост. 713 — обе формы мгновенно берут свой предельный процент.
   * Франшиза ПВЗ: лимита 713 у услуги нет, поэтому в формы 713 уходит ручной ввод,
   * товарные параметры обнуляются, а пользователь попадает на калькулятор ПВЗ.
   */
  const selectProduct = useCallback(
    (id: string) => {
      const item = getCatalogItem(id);
      if (!item) return;

      if (item.pvz) {
        setValues({
          [SHARED_KEYS.productCategory]: id,
          [SHARED_KEYS.category]: PRICE_CONTROL_CUSTOM_ID,
          [GLOBAL_COST_FIELD.key]: '0',
          [GLOBAL_QTY_FIELD.key]: '0',
        });
        openPvzCalculator();
        return;
      }

      const current = useSharedEconomics.getState().values;
      const patch: Record<string, string> = {
        [SHARED_KEYS.productCategory]: id,
        [SHARED_KEYS.category]: id,
      };
      // Возврат товарных параметров после режима франшизы ПВЗ: обнулённые значения
      // не должны молча оставаться нулевыми в экономике.
      if (!current[GLOBAL_COST_FIELD.key] || parseFloat(current[GLOBAL_COST_FIELD.key]) === 0) {
        patch[GLOBAL_COST_FIELD.key] = GLOBAL_COST_FIELD.fallback;
      }
      if (!current[GLOBAL_QTY_FIELD.key] || parseFloat(current[GLOBAL_QTY_FIELD.key]) === 0) {
        patch[GLOBAL_QTY_FIELD.key] = GLOBAL_QTY_FIELD.fallback;
      }
      setValues(patch);
    },
    [setValues, openPvzCalculator]
  );

  // Форма → панель: категория, выбранная в «Контроле цен (Пост. 713)» или в
  // мега-калькуляторе, тут же отражается в главном селекте панели.
  // Ручной ввод лимита и режим франшизы ПВЗ сюда не попадают: они не являются
  // выбором товара, иначе они бы затёрли позицию «Франшиза ПВЗ» в селекте.
  const formCategory = values[SHARED_KEYS.category] ?? '';
  useEffect(() => {
    if (formCategory === PRICE_CONTROL_CUSTOM_ID) return;
    const item = getCatalogItem(formCategory);
    if (!item || item.pvz) return;
    const current = useSharedEconomics.getState().values[SHARED_KEYS.productCategory];
    if (current === formCategory || isPvzFranchise(current)) return;
    setValue(SHARED_KEYS.productCategory, formCategory);
  }, [formCategory, setValue]);

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
        <label
          className="shared-var__field shared-var__field--product"
          htmlFor="global-category"
        >
          <span className="shared-var__label">Товар</span>
          <span className="shared-var__control">
            <select
              id="global-category"
              className="shared-var__select"
              value={selectedId}
              onChange={(event) => selectProduct(event.currentTarget.value)}
            >
              {PRODUCT_CATALOG_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </span>
        </label>

        {fields.map((field, index) => (
          <NumberField
            key={field.key}
            field={field}
            inputId={PANEL_INPUT_IDS[field.key] ?? `global-field-${field.key}`}
            value={values[field.key] ?? field.fallback}
            onInput={writeNumber}
            context={index === fields.length - 1}
          />
        ))}
      </div>

      {/* Лимит Постановления № 713 выбранной позиции — тот же процент считают формы ниже */}
      {selectedItem && (
        <p className="shared-var__hint">
          {selectedItem.pvz
            ? 'Франшиза ПВЗ: лимит Пост. 713 не применяется · панель считает окупаемость точки (трафик, аренда, средний чек)'
            : `Пост. 713: надбавка не более ${selectedItem.limitPercent}% · категория подставлена в формы контроля цен`}
        </p>
      )}
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