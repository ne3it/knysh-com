'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  ArrowUpRight,
  Banknote,
  Briefcase,
  ClipboardList,
  Droplets,
  FileCheck2,
  Fingerprint,
  Gavel,
  Globe2,
  HandCoins,
  Landmark,
  Layers,
  Leaf,
  Megaphone,
  MonitorSmartphone,
  Pill,
  ReceiptText,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
  ShieldCheck,
  Shirt,
  Ship,
  Store,
  Tags,
  Timer,
  UserRound,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export type LawCategory =
  | 'clothes'
  | 'cosmetics'
  | 'pvz'
  | 'shoes'
  | 'npd'
  | 'general'
  | 'food'
  | 'bads'
  | 'auto'
  | 'electronics'
  | 'textile';

export type LawTag = 'all' | LawCategory;

export interface LawTagOption {
  id: LawTag;
  label: string;
}

export interface LawSource {
  label: string;
  url: string;
}

export interface LawCardData {
  id: string;
  title: string;
  categories: LawCategory[];
  body: string;
  note?: string;
  /** Служебные ключевые слова — попадают только в поисковый индекс, в карточке не выводятся */
  keywords?: string[];
  source: LawSource;
  icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORY_LABELS: Record<LawCategory, string> = {
  clothes: 'Одежда',
  cosmetics: 'Косметика',
  pvz: 'ПВЗ',
  shoes: 'Обувь',
  npd: 'Самозанятость (НПД)',
  general: 'Для всех',
  food: 'Питание',
  bads: 'БАДы и питание',
  auto: 'Автотовары',
  electronics: 'Электроника',
  textile: 'Текстиль',
};

export const LAW_TAGS: LawTagOption[] = [
  { id: 'all', label: 'Показать всё' },
  { id: 'clothes', label: 'Я продаю одежду' },
  { id: 'shoes', label: 'Я продаю обувь' },
  { id: 'cosmetics', label: 'Я продаю косметику' },
  { id: 'bads', label: 'Я продаю БАДы и питание' },
  { id: 'auto', label: 'Я продаю автотовары' },
  { id: 'electronics', label: 'Я продаю электронику' },
  { id: 'npd', label: 'Я самозанятый (НПД)' },
  { id: 'pvz', label: 'Я открываю ПВЗ' },
];

export const LAW_CARDS: LawCardData[] = [
  {
    id: 'nbrb-rate',
    title: 'Правила НБРБ по пересчету валют',
    categories: ['clothes', 'cosmetics'],
    icon: Banknote,
    body: 'Выручка от продаж на WB изначально фиксируется маркетплейсом, но для налоговой отчетности в РБ она пересчитывается в белорусские рубли строго по официальному курсу Национального банка РБ (НБРБ) на дату отчета о реализации.',
    note: 'Применяется во вкладках «Мега-калькулятор» и «КУДиР».',
    source: {
      label: 'Официальный сайт Национального банка РБ — nbrb.by',
      url: 'https://nbrb.by',
    },
  },
  {
    id: 'eco-waste-law',
    title: 'Закон РБ «Об обращении с отходами» (Экологический сбор)',
    categories: ['clothes', 'cosmetics'],
    icon: Leaf,
    body: 'Контролируется ГУ «Оператор вторичных материальных ресурсов». Селлеры WB в РБ становятся импортерами упаковки (зип-локи, коробки, стрейч). Вы обязаны ежеквартально/ежегодно подавать отчет и платить экосбор за каждый килограмм пластика и картона.',
    note: 'Применяется во вкладке «Экосбор РБ».',
    source: {
      label: 'ГУ «Оператор вторичных материальных ресурсов» — vtoroperator.by',
      url: 'https://vtoroperator.by',
    },
  },
  {
    id: 'platform-economy',
    title: 'Закон о платформенной экономике (Защитный таймер ПВЗ)',
    categories: ['pvz'],
    icon: Timer,
    body: 'С 1 октября закон запрещает маркетплейсам изменять тарифы зон или вводить новые штрафы для ПВЗ внезапно. Обязателен срок уведомления франчайзи за 45 дней.',
    note: 'Используйте этот запас времени, чтобы вовремя пересчитать модель расходов на нашем сайте.',
    source: {
      label: 'Национальный правовой Интернет-портал Республики Беларусь — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'tax-code-franchise',
    title: 'Налоговый кодекс РБ (Доход франшизы ПВЗ)',
    categories: ['pvz'],
    icon: Landmark,
    body: 'Правила расчета подоходного налога (20%) или ОСН для владельцев ПВЗ. Налог исчисляется от суммы чистого вознаграждения, выплаченного маркетплейсом, за вычетом документально подтвержденных расходов (аренда, ФОТ сотрудников).',
    source: {
      label: 'Министерство по налогам и сборам РБ — nalog.gov.by',
      url: 'https://nalog.gov.by',
    },
  },
  {
    id: 'ukaz-243-marking',
    title: 'Указ № 243 — Обязательная маркировка товаров',
    categories: ['shoes', 'clothes'],
    icon: Shirt,
    body: 'В Беларуси оборот обуви, текстиля и некоторых видов одежды без кодов защиты строго запрещен. Селлеры обязаны маркировать товар в национальной системе «Электронный знак».',
    source: {
      label: 'Государственная система маркировки — datamark.by',
      url: 'https://datamark.by',
    },
  },
  {
    id: 'npd-self-employed',
    title: 'Налог на профессиональный доход (НПД) для самозанятых',
    categories: ['npd'],
    icon: UserRound,
    body: 'Физические лица в РБ имеют право продавать на маркетплейсах товары СОБСТВЕННОГО производства, уплачивая налог 10% (или 20% при превышении лимита) через официальное приложение МНС РБ. Перепродавать чужие товары на НПД строго запрещено.',
    source: {
      label: 'База знаний МНС РБ по НПД — nalog.gov.by',
      url: 'https://nalog.gov.by/tax_regimes/npd/',
    },
  },
  {
    id: 'consumer-protection',
    title: 'Закон РБ «О защите прав потребителей» (Правила возвратов на WB)',
    categories: ['clothes', 'shoes', 'cosmetics', 'npd'],
    icon: RotateCcw,
    body: 'Регулирует права покупателей при возврате товаров надлежащего и ненадлежащего качества. Торговля через маркетплейс признается дистанционной торговлей в РБ. Селлер обязан принимать возвраты брака и компенсировать стоимость доставки, если вина лежит на продавце. Некоторые категории (например, белье 1-го слоя, косметика) надлежащего качества возврату не подлежат.',
    source: {
      label: 'Текст Закона на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'advertising-law',
    title: 'Закон РБ «О рекламе» (Маркировка интернет-продвижения и саморекламы)',
    categories: ['clothes', 'shoes', 'cosmetics'],
    icon: Megaphone,
    body: 'Продвижение карточек товаров на Wildberries (внутренняя реклама, баннеры, участие в платных блоках) на территории РБ должно строго соответствовать закону о рекламе. Запрещено использование недостоверных сведений, слов «лучший», «номер один» без документального подтверждения. Реклама товаров, подлежащих обязательной сертификации, без наличия этих сертификатов запрещена.',
    source: {
      label: 'Текст Закона на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'currency-control-178',
    title: 'Валютный контроль и Указ № 178 (Экспортные операции при торговле на РФ)',
    categories: ['clothes', 'shoes', 'cosmetics'],
    icon: Globe2,
    body: 'Продажи товаров со склада в РБ покупателям из России через Wildberries признаются внешнеторговой деятельностью. Селлеры обязаны соблюдать сроки репатриации валютной выручки и регистрировать валютные договоры на портале Национального банка РБ при превышении установленных законодательством РБ лимитов по сумме сделки.',
    source: {
      label: 'Указ Президента № 178 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'decree-7-business',
    title: 'Декрет № 7 «О развитии предпринимательства»',
    categories: ['general', 'clothes', 'shoes', 'cosmetics', 'npd'],
    icon: FileCheck2,
    body: 'Ключевой документ, упрощающий ведение бизнеса в Беларуси. Вводит уведомления о начале осуществления видов деятельности и минимизирует встречные проверки со стороны госорганов. Однако он накладывает на селлера личную ответственность за обеспечение безопасности продаваемых товаров и соответствие их санитарным нормам.',
    source: {
      label: 'Декрет № 7 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'sovmmin-31-distance-trade',
    title: 'Постановление Совмина № 31__ — Правила продажи товаров при дистанционной торговле',
    categories: ['clothes', 'shoes', 'cosmetics', 'general'],
    icon: MonitorSmartphone,
    body: 'Устанавливает жесткие требования к интернет-торговле и маркетплейсам в РБ. Селлер обязан предоставить покупателю полную и достоверную информацию о товаре, стране производства, импортере, сроках гарантии до момента заключения договора. Продажа товаров без указания этих данных в карточке товара на WB признается нарушением правил торговли РБ.',
    keywords: [
      'Минторг',
      'дистанционная торговля',
      'интернет-магазин',
      'информация о товаре',
      'гарантия',
    ],
    source: {
      label: 'Правила торговли на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'law-99z-personal-data',
    title: 'Закон РБ № 99-З «О защите персональных данных» (Контроль базы клиентов)',
    categories: ['general', 'pvz'],
    icon: Fingerprint,
    body: 'Регулирует сбор, обработку и хранение личных данных клиентов. Актуально для владельцев ПВЗ (работа с ФИО, телефонами и паспортами при выдаче) и селлеров, собирающих контакты для маркетинга. Требует обязательного получения согласия пользователя на обработку данных и защиты информационных систем от утечек.',
    keywords: ['персональные данные', 'согласие на обработку', 'утечки', 'база клиентов'],
    source: {
      label: 'Текст Закона на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'ettn-22-10-22',
    title: 'Постановление Минфина, МНС и Минсвязи № 22/10/22 (Электронные накладные ЭТТН)',
    categories: ['clothes', 'shoes', 'cosmetics'],
    icon: ReceiptText,
    body: 'При отгрузке маркированных товаров («Электронный знак») или транзите товаров в Российскую Федерацию селлеры обязаны использовать электронный документооборот (ЭДО) и выписывать электронные товарно-транспортные накладные (ЭТТН). Использование бумажных БСО для таких групп товаров в ВЭД-операциях ограничено.',
    keywords: [
      'ЭТТН',
      'ЭДО',
      'электронный документооборот',
      'товарно-транспортная накладная',
      'БСО',
    ],
    source: {
      label: 'Инструкция по ЭТТН на nalog.gov.by — nalog.gov.by',
      url: 'https://nalog.gov.by',
    },
  },
  {
    id: 'ukaz-143-economy',
    title: 'Указ Президента № 143 «О поддержке экономики» (Налоговые преференции и учет)',
    categories: ['general', 'clothes', 'shoes', 'cosmetics', 'npd'],
    icon: ScrollText,
    body: 'Предоставляет право местным органам власти изменять сроки уплаты местных налогов и сборов. Регулирует базовые принципы проверок и применения штрафных санкций. Накладывает на субъекты хозяйствования обязанность по строгому ведению кассовой дисциплины при дистанционных расчетах через платежных агентов (маркетплейсы).',
    keywords: ['налоговые преференции', 'кассовая дисциплина', 'платежный агент', 'местные налоги'],
    source: {
      label: 'Указ № 143 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'customs-regulation',
    title: 'Закон РБ «О таможенном регулировании в РБ» (Статистическое декларирование ВЭД)',
    categories: ['clothes', 'shoes', 'cosmetics'],
    icon: Ship,
    body: 'При торговле с государствами-членами ЕАЭС (включая РФ) селлеры РБ освобождены от стандартных таможенных пошлин, но обязаны своевременно подавать статистические декларации в таможенные органы РБ по итогам каждого месяца, в котором производились отгрузки или возвраты через склады WB.',
    keywords: [
      'таможня',
      'таможенное регулирование',
      'статистическое декларирование',
      'статистическая декларация',
      'ЕАЭС',
    ],
    source: {
      label: 'Закон о таможенном регулировании на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'cm-1124-bads',
    title: 'Постановление СМ РБ № 1124 — Правила интернет-торговли биологически активными добавками и питанием',
    categories: ['food', 'bads'],
    icon: Pill,
    body: 'Регулирует жесткие ограничения на дистанционную продажу БАДов и специализированного питания в РБ. Продажа допускается только при наличии государственной регистрации (СГР Минздрава РБ) и внесения в единый реестр ЕАЭС. Нарушение правил влечет немедленное изъятие партии и крупные штрафы.',
    keywords: ['БАД', 'БАДы', 'Минздрав', 'СГР', 'реестр ЕАЭС', 'спортивное питание'],
    source: {
      label: 'Постановление № 1124 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'trts-030-auto-fluids',
    title: 'Технический регламент ТР ТС 030/2012 — Требования к автомобильным маслам и спецжидкостям',
    categories: ['auto'],
    icon: Droplets,
    body: 'Продажа моторных масел, антифризов и тормозных жидкостей на WB из РБ требует обязательного оформления декларации соответствия по регламенту безопасности смазочных материалов. Продажа контрафакта или продукции без паспорта качества влечет конфискацию.',
    keywords: ['масло', 'масла', 'антифриз', 'тормозная жидкость', 'смазочные материалы', 'конфискация'],
    source: {
      label: 'Регламент ТР ТС 030 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'trts-004-020-electronics',
    title:
      'Технические регламенты ТР ТС 004/2011 и 020/2011 — Безопасность низковольтного оборудования и электромагнитная совместимость',
    categories: ['electronics'],
    icon: Zap,
    body: 'Любая бытовая техника, гаджеты и зарядные устройства, питающиеся от сети или мощных литиевых аккумуляторов, подлежат строгому подтверждению соответствия. Для сложных приборов требуется Сертификат, для мелких аксессуаров — Декларация.',
    keywords: ['аккумулятор', 'видеорегистратор', 'бытовая техника', 'сертификат', 'декларация соответствия'],
    source: {
      label: 'ТР ТС 004 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'ukaz-4-currency',
    title:
      'Указ Президента РБ № 4__ — О мерах по противодействию незаконным валютным операциям и теневому обороту',
    categories: ['clothes', 'shoes', 'cosmetics', 'food', 'bads', 'auto', 'electronics', 'npd', 'pvz'],
    icon: HandCoins,
    body: 'Жесткий указ, регулирующий легальность финансовых потоков интернет-магазинов и селлеров. Запрещает использование подставных счетов, серых схем вывода денег с маркетплейсов и сокрытие реальной выручки в BYN. Контролируется ДФР КГК РБ.',
    keywords: ['ДФР', 'КГК', 'теневая экономика', 'серые схемы', 'подставные счета'],
    source: {
      label: 'Текст Указа на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'gk-article-22',
    title: 'Гражданский кодекс РБ (Статья 22 — Предпринимательская деятельность граждан)',
    categories: ['general', 'npd'],
    icon: Briefcase,
    body: 'Определяет четкие границы между самозанятостью (НПД) и полноценным бизнесом. Если селлер на НПД начинает системно перепродавать чужие товары, а не производить свои, его деятельность признается незаконной предпринимательской деятельностью с конфискацией 100% дохода.',
    keywords: ['перепродажа', 'перепродавать', 'Гражданский кодекс', 'конфискация', 'самозанятость'],
    source: {
      label: 'Гражданский кодекс на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'pricing-law-713',
    title: 'Закон РБ «О ценообразовании» и Постановление № 713',
    categories: ['clothes', 'shoes', 'cosmetics', 'food', 'bads', 'auto', 'electronics'],
    icon: Tags,
    body: 'Фундаментальный закон РБ, запрещающий необоснованное повышение цен на регулируемые потребительские товары. Ограничивает норму прибыли импортеров и оптовые надбавки. Любое превышение грозит селлеру штрафом в двукратном размере от суммы завышения.',
    keywords: ['цена', 'наценка', 'МРЦ', 'регулируемые цены', 'двукратный штраф'],
    source: {
      label: 'Закон о ценообразовании на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'mns-16-declarations',
    title: 'Постановление Министерства по налогам и сборам РБ № 16 — Правила заполнения налоговых деклараций',
    categories: ['general'],
    icon: ClipboardList,
    body: 'Регламентирует точный порядок и сроки подачи налоговой отчетности по УСН и подоходному налогу для ИП и юрлиц. Ошибки в расчете налоговой базы из-за удержаний комиссий WB признаются занижением налога и ведут к штрафам.',
    keywords: ['УСН', 'налоговая декларация', 'отчетность', 'комиссии WB'],
    source: {
      label: 'Постановление МНС № 16 на nalog.gov.by — nalog.gov.by',
      url: 'https://nalog.gov.by',
    },
  },
  {
    id: 'trts-017-light-industry',
    title: 'Технический регламент ТР ТС 017/2011 — Безопасность продукции легкой промышленности',
    categories: ['clothes', 'shoes', 'textile'],
    icon: Layers,
    body: 'Главный закон для продавцов одежды и обуви на WB. Делит одежду на 3 слоя (контакт с кожей). Нательное белье требует дорогостоящей обязательной сертификации, а верхняя одежда — декларирования. Продажа без маркировочных ярлыков запрещена.',
    keywords: ['легкая промышленность', 'три слоя', 'белье', 'ярлык', 'сертификация'],
    source: {
      label: 'ТР ТС 017 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'trts-021-food',
    title: 'Технический регламент ТР ТС 021/2011 — Безопасность пищевой продукции',
    categories: ['food', 'bads'],
    icon: Apple,
    body: 'Регулирует продажи бакалеи, сухофруктов, чая и кофе на маркетплейсах. Требует строгого соблюдения условий хранения, наличия деклараций соответствия и маркировки сроков годности на русском/белорусском языке.',
    keywords: ['бакалея', 'чай', 'кофе', 'сухофрукты', 'срок годности', 'условия хранения'],
    source: {
      label: 'ТР ТС 021 на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
  {
    id: 'uk-article-243-tax-evasion',
    title: 'Уголовный кодекс РБ (Статья 243 — Уклонение от уплаты налогов)',
    categories: ['general', 'clothes', 'shoes', 'cosmetics', 'food', 'bads', 'auto', 'electronics', 'npd', 'pvz'],
    icon: Gavel,
    body: 'Предупреждает о жесткой ответственности за умышленное сокрытие доходов в крупном и особо крупном размере при ведении интернет-торговли. Обязывает селлеров вести прозрачный учет всех финансовых транзакций маркетплейса в BYN.',
    keywords: ['Уголовный кодекс', 'уклонение от налогов', 'сокрытие доходов', 'штраф', 'прозрачный учет'],
    source: {
      label: 'Уголовный кодекс на Pravo.by — pravo.by',
      url: 'https://pravo.by',
    },
  },
];

export const FALLBACK_LAW_TITLE = 'Нужного закона нет в списке?';
export const FALLBACK_LAW_TEXT =
  'Введите ваш тип товара в наших калькуляторах слева, и система автоматически подберет под него ограничения Постановления № 713, ТН ВЭД и правила маркировки РБ!';

export const EMPTY_RESULT_TEXT =
  'Законов по вашему специфическому запросу не найдено, но вы можете проверить ограничения ТН ВЭД и Экосбора в наших калькуляторах в меню слева!';

const isLawTag = (value: string | undefined): value is LawTag =>
  !!value && LAW_TAGS.some((tag) => tag.id === value);

const tagButtonClass =
  'px-4 py-2 rounded-[20px] border text-sm font-medium transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#7b1fa2]/40 focus:ring-offset-2';

const activeTagClass = 'bg-[#7b1fa2] border-[#7b1fa2] text-white shadow-[0_6px_16px_rgba(123,31,162,0.25)]';

const idleTagClass =
  'bg-white border-[#7b1fa2] text-[#7b1fa2] hover:bg-[#7b1fa2] hover:text-white hover:shadow-[0_6px_16px_rgba(123,31,162,0.2)]';

const cardClass =
  'bg-white rounded-xl border border-neutral-200 shadow-sm p-5 sm:p-6 transition-shadow duration-200 hover:shadow-md';

/** Приводит текст к сравнимому виду: нижний регистр, «ё» → «е», схлопнутые пробелы */
const normalizeText = (value: string) =>
  value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

/** Полный текст карточки для живого поиска: заголовок, описание, примечание, источник, ключевые слова и метки ниш */
const buildSearchText = (card: LawCardData) =>
  normalizeText(
    [
      card.title,
      card.body,
      card.note ?? '',
      ...(card.keywords ?? []),
      card.source.label,
      ...card.categories.map((category) => CATEGORY_LABELS[category]),
    ].join(' ')
  );

/** Индекс слов карточки — используется для поиска по корню слова */
const LAW_SEARCH_TOKENS: Record<string, string[]> = Object.fromEntries(
  LAW_CARDS.map((card) => [card.id, buildSearchText(card).split(' ').filter(Boolean)])
);

/** Короче 3 символов подстрока не ищется — иначе запрос вроде «о» или «в» ловил бы всё подряд */
const MIN_SUBSTRING_LENGTH = 3;

/** Длина среза слова: «валюта» находит «валютной», «реклама» — «рекламного», «возврат» — «возврате» */
const STEM_LENGTH = 5;

const stemOf = (word: string) => word.slice(0, STEM_LENGTH);

/** Совпадение по морфологии без словаря: подстрока либо совпадение начала слова */
const wordMatchesToken = (word: string, token: string) => {
  if (word.length >= MIN_SUBSTRING_LENGTH && token.includes(word)) return true;
  return (
    word.length >= STEM_LENGTH && token.length >= STEM_LENGTH && stemOf(word) === stemOf(token)
  );
};

/** Каждое слово запроса должно встречаться в тексте карточки (AND-поиск по словам) */
export function matchesLawQuery(card: LawCardData, query: string): boolean {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;

  const tokens = LAW_SEARCH_TOKENS[card.id] ?? buildSearchText(card).split(' ').filter(Boolean);
  return words.every((word) => tokens.some((token) => wordMatchesToken(word, token)));
}

/** Карточка видна только когда совпадают ОБА условия: выбранный тег И поисковый запрос */
export function isLawCardVisible(card: LawCardData, activeTag: LawTag, query: string): boolean {
  const matchesTag = activeTag === 'all' || card.categories.includes(activeTag as LawCategory);
  return matchesTag && matchesLawQuery(card, query);
}

export default function LegalNavigator({ feature }: { feature: Feature }) {
  const [activeTag, setActiveTag] = useState<LawTag>('all');
  const [query, setQuery] = useState('');
  const tagPanelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const panel = tagPanelRef.current;
    if (!panel) return;

    const handleTagClick = (event: MouseEvent) => {
      const origin = event.target instanceof Element ? event.target : null;
      const button = origin?.closest<HTMLElement>('[data-law-tag]') ?? null;
      if (!button || !panel.contains(button)) return;

      const tag = button.dataset.lawTag;
      if (isLawTag(tag)) setActiveTag(tag);
    };

    panel.addEventListener('click', handleTagClick);
    return () => panel.removeEventListener('click', handleTagClick);
  }, []);

  useEffect(() => {
    const input = searchRef.current;
    if (!input) return;

    const handleSearchInput = () => setQuery(input.value);

    input.addEventListener('input', handleSearchInput);
    return () => input.removeEventListener('input', handleSearchInput);
  }, []);

  const visibleCards = useMemo(
    () => LAW_CARDS.filter((card) => isLawCardVisible(card, activeTag, query)),
    [activeTag, query]
  );

  const activeTagLabel = LAW_TAGS.find((tag) => tag.id === activeTag)?.label ?? 'Показать всё';
  const trimmedQuery = query.trim();

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#7b1fa2]/10 flex-shrink-0">
            <Scale className="w-5 h-5 text-[#7b1fa2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900">
              Законы РБ, которые касаются селлера и франчайзи
            </h3>
            <p className="text-sm text-neutral-500">
              Выберите свою нишу — карточки ниже покажут только применимые к вам нормы. Все суммы и расчёты
              проекта ведутся в белорусских рублях (BYN).
            </p>
          </div>
        </div>

        <div
          ref={tagPanelRef}
          className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 sm:p-5"
          role="group"
          aria-label="Фильтр законов по нише"
        >
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {LAW_TAGS.map((tag) => {
              const isActive = activeTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  data-law-tag={tag.id}
                  aria-pressed={isActive}
                  className={cn(tagButtonClass, isActive ? activeTagClass : idleTagClass)}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          <div className="relative mt-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="legal-search"
              ref={searchRef}
              type="text"
              value={query}
              placeholder="Поиск по ключевым словам (например: штраф, налог, УСН)..."
              aria-label="Поиск по законам"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
          </div>

          <p className="mt-3 text-xs text-neutral-500" aria-live="polite">
            Активный фильтр: <span className="font-medium text-neutral-700">{activeTagLabel}</span>
            {trimmedQuery && (
              <>
                {' '}
                + поиск «<span className="font-medium text-neutral-700">{trimmedQuery}</span>»
              </>
            )}{' '}
            — показано {visibleCards.length} из {LAW_CARDS.length} законов
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {LAW_CARDS.map((card) => {
            const isVisible = isLawCardVisible(card, activeTag, query);
            const Icon = card.icon;

            return (
              <article
                key={card.id}
                data-law-card={card.id}
                data-categories={card.categories.join(' ')}
                style={{ display: isVisible ? 'block' : 'none' }}
                className={cn(cardClass, 'animate-fade-in')}
                aria-hidden={!isVisible}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-[#7b1fa2]/10 flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#7b1fa2]" aria-hidden="true" />
                  </div>
                  <h4 className="text-base font-semibold text-neutral-900 leading-snug">{card.title}</h4>
                </div>

                <p className="text-sm text-neutral-600 leading-relaxed">{card.body}</p>

                {card.note && (
                  <p className="mt-4 pt-3 border-t border-neutral-200 text-xs text-[#7b1fa2] font-medium">
                    {card.note}
                  </p>
                )}

                <a
                  href={card.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-law-source={card.id}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#7b1fa2] hover:text-[#4a148c] hover:underline underline-offset-2 transition-colors break-words"
                >
                  {card.source.label}
                  <ArrowUpRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                </a>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.categories.map((category) => (
                    <span
                      key={category}
                      data-category-badge={category}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#7b1fa2]/10 text-[#7b1fa2]"
                    >
                      {CATEGORY_LABELS[category]}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}

{visibleCards.length === 0 && (
            <div className="md:col-span-2 rounded-xl border border-dashed border-[#7b1fa2]/40 bg-white px-5 py-6 text-center animate-fade-in">
              <p className="text-sm font-medium text-neutral-900">{EMPTY_RESULT_TEXT}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Снимите фильтр-тег, попробуйте другое ключевое слово или воспользуйтесь универсальной карточкой
                ниже — она доступна при любом фильтре.
              </p>
            </div>
          )}

          <article
            data-law-card="fallback"
            data-always-visible="true"
            style={{ display: 'block' }}
            className={cn(cardClass, 'md:col-span-2 border-[#7b1fa2]/40 bg-[#7b1fa2]/5 animate-fade-in')}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#7b1fa2]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-neutral-900 leading-snug">{FALLBACK_LAW_TITLE}</h4>
                <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{FALLBACK_LAW_TEXT}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-neutral-200">
                    <Store className="w-3.5 h-3.5 text-[#7b1fa2]" aria-hidden="true" />
                    Постановление № 713
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-neutral-200">
                    <Landmark className="w-3.5 h-3.5 text-[#7b1fa2]" aria-hidden="true" />
                    ТН ВЭД
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-neutral-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#7b1fa2]" aria-hidden="true" />
                    Маркировка РБ
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </SectionContentWrapper>
  );
}