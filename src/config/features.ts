import type { SectionConfig, Feature, FeatureGroup, ToolBlock, ToolTab } from '@/types/section';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  FileText,
  Truck,
  CreditCard,
  AlertTriangle,
  Zap,
  Calendar,
  Target,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  HelpCircle,
  Calculator,
  Scan,
} from 'lucide-react';
import {
  BarcodeIcon,
  PriceControlIcon,
  StockoutIcon,
  SEOCleanIcon,
  StartupPlannerIcon,
  CargoTruckIcon,
  TNVEDCheckIcon,
  SplitCalculatorIcon,
  EcoFeeIcon,
  MarkingCodeIcon,
  FsznBgsIcon,
  TNVEDValidatorIcon,
  PvzReturnIcon,
  PvzBreakEvenIcon,
  ActClaimIcon,
  LegalScaleIcon,
  RocketLaunchIcon,
  DocBarcodeIcon,
  ShieldScaleIcon,
  PvzPointIcon,
  SeoBrushIcon,
  SimulatorIcon,
} from './icons';

export const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  LayoutDashboard,
  Package,
  BarChart3,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  FileText,
  Truck,
  CreditCard,
  AlertTriangle,
  Zap,
  Calendar,
  Target,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  HelpCircle,
  Calculator,
  Scan,
  Barcode: BarcodeIcon,
  PriceControl: PriceControlIcon,
  Stockout: StockoutIcon,
  SEOClean: SEOCleanIcon,
  StartupPlanner: StartupPlannerIcon,
  CargoTruck: CargoTruckIcon,
  TNVEDCheck: TNVEDCheckIcon,
  SplitCalculator: SplitCalculatorIcon,
  EcoFee: EcoFeeIcon,
  MarkingCode: MarkingCodeIcon,
  FsznBgs: FsznBgsIcon,
  PvzReturn: PvzReturnIcon,
  PvzBreakEven: PvzBreakEvenIcon,
  TNVEDValidator: TNVEDValidatorIcon,
  ActClaim: ActClaimIcon,
  LegalScale: LegalScaleIcon,
  /* Иконки 5 бизнес-блоков */
  RocketLaunch: RocketLaunchIcon,
  DocBarcode: DocBarcodeIcon,
  ShieldScale: ShieldScaleIcon,
  PvzPoint: PvzPointIcon,
  SeoBrush: SeoBrushIcon,
  /* Иконка обучающего модуля */
  Simulator: SimulatorIcon,
};

export function getIconComponent(name: string) {
  return ICON_MAP[name] || HelpCircle;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Инструменты (бывшие пункты меню). Каждый инструмент живёт внутри таба.
   ═══════════════════════════════════════════════════════════════════════════ */

const wbCalculator: Feature = {
  id: 'calculator',
  label: 'Сквозной мега-калькулятор',
  icon: 'Calculator',
  description:
    'Юнит-экономика WB (РБ → РФ): экосбор и ФСЗН, тарифы за объём, покатушки, Постановление № 713 и точка безубыточности',
  componentPath: '@/components/features/wb/Calculator',
};

const wbSplitCalculator: Feature = {
  id: 'split-calculator',
  label: 'Защита от акций (Сплит)',
  icon: 'SplitCalculator',
  description: 'Сплит-калькулятор цен для акций WB: защита от ухода в минус при участии в акциях',
  componentPath: '@/components/features/wb/SplitCalculator',
};

const wbFsznBgs: Feature = {
  id: 'fszn-bgs',
  label: 'Расчет ФСЗН и Белгосстраха',
  icon: 'FsznBgs',
  description: 'Расчёт взносов ФСЗН и Белгосстрах для ИП-селлеров РБ по месяцам деятельности',
  componentPath: '@/components/features/wb/FsznBgsCalculator',
};

const wbLabelsGenerator: Feature = {
  id: 'labels-generator',
  label: 'Маркировка и этикетки РБ',
  icon: 'Barcode',
  description: 'Генерация термоэтикеток 58x40 мм (EAN13/CODE128, ЕАС)',
  componentPath: '@/components/features/wb/LabelsGenerator',
};

const wbMarkingValidator: Feature = {
  id: 'marking-code-validator',
  label: 'Валидатор Указа № 243',
  icon: 'MarkingCode',
  description:
    'Валидация кодов маркировки (DataMatrix / Честный Знак) по Указу № 243 и проверка легальности оборота товаров РБ → РФ',
  componentPath: '@/components/features/wb/MarkingCodeValidator',
};

const wbTNVEDCheck: Feature = {
  id: 'tnved-check',
  label: 'Проверка ТН ВЭД и ОП',
  icon: 'TNVEDCheck',
  description: 'Проверка обязательной сертификации по ТР ТС и генератор отказных писем РБ (PDF)',
  componentPath: '@/components/features/wb/TNVEDCheck',
};

const wbTNVEDValidator: Feature = {
  id: 'tnved-validator',
  label: 'Валидатор ТН ВЭД',
  icon: 'TNVEDValidator',
  description:
    'Подбор кода ТН ВЭД и проверка ограничений ЕАЭС: маркировка, сертификация, Постановление № 713',
  componentPath: '@/components/features/wb/TNVEDValidator',
};

const wbActClaim: Feature = {
  id: 'act-claim',
  label: 'Акт расхождения ТТН-1',
  icon: 'ActClaim',
  description: 'Генератор Акта о расхождениях и претензии к ТК / Фулфилменту (PDF)',
  componentPath: '@/components/features/wb/DiscrepancyAct',
};

const wbPriceControl713: Feature = {
  id: 'price-control-713',
  label: 'Контроль цен (Пост. 713)',
  icon: 'PriceControl',
  description: 'Расчет МРЦ по Постановлению № 713 РБ (контроль цен)',
  componentPath: '@/components/features/wb/PriceControl713',
};

const wbEcoFeeCalculator: Feature = {
  id: 'eco-fee-calculator',
  label: 'Экосбор РБ',
  icon: 'EcoFee',
  description: 'Расчёт белорусского экологического сбора (экосбор) за упаковку товаров',
  componentPath: '@/components/features/wb/EcoFeeCalculator',
};

const wbLegalNavigator: Feature = {
  id: 'legal-navigator',
  label: 'Юридический навигатор (База законов)',
  icon: 'LegalScale',
  description:
    'Законы РБ для селлера WB и франчайзи ПВЗ: НБРБ, экосбор, платформенная экономика и налоги — с фильтром по вашей нише',
  componentPath: '@/components/features/wb/LegalNavigator',
};

const wbPvzReturn: Feature = {
  id: 'pvz-return-analyzer',
  label: 'Анализ покатушек (ПВЗ)',
  icon: 'PvzReturn',
  description:
    'Анализатор прибыльности выкупа самовывозом из ПВЗ: точка невозврата товара и компенсация покатушек',
  componentPath: '@/components/features/wb/PvzReturnAnalyzer',
};

const wbCargoCalculator: Feature = {
  id: 'cargo-calculator',
  label: 'Калькулятор доставки грузов (Карго)',
  icon: 'CargoTruck',
  description:
    'Сборщик и оптимизатор сборных грузов (Карго/Фулфилмент): паллеты, тарифы, Минск → РФ',
  componentPath: '@/components/features/wb/CargoCalculator',
};

const wbSEOClean: Feature = {
  id: 'seo-clean',
  label: 'SEO очистка текста',
  icon: 'SEOClean',
  description: 'Очистка и форматирование текстов для SEO на Wildberries',
  componentPath: '@/components/features/wb/SEOClean',
};

const wbStockout: Feature = {
  id: 'stockout',
  label: 'Упущенная выгода (Stockout)',
  icon: 'Stockout',
  description: 'Потери от отсутствия товара на складе WB',
  componentPath: '@/components/features/wb/Stockout',
};

/** Геймифицированный обучающий модуль: пошаговый симулятор запуска */
const wbStartupSimulator: Feature = {
  id: 'startup-simulator',
  label: 'Мой первый запуск на WB из РБ',
  icon: 'Simulator',
  description:
    'Интерактивный пошаговый симулятор: выбираешь роль, вводишь цифры, считаешь экономику и разбираешь 3 критические ошибки новичка. Все расчёты — в BYN',
  componentPath: '@/components/features/wb/StartupSimulator',
};

/**
 * Инструменты, созданные и зарегистрированные, но не выведенные в меню по ТЗ
 * (5 бизнес-блоков, 14 вкладок). Компоненты остаются в реестре и доступны
 * по глубокой ссылке /wb?tool=<id> — ничего не удалено из проекта.
 */
const wbStartupPlanner: Feature = {
  id: 'startup-planner',
  label: 'Планировщик старта',
  icon: 'StartupPlanner',
  description:
    'Интерактивный чек-лист и смета стартового капитала для выхода на WB из РБ',
  componentPath: '@/components/features/wb/StartupPlanner',
};

const wbPvzBreakEven: Feature = {
  id: 'pvz-break-even',
  label: 'Калькулятор ПВЗ WB',
  icon: 'PvzBreakEven',
  description:
    'Окупаемость пункта выдачи заказов WB в РБ: сотрудники и взносы, тарифные зоны, поток клиентов и симулятор «плохого месяца» с штрафами',
  componentPath: '@/components/features/wb/PvzBreakEvenCalculator',
};

export const WB_STANDALONE_FEATURES: Feature[] = [wbStartupPlanner];

const tab = (id: string, label: string, features: Feature[]): ToolTab => ({ id, label, features });

/* ═══════════════════════════════════════════════════════════════════════════
   Обучающий модуль: вынесен в самое верх меню отдельной крупной кнопкой.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SIMULATOR_BLOCK: ToolBlock = {
  id: 'simulator',
  label: 'Симулятор: Быстрый Старт',
  icon: 'Simulator',
  description: 'Геймифицированная обучалка: 4 шага, конфетти и разбор ошибок новичка',
  highlight: 'gold',
  featured: true,
  tabs: [tab('quick-start', '🎓 Пошаговый симулятор запуска', [wbStartupSimulator])],
};

/* ═══════════════════════════════════════════════════════════════════════════
   5 главных логических бизнес-блоков бокового меню.
   Внутри блока инструменты переключаются горизонтальными табами.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WB_BLOCKS: ToolBlock[] = [
  {
    id: 'startup',
    label: 'Планировщик старта',
    icon: 'RocketLaunch',
    description:
      'Точка входа в продажи WB: юнит-экономика, защита от акций и налоговые взносы РБ',
    tabs: [
      tab('mega', 'Сквозной мега-калькулятор', [wbCalculator]),
      tab('split', 'Защита от акций (Сплит)', [wbSplitCalculator]),
      tab('fszn', 'Расчет ФСЗН и Белгосстраха', [wbFsznBgs]),
    ],
  },
  {
    id: 'documents',
    label: 'Маркировка и Документы РБ',
    icon: 'DocBarcode',
    description: 'Этикетки, коды маркировки, ТН ВЭД и акты расхождения ТТН-1',
    tabs: [
      tab('labels', 'Маркировка и этикетки РБ', [wbLabelsGenerator]),
      tab('marking', 'Валидатор Указа № 243', [wbMarkingValidator]),
      tab('tnved', 'Проверка и валидатор ТН ВЭД', [wbTNVEDCheck, wbTNVEDValidator]),
      tab('act', 'Акт расхождения ТТН-1', [wbActClaim]),
    ],
  },
  {
    id: 'taxes',
    label: 'Налоги и Контроль (Безопасность)',
    icon: 'ShieldScale',
    description: 'Контроль цен Пост. 713, экосбор РБ и база законов для селлера',
    tabs: [
      tab('price-control', 'Контроль цен (Пост. 713)', [wbPriceControl713]),
      tab('eco-fee', 'Экосбор РБ', [wbEcoFeeCalculator]),
      tab('laws', 'Юридический навигатор (База законов)', [wbLegalNavigator]),
    ],
  },
  {
    id: 'pvz-logistics',
    label: 'Аналитика ПВЗ и Логистика',
    icon: 'PvzPoint',
    description: 'Покатушки самовывоза из ПВЗ и сборные грузы Минск → РФ',
    tabs: [
      tab('pvz-return', 'Анализ покатушек (ПВЗ)', [wbPvzReturn]),
      tab('pvz', 'Калькулятор ПВЗ WB', [wbPvzBreakEven]),
      tab('cargo', 'Калькулятор доставки грузов (Карго)', [wbCargoCalculator]),
    ],
  },
  {
    id: 'seo',
    label: 'SEO Оптимизация',
    icon: 'SeoBrush',
    description: 'Чистка текстов карточек и расчёт потерь от отсутствия товара',
    tabs: [
      tab('seo-clean', 'SEO очистка текста', [wbSEOClean]),
      tab('stockout', 'Упущенная выгода (Stockout)', [wbStockout]),
    ],
  },
];

export const WB_LEARNING_GROUPS: FeatureGroup[] = [
  {
    id: 'learning',
    label: 'Обучение',
    defaultOpen: true,
    blocks: [SIMULATOR_BLOCK],
  },
];

export const WB_FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'main',
    label: 'Основные',
    defaultOpen: true,
    blocks: WB_BLOCKS,
  },
];

export const WB_SECTION_CONFIG: SectionConfig = {
  id: 'wb',
  label: 'Wildberries',
  icon: 'Package',
  color: '#CB1187',
  featureGroups: [...WB_LEARNING_GROUPS, ...WB_FEATURE_GROUPS],
  defaultBlock: 'startup',
  description: 'Инструменты для управления бизнесом на Wildberries',
};

export const SECTIONS_REGISTRY: Record<string, SectionConfig> = {
  wb: WB_SECTION_CONFIG,
};

export function getSectionConfig(sectionId: string): SectionConfig | undefined {
  return SECTIONS_REGISTRY[sectionId];
}

export function getAllSections(): SectionConfig[] {
  return Object.values(SECTIONS_REGISTRY);
}

/** Все блоки раздела (пункты бокового меню) */
export function getBlocks(sectionId: string): ToolBlock[] {
  const section = getSectionConfig(sectionId);
  if (!section) return [];
  return section.featureGroups.flatMap((group) => group.blocks);
}

export function getBlock(sectionId: string, blockId: string): ToolBlock | undefined {
  return getBlocks(sectionId).find((block) => block.id === blockId);
}

/** Активная вкладка блока с безопасным откатом на первую */
export function getActiveTab(block: ToolBlock, tabId?: string | null): ToolTab {
  return block.tabs.find((item) => item.id === tabId) ?? block.tabs[0];
}

/** Инструмент раздела по id (в том числе не выведенные в меню — для глубоких ссылок) */
export function getFeature(sectionId: string, featureId: string): Feature | undefined {
  const section = getSectionConfig(sectionId);
  if (!section) return undefined;

  for (const group of section.featureGroups) {
    for (const block of group.blocks) {
      for (const item of block.tabs) {
        const feature = item.features.find((f) => f.id === featureId);
        if (feature) return feature;
      }
    }
  }

  if (sectionId === 'wb') {
    return WB_STANDALONE_FEATURES.find((feature) => feature.id === featureId);
  }
  return undefined;
}

/** Инструменты, доступные из меню (те, что лежат в табах блоков) */
export function getAllFeatures(sectionId: string): Feature[] {
  return getBlocks(sectionId).flatMap((block) =>
    block.tabs.flatMap((item) => item.features)
  );
}

/** Инструмент доступен из меню (то есть лежит в табе одного из блоков) */
export function getMenuFeature(sectionId: string, featureId: string): Feature | undefined {
  return getAllFeatures(sectionId).find((feature) => feature.id === featureId);
}