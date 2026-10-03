/**
 * Ультимативный справочник регулируемых категорий по Постановлению № 713 КГК РБ.
 *
 * limit — предельная надбавка к себестоимости закупки в виде ДОЛИ (0.30 = 30%).
 * Таблица покрывает все основные товарные секторы розничной торговли РБ
 * и используется как сквозным мега-калькулятором, так и калькулятором контроля цен.
 */

export interface Postanovlenie713Entry {
  name: string;
  limit: number;
  group: string;
}

export const POSTANOVLENIE_713_CATALOG: Postanovlenie713Entry[] = [
  // ОДЕЖДА (ВЗРОСЛЫЙ АССОРТИМЕНТ) — макс. надбавка 30-35%
  { name: 'Пальто, полупальто, плащи, куртки, ветровки мужские/женские', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Костюмы, комплекты, пиджаки, блейзеры, жакеты', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Платья, сарафаны, юбки, юбки-брюки', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Брюки, комбинезоны, бриджи, шорты', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Блузки, рубашки, батники, туники', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Свитеры, джемперы, пуловеры, кардиганы, жилеты трикотажные', limit: 0.35, group: 'Одежда для взрослых' },
  { name: 'Спортивные костюмы, брюки, куртки (для спорта)', limit: 0.35, group: 'Одежда для взрослых' },
  { name: 'Белье нательное, пижамы, халаты, сорочки ночные', limit: 0.35, group: 'Одежда для взрослых' },
  { name: 'Майки, фуфайки нательные, топ-бра трикотажные', limit: 0.35, group: 'Одежда для взрослых' },
  { name: 'Головные уборы (шапки, кепки, береты, шляпы)', limit: 0.30, group: 'Одежда для взрослых' },
  { name: 'Перчатки, рукавицы, шарфы, кашне, платки', limit: 0.30, group: 'Одежда для взрослых' },

  // ЧУЛОЧНО-НОСОЧНЫЕ ИЗДЕЛИЯ И ОБУВЬ — макс. надбавка 25-35%
  { name: 'Колготки, легинсы, рейтузы трикотажные', limit: 0.25, group: 'Чулочно-носочные и обувь' },
  { name: 'Носки, гольфы, подследники мужские/женские', limit: 0.25, group: 'Чулочно-носочные и обувь' },
  { name: 'Обувь домашняя и дорожная (тапочки, пантофли)', limit: 0.35, group: 'Чулочно-носочные и обувь' },
  { name: 'Обувь модельную и повседневную с верхом из кожи', limit: 0.35, group: 'Чулочно-носочные и обувь' },
  { name: 'Обувь с верхом из текстильных материалов', limit: 0.35, group: 'Чулочно-носочные и обувь' },
  { name: 'Обувь спортивная (кроссовки, кеды)', limit: 0.35, group: 'Чулочно-носочные и обувь' },
  { name: 'Обувь резиновая и полимерная (сапоги, сланцы)', limit: 0.35, group: 'Чулочно-носочные и обувь' },

  // ТЕКСТИЛЬ И ПОСТЕЛЬНЫЕ ПРИНАДЛЕЖНОСТИ — макс. надбавка 30%
  { name: 'Ткани для одежды и постельного белья', limit: 0.30, group: 'Текстиль и постель' },
  { name: 'Постельное белье (комплекты, простыни, наволочки)', limit: 0.30, group: 'Текстиль и постель' },
  { name: 'Одеяла, пледы, покрывала стеганые и декоративные', limit: 0.30, group: 'Текстиль и постель' },
  { name: 'Подушки спальные, диванные, валики', limit: 0.30, group: 'Текстиль и постель' },
  { name: 'Полотенца махровые, вафельные, кухонные салфетки', limit: 0.30, group: 'Текстиль и постель' },
  { name: 'Скатерти, дорожки, текстильные салфетки для стола', limit: 0.30, group: 'Текстиль и постель' },

  // ДЕТСКИЙ АССОРТИМЕНТ — макс. надбавка 25-35%
  { name: 'Одежда верхняя пальтово-курточного ассортимента для детей', limit: 0.30, group: 'Детские товары' },
  { name: 'Детские костюмы, платья, юбки, брюки, джинсы', limit: 0.30, group: 'Детские товары' },
  { name: 'Трикотаж бельевой для новорожденных и детей ясельного возраста', limit: 0.30, group: 'Детские товары' },
  { name: 'Свитеры, кофты, джемперы детские трикотажные', limit: 0.35, group: 'Детские товары' },
  { name: 'Чулочно-носочные изделия для детей (носки, колготки)', limit: 0.25, group: 'Детские товары' },
  { name: 'Обувь детская ясельная, малодетская, школьная', limit: 0.35, group: 'Детские товары' },
  { name: 'Игрушки из пластмасс, резины, металла, деревянные', limit: 0.30, group: 'Детские товары' },
  { name: 'Мягконабивные игрушки и куклы', limit: 0.30, group: 'Детские товары' },
  { name: 'Настольные игры для детей, развивающие наборы, пазлы', limit: 0.30, group: 'Детские товары' },
  { name: 'Подгузники, детские трусики-подгузники', limit: 0.30, group: 'Детские товары' },
  { name: 'Детское питание (сухие смеси, каши, пюре)', limit: 0.25, group: 'Детские товары' },

  // ПАРФЮМЕРИЯ, КОСМЕТИКА И ГИГИЕНА — макс. надбавка 25-40%
  { name: 'Духи, парфюмерная вода, одеколоны', limit: 0.40, group: 'Косметика и гигиена' },
  { name: 'Косметика декоративная (для макияжа глаз, губ, лица, лаки)', limit: 0.40, group: 'Косметика и гигиена' },
  { name: 'Средства для ухода за кожей лица и тела (кремы, лосьоны)', limit: 0.35, group: 'Косметика и гигиена' },
  { name: 'Средства для ухода за волосами (шампуни, бальзамы, маски)', limit: 0.30, group: 'Косметика и гигиена' },
  { name: 'Зубные пасты, порошки, ополаскиватели рта', limit: 0.30, group: 'Косметика и гигиена' },
  { name: 'Мыло туалетное твердое и жидкое', limit: 0.25, group: 'Косметика и гигиена' },
  { name: 'Дезодоранты и антиперспиранты личные', limit: 0.30, group: 'Косметика и гигиена' },
  { name: 'Гигиенические пакеты, прокладки, тампоны, влажные салфетки', limit: 0.30, group: 'Косметика и гигиена' },

  // БЫТОВАЯ ХИМИЯ И ХОЗТОВАРЫ — макс. надбавка 25-30%
  { name: 'Средства для стирки (порошки, жидкие гели, капсулы)', limit: 0.25, group: 'Бытовая химия и хозтовары' },
  { name: 'Средства для мытья посуды и очистки кухонных поверхностей', limit: 0.25, group: 'Бытовая химия и хозтовары' },
  { name: 'Чистящие средства для ванн, туалетов, дезинфекторы', limit: 0.25, group: 'Бытовая химия и хозтовары' },
  { name: 'Мыло хозяйственное твердое и жидкое', limit: 0.25, group: 'Бытовая химия и хозтовары' },
  { name: 'Посуда столовая и кухонная из фарфора, фаянса, керамики', limit: 0.30, group: 'Бытовая химия и хозтовары' },
  { name: 'Посуда сортовая стеклянная, хрустальная', limit: 0.30, group: 'Бытовая химия и хозтовары' },
  { name: 'Сковороды, кастрюли, чайники металлические', limit: 0.30, group: 'Бытовая химия и хозтовары' },
  { name: 'Пакеты для мусора, пищевая пленка, фольга', limit: 0.30, group: 'Бытовая химия и хозтовары' },

  // ДРУГИЕ КАТЕГОРИИ И РЕГУЛИРУЕМЫЕ ТОВАРЫ
  { name: 'Канцелярские товары (тетради, ручки, карандаши, папки)', limit: 0.15, group: 'Другие товары по 713' },
  { name: 'Наборы для детского творчества и хобби', limit: 0.15, group: 'Другие товары по 713' },
  { name: 'Сумки женские/мужские, рюкзаки, портфели', limit: 0.21, group: 'Другие товары по 713' },
  { name: 'Спортивный инвентарь (мячи, ракетки, эспандеры)', limit: 0.14, group: 'Другие товары по 713' },
  { name: 'Зоотовары, аксессуары для животных (лежанки, поводки)', limit: 0.15, group: 'Другие товары по 713' },
  { name: 'Чай черный, зеленый, травяной байховый фасованный', limit: 0.40, group: 'Другие товары по 713' },
  { name: 'Кофе жареный в зернах, молотый, растворимый', limit: 0.40, group: 'Другие товары по 713' },
  { name: 'Орехи, сухофрукты, семена фасованные', limit: 0.35, group: 'Другие товары по 713' },
];

export interface PriceControlCategory {
  id: string;
  name: string;
  group: string;
  /** Предельная надбавка к себестоимости закупки, доля (0.30 = 30%) */
  limit: number;
}

/** Доля → проценты для отображения (0.30 → 30) */
export const limitToPercent = (limit: number): number =>
  Number.isFinite(limit) ? Math.round(limit * 100) : 0;

const CYRILLIC_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Стабильный идентификатор категории на основе её названия */
export function slugifyCategory(name: string): string {
  const transliterated = name
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_LATIN[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return `p713_${transliterated || 'custom'}`;
}

function buildCategories(): PriceControlCategory[] {
  const used = new Set<string>();
  return POSTANOVLENIE_713_CATALOG.map((entry) => {
    const baseId = slugifyCategory(entry.name);
    let id = baseId;
    let suffix = 2;
    while (used.has(id)) {
      id = `${baseId}_${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { id, name: entry.name, group: entry.group, limit: entry.limit };
  });
}

/** Справочник с идентификаторами (без ручного ввода) */
export const PRICE_CONTROL_CATEGORIES: PriceControlCategory[] = buildCategories();

/** Универсальный ручной ввод лимита — всегда последняя опция списка */
export const PRICE_CONTROL_CUSTOM_ID = 'p713_custom';

export const PRICE_CONTROL_CUSTOM_CATEGORY: PriceControlCategory = {
  id: PRICE_CONTROL_CUSTOM_ID,
  name: 'Другой товар (ввести лимит наценки вручную)',
  group: 'УНИВЕРСАЛЬНЫЙ ВВОД',
  limit: 0.30,
};

export const ALL_PRICE_CONTROL_CATEGORIES: PriceControlCategory[] = [
  ...PRICE_CONTROL_CATEGORIES,
  PRICE_CONTROL_CUSTOM_CATEGORY,
];

export const DEFAULT_PRICE_CONTROL_ID = PRICE_CONTROL_CATEGORIES[0].id;

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

function groupNamesInCatalogOrder(): string[] {
  const names = POSTANOVLENIE_713_CATALOG.reduce<string[]>((acc, entry) => {
    if (!acc.includes(entry.group)) acc.push(entry.group);
    return acc;
  }, []);
  return [...names, PRICE_CONTROL_CUSTOM_CATEGORY.group];
}

/** Категории, сгруппированные по товарным секторам — источник <optgroup label="..."> */
export const PRICE_CONTROL_GROUPS: PriceControlCategoryGroup[] = groupNamesInCatalogOrder().map(
  (group) => ({
    group,
    categories: ALL_PRICE_CONTROL_CATEGORIES.filter((category) => category.group === group),
  })
);

export interface PriceControlSectorStat {
  group: string;
  count: number;
  minPercent: number;
  maxPercent: number;
}

/** Сводка по секторам для подсказок в интерфейсе */
export const PRICE_CONTROL_SECTOR_STATS: PriceControlSectorStat[] =
  PRICE_CONTROL_GROUPS.map(({ group, categories }) => {
    const percents = categories.map((category) => limitToPercent(category.limit));
    return {
      group,
      count: categories.length,
      minPercent: Math.min(...percents),
      maxPercent: Math.max(...percents),
    };
  });
