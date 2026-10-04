'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconComponent, getSectionConfig } from '@/config/features';
import {
  useSectionStore,
  useCurrentBlock,
  useSidebarCollapsed,
  useCollapsedGroups,
} from '@/lib/store/sectionStore';
import type { ToolBlock } from '@/types/section';

interface SectionSidebarProps {
  sectionId: string;
  className?: string;
  /** Always render the expanded state (used by the mobile drawer). */
  forceExpanded?: boolean;
  /** Called after a block item is selected (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function SectionSidebar({
  sectionId,
  className,
  forceExpanded = false,
  onNavigate,
}: SectionSidebarProps) {
  const sectionConfig = getSectionConfig(sectionId);
  const currentBlock = useCurrentBlock();
  const storedCollapsed = useSidebarCollapsed();
  const sidebarCollapsed = forceExpanded ? false : storedCollapsed;
  const collapsedGroups = useCollapsedGroups();
  const { toggleSidebar, toggleGroup, setCurrentBlock } = useSectionStore.getState();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectBlock = (blockId: string) => {
    setCurrentBlock(blockId);
    onNavigate?.();
  };

  const groups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (sectionConfig?.featureGroups ?? [])
      .map((group) => {
        const blocks = group.blocks.filter((block) => {
          if (!query) return true;
          const inTabs = block.tabs.some(
            (tab) =>
              tab.label.toLowerCase().includes(query) ||
              tab.features.some(
                (feature) =>
                  feature.label.toLowerCase().includes(query) ||
                  feature.description?.toLowerCase().includes(query)
              )
          );
          return block.label.toLowerCase().includes(query) || inTabs;
        });
        return { group, blocks };
      })
      .filter(({ blocks }) => blocks.length > 0 || !query);
  }, [sectionConfig, searchQuery]);

  if (!sectionConfig) {
    return (
      <div className={cn('h-full bg-white border-r border-neutral-200 flex flex-col', className)}>
        <div className="p-4 text-center text-neutral-500">Раздел не найден</div>
      </div>
    );
  }

  const SectionIcon = getIconComponent(sectionConfig.icon);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-neutral-200 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-72',
        className
      )}
      aria-label="Навигация по бизнес-блокам"
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between p-4 border-b border-neutral-200',
          sidebarCollapsed && 'justify-center'
        )}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${sectionConfig.color}14` }}>
              <SectionIcon className="w-5 h-5" style={{ color: sectionConfig.color }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-neutral-900 truncate">{sectionConfig.label}</h1>
              <p className="text-xs text-neutral-500 truncate">{sectionConfig.description}</p>
            </div>
          </div>
        )}
        {!forceExpanded && (
          <button
            onClick={toggleSidebar}
            className={cn(
              'p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors',
              sidebarCollapsed && 'ml-auto'
            )}
            aria-label={sidebarCollapsed ? 'Раскрыть сайдбар' : 'Свернуть сайдбар'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-neutral-200">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Поиск инструмента..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
              aria-label="Поиск по инструментам"
            />
          </div>
        </div>
      )}

      {/* Block Groups */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Бизнес-блоки раздела">
        {groups.map(({ group, blocks }) => {
          const isCollapsed = collapsedGroups[group.id] ?? !group.defaultOpen;
          const hasActiveBlock = blocks.some((block) => block.id === currentBlock);
          const hasVisibleBlocks = blocks.length > 0;

          if (!hasVisibleBlocks && searchQuery) return null;

          return (
            <div key={group.id} className="mb-4" data-group-id={group.id}>
              {!sidebarCollapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors',
                    hasActiveBlock && 'text-[var(--primary)]'
                  )}
                  aria-expanded={!isCollapsed}
                  aria-controls={`group-${group.id}`}
                >
                  <span className="flex-1 text-left truncate">{group.label}</span>
                  <ChevronDown
                    className={cn('w-4 h-4 flex-shrink-0 transition-transform', isCollapsed && '-rotate-90')}
                    aria-hidden="true"
                  />
                </button>
              )}

              <div
                id={`group-${group.id}`}
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  sidebarCollapsed && 'hidden',
                  isCollapsed
                    ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    : 'grid-rows-[1fr] opacity-100'
                )}
                role="region"
                aria-label={group.label}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-1" role="list">
                    {blocks.map((block) => (
                      <BlockItem
                        key={block.id}
                        block={block}
                        isActive={currentBlock === block.id}
                        sidebarCollapsed={sidebarCollapsed}
                        onClick={() => handleSelectBlock(block.id)}
                      />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

interface BlockItemProps {
  block: ToolBlock;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onClick: () => void;
}

function BlockItem({ block, isActive, sidebarCollapsed, onClick }: BlockItemProps) {
  const IconComponent = getIconComponent(block.icon);

  // Обучающий симулятор — крупная золото-фиолетовая кнопка в самом верху меню
  if (block.featured) {
    if (sidebarCollapsed) {
      return (
        <li>
          <button
            onClick={onClick}
            className="simulator-glow flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#9c27b0] to-[#6a1b8f] p-2.5 text-white shadow-lg shadow-[#7b1fa2]/30 transition-transform hover:scale-105"
            aria-current={isActive ? 'page' : undefined}
            title={block.label}
          >
            <IconComponent className="w-5 h-5" aria-hidden="true" />
          </button>
        </li>
      );
    }

    return (
      <li>
        <button
          onClick={onClick}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'simulator-glow group relative w-full overflow-hidden rounded-xl px-4 py-4 text-left transition-transform',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b1fa2] focus-visible:ring-offset-2',
            'bg-gradient-to-br from-[#9c27b0] via-[#7b1fa2] to-[#4a148c] text-white',
            'shadow-lg shadow-[#7b1fa2]/25 hover:scale-[1.02] active:scale-[0.99]',
            isActive && 'ring-2 ring-[#7b1fa2] ring-offset-2'
          )}
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.55), transparent 45%)',
            }}
            aria-hidden="true"
          />
          <span className="relative flex items-start gap-3">
            <span className="rounded-lg bg-white/25 p-2">
              <IconComponent className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-violet-100">
                Обучающий модуль
              </span>
              <span className="block text-sm font-bold leading-snug">{block.label}</span>
              <span className="mt-1 block text-xs leading-snug text-violet-100/90">
                4 шага · конфетти · разбор ошибок
              </span>
            </span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
          isActive
            ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
          sidebarCollapsed && 'justify-center px-2'
        )}
        aria-current={isActive ? 'page' : undefined}
        title={sidebarCollapsed ? block.label : undefined}
      >
        <IconComponent
          className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[var(--primary)]')}
          aria-hidden="true"
        />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="truncate">{block.label}</span>
            <span className="flex-shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
              {block.tabs.length}
            </span>
          </div>
        )}
      </button>
    </li>
  );
}
