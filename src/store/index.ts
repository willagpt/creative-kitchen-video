import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Clip, FilterState, ViewMode, SortField, SortDirection, Workspace } from '@/types';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AppState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;
  signOut: () => void;

  // Workspace
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;

  // Clips
  clips: Clip[];
  setClips: (clips: Clip[]) => void;
  updateClip: (id: number, updates: Partial<Clip>) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;

  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortDirection: SortDirection;
  setSortDirection: (dir: SortDirection) => void;
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Selection
  selectedClips: Set<number>;
  toggleSelectClip: (id: number) => void;
  selectAllVisible: (ids: number[]) => void;
  clearSelection: () => void;

  // Active tab
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Thumbnail map (filename -> drive file id for thumbnails)
  thumbnailMap: Map<string, string>;
  setThumbnailMap: (map: Map<string, string>) => void;

  // Video file map (clip basename -> drive file id for video playback)
  videoFileMap: Map<string, string>;
  setVideoFileMap: (map: Map<string, string>) => void;

  // Local file map (clip basename -> blob URL for local playback)
  localFileMap: Map<string, string>;
  setLocalFileMap: (map: Map<string, string>) => void;

  // Header filters
  showCuratedOnly: boolean;
  setShowCuratedOnly: (show: boolean) => void;
  showGradedOnly: boolean;
  setShowGradedOnly: (show: boolean) => void;
  showMusic: boolean;
  setShowMusic: (show: boolean) => void;
  columnCount: number;
  setColumnCount: (count: number) => void;

  // Clip operations
  fetchClips: (workspaceId: string) => Promise<void>;
  deleteClips: (ids: number[]) => Promise<void>;
  archiveClips: (ids: number[]) => Promise<void>;

  // Performance feedback for re-iteration
  reiterateContext: {
    adName: string;
    originalRoas: number;
    status: string;
    suggestions: string[];
  } | null;
  setReiterateContext: (ctx: {
    adName: string;
    originalRoas: number;
    status: string;
    suggestions: string[];
  } | null) => void;
}

const defaultFilters: FilterState = {
  search: '',
  category: '',
  type: '',
  subType: '',
  approved: 'all',
  ratio: '',
};

export const useStore = create<AppState>()(persist((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  signOut: () => set({
    user: null,
    workspace: null,
    clips: [],
  }),

  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),

  clips: [],
  setClips: (clips) => set({ clips }),
  updateClip: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  loading: false,
  setLoading: (loading) => set({ loading }),

  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),
  sortField: 'name',
  setSortField: (sortField) => set({ sortField }),
  sortDirection: 'asc',
  setSortDirection: (sortDirection) => set({ sortDirection }),
  filters: { ...defaultFilters },
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  selectedClips: new Set(),
  toggleSelectClip: (id) =>
    set((state) => {
      const next = new Set(state.selectedClips);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedClips: next };
    }),
  selectAllVisible: (ids) => set({ selectedClips: new Set(ids) }),
  clearSelection: () => set({ selectedClips: new Set() }),

  activeTab: 'shots',
  setActiveTab: (activeTab) => set({ activeTab }),

  thumbnailMap: new Map(),
  setThumbnailMap: (thumbnailMap) => set({ thumbnailMap }),
  videoFileMap: new Map(),
  setVideoFileMap: (videoFileMap) => set({ videoFileMap }),
  localFileMap: new Map(),
  setLocalFileMap: (localFileMap) => set({ localFileMap }),

  showCuratedOnly: false,
  setShowCuratedOnly: (showCuratedOnly) => set({ showCuratedOnly }),
  showGradedOnly: false,
  setShowGradedOnly: (showGradedOnly) => set({ showGradedOnly }),
  showMusic: false,
  setShowMusic: (showMusic) => set({ showMusic }),
  columnCount: 7,
  setColumnCount: (columnCount) => set({ columnCount }),

  fetchClips: async (workspaceId: string) => {
    set((state) => ({ ...state, loading: true }));
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name', { ascending: true });

      if (error) throw error;
      // Deduplicate: exact name match first, then normalize to catch " copy", "(copy)" variants
      const seen = new Map<string, Clip>();
      for (const clip of (data as Clip[]) || []) {
        // Normalize: strip " copy", " (copy)", trailing " food porn", " food", extra whitespace
        const normName = clip.name
          .replace(/\s*\(copy\)\s*/gi, '')
          .replace(/\s+copy\s*/gi, '')
          .trim();
        const existing = seen.get(normName);
        if (!existing || (clip.id > existing.id)) {
          seen.set(normName, clip);
        }
      }
      set({ clips: Array.from(seen.values()), loading: false });
    } catch (err) {
      console.error('Failed to fetch clips:', err);
      set({ loading: false });
    }
  },

  deleteClips: async (ids: number[]) => {
    try {
      const { error } = await supabase
        .from('clips')
        .delete()
        .in('id', ids);
      if (error) throw error;
      set((state) => ({
        clips: state.clips.filter((c) => !ids.includes(c.id)),
        selectedClips: new Set(),
      }));
    } catch (err) {
      console.error('Failed to delete clips:', err);
    }
  },

  archiveClips: async (ids: number[]) => {
    try {
      const { error } = await supabase
        .from('clips')
        .update({ archived: true })
        .in('id', ids);
      if (error) throw error;
      set((state) => ({
        clips: state.clips.map((c) =>
          ids.includes(c.id) ? { ...c, archived: true } : c
        ),
        selectedClips: new Set(),
      }));
    } catch (err) {
      console.error('Failed to archive clips:', err);
    }
  },

  reiterateContext: null,
  setReiterateContext: (reiterateContext) => set({ reiterateContext }),
}), {
  name: 'ck-video-store',
  partialize: (state) => ({
    workspace: state.workspace,
    clips: state.clips,
    activeTab: state.activeTab,
  }),
}));
