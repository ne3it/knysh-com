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
