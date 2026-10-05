/**
 * Публичный API раздела «Каркасные дома» (/frame).
 *
 * Компоненты конструктора импортируют ТОЛЬКО отсюда:
 *
 *   import { useFrameStore, computeFrameEstimate, STUD_SIZES } from '@/lib/frame';
 *
 * Зачем баррель: он держит границу слоёв. Компонент не должен знать, лежит ли
 * норма в `constants.ts`, цена в `prices.ts`, формула в `geometry.ts` или текст
 * сметы в `estimate.ts`. Иначе правка одной нормы тянет за собой все шаги
 * конструктора, и «стоимость» расчёна размывается.
 *
 * Экспортируются функции, справочники и типы. Экшены стора экспортируются
 * (компонентам они нужны), но сам стор подключается через готовые хуки
 * `useFrameStore` / `useFrameEstimate`, чтобы компонент не знал про
 * `persist`-обвязку.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *   - станков и разметки — это ответственность `components/frame`;
 *   - `copyToClipboard` есть, потому что копирование сметы в буфер — это
 *     поведение сметы, а не особенность интерфейса;
 *   - `formatByn` НЕ дублируется: деньги раздела /const уже отформатированы
 *     белорусским форматом, второй форматтер дал бы расхождение «1 200,50»
 *     и «1200.50» в одном интерфейсе.
 */

export * from './constants';
export * from './prices';
export * from './geometry';
export * from './estimate';

/**
 * Стор конструктора реэкспортируется ПОСЛЕДНИМ, и это не случайно.
 *
 * Стор — единственный модуль раздела, который ЗАВИСИТ от остальных, поэтому
 * перечислять его последним значит, что к моменту его загрузки `constants`,
 * `prices`, `geometry` и `estimate` уже инициализированы. Обратный порядок дал
 * бы цикл `frame/index → frameStore → frame/index` и недетерминированный
 * порядок инициализации в ESM — источник ошибок вида
 * «Cannot access 'FRAME_STEPS' before initialization», которые проявляются
 * только в production-бандле.
 *
 * Именно поэтому сам стор импортирует конкретные модули
 * (`@/lib/frame/constants`, `@/lib/frame/estimate`), а НЕ этот баррель:
 * только так граф зависимостей остаётся ациклическим.
 *
 * Экспортируются хуки и действия стора, а не `persist`-обвязка: компонент
 * получает `useFrameEstimate()` (смета, посчитанная через `useMemo`) и
 * не знает, откуда берутся данные.
 */
export {
  useFrameStore,
  useFrameEstimate,
  useFrameHydrated,
  useFrameCanUndo,
  useFrameCanRedo,
  useFrameFormMax,
  frameStepIndex,
  safeNum,
  generateElementId,
  wallRunM,
  wallLengthM,
  wallRunM as wallRun,
  clampPosition,
  nearestWall,
  snapToWall,
  WALL_ORDER,
  WALL_LABELS,
  type WallId,
  type PlacedElement,
  type FrameForm,
  type FrameState,
} from '@/lib/store/frameStore';
