'use client';

import { create } from 'zustand';
import type {
  Project, CharacterBrief, PromptRevision, CandidateImage,
  BaseCharacter, VariantPrompt,
} from '@/types';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function jsonPatch(body: unknown): RequestInit {
  return { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

interface AppState {
  // Data
  projects: Project[];
  currentProject: Project | null;
  brief: CharacterBrief | null;
  revisions: PromptRevision[];
  candidates: CandidateImage[];
  baseCharacter: (BaseCharacter & { candidate?: CandidateImage }) | null;
  variants: VariantPrompt[];
  aiConfigured: boolean;
  loading: boolean;
  error: string | null;

  // Project CRUD
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string, mode?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  fetchProject: (id: string) => Promise<void>;

  // Brief
  fetchBrief: (pid: string) => Promise<void>;
  saveBrief: (pid: string, data: Partial<CharacterBrief>) => Promise<void>;

  // AI
  checkAI: () => Promise<void>;
  structureBrief: (naturalInput: string) => Promise<Record<string, string>>;
  aiGenerate: (pid: string) => Promise<PromptRevision>;
  aiRevise: (pid: string, feedback: string) => Promise<PromptRevision>;
  aiTwenty: (pid: string) => Promise<void>;

  // Revisions
  fetchRevisions: (pid: string) => Promise<void>;

  // Candidates
  fetchCandidates: (pid: string) => Promise<void>;
  addCandidate: (pid: string, revisionId: string, imagePath?: string) => Promise<CandidateImage>;
  updateCandidate: (pid: string, cid: string, data: Partial<CandidateImage>) => Promise<void>;
  deleteCandidate: (pid: string, cid: string) => Promise<void>;

  // Base
  fetchBase: (pid: string) => Promise<void>;
  setBase: (pid: string, candidateId: string, summary?: string) => Promise<void>;

  // Variants
  fetchVariants: (pid: string) => Promise<void>;
  updateVariant: (pid: string, vid: string, data: Partial<VariantPrompt>) => Promise<void>;

  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  currentProject: null,
  brief: null,
  revisions: [],
  candidates: [],
  baseCharacter: null,
  variants: [],
  aiConfigured: false,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true });
    const projects = await api<Project[]>('/api/projects');
    set({ projects, loading: false });
  },
  createProject: async (name, description, mode) => {
    const project = await api<Project>('/api/projects', jsonPost({ name, description, mode: mode || 'midjourney_manual' }));
    set(s => ({ projects: [project, ...s.projects] }));
    return project;
  },
  deleteProject: async (id) => {
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }));
  },
  fetchProject: async (id) => {
    const project = await api<Project>(`/api/projects/${id}`);
    set({ currentProject: project });
  },

  fetchBrief: async (pid) => {
    const brief = await api<CharacterBrief | null>(`/api/projects/${pid}/brief`);
    set({ brief });
  },
  saveBrief: async (pid, data) => {
    const brief = await api<CharacterBrief>(`/api/projects/${pid}/brief`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    set({ brief });
  },

  checkAI: async () => {
    try {
      const r = await api<{ configured: boolean }>('/api/ai', jsonPost({ action: 'check' }));
      set({ aiConfigured: r.configured });
    } catch { set({ aiConfigured: false }); }
  },
  structureBrief: async (naturalInput) => {
    set({ loading: true, error: null });
    try {
      const data = await api<Record<string, string>>('/api/ai', jsonPost({ action: 'structure', naturalInput }));
      set({ loading: false });
      return data;
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },
  aiGenerate: async (pid) => {
    set({ loading: true, error: null });
    try {
      const data = await api<PromptRevision & { usedFallback?: boolean }>('/api/ai', jsonPost({ action: 'generate', projectId: pid }));
      set(s => ({ revisions: [...s.revisions, data], loading: false }));
      return data;
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },
  aiRevise: async (pid, feedback) => {
    set({ loading: true, error: null });
    try {
      const data = await api<PromptRevision & { usedFallback?: boolean }>('/api/ai', jsonPost({ action: 'revise', projectId: pid, feedback }));
      set(s => ({ revisions: [...s.revisions, data], loading: false }));
      return data;
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },
  aiTwenty: async (pid) => {
    set({ loading: true, error: null });
    try {
      const data = await api<{ variants: VariantPrompt[]; usedFallback?: boolean }>('/api/ai', jsonPost({ action: 'twenty', projectId: pid }));
      set({ variants: data.variants || data as unknown as VariantPrompt[], loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  fetchRevisions: async (pid) => {
    const revisions = await api<PromptRevision[]>(`/api/projects/${pid}/revisions`);
    set({ revisions });
  },

  fetchCandidates: async (pid) => {
    const candidates = await api<CandidateImage[]>(`/api/projects/${pid}/candidates`);
    set({ candidates });
  },
  addCandidate: async (pid, revisionId, imagePath) => {
    const c = await api<CandidateImage>(`/api/projects/${pid}/candidates`, jsonPost({
      revision_id: revisionId,
      ...(imagePath ? { image_path: imagePath } : {}),
    }));
    set(s => ({ candidates: [c, ...s.candidates] }));
    return c;
  },
  updateCandidate: async (pid, cid, data) => {
    const c = await api<CandidateImage>(`/api/projects/${pid}/candidates/${cid}`, jsonPatch(data));
    set(s => ({ candidates: s.candidates.map(x => x.id === cid ? c : x) }));
  },
  deleteCandidate: async (pid, cid) => {
    await api(`/api/projects/${pid}/candidates/${cid}`, { method: 'DELETE' });
    set(s => ({ candidates: s.candidates.filter(x => x.id !== cid) }));
  },

  fetchBase: async (pid) => {
    const base = await api<(BaseCharacter & { candidate?: CandidateImage }) | null>(`/api/projects/${pid}/base`);
    set({ baseCharacter: base });
  },
  setBase: async (pid, candidateId, summary) => {
    set({ loading: true });
    await api(`/api/projects/${pid}/base`, jsonPost({ candidate_id: candidateId, summary }));
    set({ loading: false });
    await get().fetchBase(pid);
    await get().fetchCandidates(pid);
  },

  fetchVariants: async (pid) => {
    const variants = await api<VariantPrompt[]>(`/api/projects/${pid}/variants`);
    set({ variants });
  },
  updateVariant: async (pid, vid, data) => {
    const v = await api<VariantPrompt>(`/api/projects/${pid}/variants/${vid}`, jsonPatch(data));
    set(s => ({ variants: s.variants.map(x => x.id === vid ? v : x) }));
  },

  clearError: () => set({ error: null }),
}));
