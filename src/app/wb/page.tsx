import { Metadata } from 'next';
import { SectionLayout } from '@/components/layout/SectionLayout';

export const metadata: Metadata = {
  title: 'Wildberries — Knysh.com',
  description: 'Инструменты для управления бизнесом на Wildberries: калькулятор юнит-экономики, SEO очистка, контроль цен, маркировка и этикетки.',
  openGraph: {
    title: 'Wildberries — Knysh.com',
    description: 'Инструменты для управления бизнесом на Wildberries',
  },
};

export default function WbPage() {
  return <SectionLayout sectionId="wb" />;
}
