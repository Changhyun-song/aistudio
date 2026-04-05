import { create } from 'zustand';
import type { ReferenceSource, ReferenceAnalysis, ReferenceSynthesis } from '@/types';

interface ReferenceState {
  projectId: string;
  sources: ReferenceSource[];
  analyses: Record<string, ReferenceAnalysis>;
  synthesis: ReferenceSynthesis | null;
  loading: boolean;
  analyzing: string | null;
  synthesizing: boolean;
  sending: boolean;
  error: string | null;

  setProject: (pid: string) => void;
  fetchSources: () => Promise<void>;
  addSource: (data: Record<string, unknown>) => Promise<ReferenceSource>;
  uploadFile: (file: File, title: string, tags: string[], note: string) => Promise<ReferenceSource>;
  updateSource: (sourceId: string, data: Record<string, unknown>) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  analyzeSource: (sourceId: string) => Promise<void>;
  analyzeAll: () => Promise<void>;
  fetchSourceDetail: (sourceId: string) => Promise<void>;
  fetchSynthesis: () => Promise<void>;
  generateSynthesis: (sourceIds?: string[], userGoal?: string) => Promise<void>;
  sendToStudio: (mode: string) => Promise<{ inspirationText: string }>;
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  projectId: '',
  sources: [],
  analyses: {},
  synthesis: null,
  loading: false,
  analyzing: null,
  synthesizing: false,
  sending: false,
  error: null,

  setProject: (pid) => set({ projectId: pid, sources: [], analyses: {}, synthesis: null }),

  fetchSources: async () => {
    const { projectId } = get();
    if (!projectId) return;
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/projects/${projectId}/story/references`);
      const data = await res.json();
      set({ sources: data, loading: false });
    } catch (err) {
      set({ loading: false, error: 'Failed to fetch sources' });
    }
  },

  addSource: async (data) => {
    const { projectId } = get();
    const res = await fetch(`/api/projects/${projectId}/story/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const source = await res.json();
    set(s => ({ sources: [source, ...s.sources] }));
    return source;
  },

  uploadFile: async (file, title, tags, note) => {
    const { projectId } = get();
    const form = new FormData();
    form.append('file', file);
    form.append('title', title || file.name);
    form.append('tags_json', JSON.stringify(tags));
    form.append('user_note', note);
    const res = await fetch(`/api/projects/${projectId}/story/references/upload`, { method: 'POST', body: form });
    const source = await res.json();
    set(s => ({ sources: [source, ...s.sources] }));
    return source;
  },

  updateSource: async (sourceId, data) => {
    const { projectId } = get();
    await fetch(`/api/projects/${projectId}/story/references/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    get().fetchSources();
  },

  deleteSource: async (sourceId) => {
    const { projectId } = get();
    await fetch(`/api/projects/${projectId}/story/references/${sourceId}`, { method: 'DELETE' });
    set(s => ({
      sources: s.sources.filter(x => x.id !== sourceId),
      analyses: (() => { const a = { ...s.analyses }; delete a[sourceId]; return a; })(),
    }));
  },

  analyzeSource: async (sourceId) => {
    const { projectId } = get();
    set({ analyzing: sourceId, error: null });
    try {
      const res = await fetch(`/api/projects/${projectId}/story/references/${sourceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const analysis = await res.json();
      if (analysis.error) throw new Error(analysis.error);
      set(s => ({ analyses: { ...s.analyses, [sourceId]: analysis }, analyzing: null }));
    } catch (err: unknown) {
      set({ analyzing: null, error: err instanceof Error ? err.message : 'Analysis failed' });
    }
  },

  analyzeAll: async () => {
    const { sources, analyzeSource } = get();
    for (const s of sources) {
      await analyzeSource(s.id);
    }
  },

  fetchSourceDetail: async (sourceId) => {
    const { projectId } = get();
    const res = await fetch(`/api/projects/${projectId}/story/references/${sourceId}`);
    const { analysis } = await res.json();
    if (analysis) set(s => ({ analyses: { ...s.analyses, [sourceId]: analysis } }));
  },

  fetchSynthesis: async () => {
    const { projectId } = get();
    const res = await fetch(`/api/projects/${projectId}/story/references/synthesize`);
    const data = await res.json();
    set({ synthesis: data });
  },

  generateSynthesis: async (sourceIds, userGoal) => {
    const { projectId } = get();
    set({ synthesizing: true, error: null });
    try {
      const res = await fetch(`/api/projects/${projectId}/story/references/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_ids: sourceIds || [], user_goal: userGoal || '' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set({ synthesis: data, synthesizing: false });
    } catch (err: unknown) {
      set({ synthesizing: false, error: err instanceof Error ? err.message : 'Synthesis failed' });
    }
  },

  sendToStudio: async (mode) => {
    const { projectId } = get();
    set({ sending: true, error: null });
    try {
      const res = await fetch(`/api/projects/${projectId}/story/references/send-to-studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set({ sending: false });
      return { inspirationText: data.inspirationText };
    } catch (err: unknown) {
      set({ sending: false, error: err instanceof Error ? err.message : 'Send failed' });
      throw err;
    }
  },
}));
