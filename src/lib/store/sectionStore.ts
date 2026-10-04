import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SectionStore } from '@/types/section';

const INITIAL_STATE = {
  currentSection: null as string | null,
  currentBlock: null as string | null,
  activeTabs: {} as Record<string, string>,
  sidebarCollapsed: false,
  collapsedGroups: {},
  recentFeatures: [] as string[],
};

export const useSectionStore = create<SectionStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setCurrentSection: (sectionId: string) => {
        set((state) =>
          state.currentSection === sectionId
            ? state
            : { currentSection: sectionId, currentBlock: null, activeTabs: {} }
        );
      },

      setCurrentBlock: (blockId: string) => {
        set({ currentBlock: blockId });
        get().addRecentFeature(blockId);
      },

      setActiveTab: (blockId: string, tabId: string) => {
        set((state) => ({ activeTabs: { ...state.activeTabs, [blockId]: tabId } }));
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

      addRecentFeature: (blockId: string) => {
        set((state) => {
          const filtered = state.recentFeatures.filter((id) => id !== blockId);
          return {
            recentFeatures: [blockId, ...filtered].slice(0, 5),
          };
        });
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'knysh-section-store',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedGroups: state.collapsedGroups,
        recentFeatures: state.recentFeatures,
        currentSection: state.currentSection,
        currentBlock: state.currentBlock,
        activeTabs: state.activeTabs,
      }),
      /**
       * Миграция со старой схемы (currentFeature без блоков): старый ключ игнорируем,
       * активный блок выставляется заново в SectionLayout.
       */
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        return {
          sidebarCollapsed: Boolean(state.sidebarCollapsed),
          collapsedGroups: (state.collapsedGroups as Record<string, boolean>) ?? {},
          recentFeatures: Array.isArray(state.recentFeatures)
            ? (state.recentFeatures as string[])
            : [],
          currentSection: (state.currentSection as string) ?? null,
          currentBlock: (state.currentBlock as string) ?? null,
          activeTabs: (state.activeTabs as Record<string, string>) ?? {},
        };
      },
    }
  )
);

/**
 * Selector hooks for granular subscriptions (prevents unnecessary re-renders)
 */
export const useCurrentSection = () => useSectionStore((state) => state.currentSection);
export const useCurrentBlock = () => useSectionStore((state) => state.currentBlock);
export const useActiveTabs = () => useSectionStore((state) => state.activeTabs);
export const useSidebarCollapsed = () => useSectionStore((state) => state.sidebarCollapsed);
export const useCollapsedGroups = () => useSectionStore((state) => state.collapsedGroups);
export const useRecentFeatures = () => useSectionStore((state) => state.recentFeatures);
export const useSectionActions = () =>
  useSectionStore((state) => ({
    setCurrentSection: state.setCurrentSection,
    setCurrentBlock: state.setCurrentBlock,
    setActiveTab: state.setActiveTab,
    toggleSidebar: state.toggleSidebar,
    toggleGroup: state.toggleGroup,
    addRecentFeature: state.addRecentFeature,
    reset: state.reset,
  }));