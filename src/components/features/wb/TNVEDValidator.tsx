'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode as BarcodeIcon,
  ChevronDown,
  Info,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export interface TnvedEntry {
  name: string;
  tnved: string;
  marking: string;
  trts: string;
  p713: string;
  group: string;
  /** Признак позиции, собранной эвристикой по префиксу кода. */
  inferred?: boolean;
}

/**
 * Ультимативный справочник товарных секторов маркетплейса: код ТН ВЭД,
 * маркировка «Электронный знак» (РБ), форма подтверждения соответствия ЕАЭС
 * и регулирование цен (Постановление № 713). Секторы идут в порядке вывода
 * в выпадающем списке (optgroup).
 */
export const TNVED_DATABASE: TnvedEntry[] = [
  // ОДЕЖДА И ТЕКСТИЛЬ (ВЗРОСЛЫЙ АССОРТИМЕНТ)
  { name: "Пальто, куртки, ветровки, плащи мужские и женские", tnved: "6201400000", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Одежда и текстиль для взрослых" },
  { name: "Костюмы, комплекты, жакеты, платья, юбки, брюки", tnved: "6204430000", marking: "Нет", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Одежда и текстиль для взрослых" },
  { name: "Блузки, рубашки, батники женские/мужские трикотажные", tnved: "6106100000", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 35%)", group: "Одежда и текстиль для взрослых" },
  { name: "Свитеры, джемперы, пуловеры, кардиганы трикотажные", tnved: "6110209100", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 35%)", group: "Одежда и текстиль для взрослых" },
  { name: "Белье нательное, пижамы, халаты, ночные сорочки (1 слой)", tnved: "6107110000", marking: "Нет", trts: "ТР ТС 017/2011 (СЕРТИФИКАТ!)", p713: "Нет", group: "Одежда и текстиль для взрослых" },
  { name: "Колготки, чулки, носки, гольфы трикотажные", tnved: "6115950000", marking: "Нет", trts: "ТР ТС 017/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 25%)", group: "Одежда и текстиль для взрослых" },
  { name: "Обувь с верхом из натуральной или комбинированной кожи", tnved: "6403999300", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 35%)", group: "Одежда и текстиль для взрослых" },
  { name: "Обувь из резины или полимеров (сланцы, сапоги)", tnved: "6401921000", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 35%)", group: "Одежда и текстиль для взрослых" },
  { name: "Постельное белье (простыни, пододеяльники, наволочки)", tnved: "6302210000", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Одежда и текстиль для взрослых" },
  { name: "Полотенца кухонные, махровые и кухонный текстиль", tnved: "6302600000", marking: "Да", trts: "ТР ТС 017/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Одежда и текстиль для взрослых" },

  // ДЕТСКИЙ АССОРТИМЕНТ (Максимальный контроль)
  { name: "Одежда верхняя и трикотажная для детей и подростков", tnved: "6111209000", marking: "Да", trts: "ТР ТС 007/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 30%)", group: "Детские товары" },
  { name: "Белье нательное и одежда первого слоя для новорожденных", tnved: "6111201000", marking: "Нет", trts: "ТР ТС 007/2011 (СГР Минздрава + Серт)", p713: "Да (макс. 30%)", group: "Детские товары" },
  { name: "Обувь детская (кроме спортивной и домашней)", tnved: "6403919600", marking: "Да", trts: "ТР ТС 007/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 35%)", group: "Детские товары" },
  { name: "Игрушки детские из пластмасс, резины, мягконабивные", tnved: "9503007000", marking: "Нет", trts: "ТР ТС 008/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 30%)", group: "Детские товары" },
  { name: "Детские настольные игры, пазлы, головоломки", tnved: "9503009500", marking: "Нет", trts: "ТР ТС 008/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 30%)", group: "Детские товары" },
  { name: "Подгузники, детские трусики, пеленки одноразовые", tnved: "9619008100", marking: "Нет", trts: "ТР ТС 007/2011 (СГР Минздрава)", p713: "Да (макс. 30%)", group: "Детские товары" },
  { name: "Коляски детские и автокресла безопасности", tnved: "8715001000", marking: "Нет", trts: "ТР ТС 007/2011 (СЕРТИФИКАТ!)", p713: "Да (макс. 25%)", group: "Детские товары" },

  // КРАСОТА, ЗДОРОВЬЕ И ГИГИЕНА
  { name: "Духи, парфюмерная и туалетная вода", tnved: "3303001000", marking: "Да", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 40%)", group: "Косметика и парфюмерия" },
  { name: "Кремы, эмульсии, маски для ухода за кожей лица и тела", tnved: "3304990000", marking: "Нет", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 35%)", group: "Косметика и парфюмерия" },
  { name: "Декоративная косметика (тушь, помада, тени, пудра)", tnved: "3304100000", marking: "Нет", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 40%)", group: "Косметика и парфюмерия" },
  { name: "Шампуни, бальзамы, лаки и средства для волос", tnved: "3305100000", marking: "Нет", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Косметика и парфюмерия" },
  { name: "Зубные пасты, ополаскиватели, гели для зубов", tnved: "3306100000", marking: "Нет", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 30%)", group: "Косметика и парфюмерия" },
  { name: "Мыло туалетное твердое и жидкое", tnved: "3401110000", marking: "Нет", trts: "ТР ТС 009/2011 (Декларация)", p713: "Да (макс. 25%)", group: "Косметика и парфюмерия" },
  { name: "Биологически активные добавки к пище (БАДы)", tnved: "2106909809", marking: "Нет", trts: "Нац. СГР Минздрава РБ", p713: "Да (макс. 40%)", group: "Косметика и парфюмерия" },

  // ЭЛЕКТРОНИКА И БЫТОВАЯ ТЕХНИКА
  { name: "Смартфоны, мобильные телефоны, планшеты", tnved: "8517130000", marking: "Нет", trts: "ТР ТС 004/2011, 020/2011 (Декларация)", p713: "Нет", group: "Электроника и бытовая техника" },
  { name: "Умные часы, фитнес-браслеты, трекеры", tnved: "8517620003", marking: "Нет", trts: "ТР ТС 020/2011 (Декларация)", p713: "Нет", group: "Электроника и бытовая техника" },
  { name: "Наушники беспроводные и проводные, гарнитуры", tnved: "8518300009", marking: "Нет", trts: "ТР ТС 020/2011 (Декларация)", p713: "Нет", group: "Электроника и бытовая техника" },
  { name: "Электрочайники, кофеварки, тостеры, блендеры", tnved: "8516797000", marking: "Нет", trts: "ТР ТС 004, 020 (СЕРТИФИКАТ!)", p713: "Нет", group: "Электроника и бытовая техника" },
  { name: "Фены, щипцы, плойки, выпрямители для волос электрические", tnved: "8516310000", marking: "Нет", trts: "ТР ТС 004, 020 (СЕРТИФИКАТ!)", p713: "Нет", group: "Электроника и бытовая техника" },
  { name: "Портативные аккумуляторы (Power Bank), кабели, зарядки", tnved: "8504403009", marking: "Нет", trts: "ТР ТС 004/2011 (Декларация)", p713: "Нет", group: "Электроника и бытовая техника" },

  // ДОМ, КУХНЯ И ХОЗТОВАРЫ
  { name: "Мебель деревянная корпусная (столы, шкафы, комоды)", tnved: "9403601000", marking: "Нет", trts: "ТР ТС 025/2012 (Декларация)", p713: "Нет", group: "Дом, кухня и ремонт" },
  { name: "Посуда столовая и кухонная из фарфора или фаянса", tnved: "6911100000", marking: "Нет", trts: "ГОСТ / Нац. Декларация РБ", p713: "Да (макс. 30%)", group: "Дом, кухня и ремонт" },
  { name: "Сковороды, кастрюли, сотейники из алюминия/чугуна", tnved: "7615101000", marking: "Нет", trts: "ГОСТ / Нац. Декларация РБ", p713: "Да (макс. 30%)", group: "Дом, кухня и ремонт" },
  { name: "Порошки, гели, капсулы для стирки белья", tnved: "3402500000", marking: "Нет", trts: "Нац. СГР (Минздрав РБ)", p713: "Да (макс. 25%)", group: "Дом, кухня и ремонт" },
  { name: "Средства для мытья посуды и чистки поверхностей", tnved: "3402500000", marking: "Нет", trts: "Нац. СГР (Минздрав РБ)", p713: "Да (макс. 25%)", group: "Дом, кухня и ремонт" },
  { name: "Светильники светодиодные, люстры, лампы настольные", tnved: "9405110011", marking: "Нет", trts: "ТР ТС 004, 020 (СЕРТИФИКАТ!)", p713: "Нет", group: "Дом, кухня и ремонт" },
  { name: "Инструменты ручные (молотки, отвертки, плоскогубцы)", tnved: "8205200000", marking: "Нет", trts: "Отказное письмо", p713: "Нет", group: "Дом, кухня и ремонт" },

  // СВОБОДНЫЕ ОТ СЕРТИФИКАЦИИ / ОТКАЗНЫЕ ПИСЬМА
  { name: "Зеркала интерьерные стеклянные без встроенной подсветки", tnved: "7009920000", marking: "Нет", trts: "Отказное письмо", p713: "Нет", group: "Отказные письма (Бижутерия и Декор)" },
  { name: "Свечи парафиновые, стеариновые, восковые декоративные", tnved: "3406000000", marking: "Нет", trts: "Отказное письмо", p713: "Нет", group: "Отказные письма (Бижутерия и Декор)" },
  { name: "Бижутерия (серьги, кольца, заколки из базовых металлов)", tnved: "7117190000", marking: "Нет", trts: "Отказное письмо", p713: "Нет", group: "Отказные письма (Бижутерия и Декор)" },
  { name: "Сумки, рюкзаки, городские кошельки (из искусств. кожи)", tnved: "4202921900", marking: "Нет", trts: "Отказное письмо", p713: "Да (макс. 21%)", group: "Отказные письма (Бижутерия и Декор)" },
  { name: "Канцелярия для взрослых (ежедневники, ручки, блокноты)", tnved: "4820103000", marking: "Нет", trts: "Отказное письмо", p713: "Да (макс. 15%)", group: "Отказные письма (Бижутерия и Декор)" },
  { name: "Чехлы, бамперы, защитные стекла для мобильных телефонов", tnved: "4202321000", marking: "Нет", trts: "Отказное письмо", p713: "Да (макс. 15%)", group: "Отказные письма (Бижутерия и Декор)" },
];

/** Секторы маркетплейса в порядке отображения — источник для <optgroup>. */
export const TNVED_SECTORS: string[] = Array.from(new Set(TNVED_DATABASE.map((e) => e.group)));

/** Позиции сектора — для рендера <optgroup> внутри <select>. */
export function getSectorEntries(sector: string): TnvedEntry[] {
  return TNVED_DATABASE.filter((e) => e.group === sector);
}

/** Уникальный ключ позиции: код ТН ВЭД не уникален внутри справочника. */
export function entryKey(entry: TnvedEntry, index: number): string {
  return `${entry.tnved}-${entry.name}-${index}`;
}

/** Сравнение позиций по коду и названию: один код ТН ВЭД встречается дважды. */
function isSameEntry(a: TnvedEntry | null, b: TnvedEntry): boolean {
  return !!a && a.tnved === b.tnved && a.name === b.name;
}

const PLACEHOLDER = 'Например: Куртка, Обувь, Блузка, 6201...';

/** Префиксы разделов ТН ВЭД, по которым статус восстанавливается без справочника. */
const APPAREL_PREFIXES = ['61', '62', '63', '64'];
const TECH_PREFIXES = ['85'];
const BEAUTY_PREFIXES = ['33', '34'];
const TOYS_PREFIXES = ['95'];

export const MANUAL_VERIFICATION =
  'Кастомный код. Требуется сверка с национальными перечнями ТР ТС и Постановления № 713';

export function findExactByCode(code: string): TnvedEntry | undefined {
  const digits = code.replace(/\D/g, '');
  if (!digits) return undefined;
  return TNVED_DATABASE.find((e) => e.tnved === digits);
}

/**
 * Режим неуязвимости: если кода нет в базе, разбираем первые 2-4 цифры раздела.
 * Никогда не бросает и всегда возвращает детерминированный статус.
 */
export function inferByPrefix(code: string): TnvedEntry {
  const digits = code.replace(/\D/g, '');
  const prefix = digits.slice(0, 2);
  const displayCode = digits.padEnd(10, '0');

  if (APPAREL_PREFIXES.includes(prefix)) {
    return {
      name: `Код ${displayCode} — позиция вне справочника (раздел ${prefix}XX, одежда/обувь)`,
      tnved: displayCode,
      marking: 'Проверить (Одежда/Обувь)',
      trts: 'ТР ТС 017/2011 или 007/2011',
      p713: 'Возможно Да',
      group: 'Эвристика по префиксу',
      inferred: true,
    };
  }

  if (TECH_PREFIXES.includes(prefix)) {
    return {
      name: `Код ${displayCode} — позиция вне справочника (раздел 85XX, электротехника)`,
      tnved: displayCode,
      marking: 'Нет',
      trts: 'ТР ТС 004/2011 (Электротехника)',
      p713: 'Нет',
      group: 'Эвристика по префиксу',
      inferred: true,
    };
  }

  if (BEAUTY_PREFIXES.includes(prefix)) {
    return {
      name: `Код ${displayCode} — позиция вне справочника (раздел ${prefix}XX, парфюмерия/химия)`,
      tnved: displayCode,
      marking: 'Проверить (Парфюм)',
      trts: 'ТР ТС 009/2011 или СГР',
      p713: 'Да',
      group: 'Эвристика по префиксу',
      inferred: true,
    };
  }

  if (TOYS_PREFIXES.includes(prefix)) {
    return {
      name: `Код ${displayCode} — позиция вне справочника (раздел 95XX, детские игрушки)`,
      tnved: displayCode,
      marking: 'Нет',
      trts: 'ТР ТС 008/2011 (Детские игрушки)',
      p713: 'Да',
      group: 'Эвристика по префиксу',
      inferred: true,
    };
  }

  return {
    name: `Код ${displayCode} — кастомный код`,
    tnved: displayCode,
    marking: MANUAL_VERIFICATION,
    trts: MANUAL_VERIFICATION,
    p713: MANUAL_VERIFICATION,
    group: 'Ручная сверка',
    inferred: true,
  };
}

function scoreMatch(entry: TnvedEntry, query: string): number {
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const code = entry.tnved;
  let score = 0;
  if (name.startsWith(q)) score += 100;
  if (name.includes(q)) score += 50;
  if (code.startsWith(query)) score += 80;
  else if (code.includes(query)) score += 30;
  if (entry.group.toLowerCase().includes(q)) score += 10;
  return score;
}

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const target = q.toLowerCase();
  const index = lower.indexOf(target);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-[var(--primary)]/15 text-[var(--primary)] rounded px-0.5 font-semibold">
        {text.slice(index, index + target.length)}
      </mark>
      {text.slice(index + target.length)}
    </>
  );
}

type Tone = 'neutral' | 'purple' | 'red' | 'amber' | 'green' | 'orange';

const TONE_CARD: Record<Tone, string> = {
  neutral: 'bg-neutral-50 border-neutral-200',
  purple: 'bg-purple-50 border-purple-300',
  red: 'bg-red-50 border-red-300',
  amber: 'bg-amber-50 border-amber-300',
  green: 'bg-green-50 border-green-300',
  orange: 'bg-orange-50 border-orange-300',
};

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  orange: 'bg-orange-100 text-orange-700',
};

const TONE_LABEL: Record<Tone, string> = {
  neutral: 'text-neutral-500',
  purple: 'text-purple-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
  green: 'text-green-700',
  orange: 'text-orange-700',
};

const TONE_VALUE: Record<Tone, string> = {
  neutral: 'text-neutral-900',
  purple: 'text-purple-900',
  red: 'text-red-900',
  amber: 'text-amber-900',
  green: 'text-green-900',
  orange: 'text-orange-900',
};

function certTone(trts: string): Tone {
  const value = trts.toLowerCase();
  if (value.includes('отказное')) return 'green';
  if (value.includes('сертификат')) return 'red';
  if (value.includes('декларация')) return 'amber';
  return 'neutral';
}

function markingTone(marking: string): Tone {
  const value = marking.toLowerCase();
  if (value.startsWith('да')) return 'purple';
  return 'neutral';
}

function p713Tone(p713: string): Tone {
  const value = p713.toLowerCase();
  if (value.startsWith('да')) return 'orange';
  return 'neutral';
}

interface StatusCardProps {
  label: string;
  value: string;
  tone: Tone;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  hint?: string;
}

function StatusCard({ label, value, tone, icon: Icon, hint }: StatusCardProps) {
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm transition-colors', TONE_CARD[tone])}>
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg flex-shrink-0', TONE_ICON[tone])}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={cn('text-sm', TONE_LABEL[tone])}>{label}</p>
          <p className={cn('text-lg font-semibold break-words', TONE_VALUE[tone])}>{value}</p>
          {hint && <p className={cn('text-xs mt-0.5', TONE_LABEL[tone])}>{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default function TNVEDValidator({ feature }: { feature: Feature }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TnvedEntry | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('Все группы');
  const [catalogueIndex, setCatalogueIndex] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const source =
      groupFilter === 'Все группы'
        ? TNVED_DATABASE
        : TNVED_DATABASE.filter((e) => e.group === groupFilter);
    if (!query.trim()) {
      return source.map((entry) => ({ entry, index: TNVED_DATABASE.indexOf(entry) }));
    }
    return source
      .map((entry) => ({ entry, index: TNVED_DATABASE.indexOf(entry), score: scoreMatch(entry, query.trim()) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, groupFilter]);

  const typedCode = /^\d+$/.test(query.trim()) && query.trim().length >= 2 ? query.trim() : null;
  const exactForTyped = typedCode ? findExactByCode(typedCode) : undefined;
  const fallbackEntry = typedCode && !exactForTyped ? inferByPrefix(typedCode) : null;
  const hasResults = matches.length > 0 || fallbackEntry !== null;

  const handleSelect = (entry: TnvedEntry) => {
    const index = TNVED_DATABASE.indexOf(entry);
    setSelected(entry);
    setQuery(entry.tnved);
    setCatalogueIndex(index >= 0 ? String(index) : '');
    setIsOpen(false);
  };

  const handleReset = () => {
    setQuery('');
    setSelected(null);
    setGroupFilter('Все группы');
    setCatalogueIndex('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (e.key === 'Enter' && typedCode) {
      e.preventDefault();
      handleSelect(exactForTyped ?? fallbackEntry!);
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Параметры поиска */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Параметры проверки</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Введите название товара или 10-значный код ТН ВЭД — ограничения ЕАЭС и законы РБ применятся автоматически.
            </p>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (exactForTyped) handleSelect(exactForTyped);
                else if (fallbackEntry) handleSelect(fallbackEntry);
                else if (matches[0]) handleSelect(matches[0].entry);
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label
                    htmlFor="tnved-search"
                    className="block text-sm font-medium text-neutral-700 mb-1"
                  >
                    Введите название товара или 10-значный код ТН ВЭД
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="tnved-search"
                      ref={inputRef}
                      type="text"
                      role="combobox"
                      aria-expanded={isOpen}
                      aria-controls="tnved-listbox"
                      aria-autocomplete="list"
                      autoComplete="off"
                      placeholder={PLACEHOLDER}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                      }}
                      onFocus={() => setIsOpen(true)}
                      onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
                      onKeyDown={handleKeyDown}
                      className="w-full pl-10 pr-10 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
                      aria-hidden="true"
                    />

                    {isOpen && hasResults && (
                      <ul
                        id="tnved-listbox"
                        role="listbox"
                        className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-lg divide-y divide-neutral-100"
                      >
                        {fallbackEntry && (
                          <li role="option" aria-selected={isSameEntry(selected, fallbackEntry)}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelect(fallbackEntry)}
                              className="w-full text-left px-3 py-2.5 hover:bg-[var(--primary)]/5"
                            >
                              <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden="true" />
                                {fallbackEntry.name}
                              </span>
                              <span className="block mt-0.5 pl-6 text-xs text-neutral-500">
                                Код {fallbackEntry.tnved} · {fallbackEntry.trts}
                              </span>
                            </button>
                          </li>
                        )}
                        {matches.map(({ entry, index }) => (
                          <li
                            key={entryKey(entry, index)}
                            role="option"
                            aria-selected={isSameEntry(selected, entry)}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelect(entry)}
                              className={cn(
                                'w-full text-left px-3 py-2.5 hover:bg-[var(--primary)]/5',
                                selected?.tnved === entry.tnved && 'bg-[var(--primary)]/10'
                              )}
                            >
                              <span className="block text-sm font-medium text-neutral-900">
                                {highlight(entry.name, query.trim())}
                              </span>
                              <span className="block mt-0.5 text-xs text-neutral-500">
                                <span className="font-mono">{highlight(entry.tnved, query.trim())}</span>
                                {' · '}
                                {entry.group}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="tnved-catalogue"
                    className="block text-sm font-medium text-neutral-700 mb-1"
                  >
                    Справочник ТН ВЭД по товарным секторам ({TNVED_DATABASE.length} позиций)
                  </label>
                  <select
                    id="tnved-catalogue"
                    value={catalogueIndex}
                    onChange={(e) => {
                      const entry = TNVED_DATABASE[Number(e.target.value)];
                      if (entry) handleSelect(entry);
                      else setCatalogueIndex('');
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  >
                    <option value="">— Выберите позицию из справочника —</option>
                    {TNVED_SECTORS.map((sector) => (
                      <optgroup key={sector} label={sector}>
                        {getSectorEntries(sector).map((entry) => (
                          <option
                            key={entryKey(entry, TNVED_DATABASE.indexOf(entry))}
                            value={String(TNVED_DATABASE.indexOf(entry))}
                          >
                            {entry.tnved} — {entry.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tnved-group" className="block text-sm font-medium text-neutral-700 mb-1">
                    Товарная группа
                  </label>
                  <select
                    id="tnved-group"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  >
                    <option value="Все группы">Все группы</option>
                    {TNVED_SECTORS.map((sector) => (
                      <option key={sector} value={sector}>
                        {sector}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Источник ограничений</label>
                  <div className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-600 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[var(--primary)] flex-shrink-0" aria-hidden="true" />
                    ТР ТС / ЕАЭС + законы РБ
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!hasResults}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
                    hasResults
                      ? 'bg-[var(--primary)] hover:bg-[var(--primary)]/90'
                      : 'bg-[var(--primary)]/50 cursor-not-allowed'
                  )}
                >
                  <BarcodeIcon className="w-4 h-4" aria-hidden="true" />
                  Проверить код
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  Сбросить
                </button>
              </div>
            </form>
          </div>

          {/* Список позиций */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-neutral-900">Справочник позиций</h3>
              <span className="text-xs text-neutral-500">
                {matches.length} из {TNVED_DATABASE.length}
              </span>
            </div>

            {hasResults ? (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1" role="list">
                {fallbackEntry && (
                  <li>
                    <button
                      type="button"
                      onClick={() => handleSelect(fallbackEntry)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border rounded-lg transition-colors',
                        isSameEntry(selected, fallbackEntry)
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden="true" />
                        Введённый код {fallbackEntry.tnved}
                      </span>
                      <span className="block mt-0.5 pl-6 text-xs text-neutral-500">
                        {fallbackEntry.name}
                      </span>
                    </button>
                  </li>
                )}
                {matches.map(({ entry, index }) => (
                  <li key={entryKey(entry, index)}>
                    <button
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border rounded-lg transition-colors',
                        isSameEntry(selected, entry)
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      )}
                    >
                      <span className="block text-sm font-medium text-neutral-900">
                        {highlight(entry.name, query.trim())}
                      </span>
                      <span className="block mt-0.5 text-xs text-neutral-500">
                        <span className="font-mono text-neutral-700">
                          {highlight(entry.tnved, query.trim())}
                        </span>
                        {' · '}
                        {entry.group}
                        {' · '}
                        {entry.trts}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center text-neutral-400">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p className="text-sm">Ничего не найдено. Уточните запрос или введите код ТН ВЭД.</p>
              </div>
            )}
          </div>
        </div>

        {/* Информационная панель результата */}
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">Выбранная позиция</p>
                  <h3 className="text-lg font-semibold text-neutral-900">{selected.name}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {selected.group}
                    {selected.inferred && ' · позиция восстановлена по префиксу кода'}
                  </p>
                </div>
                {selected.inferred && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                    <Info className="w-3.5 h-3.5" aria-hidden="true" />
                    Требуется проверка
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatusCard
                label="Подобранный код ТН ВЭД"
                value={selected.tnved}
                tone="neutral"
                icon={BarcodeIcon}
                hint="10 знаков, без пробелов"
              />
              <StatusCard
                label="Маркировка «Электронный знак» (РБ)"
                value={selected.marking}
                tone={markingTone(selected.marking)}
                icon={Tag}
                hint={selected.marking.toLowerCase().startsWith('да') ? 'Требуется DataMatrix и нанесение знака' : 'Маркировка не обязательна'}
              />
              <StatusCard
                label="Сертификация ЕАЭС"
                value={selected.trts}
                tone={certTone(selected.trts)}
                icon={ShieldCheck}
                hint={
                  certTone(selected.trts) === 'red'
                    ? 'Обязателен сертификат соответствия'
                    : certTone(selected.trts) === 'amber'
                      ? 'Достаточно декларации о соответствии'
                      : certTone(selected.trts) === 'green'
                        ? 'Сертификация не требуется'
                        : 'Сверьте с реестром Росаккредитации'
                }
              />
              <StatusCard
                label="Регулирование цен (Постановление № 713)"
                value={selected.p713}
                tone={p713Tone(selected.p713)}
                icon={Wallet}
                hint={
                  selected.p713.toLowerCase().startsWith('да')
                    ? 'Цена регулируется — нужен расчёт предельной цены'
                    : 'Цена не регулируется'
                }
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 text-center text-neutral-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>Выберите позицию из справочника, чтобы увидеть статус маркировки, сертификации и цен</p>
          </div>
        )}
      </div>
    </SectionContentWrapper>
  );
}
