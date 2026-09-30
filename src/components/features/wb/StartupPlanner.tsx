'use client';

import React, { useState } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  Building,
  FileText,
  CheckCircle,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import { BudgetDonut } from './StartupPlannerChart';
import type { Feature } from '@/types/section';
import { jsPDF } from 'jspdf';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from '@/lib/fonts';

type Origin = 'china' | 'russia' | 'belarus';
type DeliveryMethod = 'official' | 'cargo';
type BusinessForm = 'ip' | 'ooo' | 'self_employed';

export interface ProductCategoryMeta {
  id: string;
  name: string;
  certCost: number;
  hasMarking: boolean;
  logiCoeff: number;
  group: string;
}

export interface PlannerForm {
  category: string;
  batchVolume: string;
  purchasePrice: string;
  origin: Origin;
  deliveryMethod: DeliveryMethod;
  businessForm: BusinessForm;
}

export interface BudgetBreakdown {
  purchase: number;
  logistics: number;
  certification: number;
  marking: number;
  misc: number;
  total: number;
}

export interface ChecklistItem {
  label: string;
  text: string;
}

const DEFAULT_FORM: PlannerForm = {
  category: 'cloth_marked',
  batchVolume: '100',
  purchasePrice: '15',
  origin: 'belarus',
  deliveryMethod: 'official',
  businessForm: 'ip',
};

const STEPS = [
  { id: 1, key: 'product', label: 'Товар', icon: Package },
  { id: 2, key: 'logistics', label: 'Логистика', icon: Truck },
  { id: 3, key: 'registration', label: 'Оформление', icon: Building },
  { id: 4, key: 'result', label: 'Результат', icon: FileText },
] as const;

const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  // ОДЕЖДА, ОБУВЬ И ТЕКСТИЛЬ
  { id: 'cloth_marked', name: 'Одежда верхняя, куртки, трикотаж блузы (с маркировкой Электронный Знак)', certCost: 850, hasMarking: true, logiCoeff: 1.0, group: 'Одежда и текстиль' },
  { id: 'cloth_clear', name: 'Одежда легкая, платья, брюки (без обязательной маркировки)', certCost: 800, hasMarking: false, logiCoeff: 0.9, group: 'Одежда и текстиль' },
  { id: 'underwear', name: 'Белье нательное, корсетные изделия, пижамы (1-й слой)', certCost: 1200, hasMarking: false, logiCoeff: 0.6, group: 'Одежда и текстиль' },
  { id: 'shoes_all', name: 'Обувь любая (требует маркировки Электронный Знак)', certCost: 950, hasMarking: true, logiCoeff: 1.2, group: 'Одежда и текстиль' },
  { id: 'socks', name: 'Чулочно-носочные изделия', certCost: 650, hasMarking: false, logiCoeff: 0.5, group: 'Одежда и текстиль' },
  { id: 'home_textile', name: 'Постельное белье, полотенца, пледы', certCost: 850, hasMarking: false, logiCoeff: 1.2, group: 'Одежда и текстиль' },

  // ДЕТСКИЕ ТОВАРЫ
  { id: 'child_cloth', name: 'Детская одежда, трикотаж и белье (строгий контроль)', certCost: 1800, hasMarking: false, logiCoeff: 0.8, group: 'Детские товары' },
  { id: 'child_shoes', name: 'Детская обувь', certCost: 1900, hasMarking: true, logiCoeff: 1.0, group: 'Детские товары' },
  { id: 'child_toys', name: 'Игрушки (пластик, мягкие, настольные игры)', certCost: 1600, hasMarking: false, logiCoeff: 1.2, group: 'Детские товары' },
  { id: 'child_care', name: 'Товары для ухода за детьми, соски, бутылочки (требует СГР)', certCost: 2500, hasMarking: false, logiCoeff: 0.9, group: 'Детские товары' },

  // КРАСОТА, ЗДОРОВЬЕ И ГИГИЕНА
  { id: 'cosm_makeup', name: 'Декоративная косметика и парфюмерия', certCost: 900, hasMarking: false, logiCoeff: 0.6, group: 'Красота и здоровье' },
  { id: 'cosm_care', name: 'Кремы, маски, уходовая косметика для кожи и волос', certCost: 1100, hasMarking: false, logiCoeff: 0.8, group: 'Красота и здоровье' },
  { id: 'bads', name: 'БАДы и спортивное питание (сложное СГР в Минздраве)', certCost: 3500, hasMarking: false, logiCoeff: 0.6, group: 'Красота и здоровье' },
  { id: 'hygiene', name: 'Зубные пасты, дезодоранты, средства гигиены', certCost: 1200, hasMarking: false, logiCoeff: 0.7, group: 'Красота и здоровье' },
  { id: 'intime', name: 'Товары для взрослых (18+)', certCost: 1100, hasMarking: false, logiCoeff: 0.7, group: 'Красота и здоровье' },

  // ЭЛЕКТРОНИКА И БЫТОВАЯ ТЕХНИКА
  { id: 'appliances_large', name: 'Крупная бытовая техника', certCost: 1500, hasMarking: false, logiCoeff: 4.0, group: 'Электроника и техника' },
  { id: 'appliances_small', name: 'Малая бытовая техника, фены, чайники', certCost: 1100, hasMarking: false, logiCoeff: 1.6, group: 'Электроника и техника' },
  { id: 'gadgets', name: 'Смартфоны, смарт-часы, наушники', certCost: 1400, hasMarking: false, logiCoeff: 0.8, group: 'Электроника и техника' },
  { id: 'acc_electronics', name: 'Чехлы, кабели, повербанки, ремешки', certCost: 150, hasMarking: false, logiCoeff: 0.5, group: 'Электроника и техника' },

  // ДОМ, КУХНЯ И РЕМОНТ
  { id: 'furniture', name: 'Корпусная и мягкая мебель', certCost: 800, hasMarking: false, logiCoeff: 3.5, group: 'Дом, кухня и ремонт' },
  { id: 'kitchen', name: 'Посуда столовая, сковороды, кастрюли', certCost: 500, hasMarking: false, logiCoeff: 1.3, group: 'Дом, кухня и ремонт' },
  { id: 'decor', name: 'Интерьерный декор, свечи, зеркала', certCost: 150, hasMarking: false, logiCoeff: 1.1, group: 'Дом, кухня и ремонт' },
  { id: 'lighting', name: 'Люстры, светильники, светодиодные ленты', certCost: 1100, hasMarking: false, logiCoeff: 1.4, group: 'Дом, кухня и ремонт' },
  { id: 'tools', name: 'Строительные и ручные инструменты', certCost: 600, hasMarking: false, logiCoeff: 1.8, group: 'Дом, кухня и ремонт' },
  { id: 'household_chem', name: 'Бытовая химия, порошки, капсулы для стирки', certCost: 1700, hasMarking: false, logiCoeff: 1.4, group: 'Дом, кухня и ремонт' },

  // ДРУГИЕ КАТЕГОРИИ
  { id: 'auto', name: 'Автотовары, электроника для авто, масла', certCost: 900, hasMarking: false, logiCoeff: 1.5, group: 'Остальные категории' },
  { id: 'stationery', name: 'Канцелярия, тетради, ручки', certCost: 150, hasMarking: false, logiCoeff: 0.6, group: 'Остальные категории' },
  { id: 'hobby', name: 'Товары для хобби, картины по номерам, пряжа', certCost: 150, hasMarking: false, logiCoeff: 0.8, group: 'Остальные категории' },
  { id: 'sport', name: 'Спортивный инвентарь и тренажеры', certCost: 400, hasMarking: false, logiCoeff: 1.9, group: 'Остальные категории' },
  { id: 'pet_food', name: 'Корма для животных (требует ветеринарного контроля)', certCost: 1100, hasMarking: false, logiCoeff: 1.2, group: 'Остальные категории' },
  { id: 'pet_supplies', name: 'Игрушки, лежанки и одежду для животных', certCost: 150, hasMarking: false, logiCoeff: 1.1, group: 'Остальные категории' },
  { id: 'bags', name: 'Сумки, рюкзаки, кошелья', certCost: 150, hasMarking: false, logiCoeff: 0.9, group: 'Остальные категории' },
  { id: 'jewelry_costume', name: 'Бижутерия и аксессуары для волос', certCost: 150, hasMarking: false, logiCoeff: 0.4, group: 'Остальные категории' },
  { id: 'food_regular', name: 'Бакалея, орехи, сухофрукты, сладости', certCost: 700, hasMarking: false, logiCoeff: 1.0, group: 'Остальные категории' },
];

export function getCategoryMeta(id: string): ProductCategoryMeta {
  return PRODUCT_CATEGORIES.find((c) => c.id === id) ?? PRODUCT_CATEGORIES[0];
}

const CATEGORY_GROUPS: { label: string; options: ProductCategoryMeta[] }[] = [];
PRODUCT_CATEGORIES.forEach((cat) => {
  const group = CATEGORY_GROUPS.find((g) => g.label === cat.group);
  if (group) {
    group.options.push(cat);
  } else {
    CATEGORY_GROUPS.push({ label: cat.group, options: [cat] });
  }
});

const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: 'china', label: 'Китай' },
  { value: 'russia', label: 'Россия' },
  { value: 'belarus', label: 'Республика Беларусь' },
];

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: 'official', label: 'Официальная доставка с документами' },
  { value: 'cargo', label: 'Карго/Самовывоз' },
];

const BUSINESS_OPTIONS: { value: BusinessForm; label: string }[] = [
  { value: 'ip', label: 'ИП' },
  { value: 'ooo', label: 'Юрлицо (ООО)' },
  { value: 'self_employed', label: 'Самозанятый' },
];

const ORIGIN_LABELS: Record<Origin, string> = {
  china: 'Китай',
  russia: 'Россия',
  belarus: 'Республика Беларусь',
};

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  official: 'Официальная доставка с документами',
  cargo: 'Карго/Самовывоз',
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBudget(form: PlannerForm): BudgetBreakdown {
  const volume = parseFloat(form.batchVolume) || 0;
  const price = parseFloat(form.purchasePrice) || 0;
  const meta = getCategoryMeta(form.category);
  const isAbroad = form.origin === 'china' || form.origin === 'russia';

  const purchase = roundCurrency(volume * price);

  let certification = 0;
  if (isAbroad) {
    certification = roundCurrency(meta.certCost);
  }

  let marking = 0;
  if (meta.hasMarking) {
    marking = roundCurrency(volume * 0.15 + 50);
  }

  const misc = form.businessForm === 'self_employed' ? 0 : 150;

  const perItem =
    form.origin === 'china' ? 3 : form.origin === 'russia' ? 1.5 : 0.5;
  const logistics = roundCurrency(volume * perItem * meta.logiCoeff);

  const total = roundCurrency(purchase + logistics + certification + marking + misc);

  return { purchase, logistics, certification, marking, misc, total };
}

export function generateChecklist(form: PlannerForm, budget: BudgetBreakdown): ChecklistItem[] {
  const lines: ChecklistItem[] = [];
  const volume = parseFloat(form.batchVolume) || 0;
  const meta = getCategoryMeta(form.category);
  const isAbroad = form.origin === 'china' || form.origin === 'russia';
  const perItem = form.origin === 'china' ? 3 : form.origin === 'russia' ? 1.5 : 0.5;
  const effectivePerItem = perItem * meta.logiCoeff;

  if (form.businessForm === 'ip') {
    lines.push({
      label: 'Бизнес',
      text: `Открыть ИП на УСН 6% через Госуслуги или МФЦ. Подготовьте паспорт, ИНН и адрес регистрации (можно в Юридическом адресе).`,
    });
  } else if (form.businessForm === 'ooo') {
    lines.push({
      label: 'Бизнес',
      text: `Открыть ООО с одним учредителем-единоличником через МФЦ или нотариуса. Подготовьте устав, договор аренды офиса и ИНН.`,
    });
  } else {
    lines.push({
      label: 'Бизнес',
      text: `Зарегистрироваться как самозанятый в мобильном приложении «Мой налог» (подходит до 2,4 млн BYN дохода в год без НДС).`,
    });
  }

  lines.push({
    label: 'Документы',
    text: `Получить квалифицированную ЭЦП (электронную подпись) в ГосСУОК или аккредитованном удостоверяющем центре — понадобится для подписи договоров с WB и таможенных деклараций.`,
  });

  if (form.businessForm !== 'self_employed') {
    lines.push({
      label: 'Деньги',
      text: `Открыть расчётный счёт в банке и подключить кассовый аппарат или онлайн-кассу для приёма оплаты покупателей.`,
    });
  }

  lines.push({
    label: 'Закупка',
    text: `Заключить договор с поставщиком товара «${meta.name}» из ${ORIGIN_LABELS[form.origin]} (способ — ${DELIVERY_LABELS[form.deliveryMethod]}). Объём первой партии — ${volume.toLocaleString('ru-RU')} шт. по ${parseFloat(form.purchasePrice).toLocaleString('ru-RU')} BYN за шт.`,
  });

  if (isAbroad) {
    lines.push({
      label: 'Сертификация',
      text: `Оформить сертификат соответствия или декларацию о соответствии на товар «${meta.name}» (импорт из ${ORIGIN_LABELS[form.origin]}). Бюджет сертификата — ~${meta.certCost.toLocaleString('ru-RU')} BYN.`,
    });
  } else {
    lines.push({
      label: 'Сертификация',
      text: `Подтвердить соответствие товара для товаров из Республики Беларусь — в рамках официальной доставки с документами сертификат не требуется (0 BYN).`,
    });
  }

  if (meta.hasMarking) {
    lines.push({
      label: 'Маркировка',
      text: `Подключить «Электронный знак» — система маркировки для WB. Заказать коды маркировки (0.15 BYN за шт.) и оплатить настройку системы (~50 BYN).`,
    });
  }

  lines.push({
    label: 'Логистика',
    text: `Доставить партию на склад WB (${DELIVERY_LABELS[form.deliveryMethod]}). Логистика до склада — ${budget.logistics.toLocaleString('ru-RU')} BYN (${effectivePerItem.toFixed(2)} BYN/шт × ${volume.toLocaleString('ru-RU')} шт.).`,
  });

  lines.push({
    label: 'WB',
    text: `Создать карточки товаров на площадке WB, загрузить фото и описание, отправить на модерацию.`,
  });

  lines.push({
    label: 'Капитал',
    text: `Подготовить стартовый капитал — ${budget.total.toLocaleString('ru-RU')} BYN (Закупка: ${budget.purchase.toLocaleString('ru-RU')} BYN, Логистика: ${budget.logistics.toLocaleString('ru-RU')} BYN, Сертификация: ${budget.certification.toLocaleString('ru-RU')} BYN, Маркировка: ${budget.marking.toLocaleString('ru-RU')} BYN, Прочие: ${budget.misc.toLocaleString('ru-RU')} BYN).`,
  });

  return lines;
}

const BUDGET_LABELS: { key: keyof BudgetBreakdown; label: string; color: string }[] = [
  { key: 'purchase', label: 'Закупка', color: '#3b82f6' },
  { key: 'logistics', label: 'Логистика', color: '#f59e0b' },
  { key: 'certification', label: 'Сертификация', color: '#8b5cf6' },
  { key: 'marking', label: 'Маркировка', color: '#10b981' },
  { key: 'misc', label: 'Прочие', color: '#ef4444' },
];

function registerPdfFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  return doc;
}

export default function StartupPlanner({ feature }: { feature: Feature }) {
  const [form, setForm] = useState<PlannerForm>(DEFAULT_FORM);
  const [currentStep, setCurrentStep] = useState(1);
  const [budget, setBudget] = useState<BudgetBreakdown | null>(null);

  const updateField = (field: keyof PlannerForm, value: string | Origin | DeliveryMethod | BusinessForm) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    const result = calculateBudget(form);
    setBudget(result);
    setCurrentStep(4);
  };

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
    else handleCalculate();
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setBudget(null);
    setCurrentStep(1);
  };

  const handleDownloadPdf = () => {
    if (!budget) return;
    const checklist = generateChecklist(form, budget);
    const doc = registerPdfFont(new jsPDF({ unit: 'mm', format: 'a4' }));
    const pageWidth = 210;
    let cursorY = 20;

    doc.setDrawColor(126, 27, 177);
    doc.setLineWidth(2);
    doc.line(20, cursorY, pageWidth - 20, cursorY);
    cursorY += 8;

    doc.setFontSize(22);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(126, 27, 177);
    doc.text('Планировщик старта: Выход на WB из РБ', pageWidth / 2, cursorY, {
      align: 'center',
    });
    cursorY += 12;

    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    doc.setFont('Roboto', 'normal');
    doc.text(
      `Смета стартового капитала и пошаговый чек-лист (${new Date().toLocaleDateString('ru-RU')})`,
      pageWidth / 2,
      cursorY,
      { align: 'center' }
    );
    cursorY += 12;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, cursorY, pageWidth - 20, cursorY);
    cursorY += 10;

    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.setFont('Roboto', 'bold');
    doc.text('СМЕТА СТАРТОВОГО КАПИТАЛА', 20, cursorY);
    cursorY += 8;

    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.setFont('Roboto', 'normal');
    doc.text('категория | сумма (BYN)', 20, cursorY);
    cursorY += 6;

    const rows: [string, number][] = [
      ['Закупка', budget.purchase],
      ['Логистика', budget.logistics],
      ['Сертификация', budget.certification],
      ['Маркировка', budget.marking],
      ['Прочие (ЭЦП, счёт, касса)', budget.misc],
    ];

    rows.forEach(([label, value]) => {
      const valStr = value.toLocaleString('ru-RU');
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(label, 20, cursorY);
      doc.setFont('Roboto', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(valStr, pageWidth - 20, cursorY, { align: 'right' });
      cursorY += 7;
    });

    doc.setFont('Roboto', 'normal');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, cursorY - 1, pageWidth - 20, cursorY - 1);
    cursorY += 2;

    doc.setFontSize(14);
    doc.setTextColor(126, 27, 177);
    doc.setFont('Roboto', 'bold');
    doc.text(
      `ИТОГО неоходимый стартовый капитал: ${budget.total.toLocaleString('ru-RU')} BYN`,
      pageWidth / 2,
      cursorY,
      { align: 'center' }
    );
    cursorY += 12;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, cursorY, pageWidth - 20, cursorY);
    cursorY += 10;

    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.setFont('Roboto', 'bold');
    doc.text('ПОШАГОВЫЙ ЧЕК-ЛИСТ', 20, cursorY);
    cursorY += 10;

    checklist.forEach((item, idx) => {
      if (cursorY > 250) {
        doc.addPage();
        cursorY = 20;
      }
      doc.setFontSize(11);
      doc.setTextColor(126, 27, 177);
      doc.setFont('Roboto', 'bold');
      doc.text(`${idx + 1}. [${item.label}]`, 20, cursorY);
      cursorY += 6;

      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      doc.setFont('Roboto', 'normal');
      const split = doc.splitTextToSize(item.text, pageWidth - 50);
      doc.text(split, 24, cursorY);
      cursorY += split.length * 5 + 3;
    });

    if (cursorY > 270) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('Roboto', 'normal');
    doc.text('Сгенерировано в Knysh.com — Планировщик старта WB', pageWidth / 2, cursorY + 10, {
      align: 'center',
    });

    doc.save('knysh-wb-startup-planner.pdf');
  };

  return (
    <SectionContentWrapper feature={feature}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Stepper Top Panel */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const IconComponent = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              let statusColor = 'text-neutral-400';
              let bgColor = 'bg-neutral-100';
              let ringColor = '';
              if (isActive) {
                statusColor = 'text-white';
                bgColor = 'bg-[var(--primary)]';
              } else if (isCompleted) {
                statusColor = 'text-white';
                bgColor = 'bg-[var(--primary)]';
              }
              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 transition-all',
                      step.id < 4 ? 'flex-1' : 'flex-1',
                    )}
                    aria-label={`Шаг ${step.id}: ${step.label}`}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                        isActive || isCompleted
                          ? 'border-[var(--primary)]'
                          : 'border-neutral-300',
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle
                          className={cn('w-5 h-5', statusColor)}
                          aria-hidden="true"
                        />
                      ) : (
                        <IconComponent
                          className={cn('w-5 h-5', statusColor)}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isActive || isCompleted
                          ? 'text-[var(--primary)]'
                          : 'text-neutral-500'
                      )}
                    >
                      {step.id}. {step.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 flex items-center">
                      <ChevronRight
                        className={cn(
                          'w-5 h-5 mx-auto transition-colors',
                          currentStep > step.id ? 'text-[var(--primary)]' : 'text-neutral-300'
                        )}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step 1: Товар */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Товар</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Категория товара
                </label>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  {CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Планируемый объем первой партии, шт.
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.batchVolume}
                  onChange={(e) => updateField('batchVolume', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Планируемая цена закупки за 1 шт, BYN
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(e) => updateField('purchasePrice', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
                    BYN
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Логистика */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Логистика и сертификация</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Где закупается товар?
                </label>
                <select
                  value={form.origin}
                  onChange={(e) => updateField('origin', e.target.value as Origin)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  {ORIGIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Способ доставки
                </label>
                <select
                  value={form.deliveryMethod}
                  onChange={(e) =>
                    updateField('deliveryMethod', e.target.value as DeliveryMethod)
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  {DELIVERY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Оформление */}
        {currentStep === 3 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Оформление бизнеса</h3>
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Выберите форму бизнеса, чтобы рассчитать накладные расходы (ЭЦП, открытие счёта, касса).
              </p>
              <div className="space-y-3">
                {BUSINESS_OPTIONS.map((opt) => {
                  const selected = form.businessForm === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                        selected
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-neutral-300 hover:border-neutral-400'
                      )}
                    >
                      <input
                        type="radio"
                        name="businessForm"
                        value={opt.value}
                        checked={selected}
                        onChange={() => updateField('businessForm', opt.value)}
                        className="w-4 h-4 accent-[var(--primary)] focus:ring-[var(--primary)]"
                        aria-label={opt.label}
                      />
                      <span className="text-sm font-medium text-neutral-900">
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Результат */}
        {currentStep === 4 && budget && (
          <div className="space-y-6">
            {/* Donut chart */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Смета расходов</h3>
              <BudgetDonut budget={budget} />
            </div>

            {/* Structured budget table */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Подробная смета по категориям
              </h3>
              <div className="space-y-2">
                {BUDGET_LABELS.map((item) => {
                  const value = budget[item.key];
                  const pct =
                    budget.total > 0
                      ? ((value / budget.total) * 100).toFixed(1)
                      : '0';
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-neutral-700">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-500 w-12 text-right">
                            {pct}%
                          </span>
                          <span className="text-sm font-semibold text-neutral-900 w-32 text-right">
                            {value.toLocaleString('ru-RU')} BYN
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-neutral-200 mt-4 pt-4 flex items-center justify-between">
                <span className="text-base font-semibold text-neutral-900">
                  Итого необходимый стартовый капитал:
                </span>
                <span className="text-2xl font-bold text-[var(--primary)]">
                  {budget.total.toLocaleString('ru-RU')} BYN
                </span>
              </div>
            </div>

            {/* Generated checklist */}
            <ChecklistSection form={form} budget={budget} />

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className={cn(
                  'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-colors',
                  'bg-[#7b1fa2] hover:bg-[#6a1b91] focus:ring-2 focus:ring-[#7b1fa2] focus:ring-offset-2'
                )}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Скачать чек-лист и смету в PDF
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Начать заново
              </button>
            </div>
          </div>
        )}

        {/* Navigation buttons (steps 1-3) */}
        {currentStep < 4 && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium border border-neutral-300 text-neutral-700 transition-colors',
                currentStep === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-neutral-50'
              )}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Назад
            </button>
            <button
              type="button"
              onClick={handleNext}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors',
                'bg-[var(--primary)] hover:bg-[var(--primary)]/90 focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
                'disabled:opacity-50'
              )}
            >
              {currentStep === 3 ? 'Посчитать' : 'Далее'}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Empty state for step 4 before calculation */}
        {currentStep === 4 && !budget && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center text-neutral-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>Настройте параметры во вкладках «Товар», «Логистика» и «Оформление», затем нажмите «Посчитать».</p>
          </div>
        )}
      </div>
    </SectionContentWrapper>
  );
}

function ChecklistSection({ form, budget }: { form: PlannerForm; budget: BudgetBreakdown }) {
  const checklist = generateChecklist(form, budget);
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <List className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-neutral-900">
          Персонализированный чек-лист для запуска из РБ
        </h3>
      </div>
      <ul className="space-y-3" role="list">
        {checklist.map((item, idx) => (
          <li key={idx} className="flex gap-3">
            <span
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: '#7b1fa2' }}
              aria-hidden="true"
            >
              {idx + 1}
            </span>
            <div>
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {item.label}
              </span>
              <p className="text-sm text-neutral-700 mt-0.5 leading-relaxed">
                {item.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
