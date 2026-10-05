'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Layers, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveTab, getBlock, getIconComponent, getSectionConfig } from '@/config/features';
import { useActiveTabs } from '@/lib/store/sectionStore';
import type { ToolBlock } from '@/types/section';
import { FeatureLoader } from './SectionContent';
import { SharedVariablesPanel } from './SharedVariablesPanel';
import {
  useConstructionDistrict,
  useConstructionRegion,
  useConstructionStore,
  type ConstructionDistrictKey,
  type ConstructionRegionKey,
} from '@/lib/store/constructionStore';
import { DISTRICT_LABELS, REGION_COEFFICIENTS } from '@/lib/construction';

interface BlockWorkspaceProps {
  sectionId: string;
  blockId: string | null;
  onTabChange: (blockId: string, tabId: string) => void;
}

/**
 * Страница одного бизнес-блока.
 *
 *  - шапка блока с уникальной иконкой;
 *  - панель «↔ СКВОЗНЫЕ ПЕРЕМЕННЫЕ» — глобальные параметры блока: товар из
 *    справочника Постановления № 713 и три числовых поля, набор которых зависит
 *    от типа товара (себестоимость/количество/выкуп либо трафик/аренда/средний чек
 *    для франшизы ПВЗ);
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
  // В разделе /const над вкладками идёт переключатель региона и области,
  // а не сквозная экономика WB: цены в смете считаются от региона.
  const isConstruction = getSectionConfig(sectionId)?.theme === 'graphite';

  return (
    <div className="animate-fade-in space-y-4">
      <BlockHeader block={block} />
      {!isSimulator &&
        (isConstruction ? <ConstructionRegionBar /> : <SharedVariablesPanel />)}
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
          ? 'border-violet-300 bg-gradient-to-r from-violet-50 via-white to-white'
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
 * Полоса раздела «Строительный»: переключатель «Минск / Регионы» и область РБ.
 *
 * Регион меняет цены (коэффициенты к материалам и работам), область — глубину
 * промерзания грунта по СН 2.01.01-2019 в фундаментном калькуляторе. Оба
 * выбора сохраняются: прораб не должен заново выставлять их в каждом
 * инструменте, поэтому значения лежат в общем сторе раздела.
 */
function ConstructionRegionBar() {
  const region = useConstructionRegion();
  const district = useConstructionDistrict();
  const setRegion = useConstructionStore((state) => state.setRegion);
  const setDistrict = useConstructionStore((state) => state.setDistrict);
  const coefficients = REGION_COEFFICIENTS[region];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--kc-khaki)] bg-[var(--kc-surface)] px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--kc-khaki-text)]">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Смета в BYN
      </span>

      <div
        className="inline-flex overflow-hidden rounded-lg border border-[var(--kc-border-strong)]"
        role="group"
        aria-label="Регион расчёта стоимости"
      >
        {(Object.keys(REGION_COEFFICIENTS) as ConstructionRegionKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRegion(key)}
            aria-pressed={region === key}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kc-khaki-text)]',
              region === key
                ? 'bg-[var(--kc-khaki)] text-white'
                : 'bg-transparent text-[var(--kc-muted)] hover:bg-[var(--kc-surface-2)] hover:text-white'
            )}
          >
            {REGION_COEFFICIENTS[key].shortLabel}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--kc-muted)]">
        <span className="sr-only sm:not-sr-only">Область</span>
        <select
          value={district}
          onChange={(event) => setDistrict(event.target.value as ConstructionDistrictKey)}
          className="rounded-lg border border-[var(--kc-border-strong)] bg-[var(--kc-surface-2)] px-2.5 py-1.5 text-xs text-white"
        >
          {Object.entries(DISTRICT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {/* Коэффициенты видны сразу: прораб должен понимать, почему сумма уехала вниз */}
      <span className="ml-auto rounded-lg bg-[var(--kc-surface-2)] px-2.5 py-1 font-mono text-[11px] tabular-nums text-[var(--kc-muted)]">
        материал ×{coefficients.material.toFixed(2)} · работа ×{coefficients.labor.toFixed(2)}
      </span>
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