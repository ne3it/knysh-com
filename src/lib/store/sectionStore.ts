import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SectionStore } from '@/types/section';

const INITIAL_STATE = {
  currentSection: null,
  currentFeature: null,
  sidebarCollapsed: false,
  collapsedGroups: {},
  recentFeatures: [],
};

export const useSectionStore = create<SectionStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setCurrentSection: (sectionId: string) => {
        set((state) => ({
          currentSection: sectionId,
          currentFeature: null,
        }));
      },

      setCurrentFeature: (featureId: string) => {
        set((state) => ({ currentFeature: featureId }));
        get().addRecentFeature(featureId);
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      toggleGroup: (groupId: string) => {
        set((state) => ({
          collapsedGroups: {
            ...state.collapsedGroups,
            [groupId]: !state.collapsedGroups[groupId],
          },
        }));
      },

      addRecentFeature: (featureId: string) => {
        set((state) => {
          const filtered = state.recentFeatures.filter((id) => id !== featureId);
          return {
            recentFeatures: [featureId, ...filtered].slice(0, 5),
          };
        });
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'knysh-section-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedGroups: state.collapsedGroups,
        recentFeatures: state.recentFeatures,
        currentSection: state.currentSection,
        currentFeature: state.currentFeature,
      }),
    }
  )
);

/**
 * Selector hooks for granular subscriptions (prevents unnecessary re-renders)
 */
export const useCurrentSection = () => useSectionStore((state) => state.currentSection);
export const useCurrentFeature = () => useSectionStore((state) => state.currentFeature);
export const useSidebarCollapsed = () => useSectionStore((state) => state.sidebarCollapsed);
export const useCollapsedGroups = () => useSectionStore((state) => state.collapsedGroups);
export const useRecentFeatures = () => useSectionStore((state) => state.recentFeatures);
export const useSectionActions = () => useSectionStore((state) => ({
  setCurrentSection: state.setCurrentSection,
  setCurrentFeature: state.setCurrentFeature,
  toggleSidebar: state.toggleSidebar,
  toggleGroup: state.toggleGroup,
  addRecentFeature: state.addRecentFeature,
  reset: state.reset,
}));
