/**
 * Публичный API нормативного ядра раздела «Строительный» (/const).
 *
 * Калькуляторы импортируют ТОЛЬКО отсюда одним движением:
 *
 *   import { computeMasonry, getPrice, formatByn, MIX_PRODUCTS } from '@/lib/construction';
 *
 * Зачем нужен баррель: он держит границу слоёв. Калькулятор не должен знать,
 * живут нормы в `constants.ts`, цены в `prices.ts` или арифметика в `geometry.ts` —
 * иначе при правке одного файла придётся править шесть компонентов.
 *
 * Экспортируются функции, справочники и типы. `clear*` хуки из стора
 * намеренно НЕ экспортируются: состояние форм — часть калькулятора, а не ядра.
 */

export * from './constants';
export * from './prices';
export * from './geometry';
export * from './format';
export * from './estimate';