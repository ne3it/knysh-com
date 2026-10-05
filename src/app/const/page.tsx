import { Metadata } from 'next';
import { SectionLayout } from '@/components/layout/SectionLayout';

export const metadata: Metadata = {
  title: 'Строительный — Kilo Construction | Калькуляторы РБ',
  description:
    'Калькуляторы строительных работ Республики Беларусь: расчёт фундамента и арматуры по СН 2.01.01-2019, кладка блоков с вычетом проёмов и запасом на бой, скатная кровля, штукатурка и стяжка. Смета в белорусских рублях, цены Минска и регионов.',
  openGraph: {
    title: 'Строительный — Kilo Construction',
    description:
      'Калькуляторы РБ: фундаменты, блоки, кровля, штукатурка и стяжка. Смета в BYN.',
  },
};

export default function ConstructionPage() {
  return <SectionLayout sectionId="const" />;
}