'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSectionStore } from '@/lib/store/sectionStore';
import { getFeature, getSectionConfig } from '@/config/features';

/**
 * Поддержка глубоких ссылок вида /wb?tool=<id>.
 *
 * Параметр читается из window.location, а не через useSearchParams: так /wb остаётся
 * статически отрендеренным (иначе весь раздел уходит в client-side rendering).
 *
 * Для обычных инструментов находим блок и его таб и открываем их — ссылка работает,
 * даже если блок не был активным. Инструменты, которые по ТЗ не выведены в меню
 * (Планировщик старта, Калькулятор ПВЗ), остаются в реестре и открываются напрямую:
 * для них хук возвращает id фичи, а layout рендерит её вместо блока.
 */
export function useToolDeepLink(sectionId: string): string | null {
  const [toolParam, setToolParam] = useState<string | null>(null);
  const [standaloneFeatureId, setStandaloneFeatureId] = useState<string | null>(null);

  const readParam = useCallback(() => {
    if (typeof window === 'undefined') return;
    setToolParam(new URLSearchParams(window.location.search).get('tool'));
  }, []);

  useEffect(() => {
    readParam();
    window.addEventListener('popstate', readParam);
    return () => window.removeEventListener('popstate', readParam);
  }, [readParam]);

  useEffect(() => {
    if (!toolParam) {
      setStandaloneFeatureId(null);
      return;
    }

    const section = getSectionConfig(sectionId);
    const feature = getFeature(sectionId, toolParam);
    if (!section || !feature) {
      setStandaloneFeatureId(null);
      return;
    }

    const owner = section.featureGroups
      .flatMap((group) => group.blocks)
      .find((block) => block.tabs.some((tab) => tab.features.some((item) => item.id === feature.id)));

    const store = useSectionStore.getState();

    if (!owner) {
      // Инструмент вне меню: рендерим его напрямую поверх рабочей области.
      setStandaloneFeatureId(feature.id);
      return;
    }

    const tab = owner.tabs.find((item) => item.features.some((entry) => entry.id === feature.id));
    setStandaloneFeatureId(null);

    if (store.currentSection !== sectionId) store.setCurrentSection(sectionId);
    if (store.currentBlock !== owner.id) store.setCurrentBlock(owner.id);
    if (tab && store.activeTabs[owner.id] !== tab.id) store.setActiveTab(owner.id, tab.id);
  }, [sectionId, toolParam]);

  return standaloneFeatureId;
}
