/**
 * Core types for the section-based messenger architecture
 * Each section (e.g., /wb, /ozon) has its own set of features
 */

export interface Feature {
  /** Unique identifier for the feature */
  id: string;
  /** Display name in the sidebar */
  label: string;
  /** Lucide icon name (as string) */
  icon: string;
  /** Short description for tooltip */
  description?: string;
  /** Feature component path for lazy loading */
  componentPath: string;
  /** Optional: required permissions/roles */
  permissions?: string[];
  /** Optional: badge count (e.g., notifications) */
  badge?: number | string;
  /** Optional: keyboard shortcut */
  shortcut?: string;
  /** Optional: feature group for organization */
  group?: string;
  /** Whether feature is enabled */
  enabled?: boolean;
}

export interface FeatureGroup {
  id: string;
  label: string;
  features: Feature[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export interface SectionConfig {
  /** Section identifier (e.g., 'wb', 'ozon') */
  id: string;
  /** Display name */
  label: string;
  /** Section icon */
  icon: string;
  /** Section color theme */
  color: string;
  /** Feature groups for this section */
  featureGroups: FeatureGroup[];
  /** Default feature to show on entry */
  defaultFeature?: string;
  /** Section description for SEO */
  description?: string;
}

export interface SectionState {
  /** Current active section */
  currentSection: string | null;
  /** Current active feature within section */
  currentFeature: string | null;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Feature groups collapsed state */
  collapsedGroups: Record<string, boolean>;
  /** Recent features for quick access */
  recentFeatures: string[];
}

export interface SectionActions {
  setCurrentSection: (sectionId: string) => void;
  setCurrentFeature: (featureId: string) => void;
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
  addRecentFeature: (featureId: string) => void;
  reset: () => void;
}

export type SectionStore = SectionState & SectionActions;
