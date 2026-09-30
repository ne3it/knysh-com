import type { SectionConfig, Feature, FeatureGroup } from '@/types/section';
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
import { BarcodeIcon, PriceControlIcon, StockoutIcon, SEOCleanIcon, StartupPlannerIcon, CargoTruckIcon, TNVEDCheckIcon, SplitCalculatorIcon, EcoFeeIcon, MarkingCodeIcon } from './icons';

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
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
    };

export function getIconComponent(name: string) {
  return ICON_MAP[name] || HelpCircle;
}

const wbCalculator: Feature = {
  id: 'calculator',
  label: 'Калькулятор юнит-экономики',
  icon: 'Calculator',
  description: 'Расчет ППЦ и ROI для Wildberries (РБ → РФ)',
  componentPath: '@/components/features/wb/Calculator',
  group: 'main',
};

const wbSEOClean: Feature = {
  id: 'seo-clean',
  label: 'SEO очистка текста',
  icon: 'SEOClean',
  description: 'Очистка и форматирование текстов для SEO на Wildberries',
  componentPath: '@/components/features/wb/SEOClean',
  group: 'main',
};

const wbStockout: Feature = {
  id: 'stockout',
  label: 'Упущенная выгода (Stockout)',
  icon: 'Stockout',
  description: 'Потери от отсутствия товара на складе WB',
  componentPath: '@/components/features/wb/Stockout',
  group: 'main',
};

const wbPriceControl713: Feature = {
  id: 'price-control-713',
  label: 'Контроль цен (Пост. 713)',
  icon: 'PriceControl',
  description: 'Расчет МРЦ по Постановлению № 713 РБ (контроль цен)',
  componentPath: '@/components/features/wb/PriceControl713',
  group: 'main',
};

const wbLabelsGenerator: Feature = {
  id: 'labels-generator',
  label: 'Маркировка и этикетки РБ',
  icon: 'Barcode',
  description: 'Генерация термоэтикеток 58x40 мм (EAN13/CODE128, ЕАС)',
  componentPath: '@/components/features/wb/LabelsGenerator',
  group: 'main',
};

const wbStartupPlanner: Feature = {
  id: 'startup-planner',
  label: 'Планировщик старта',
  icon: 'StartupPlanner',
  description: 'Интерактивный чек-лист и смета стартового капитала для выхода на WB из РБ',
  componentPath: '@/components/features/wb/StartupPlanner',
  group: 'main',
};

const wbCargoCalculator: Feature = {
  id: 'cargo-calculator',
  label: 'Калькулятор доставки грузов',
  icon: 'CargoTruck',
  description: 'Сборщик и оптимизатор сборных грузов (Карго/Фулфилмент): паллеты, тарифы, Минск → РФ',
  componentPath: '@/components/features/wb/CargoCalculator',
  group: 'main',
};

const wbTNVEDCheck: Feature = {
  id: 'tnved-check',
  label: 'Проверка ТН ВЭД и ОП',
  icon: 'TNVEDCheck',
  description: 'Проверка обязательной сертификации по ТР ТС и генератор отказных писем РБ (PDF)',
  componentPath: '@/components/features/wb/TNVEDCheck',
  group: 'main',
};

const wbSplitCalculator: Feature = {
  id: 'split-calculator',
  label: 'Защита от акций (Сплит)',
  icon: 'SplitCalculator',
  description: 'Сплит-калькулятор цен для акций WB: защита от ухода в минус при участии в акциях',
  componentPath: '@/components/features/wb/SplitCalculator',
  group: 'main',
};

const wbEcoFeeCalculator: Feature = {
  id: 'eco-fee-calculator',
  label: 'Экосбор РБ',
  icon: 'EcoFee',
  description: 'Расчёт белорусского экологического сбора (экосбор) за упаковку товаров',
  componentPath: '@/components/features/wb/EcoFeeCalculator',
  group: 'main',
};

const wbMarkingValidator: Feature = {
  id: 'marking-code-validator',
  label: 'Валидатор Указа № 243',
  icon: 'MarkingCode',
  description: 'Валидация кодов маркировки (DataMatrix / Честный Знак) по Указу № 243 и проверка легальности оборота товаров РБ → РФ',
  componentPath: '@/components/features/wb/MarkingCodeValidator',
  group: 'main',
};

export const WB_FEATURE_GROUPS: FeatureGroup[] = [  {
    id: 'main',
    label: 'Основные',
    defaultOpen: true,
    features: [wbCalculator, wbSEOClean, wbStockout, wbPriceControl713, wbLabelsGenerator, wbStartupPlanner, wbCargoCalculator, wbTNVEDCheck, wbSplitCalculator, wbEcoFeeCalculator, wbMarkingValidator],
  },
];

export const WB_SECTION_CONFIG: SectionConfig = {
  id: 'wb',
  label: 'Wildberries',
  icon: 'Package',
  color: '#CB1187',
  featureGroups: WB_FEATURE_GROUPS,
  defaultFeature: 'calculator',
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

export function getFeature(sectionId: string, featureId: string): Feature | undefined {
  const section = getSectionConfig(sectionId);
  if (!section) return undefined;

  for (const group of section.featureGroups) {
    const feature = group.features.find((f) => f.id === featureId);
    if (feature) return feature;
  }
  return undefined;
}

export function getAllFeatures(sectionId: string): Feature[] {
  const section = getSectionConfig(sectionId);
  if (!section) return [];

  return section.featureGroups.flatMap((group) => group.features);
}