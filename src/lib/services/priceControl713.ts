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
  // Одежда, обувь и текстиль
  { id: 'clothes_top', name: 'Одежда верхняя, куртки', group: 'Одежда, обувь и текстиль', limit: 30 },
  { id: 'clothes_light', name: 'Одежда легкая, платья', group: 'Одежда, обувь и текстиль', limit: 30 },
  { id: 'knitwear', name: 'Трикотаж, свитера', group: 'Одежда, обувь и текстиль', limit: 35 },
  { id: 'shoes', name: 'Обувь взрослая', group: 'Одежда, обувь и текстиль', limit: 35 },
  { id: 'bed_linen', name: 'Постельное белье', group: 'Одежда, обувь и текстиль', limit: 30 },
  { id: 'hosiery', name: 'Чулочно-носочные изделия', group: 'Одежда, обувь и текстиль', limit: 25 },

  // Детские товары
  { id: 'kids_clothes', name: 'Детская одежда и трикотаж', group: 'Детские товары', limit: 30 },
  { id: 'kids_shoes', name: 'Детская обувь', group: 'Детские товары', limit: 35 },
  { id: 'kids_toys', name: 'Детские игрушки и игры', group: 'Детские товары', limit: 30 },
  { id: 'diapers_pads', name: 'Подгузники и пеленки', group: 'Детские товары', limit: 30 },
  { id: 'kids_food', name: 'Детское питание', group: 'Детские товары', limit: 25 },

  // Красота и гигиена
  { id: 'perfumery', name: 'Парфюмерия и духи', group: 'Красота и гигиена', limit: 40 },
  { id: 'decor_makeup', name: 'Декоративная косметика', group: 'Красота и гигиена', limit: 40 },
  { id: 'skin_care', name: 'Уходовая косметика для кожи', group: 'Красота и гигиена', limit: 35 },
  { id: 'hair_care', name: 'Средства ухода за волосами', group: 'Красота и гигиена', limit: 30 },
  { id: 'soap_toilet', name: 'Мыло туалетное', group: 'Красота и гигиена', limit: 25 },
  { id: 'oral_care', name: 'Зубная паста и гигиена рта', group: 'Красота и гигиена', limit: 30 },
  { id: 'pads_tampons', name: 'Прокладки и тампоны', group: 'Красота и гигиена', limit: 30 },

  // Дом, кухня и ремонт
  { id: 'kitchenware', name: 'Посуда кухонная', group: 'Дом, кухня и ремонт', limit: 30 },
  { id: 'hand_tools', name: 'Инструменты ручные', group: 'Дом, кухня и ремонт', limit: 30 },
  { id: 'household_chemicals', name: 'Бытовая химия и порошки', group: 'Дом, кухня и ремонт', limit: 25 },
  { id: 'lighting', name: 'Светильники и люстры', group: 'Дом, кухня и ремонт', limit: 35 },
  { id: 'furniture', name: 'Корпусная мебель', group: 'Дом, кухня и ремонт', limit: 30 },

  // Остальные категории
  { id: 'bags', name: 'Сумки и рюкзаки', group: 'Остальные категории', limit: 21 },
  { id: 'stationery', name: 'Канцелярия', group: 'Остальные категории', limit: 15 },
  { id: 'hobby', name: 'Товары для хобби и мозаика', group: 'Остальные категории', limit: 15 },
  { id: 'sports', name: 'Спортинвентарь', group: 'Остальные категории', limit: 14 },
  { id: 'zoogoods', name: 'Зоотовары', group: 'Остальные категории', limit: 15 },
  { id: 'grocery', name: 'Бакалея, чай, кофе', group: 'Остальные категории', limit: 40 },
  { id: 'nuts_dried', name: 'Орехи и сухофрукты', group: 'Остальные категории', limit: 35 },
];

/** Универсальный ручной ввод лимита */
export const PRICE_CONTROL_CUSTOM_ID = 'p713_custom';

export const PRICE_CONTROL_CUSTOM_CATEGORY: PriceControlCategory = {
  id: PRICE_CONTROL_CUSTOM_ID,
  name: 'Другой товар (ввести лимит наценки вручную)',
  group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
  limit: 30,
};

export const ALL_PRICE_CONTROL_CATEGORIES: PriceControlCategory[] = [
  ...PRICE_CONTROL_CATEGORIES,
  PRICE_CONTROL_CUSTOM_CATEGORY,
];

export const DEFAULT_PRICE_CONTROL_ID = 'clothes_top';

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
