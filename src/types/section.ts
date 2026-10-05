/**
 * Core types for the section-based messenger architecture
 * Each section (e.g., /wb, /ozon) has its own set of features
 */

export interface Feature {
  /** Unique identifier for the feature */
  id: string;
  /** Display name in the sidebar */
  label: string;
  /** Lucide icon name (as string) */
  icon: string;
  /** Short description for tooltip */
  description?: string;
  /** Feature component path for lazy loading */
  componentPath: string;
  /** Optional: required permissions/roles */
  permissions?: string[];
  /** Optional: badge count (e.g., notifications) */
  badge?: number | string;
  /** Optional: keyboard shortcut */
  shortcut?: string;
  /** Optional: feature group for organization */
  group?: string;
  /** Whether feature is enabled */
  enabled?: boolean;
}

/**
 * Горизонтальная вкладка внутри бизнес-блока.
 * Один таб может содержать несколько инструментов (например «Проверка и валидатор ТН ВЭД»
 * объединяет проверку сертификации и подбор кода ТН ВЭД).
 */
export interface ToolTab {
  /** Уникальный идентификатор таба внутри блока */
  id: string;
  /** Подпись на фиолетовой кнопке-вкладке */
  label: string;
  /** Инструменты, отрисованные внутри таба (монтируются один раз — значения полей не сбрасываются) */
  features: Feature[];
}

/** Логический бизнес-блок — пункт бокового меню */
export interface ToolBlock {
  id: string;
  label: string;
  /** Имя SVG-иконки из ICON_MAP */
  icon: string;
  description?: string;
  /** Вкладки с инструментами блока */
  tabs: ToolTab[];
  /**
   * Блок выделен в меню (обучающий модуль): крупная кнопка с акцентной рамкой,
   * чтобы новичок сразу видел точку входа в симулятор.
   */
  highlight?: 'gold' | 'violet' | 'khaki';
  /** Блок рисуется отдельной крупной кнопкой, а не строкой списка */
  featured?: boolean;
}

export interface FeatureGroup {
  id: string;
  label: string;
  /** Блоки внутри группы меню */
  blocks: ToolBlock[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export interface SectionConfig {
  /** Section identifier (e.g., 'wb', 'ozon') */
  id: string;
  /** Display name */
  label: string;
  /** Section icon */
  icon: string;
  /** Section color theme */
  color: string;
  /** Feature groups for this section */
  featureGroups: FeatureGroup[];
  /** Default business block to show on entry */
  defaultBlock?: string;
  /** Section description for SEO */
  description?: string;
  /**
   * Оформление каркаса раздела.
   *
   * 'light'    — белый фон, нейтральные границы (раздел /wb, значение по умолчанию);
   * 'graphite' — тёмный графит + хаки-акценты (раздел /const: стройка на телефоне,
   *              где белый фон под солнцем нечитаем, а хаки держит контраст к белому).
   *
   * Поле необязательное: без него раздел рендерится ровно как раньше, поэтому
   * добавление /const не затрагивает вид /wb.
   */
  theme?: 'light' | 'graphite';
  /** Крупный заголовок сайдбара, если он отличается от label (напр. «Kilo Construction») */
  sidebarTitle?: string;
  /** Подпись под заголовком сайдбара */
  sidebarSubtitle?: string;
  /**
   * Инструменты вне меню: открываются по /const?tool=<id> через useToolDeepLink.
   * Нужны, чтобы инструмент оставался в реестре lazy-загрузки, но не занимал
   * место в меню.
   */
  standaloneFeatures?: Feature[];
}

export interface SectionState {
  /** Current active section */
  currentSection: string | null;
  /** Current active business block within the section */
  currentBlock: string | null;
  /** Активная вкладка для каждого блока: { [blockId]: tabId } */
  activeTabs: Record<string, string>;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Feature groups collapsed state */
  collapsedGroups: Record<string, boolean>;
  /** Недавно открытые бизнес-блоки (id блока) для быстрого доступа */
  recentFeatures: string[];
}

export interface SectionActions {
  setCurrentSection: (sectionId: string) => void;
  setCurrentBlock: (blockId: string) => void;
  setActiveTab: (blockId: string, tabId: string) => void;
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
  addRecentFeature: (blockId: string) => void;
  reset: () => void;
}

export type SectionStore = SectionState & SectionActions;
