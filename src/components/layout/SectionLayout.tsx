'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSectionConfig, getIconComponent, getBlock } from '@/config/features';
import { useSectionStore, useSidebarCollapsed, useCurrentBlock } from '@/lib/store/sectionStore';
import { SectionSidebar } from './SectionSidebar';
import { BlockWorkspace } from './BlockWorkspace';
import { FeatureLoader } from './SectionContent';
import { useToolDeepLink } from './useToolDeepLink';

interface SectionLayoutProps {
  sectionId: string;
  children?: React.ReactNode;
}

export function SectionLayout({ sectionId, children }: SectionLayoutProps) {
  const sidebarCollapsed = useSidebarCollapsed();
  const initializedRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Читаем подпиской: нужно перерисовать рабочую область при смене блока/таба
  const currentBlock = useSectionStore((state) => state.currentBlock);

  const sectionConfig = getSectionConfig(sectionId);
  const defaultBlockId = sectionConfig?.defaultBlock ?? null;
  // /wb?tool=<id>: инструменты вне меню открываются напрямую (Планировщик старта, Калькулятор ПВЗ)
  const standaloneFeatureId = useToolDeepLink(sectionId);

  // Initialize store once on mount — uses getState() to avoid creating re-render subscriptions
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const store = useSectionStore.getState();
    if (store.currentSection !== sectionId) {
      store.setCurrentSection(sectionId);
    }
    const currentBlockIsValid =
      !!store.currentBlock && !!getBlock(sectionId, store.currentBlock);
    if (!currentBlockIsValid && defaultBlockId) {
      store.setCurrentBlock(defaultBlockId);
    }
  }, [sectionId, defaultBlockId]);

  // Close the mobile drawer on Escape and when returning to the desktop breakpoint
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  if (!sectionConfig) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Раздел не найден</h1>
          <p className="text-neutral-500">Раздел &quot;{sectionId}&quot; не существует в реестре</p>
        </div>
      </div>
    );
  }

  const SectionIcon = getIconComponent(sectionConfig.icon);
  const store = useSectionStore.getState();

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white lg:flex-row">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex w-full items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="-ml-1 rounded-lg p-2 text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          aria-label="Открыть меню"
          aria-expanded={mobileMenuOpen}
          aria-controls="wb-mobile-menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <SectionIcon className="h-5 w-5 flex-shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <span className="truncate text-base font-semibold text-neutral-900">{sectionConfig.label}</span>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 lg:hidden" id="wb-mobile-menu" role="dialog" aria-modal="true" aria-label="Меню раздела">
          <SectionSidebar
            sectionId={sectionId}
            forceExpanded
            onNavigate={() => setMobileMenuOpen(false)}
            className="w-[280px] max-w-[85vw] shadow-xl"
          />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute right-3 top-4 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100"
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <SectionSidebar sectionId={sectionId} className="hidden lg:flex" />

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 min-w-0 w-full bg-white transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
        )}
        id="main-content"
        role="main"
        aria-label={sectionConfig.label}
      >
        <div className="flex-1 min-w-0 w-full p-4 sm:p-6 lg:p-8">
          {standaloneFeatureId ? (
            <FeatureLoader sectionId={sectionId} featureId={standaloneFeatureId} />
          ) : (
            <BlockWorkspace
              sectionId={sectionId}
              blockId={currentBlock}
              onTabChange={(blockId, tabId) => store.setActiveTab(blockId, tabId)}
            />
          )}

          {/* Custom children (for section-specific overlays, etc.) */}
          {children}
        </div>
      </main>


      {/* Global styles for the section */}
      <style jsx global>{`
        /* Custom scrollbar for sidebar */
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }

        /* Focus visible styles */
        :focus-visible {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Section Layout with custom header (for sections needing extra toolbar)
 */
export function SectionLayoutWithHeader({
  sectionId,
  header,
}: {
  sectionId: string;
  header: React.ReactNode;
}) {
  const sidebarCollapsed = useSidebarCollapsed();
  const currentBlock = useCurrentBlock();
  const store = useSectionStore.getState();

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white lg:flex-row">
      <SectionSidebar sectionId={sectionId} className="hidden lg:flex" />
      <main
        className={cn(
          'flex-1 min-w-0 w-full bg-white transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
        )}
      >
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-neutral-200">
          {header}
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <BlockWorkspace
            sectionId={sectionId}
            blockId={currentBlock}
            onTabChange={(blockId, tabId) => store.setActiveTab(blockId, tabId)}
          />
        </div>
      </main>
    </div>
  );
}
