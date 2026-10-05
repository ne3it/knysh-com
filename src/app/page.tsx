'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, ChevronDown, FolderOpen, Code, Terminal, Database, Globe, Shield, HardHat, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  {
    id: 'wb',
    title: 'Wildberries',
    description: 'Рабочий раздел: аналитика, товары, заказы, склады, финансы, реклама, SEO, отзывы.',
    icon: Database,
    href: '/wb',
    active: true,
  },
  {
    id: 'const',
    title: 'Строительный',
    description: 'Рабочий раздел: Калькуляторы РБ',
    icon: HardHat,
    href: '/const',
    active: true,
  },
  {
    id: 'frame',
    title: 'Каркасные дома',
    description: 'Рабочий раздел: конструктор по ТКП 45-5.05-146-2009',
    icon: Home,
    href: '/frame',
    active: true,
  },
  {
    id: 'ozon',
    title: 'Ozon',
    description: 'В разработке...',
    icon: Globe,
    href: '#',
    active: false,
  },
  {
    id: 'yandex',
    title: 'Яндекс Маркет',
    description: 'В разработке...',
    icon: Shield,
    href: '#',
    active: false,
  },
  {
    id: 'api',
    title: 'API & Интеграции',
    description: 'В разработке...',
    icon: Code,
    href: '#',
    active: false,
  },
  {
    id: 'tools',
    title: 'Внутренние инструменты',
    description: 'В разработке...',
    icon: Terminal,
    href: '#',
    active: false,
  },
];

function Header() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownHeight, setDropdownHeight] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="border-b border-neutral-900 bg-black/80 backdrop-blur-xl sticky top-0 z-40" role="banner">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-medium tracking-tight text-white/90 hover:text-white transition-colors duration-300" aria-label="Knysh.com — главная">
          Knysh.com
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium" role="navigation" aria-label="Основная навигация">
          <Link
            href="#about"
            className="text-neutral-500 hover:text-white/80 transition-colors duration-300 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-white/30 after:transition-width after:duration-300 hover:after:w-full"
            onClick={() => setIsDropdownOpen(false)}
          >
            О проекте
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-neutral-500 hover:text-white/80 hover:bg-white/5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/10 focus:ring-offset-2 focus:ring-offset-black"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              aria-label="Разделы"
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              Разделы
              <ChevronDown className={cn('w-4 h-4 transition-transform duration-300', isDropdownOpen && 'rotate-180')} aria-hidden="true" />
            </button>
            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-3 w-64 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-dropdown-enter"
                role="menu"
                style={{ transformOrigin: 'top right' }}
              >
                <div className="px-3 py-2 border-b border-neutral-800">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Доступные разделы</p>
                </div>
                <div className="py-1 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {sections.map((section, index) => (
                    <Link
                      key={section.id}
                      href={section.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 rounded-lg mx-2',
                        section.active
                          ? 'text-white hover:bg-white/5'
                          : 'text-neutral-500 hover:text-neutral-400 hover:bg-white/3 cursor-not-allowed'
                      )}
                      role="menuitem"
                      onClick={() => setIsDropdownOpen(false)}
                      aria-current={section.active ? 'page' : undefined}
                      aria-disabled={!section.active}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className={cn('p-1.5 rounded-lg flex-shrink-0', section.active ? 'bg-white/10' : 'bg-white/5')}>
                        <section.icon className={cn('w-4 h-4', section.active ? 'text-white/90' : 'text-neutral-500')} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="font-medium truncate block">{section.title}</span>
                        <span className="text-xs truncate block">{section.description}</span>
                      </div>
                      {section.active && (
                        <ArrowRight className="w-4 h-4 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                      )}
                    </Link>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-neutral-800">
                  <p className="text-xs text-neutral-500 text-center">Knysh.com — экосистема технологических разделов</p>
                </div>
              </div>
            )}
          </div>
          <Link
            href="#about"
            className="hidden sm:block px-4 py-2 rounded-lg font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 hover:border-white/20"
            onClick={() => setIsDropdownOpen(false)}
          >
            Открыть разделы
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32 lg:py-40 min-h-[80vh] flex items-center" aria-labelledby="hero-title">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/3 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/2 rounded-full blur-3xl" />
      </div>
      <div className="container mx-auto px-6 relative z-10 w-full">
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6 text-sm font-medium text-white/60 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse-soft" aria-hidden="true" />
            <span>Технологическая экосистема</span>
          </div>
          <h1 id="hero-title" className="text-5xl md:text-6xl lg:text-7xl font-medium text-white mb-6 tracking-tight animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Knysh.com
            <br />
            <span className="text-white/60 font-normal">
              Сборник технологических разделов и инструментов
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            Единая точка входа в экосистему самостоятельных технических разделов.
            Каждый раздел — изолированный, специализированный инструмент для своих задач.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <Link
              href="#sections"
              className={cn(
                'inline-flex items-center gap-2 px-8 py-4 rounded-xl font-medium text-white text-base',
                'bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm',
                'transition-all duration-300 hover:border-white/30 hover:bg-white/15 hover:-translate-y-0.5',
                'focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black'
              )}
            >
              Открыть разделы
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-white/30 animate-fade-in-up" style={{ animationDelay: '500ms' }} role="list" aria-label="Статус разделов">
            <span className="flex items-center gap-2" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-white/30" />
              1 активный
            </span>
            <span className="w-px h-6 bg-white/10" aria-hidden="true" />
            <span className="flex items-center gap-2" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-white/10" />
              4 в разработке
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionsOverview() {
  return (
    <section id="sections" className="py-20 md:py-28 lg:py-32 border-t border-neutral-900" aria-labelledby="sections-title">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16 animate-fade-in-up">
          <h2 id="sections-title" className="text-3xl md:text-4xl font-medium text-white mb-4 tracking-tight">
            Разделы экосистемы
          </h2>
          <p className="text-white/50 text-lg">
            Каждый раздел — автономный продукт со своим стеком, логикой и интерфейсом
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {sections.map((section, index) => (
            <article
              key={section.id}
              className={cn(
                'relative rounded-2xl p-6 bg-neutral-950/50 backdrop-blur-sm',
                'border border-neutral-800 transition-all duration-400',
                'hover:border-neutral-700 hover:bg-neutral-900/80 hover:-translate-y-1',
                'hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)]'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl" aria-hidden="true" />
              <div className="relative flex flex-col h-full">
                <div className="p-3 rounded-xl flex-shrink-0 bg-white/5 border border-white/10">
                  <section.icon className="w-7 h-7 text-white/70" aria-hidden="true" />
                </div>
                <div className="mt-5 flex-1 animate-fade-in-up" style={{ animationDelay: `${index * 80 + 100}ms` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium text-white">{section.title}</h3>
                    {section.active && (
                      <span className="px-2 py-0.5 text-xs font-medium text-white/70 bg-white/10 rounded-full">
                        Активно
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50 mb-5">{section.description}</p>
                  <Link
                    href={section.href}
                    className={cn(
                      'inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300',
                      section.active
                        ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:border-white/20 hover:bg-white/15 hover:-translate-y-0.5'
                        : 'bg-white/3 hover:bg-white/5 text-neutral-500 hover:text-neutral-400 cursor-not-allowed'
                    )}
                    aria-disabled={!section.active}
                    aria-label={`${section.active ? '' : 'Скоро: '}${section.title}`}
                  >
                    {section.active ? (
                      <>
                        Перейти
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse-soft" aria-hidden="true" />
                          В разработке
                        </span>
                      </>
                    )}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="py-20 md:py-28 lg:py-32 border-t border-neutral-900" aria-labelledby="about-title">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
          <h2 id="about-title" className="text-3xl md:text-4xl font-medium text-white mb-6 tracking-tight">
            О Knysh.com
          </h2>
          <div className="prose prose-invert max-w-none mx-auto text-white/60 leading-relaxed space-y-5 text-base">
            <p className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              Knysh.com — это технологическая экосистема, объединяющая самостоятельные разделы под единым брендом.
            </p>
            <p className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              Мы строим изолированные, высокоспециализированные инструменты — каждый со своим стеком,
              архитектурой и жизненным циклом. Никаких монолитов: только чистая модульность и чёткое разделение ответственности.
            </p>
            <p className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              Первый активный раздел — <strong className="text-white">Wildberries</strong> — полностью функционален и используется в продакшене.
              Остальные разделы находятся в стадии проектирования и разработки.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-900 py-10 bg-neutral-950/50 backdrop-blur-sm" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40 text-center md:text-left">
            © {new Date().getFullYear()} Knysh.com. Все права защищены.
          </p>
          <div className="flex items-center justify-center md:justify-end gap-6">
            <a
              href="https://github.com/knysh-com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/70 transition-colors duration-300"
              aria-label="GitHub Knysh.com"
            >
              <ExternalLink className="w-5 h-5" aria-hidden="true" />
            </a>
            <a
              href="https://t.me/knysh_com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/70 transition-colors duration-300"
              aria-label="Telegram Knysh.com"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.944 19.144a7.87 7.87 0 0 1-3.472-.978l-.375-.217-4.392.986a.6.6 0 0 1-.879-.487l.87-4.681-.98-4.008a.606.606 0 0 1 .225-.977l4.318-2.547 3.896-3.56a.6.6 0 0 1 .984.103l3.56 3.895 2.548 4.317a.6.6 0 0 1-.226.976l-4.007.98 4.68.87a.6.6 0 0 1 .31.794l-.966 4.577a8.057 8.057 0 0 1-4.082 1.981 8.57 8.57 0 0 1-3.428-1.008l-.346-.205Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header />
      <main className="flex-1">
        <Hero />
        <SectionsOverview />
        <About />
      </main>
      <Footer />
    </div>
  );
}