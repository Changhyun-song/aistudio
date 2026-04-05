'use client';

import { create } from 'zustand';
import type { CharacterizerConfig, CharacterizerAnchor, CharacterizerShot, SelectionState } from '@/types';

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

interface CharacterizerState {
  config: CharacterizerConfig | null;
  anchors: CharacterizerAnchor[];
  shots: CharacterizerShot[];
  geminiConfigured: boolean;
  loading: boolean;
  generatingShots: boolean;
  error: string | null;

  fetchConfig: (pid: string) => Promise<void>;
  saveConfig: (pid: string, data: Partial<CharacterizerConfig>) => Promise<void>;
  generateAnchors: (pid: string) => Promise<void>;
  generateAllShots: (pid: string) => Promise<void>;
  regenerateShot: (pid: string, shotId: string) => Promise<void>;
  fetchShots: (pid: string) => Promise<void>;
  updateShotSelection: (pid: string, shotId: string, state: SelectionState) => Promise<void>;
  clearError: () => void;
}

export const useCharacterizerStore = create<CharacterizerState>((set) => ({
  config: null,
  anchors: [],
  shots: [],
  geminiConfigured: false,
  loading: false,
  generatingShots: false,
  error: null,

  fetchConfig: async (pid) => {
    set({ loading: true, error: null });
    try {
      const data = await api<{ config: CharacterizerConfig | null; anchors: CharacterizerAnchor[]; geminiConfigured: boolean }>(
        `/api/projects/${pid}/characterizer`
      );
      set({ config: data.config, anchors: data.anchors, geminiConfigured: data.geminiConfigured, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  saveConfig: async (pid, data) => {
    set({ loading: true, error: null });
    try {
      const config = await api<CharacterizerConfig>(`/api/projects/${pid}/characterizer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      set({ config, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  generateAnchors: async (pid) => {
    set({ loading: true, error: null });
    try {
      const data = await api<{ anchors: CharacterizerAnchor[] }>(
        `/api/projects/${pid}/characterizer`,
        jsonPost({ action: 'generate_anchors' })
      );
      set({ anchors: data.anchors, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  generateAllShots: async (pid) => {
    set({ generatingShots: true, error: null });
    try {
      const data = await api<{ shots: CharacterizerShot[] }>(
        `/api/projects/${pid}/characterizer/generate`,
        jsonPost({ action: 'generate_all' })
      );
      set({ shots: data.shots, generatingShots: false });
    } catch (e) {
      set({ generatingShots: false, error: (e as Error).message });
    }
  },

  regenerateShot: async (pid, shotId) => {
    set({ error: null });
    try {
      set(s => ({ shots: s.shots.map(sh => sh.id === shotId ? { ...sh, status: 'generating' as const } : sh) }));
      const updated = await api<CharacterizerShot>(
        `/api/projects/${pid}/characterizer/generate`,
        jsonPost({ action: 'regenerate_shot', shotId })
      );
      set(s => ({ shots: s.shots.map(sh => sh.id === shotId ? updated : sh) }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchShots: async (pid) => {
    const shots = await api<CharacterizerShot[]>(`/api/projects/${pid}/characterizer/shots`);
    set({ shots });
  },

  updateShotSelection: async (pid, shotId, state) => {
    const updated = await api<CharacterizerShot>(
      `/api/projects/${pid}/characterizer/shots/${shotId}`,
      jsonPatch({ selection_state: state })
    );
    set(s => ({ shots: s.shots.map(sh => sh.id === shotId ? updated : sh) }));
  },

  clearError: () => set({ error: null }),
}));
