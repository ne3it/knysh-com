'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconComponent } from '@/config/features';
import { useSectionStore, useCurrentFeature, useSidebarCollapsed, useCollapsedGroups } from '@/lib/store/sectionStore';
import { getSectionConfig, getAllFeatures } from '@/config/features';
import type { Feature } from '@/types/section';

interface SectionSidebarProps {
  sectionId: string;
  className?: string;
  /** Always render the expanded state (used by the mobile drawer). */
  forceExpanded?: boolean;
  /** Called after a feature item is selected (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function SectionSidebar({ sectionId, className, forceExpanded = false, onNavigate }: SectionSidebarProps) {
  const sectionConfig = getSectionConfig(sectionId);
  const currentFeature = useCurrentFeature();
  const storedCollapsed = useSidebarCollapsed();
  const sidebarCollapsed = forceExpanded ? false : storedCollapsed;
  const collapsedGroups = useCollapsedGroups();
  const store = useSectionStore.getState();
  const { toggleSidebar, toggleGroup, setCurrentFeature } = store;
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectFeature = (featureId: string) => {
    setCurrentFeature(featureId);
    onNavigate?.();
  };

  if (!sectionConfig) {
    return (
      <div className={cn('h-full bg-white border-r border-neutral-200 flex flex-col', className)}>
        <div className="p-4 text-center text-neutral-500">Раздел не найден</div>
      </div>
    );
  }

  const allFeatures = getAllFeatures(sectionId);
  const filteredFeatures = allFeatures.filter((feature) =>
    feature.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    feature.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered features by their original groups
  const groupedFeatures: Record<string, Feature[]> = {};
  sectionConfig.featureGroups.forEach((group) => {
    groupedFeatures[group.id] = group.features.filter((f) =>
      filteredFeatures.includes(f)
    );
  });

  const IconComponent = getIconComponent(sectionConfig.icon);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-neutral-200 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-72',
        className
      )}
      aria-label="Навигация по функциям"
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between p-4 border-b border-neutral-200', sidebarCollapsed && 'justify-center')}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn('p-2 rounded-xl', `bg-[${sectionConfig.color}]/10`)}>
              <IconComponent className={cn('w-5 h-5', `text-[${sectionConfig.color}]`)} aria-hidden="true" />
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
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Поиск функций..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
              aria-label="Поиск по функциям"
            />
          </div>
        </div>
      )}

      {/* Feature Groups */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Список функций">
        {sectionConfig.featureGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.id] ?? !group.defaultOpen;
          const groupFeatures = groupedFeatures[group.id] || [];
          const hasActiveFeature = groupFeatures.some((f) => f.id === currentFeature);
          const hasVisibleFeatures = groupFeatures.length > 0;

          if (!hasVisibleFeatures && searchQuery) return null;

          return (
            <div key={group.id} className="mb-4" data-group-id={group.id}>
              {/* Group Header */}
              {!sidebarCollapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors',
                    hasActiveFeature && 'text-[var(--primary)]'
                  )}
                  aria-expanded={!isCollapsed}
                  aria-controls={`group-${group.id}`}
                >
                  <span className="flex-1 text-left truncate">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                    aria-hidden="true"
                  />
                </button>
              )}

              {/* Features List */}
              <div
                id={`group-${group.id}`}
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  sidebarCollapsed && 'hidden',
                  isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
                )}
                role="region"
                aria-label={`${group.label} функции`}
              >
                {/* Inner wrapper carries overflow-hidden so the height animates without clipping the open list */}
                <div className="overflow-hidden">
                  <ul className="space-y-1" role="list">
                    {groupFeatures.map((feature) => (
                      <FeatureItem
                        key={feature.id}
                        feature={feature}
                        isActive={currentFeature === feature.id}
                        sidebarCollapsed={sidebarCollapsed}
                        onClick={() => handleSelectFeature(feature.id)}
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

interface FeatureItemProps {
  feature: Feature;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onClick: () => void;
}

function FeatureItem({ feature, isActive, sidebarCollapsed, onClick }: FeatureItemProps) {
  const IconComponent = getIconComponent(feature.icon);

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
        aria-pressed={isActive}
        title={sidebarCollapsed ? feature.label : undefined}
      >
        <IconComponent className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[var(--primary)]')} aria-hidden="true" />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="truncate">{feature.label}</span>
            {feature.badge && (
              <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] rounded-full">
                {feature.badge}
              </span>
            )}
            {feature.shortcut && (
              <kbd className="flex-shrink-0 px-1.5 py-0.5 text-xs text-neutral-400 bg-neutral-100 rounded font-mono">
                {feature.shortcut}
              </kbd>
            )}
          </div>
        )}
      </button>
    </li>
  );
}


