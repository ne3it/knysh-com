import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Knysh.com — Технологическая экосистема',
    template: `%s | Knysh.com`,
  },
  description: 'Knysh.com: технологическая экосистема, объединяющая самостоятельные разделы под единым брендом. Wildberries — первый активный раздел, остальные в разработке.',
  keywords: ['knysh', 'wildberries', 'технологическая экосистема', 'инструменты', 'разработка', 'api', 'интеграции'],
  authors: [{ name: 'Knysh' }],
  creator: 'Knysh',
  publisher: 'Knysh',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://knysh.com',
    title: 'Knysh.com — Технологическая экосистема',
    description: 'Единая точка входа в экосистему самостоятельных технических разделов и инструментов.',
    siteName: 'Knysh.com',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knysh.com — Технологическая экосистема',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knysh.com — Технологическая экосистема',
    description: 'Единая точка входа в экосистему самостоятельных технических разделов и инструментов.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://knysh.com',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className={cn(inter.className, 'min-h-screen bg-black text-white')}>
        {children}
      </body>
    </html>
  );
}