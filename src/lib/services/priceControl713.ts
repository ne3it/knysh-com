/**
 * Единая таблица предельных надбавок по Постановлению № 713 КГК РБ.
 * Используется и отдельным калькулятором контроля цен, и сквозным мега-калькулятором.
 * limit хранится в ПРОЦЕНТАХ от себестоимости закупки.
 */

export interface PriceControlCategory {
  id: string;
  name: string;
  group: string;
  /** Предельная надбавка к себестоимости закупки, % */
  limit: number;
}

export const PRICE_CONTROL_CATEGORIES: PriceControlCategory[] = [
  { id: 'clothes_mw', name: 'Одежда мужская и женская (кроме трикотажа)', group: 'Одежда и обувь', limit: 30 },
  { id: 'knitwear', name: 'Трикотажные изделия (белье, кофты, футболки)', group: 'Одежда и обувь', limit: 35 },
  { id: 'shoes', name: 'Обувь мужская и женская', group: 'Одежда и обувь', limit: 35 },
  { id: 'hosiery', name: 'Чулочно-носочные изделия', group: 'Одежда и обувь', limit: 25 },

  { id: 'kids_clothes', name: 'Детская одежда и трикотаж', group: 'Детские товары', limit: 30 },
  { id: 'kids_shoes', name: 'Детская обувь', group: 'Детские товары', limit: 35 },
  { id: 'kids_toys', name: 'Детские игрушки и игры', group: 'Детские товары', limit: 30 },
  { id: 'kids_food', name: 'Детское питание (каши, смеси, пюре)', group: 'Детские товары', limit: 25 },
  { id: 'diapers', name: 'Подгузники и детские трусики', group: 'Детские товары', limit: 30 },

  { id: 'perfumery', name: 'Парфюмерия и духи', group: 'Косметика и гигиена', limit: 40 },
  { id: 'decor_cosmetics', name: 'Декоративная косметика (помада, тушь, лаки)', group: 'Косметика и гигиена', limit: 40 },
  { id: 'skin_care', name: 'Средства для ухода за кожей лица и тела', group: 'Косметика и гигиена', limit: 35 },
  { id: 'hair_care', name: 'Средства для ухода за волосами (шампуни, бальзамы)', group: 'Косметика и гигиена', limit: 30 },
  { id: 'oral_care', name: 'Зубная паста, щётки и средства гигиены рта', group: 'Косметика и гигиена', limit: 30 },
  { id: 'soap_toilet', name: 'Мыло туалетное и твердое', group: 'Косметика и гигиена', limit: 25 },
  { id: 'hygiene_pads', name: 'Гигиенические пакеты, тампоны, салфетки', group: 'Косметика и гигиена', limit: 30 },

  { id: 'laundry', name: 'Средства для стирки (порошки, гели, капсулы)', group: 'Бытовая химия', limit: 25 },
  { id: 'dishwashing', name: 'Средства для мытья посуды', group: 'Бытовая химия', limit: 25 },
  { id: 'cleaning', name: 'Чистящие средства для дома и сантехники', group: 'Бытовая химия', limit: 25 },
  { id: 'soap_household', name: 'Мыло хозяйственное', group: 'Бытовая химия', limit: 25 },

  { id: 'tableware', name: 'Посуда столовая и кухонная', group: 'Хозтовары', limit: 30 },
  { id: 'home_textile', name: 'Постельное белье и текстиль для дома', group: 'Хозтовары', limit: 30 },
  { id: 'small_appliances', name: 'Бытовая техника малая (чайники, блендеры)', group: 'Техника', limit: 30 },
  { id: 'tools', name: 'Инструменты ручные и электроинструменты', group: 'Инструменты', limit: 30 },
];

/** Универсальный ручной ввод лимита */
export const PRICE_CONTROL_CUSTOM_ID = 'p713_custom';

export const PRICE_CONTROL_CUSTOM_CATEGORY: PriceControlCategory = {
  id: PRICE_CONTROL_CUSTOM_ID,
  name: 'Кастомный лимит (ввести надбавку вручную)',
  group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
  limit: 30,
};

export const ALL_PRICE_CONTROL_CATEGORIES: PriceControlCategory[] = [
  ...PRICE_CONTROL_CATEGORIES,
  PRICE_CONTROL_CUSTOM_CATEGORY,
];

export const DEFAULT_PRICE_CONTROL_ID = 'clothes_mw';

export function getPriceControlCategory(id: string): PriceControlCategory {
  return (
    ALL_PRICE_CONTROL_CATEGORIES.find((category) => category.id === id) ??
    PRICE_CONTROL_CATEGORIES[0]
  );
}

export interface PriceControlCategoryGroup {
  group: string;
  categories: PriceControlCategory[];
}

export const PRICE_CONTROL_GROUPS: PriceControlCategoryGroup[] = [
  ...PRICE_CONTROL_CATEGORIES.reduce<string[]>((acc, category) => {
    if (!acc.includes(category.group)) acc.push(category.group);
    return acc;
  }, []),
  PRICE_CONTROL_CUSTOM_CATEGORY.group,
].map((group) => ({
  group,
  categories: ALL_PRICE_CONTROL_CATEGORIES.filter((category) => category.group === group),
}));
