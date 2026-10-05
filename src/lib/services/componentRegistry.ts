import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { Feature } from '@/types/section';

type FeatureComponent = ComponentType<{ feature: Feature }>;

/**
 * Component registry mapping componentPath strings to next/dynamic loaders.
 * This is needed because raw import() with a runtime variable (e.g. feature.componentPath)
 * cannot resolve the @/ path alias at build time — webpack only resolves aliases for
 * literal string paths. next/dynamic wraps a static import() call so the alias resolves correctly.
 */

// Helper: extract the default export from a module, typed as FeatureComponent
async function loadDefault(mod: { default?: FeatureComponent }): Promise<FeatureComponent> {
  if (mod.default) return mod.default;
  const firstKey = Object.keys(mod)[0];
  if (firstKey && typeof mod[firstKey as keyof typeof mod] === 'function') {
    return mod[firstKey as keyof typeof mod] as FeatureComponent;
  }
  throw new Error('No component exported');
}

export const COMPONENT_REGISTRY: Record<string, FeatureComponent> = {
  /* Обучающий симулятор «Быстрый Старт» — первым, он же главная кнопка сайдбара */
  '@components/features/wb/StartupSimulator': dynamic(() =>
    import('@/components/features/wb/StartupSimulator').then(loadDefault)
  ),
   '@components/features/wb/Calculator': dynamic(() =>
    import('@/components/features/wb/Calculator').then(loadDefault)
  ),
   '@components/features/wb/SEOClean': dynamic(() =>
    import('@/components/features/wb/SEOClean').then(loadDefault)
  ),
   '@components/features/wb/Stockout': dynamic(() =>
    import('@/components/features/wb/Stockout').then(loadDefault)
  ),
  '@components/features/wb/PriceControl713': dynamic(() =>
    import('@/components/features/wb/PriceControl713').then(loadDefault)
  ),
   '@components/features/wb/LabelsGenerator': dynamic(() =>
    import('@/components/features/wb/LabelsGenerator').then(loadDefault)
  ),
   '@components/features/wb/StartupPlanner': dynamic(() =>
     import('@/components/features/wb/StartupPlanner').then(loadDefault)
   ),
   '@components/features/wb/CargoCalculator': dynamic(() =>
    import('@/components/features/wb/CargoCalculator').then(loadDefault)
  ),
   '@components/features/wb/TNVEDCheck': dynamic(() =>
    import('@/components/features/wb/TNVEDCheck').then(loadDefault)
  ),
  '@components/features/wb/TNVEDValidator': dynamic(() =>
    import('@/components/features/wb/TNVEDValidator').then(loadDefault)
  ),
  '@components/features/wb/SplitCalculator': dynamic(() =>
    import('@/components/features/wb/SplitCalculator').then(loadDefault)
  ),
  '@components/features/wb/EcoFeeCalculator': dynamic(() =>
    import('@/components/features/wb/EcoFeeCalculator').then(loadDefault)
  ),
  '@components/features/wb/MarkingCodeValidator': dynamic(() =>
    import('@/components/features/wb/MarkingCodeValidator').then(loadDefault)
  ),
   '@components/features/wb/FsznBgsCalculator': dynamic(() =>
    import('@/components/features/wb/FsznBgsCalculator').then(loadDefault)
  ),
'@components/features/wb/PvzReturnAnalyzer': dynamic(() =>
     import('@/components/features/wb/PvzReturnAnalyzer').then(loadDefault)
   ),
  '@components/features/wb/PvzBreakEvenCalculator': dynamic(() =>
    import('@/components/features/wb/PvzBreakEvenCalculator').then(loadDefault)
  ),
  '@components/features/wb/DiscrepancyAct': dynamic(() =>
    import('@/components/features/wb/DiscrepancyAct').then(loadDefault)
  ),
  '@components/features/wb/LegalNavigator': dynamic(() =>
    import('@/components/features/wb/LegalNavigator').then(loadDefault)
  ),

  /* ═══════════════════════════════════════════════════════════════════════
     Раздел «Строительный» (/const).

     Код каждого калькулятора лежит в своём модуле и грузится отдельным чанком
     только в момент клика по пункту меню. Каркас и сайдбар при этом уже
     в памяти: пользователь видит меню и сразу переключает инструменты,
     не дожидаясь загрузки расчётной части.
     ═══════════════════════════════════════════════════════════════════════ */
  '@components/features/const/ConstructionSimulator': dynamic(() =>
    import('@/components/features/const/ConstructionSimulator').then(loadDefault)
  ),
  '@components/features/const/FoundationCalculator': dynamic(() =>
    import('@/components/features/const/FoundationCalculator').then(loadDefault)
  ),
  '@components/features/const/RebarCalculator': dynamic(() =>
    import('@/components/features/const/RebarCalculator').then(loadDefault)
  ),
  '@components/features/const/BlocksCalculator': dynamic(() =>
    import('@/components/features/const/BlocksCalculator').then(loadDefault)
  ),
  '@components/features/const/RoofCalculator': dynamic(() =>
    import('@/components/features/const/RoofCalculator').then(loadDefault)
  ),
  '@components/features/const/PlasterCalculator': dynamic(() =>
    import('@/components/features/const/PlasterCalculator').then(loadDefault)
  ),
  '@components/features/const/ScreedCalculator': dynamic(() =>
    import('@/components/features/const/ScreedCalculator').then(loadDefault)
  ),

  /* ═══════════════════════════════════════════════════════════════════════
     Раздел «Каркасные дома» (/frame).

     Конструктор один и он большой: внутри четыре шага, SVG-схема с
     drag-and-drop и генератор ТЗ. Он вынесен в отдельный чанк целиком —
     на мобильном интернете пользователь не должен платить за загрузку всего
     конструктора, пока не открыл раздел.
     ═══════════════════════════════════════════════════════════════════════ */
  '@components/frame/FrameConstructor': dynamic(() =>
    import('@/components/frame/FrameConstructor').then(loadDefault)
  ),
};

/**
 * Normalize a componentPath from the feature config into a registry key.
 * Strips the @/ prefix so '@components/features/wb/Calculator' matches.
 */
export function resolveComponentPath(componentPath: string): string {
  return componentPath.replace(/^@\/?/, '@');
}

export function getFeatureComponent(
  componentPath: string
): FeatureComponent | undefined {
  const key = resolveComponentPath(componentPath);
  return COMPONENT_REGISTRY[key];
}
