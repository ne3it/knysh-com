'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { SHARED_KEYS, useSharedEconomics } from '@/lib/store/sharedEconomicsStore';

/**
 * `useLinkedForm` — форма инструмента, часть полей которой вынесена в общие переменные блока.
 *
 * Зачем: при переключении вкладок значения полей не должны сбрасываться, а экономика
 * должна пересчитываться сквозным образом между инструментами одного блока
 * (себестоимость, габариты, категория, цена, вес, партия).
 *
 * Как это работает:
 *  - обычные поля живут в локальном состоянии компонента;
 *  - поля, объявленные в `links`, читаются из общего стора (sharedEconomicsStore);
 *  - любое изменение общего поля сразу пишется в стор, поэтому остальные вкладки блока
 *    пересчитываются мгновенно, без ручного переноса данных;
 *  - `reset()` очищает и локальные поля, и связанные общие переменные.
 *
 * links объявляется константой модуля, чтобы ссылка была стабильной между рендерами.
 */
export interface LinkedForm<T extends object> {
  form: T;
  /**
   * Обновление формы в стиле React setState (значение или функция от предыдущего).
   * Существует, чтобы инструменты, написанные на `useState`, переходили на общие
   * переменные без переписывания всех обработчиков: связанные поля сами уходят
   * в общий стор, остальные остаются локальными.
   */
  setForm: (next: T | ((prev: T) => T)) => void;
  /** Обновить одно поле (связанные пишутся в общий стор) */
  updateField: <K extends keyof T & string>(field: K, value: T[K]) => void;
  /** Обновить несколько полей одним вызовом */
  updateFields: (patch: Partial<T>) => void;
  /** Вернуть значения по умолчанию и очистить связанные общие переменные */
  reset: () => void;
}

type LinkMap<T> = Partial<Record<keyof T & string, string>>;

export function useLinkedForm<T extends object>(
  defaults: T,
  links: LinkMap<T> = {}
): LinkedForm<T> {
  const [local, setLocal] = useState<T>(defaults);
  // Зеркало локальной формы: нужно, чтобы setForm(prev => …) корректно читал
  // актуальное значение вне React-апдейтера.
  const localRef = useRef<T>(defaults);
  const shared = useSharedEconomics((state) => state.values);
  const setSharedValues = useSharedEconomics((state) => state.setValues);
  const clearShared = useSharedEconomics((state) => state.clearValues);

  /** Слить связанные поля формы в общий стор одним вызовом */
  const publishLinked = useCallback(
    (next: T) => {
      const patch: Record<string, string> = {};
      (Object.keys(links) as Array<keyof T & string>).forEach((field) => {
        const sharedKey = links[field];
        if (!sharedKey) return;
        const value = (next as Record<string, unknown>)[field];
        if (value === undefined || value === null) return;
        patch[sharedKey] = String(value);
      });
      if (Object.keys(patch).length > 0) setSharedValues(patch);
    },
    [links, setSharedValues]
  );

  const setForm = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(localRef.current) : next;
      localRef.current = resolved;
      setLocal(resolved);
      publishLinked(resolved);
    },
    [publishLinked]
  );

  const form = useMemo(() => {
    const merged = { ...defaults, ...local } as unknown as Record<string, unknown>;
    (Object.keys(links) as string[]).forEach((field) => {
      const sharedKey = links[field as keyof T & string];
      if (!sharedKey) return;
      if (Object.prototype.hasOwnProperty.call(shared, sharedKey)) {
        merged[field] = shared[sharedKey];
      }
    });
    return merged as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults, local, shared, links]);

  const updateField = useCallback(
    <K extends keyof T & string>(field: K, value: T[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [setForm]
  );

  const updateFields = useCallback(
    (patch: Partial<T>) => {
      setForm((prev) => ({ ...prev, ...patch }));
    },
    [setForm]
  );

  const reset = useCallback(() => {
    localRef.current = defaults;
    setLocal(defaults);
    const sharedKeys = Object.values(links).filter((key): key is string => Boolean(key));
    if (sharedKeys.length > 0) clearShared(sharedKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults, links, clearShared]);

  return { form, setForm, updateField, updateFields, reset };
}

/** Готовые карты связей для инструментов (объявляются константами модуля) */
export const MEGA_LINKS = {
  cost_price: SHARED_KEYS.cost,
  retail_price: SHARED_KEYS.retailPrice,
  commission_rate: SHARED_KEYS.commissionRate,
  tax_rate: SHARED_KEYS.taxRate,
  length: SHARED_KEYS.length,
  width: SHARED_KEYS.width,
  height: SHARED_KEYS.height,
  eco_weight: SHARED_KEYS.weight,
  batch_volume: SHARED_KEYS.batchVolume,
  buyout_rate: SHARED_KEYS.buyoutRate,
  transit: SHARED_KEYS.transit,
  fszn_quarter: SHARED_KEYS.fsznQuarter,
  p713_category: SHARED_KEYS.category,
} as const;

export const SPLIT_LINKS = {
  cost: SHARED_KEYS.cost,
  currentPrice: SHARED_KEYS.retailPrice,
  spp: SHARED_KEYS.spp,
} as const;

export const PRICE_CONTROL_LINKS = {
  cost_price: SHARED_KEYS.cost,
  category: SHARED_KEYS.category,
} as const;

export const ECO_FEE_LINKS = {
  weightPerUnit: SHARED_KEYS.weight,
  batchVolume: SHARED_KEYS.batchVolume,
} as const;

export const PVZ_RETURN_LINKS = {
  cost: SHARED_KEYS.cost,
  price: SHARED_KEYS.retailPrice,
  commission: SHARED_KEYS.commissionRate,
  buyout: SHARED_KEYS.buyoutRate,
} as const;

export const CARGO_LINKS = {
  length: SHARED_KEYS.length,
  width: SHARED_KEYS.width,
  height: SHARED_KEYS.height,
  quantity: SHARED_KEYS.batchVolume,
} as const;

export const STOCKOUT_LINKS = {
  retail_price_byn: SHARED_KEYS.retailPrice,
  daily_sales: SHARED_KEYS.dailySales,
  margin_percent: SHARED_KEYS.marginPercent,
} as const;

export const LABELS_LINKS = {
  productName: SHARED_KEYS.productName,
} as const;

export const TNVED_CHECK_LINKS = {
  organization: SHARED_KEYS.organization,
  unp: SHARED_KEYS.unp,
  address: SHARED_KEYS.address,
  director: SHARED_KEYS.director,
} as const;

export const ACT_LINKS = {
  organization: SHARED_KEYS.organization,
  unp: SHARED_KEYS.unp,
} as const;