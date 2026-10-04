'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFeature, getIconComponent } from '@/config/features';
import { useCurrentBlock } from '@/lib/store/sectionStore';
import { getFeatureComponent } from '@/lib/services/componentRegistry';
import type { Feature } from '@/types/section';

/**
 * Feature Loader Component
 * Handles lazy loading with loading/error/empty states
 */
interface FeatureLoaderProps {
  sectionId: string;
  featureId: string | null;
}

export function FeatureLoader({ sectionId, featureId }: FeatureLoaderProps) {
  const [Component, setComponent] = useState<React.ComponentType<{ feature: Feature }> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (!featureId) {
      setComponent(null);
      setFeature(null);
      setError(null);
      return;
    }

    const foundFeature = getFeature(sectionId, featureId);
    if (!foundFeature) {
      setError(new Error(`Feature "${featureId}" not found in section "${sectionId}"`));
      return;
    }

    setFeature(foundFeature);
    setError(null);

    // Look up the dynamically-importable component via the registry.
    // Using next/dynamic inside the registry ensures the @/ path alias
    // is resolved correctly at build time (raw import() with a runtime
    // variable cannot resolve path aliases).
    let cancelled = false;
    const loadComponent = async () => {
      try {
        const DynamicComponent = getFeatureComponent(foundFeature.componentPath);
        if (!DynamicComponent) {
          throw new Error(
            `Component not registered for path: ${foundFeature.componentPath}`
          );
        }
        if (cancelled) return;
        setComponent(() => DynamicComponent);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load feature:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };

    loadComponent();

    return () => {
      cancelled = true;
    };
  }, [sectionId, featureId]);

  // Loading state
  if (!featureId || !feature) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center p-8">
          <FileQuestion className="w-12 h-12 text-neutral-300 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Выберите функцию</h3>
          <p className="text-neutral-500">Нажмите на пункт в боковом меню для начала работы</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">Ошибка загрузки</h3>
          <p className="text-neutral-500 mb-4">Не удалось загрузить компонент &quot;{feature.label}&quot;</p>
          <pre className="text-xs text-neutral-400 bg-neutral-100 p-4 rounded text-left overflow-auto max-h-40">
            {error.message}
          </pre>
        </div>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-neutral-500">Загрузка &quot;{feature.label}&quot;...</p>
        </div>
      </div>
    );
  }

  return <Component feature={feature} />;
}

/**
 * Section Content Wrapper
 * Provides consistent layout for feature content
 */
interface SectionContentWrapperProps {
  children: React.ReactNode;
  feature: Feature;
}

export function SectionContentWrapper({ children, feature }: SectionContentWrapperProps) {
  const IconComponent = getIconComponent(feature.icon);

  return (
    <div className="flex h-full flex-col bg-white animate-fade-in">
      {/* Feature Header */}
      <header className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 rounded-xl bg-[var(--primary)]/10">
            <IconComponent className="w-6 h-6 text-[var(--primary)]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl font-semibold text-neutral-900 truncate">{feature.label}</h2>
            {feature.description && (
              <p className="text-xs sm:text-sm text-neutral-500 truncate">{feature.description}</p>
            )}
          </div>
        </div>
      </header>

      {/* Feature Content */}
      <main className="flex-1 min-w-0 w-full overflow-x-hidden p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

/**
 * Main Section Content Component
 * Orchestrates the feature loading and rendering
 */
export function SectionContent({ sectionId }: { sectionId: string }) {
  const currentBlock = useCurrentBlock();
  return <FeatureLoader sectionId={sectionId} featureId={currentBlock} />;
}

