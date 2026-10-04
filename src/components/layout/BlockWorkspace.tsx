'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Link2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveTab, getBlock, getIconComponent } from '@/config/features';
import { useActiveTabs } from '@/lib/store/sectionStore';
import { SHARED_SUMMARY_FIELDS, SHARED_KEYS, useSharedEconomics } from '@/lib/store/sharedEconomicsStore';
import type { ToolBlock } from '@/types/section';
import { FeatureLoader } from './SectionContent';

interface BlockWorkspaceProps {
  sectionId: string;
  blockId: string | null;
  onTabChange: (blockId: string, tabId: string) => void;
}

/**
 * Страница одного бизнес-блока.
 *
 *  - шапка блока с уникальной иконкой;
 *  - полоса «сквозных переменных» — общая экономика блока (себестоимость, цена,
 *    габариты, вес, партия), которая живёт в общем сторе;
 *  - горизонтальные фиолетовые вкладки с инструментами блока.
 *
 * Вкладки монтируются один раз и дальше остаются в DOM (неактивные скрыты атрибутом hidden),
 * поэтому React не размонтирует их state: введённые значения НЕ сбрасываются,
 * а расчёты пересчитываются мгновенно по событию input.
 */
export function BlockWorkspace({ sectionId, blockId, onTabChange }: BlockWorkspaceProps) {
  const activeTabs = useActiveTabs();
  const block = useMemo(() => getBlock(sectionId, blockId ?? ''), [sectionId, blockId]);

  if (!block) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white">
        <div className="text-center p-8">
          <Layers className="mx-auto mb-4 h-12 w-12 text-neutral-300" aria-hidden="true" />
          <h2 className="mb-1 text-lg font-medium text-neutral-900">Выберите бизнес-блок</h2>
          <p className="text-neutral-500">
            Слева симулятор для новичков и 5 блоков: планировщик старта, документы РБ,
            налоги и контроль, аналитика ПВЗ и логистика, SEO-оптимизация
          </p>
        </div>
      </div>
    );
  }

  return (
    <BlockView
      sectionId={sectionId}
      block={block}
      activeTabs={activeTabs}
      onTabChange={onTabChange}
    />
  );
}

/**
 * Рабочая область блока. Вынесена отдельным компонентом, чтобы хуки
 * вызывались в неизменном порядке (вызов useMountedTabs идёт после проверки блока).
 */
function BlockView({
  sectionId,
  block,
  activeTabs,
  onTabChange,
}: {
  sectionId: string;
  block: ToolBlock;
  activeTabs: Record<string, string>;
  onTabChange: (blockId: string, tabId: string) => void;
}) {
  const activeTab = getActiveTab(block, activeTabs[block.id]);
  const mountedTabs = useMountedTabs(block, activeTab.id);
  const isSimulator = Boolean(block.featured);

  return (
    <div className="animate-fade-in space-y-4">
      <BlockHeader block={block} />
      {!isSimulator && <SharedEconomicsBar />}
      <ToolTabs block={block} activeTabId={activeTab.id} onTabChange={onTabChange} />

      {block.tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tool-panel-${block.id}-${tab.id}`}
          aria-labelledby={`tool-tab-${block.id}-${tab.id}`}
          hidden={tab.id !== activeTab.id}
          className="rounded-2xl border border-neutral-200 bg-white"
        >
          {mountedTabs.has(tab.id) &&
            tab.features.map((feature) => (
              <FeatureLoader key={feature.id} sectionId={sectionId} featureId={feature.id} />
            ))}
        </div>
      ))}
    </div>
  );
}

function BlockHeader({ block }: { block: ToolBlock }) {
  const IconComponent = getIconComponent(block.icon);

  return (
    <header
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-4 sm:px-5',
        block.highlight === 'gold'
          ? 'border-amber-300 bg-gradient-to-r from-amber-50 via-white to-white'
          : 'border-neutral-200 bg-white'
      )}
    >
      <div
        className={cn(
          'rounded-xl p-2.5',
          block.highlight === 'gold' ? 'bg-violet-100' : 'bg-[var(--primary)]/10'
        )}
      >
        <IconComponent
          className={cn('h-6 w-6', block.highlight === 'gold' ? 'text-[#7b1fa2]' : 'text-[var(--primary)]')}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            'text-lg font-semibold sm:text-xl',
            block.highlight === 'gold' ? 'text-[#7b1fa2]' : 'text-neutral-900'
          )}
        >
          {block.label}
        </h1>
        {block.description && <p className="text-sm text-neutral-500">{block.description}</p>}
      </div>
      {block.highlight === 'gold' && (
        <span className="hidden shrink-0 rounded-full bg-[#7b1fa2] px-3 py-1 text-xs font-semibold text-white sm:inline">
          🎓 Обучающий модуль
        </span>
      )}
      {!block.highlight && (
        <span className="hidden shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 sm:inline">
          {block.tabs.length}{' '}
          {block.tabs.length === 1
            ? 'инструмент'
            : block.tabs.length < 5
              ? 'инструмента'
              : 'инструментов'}
        </span>
      )}
    </header>
  );
}

/**
 * Полоса общих переменных. Значения берутся из общего стора, поэтому видно,
 * что именно перейдёт в следующую вкладку и что расчёт идёт в BYN.
 */
function SharedEconomicsBar() {
  const values = useSharedEconomics((state) => state.values);
  const resetShared = useSharedEconomics((state) => state.resetShared);

  const filled = SHARED_SUMMARY_FIELDS.filter((field) => (values[field.key] ?? '').trim() !== '');
  if (filled.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        Сквозные переменные
      </span>
      {filled.map((field) => (
        <span
          key={field.key}
          className="rounded-lg bg-white px-2.5 py-1 text-xs text-neutral-700 shadow-sm"
        >
          {field.label}:{' '}
          <strong className="tabular-nums text-neutral-900">
            {field.key === SHARED_KEYS.length
              ? `${values[SHARED_KEYS.length]}×${values[SHARED_KEYS.width]}×${
                  values[SHARED_KEYS.height]
                } ${field.unit}`
              : `${values[field.key]}${field.unit ? ` ${field.unit}` : ''}`}
          </strong>
        </span>
      ))}
      <button
        type="button"
        onClick={resetShared}
        title="Сбросить общие переменные блока"
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Сбросить
      </button>
    </div>
  );
}

function ToolTabs({
  block,
  activeTabId,
  onTabChange,
}: {
  block: ToolBlock;
  activeTabId: string;
  onTabChange: (blockId: string, tabId: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={`Инструменты блока «${block.label}»`}
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
    >
      {block.tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const count = tab.features.length;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tool-tab-${block.id}-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tool-panel-${block.id}-${tab.id}`}
            onClick={() => onTabChange(block.id, tab.id)}
            className={cn(
              'shrink-0 snap-start rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2',
              isActive
                ? block.highlight === 'gold'
                  ? 'bg-[#7b1fa2] text-white shadow-sm shadow-[#7b1fa2]/30'
                  : 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm shadow-[var(--primary)]/30'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:border-[var(--primary)]/40 hover:text-[var(--primary)]'
            )}
          >
            {tab.label}
            {count > 1 && (
              <span
                className={cn(
                  'ml-2 rounded-full px-1.5 py-0.5 text-[11px]',
                  isActive ? 'bg-white/25' : 'bg-neutral-100 text-neutral-500'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Вкладки, которые уже открывались в текущем сеансе просмотра блока.
 * Таб монтируется один раз и дальше остаётся в DOM, поэтому значения полей
 * не теряются при переключении. Ещё не открытые табы не монтируются вовсе —
 * тяжёлые библиотеки (PDF, Chart.js) грузятся только когда они действительно нужны.
 */
function useMountedTabs(block: ToolBlock, activeTabId: string): Set<string> {
  const [visited, setVisited] = useState<Record<string, string[]>>({});
  const activeTab = block.tabs.find((tab) => tab.id === activeTabId);
  const tabIdToMount = activeTab?.id ?? block.tabs[0]?.id ?? '';

  useEffect(() => {
    if (!tabIdToMount) return;
    setVisited((prev) => {
      const current = prev[block.id] ?? [];
      if (current.includes(tabIdToMount)) return prev;
      return { ...prev, [block.id]: [...current, tabIdToMount] };
    });
  }, [block.id, tabIdToMount]);

  const visitedForBlock = visited[block.id];
  // На первом рендере эффект ещё не отработал — монтируем активный таб сразу,
  // чтобы пользователь не видел пустой кадр.
  return new Set(visitedForBlock ?? (tabIdToMount ? [tabIdToMount] : []));
}