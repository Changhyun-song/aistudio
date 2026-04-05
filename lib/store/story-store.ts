'use client';
import { create } from 'zustand';
import type {
  StoryCharacter, StorySeriesBible, StoryEpisodeArc,
  StoryEpisodeScript, StoryClipPacket, StoryConcept, StoryBoundaryFrame,
} from '@/types';

export type EvalTaskType = 'concept' | 'bible' | 'season' | 'script' | 'clips';
export type PlannerAction = 'approve' | 'revise_partial' | 'revise_full' | 'ask_user';

export interface EvalCriterion {
  name: string;
  score: number;
  weight: number;
  reason: string;
  mustFix: boolean;
}

export interface EvalWeakness {
  issue: string;
  whyItMatters: string;
  fixDirection: string;
}

export interface EvalResult {
  taskType: string;
  overallScore: number;
  weightedScore: number;
  pass: boolean;
  criteria: EvalCriterion[];
  criticalIssues: string[];
  topStrengths: string[];
  topWeaknesses: EvalWeakness[];
  revisionBrief: string;
  finalVerdict: 'approve' | 'revise';
}

export interface RevisionTarget {
  target: string;
  problem: string;
  whyItMatters: string;
  priority: string;
  fixStrategy: string;
  expectedImpact: string;
}

export interface PlannerDecision {
  stage: string;
  goal: string;
  successContract: string[];
  currentVersion: string;
  evaluationSummary: string;
  decision: PlannerAction;
  replanReason: string;
  revisionTargets: RevisionTarget[];
  nextAction: string;
}

export interface PlannerInit {
  stage: string;
  goal: string;
  successContract: string[];
  generatorInstructions: string;
}

export interface PipelineLog {
  stage: string;
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error' | 'score';
}

export type PipelineStage = 'idle' | 'ai1_concept' | 'ai1_eval' | 'ai1_revise' | 'ai2_bible' | 'ai2_season' | 'ai2_eval' | 'ai2_revise' | 'ai2_scripts' | 'ai3_clips' | 'ai3_eval' | 'ai3_revise' | 'season_coherence' | 'complete' | 'failed';

interface StoryStudioState {
  characters: StoryCharacter[];
  concept: StoryConcept | null;
  bible: StorySeriesBible | null;
  episodes: StoryEpisodeArc[];
  currentEpisode: number;
  script: StoryEpisodeScript | null;
  clips: StoryClipPacket[];
  frames: StoryBoundaryFrame[];
  timeline: string;
  loading: boolean;
  generating: 'concept' | 'revise' | 'bible' | 'season' | 'script' | 'clips' | 'extract_chars' | null;
  error: string | null;

  evaluation: EvalResult | null;
  plannerInit: PlannerInit | null;
  plannerDecision: PlannerDecision | null;
  evaluating: boolean;
  planning: boolean;
  evalLoop: number;
  evalStrategies: string[];

  pipelineRunning: boolean;
  pipelineRunId: string | null;
  pipelineStage: PipelineStage;
  pipelineLogs: PipelineLog[];
  pipelineTargetScore: number;
  pipelineMaxRetries: number;
  pipelineAbort: boolean;
  pipelineAbortController: AbortController | null;

  fetchCharacters: (pid: string) => Promise<void>;
  addCharacter: (pid: string, data: Partial<StoryCharacter>) => Promise<void>;
  updateCharacter: (pid: string, cid: string, data: Partial<StoryCharacter>) => Promise<void>;
  deleteCharacter: (pid: string, cid: string) => Promise<void>;
  extractCharactersFromConcept: (pid: string) => Promise<void>;

  fetchConcept: (pid: string) => Promise<void>;
  generateConcept: (pid: string, data: Record<string, unknown>) => Promise<void>;
  reviseConcept: (pid: string, feedback: string) => Promise<void>;

  fetchBible: (pid: string) => Promise<void>;
  generateBible: (pid: string, data: Record<string, string>) => Promise<void>;

  fetchSeason: (pid: string) => Promise<void>;
  generateSeason: (pid: string) => Promise<void>;

  setCurrentEpisode: (n: number) => void;
  fetchScript: (pid: string, epNum: number) => Promise<void>;
  generateScript: (pid: string, epNum: number) => Promise<void>;

  fetchClipsAndFrames: (pid: string, epNum: number) => Promise<void>;
  generateClipsAndFrames: (pid: string, epNum: number, density: string, videoProvider?: string) => Promise<void>;

  runEvaluation: (pid: string, taskType: EvalTaskType, episodeNumber?: number) => Promise<void>;
  runPlannerInit: (pid: string, taskType: EvalTaskType, context: string) => Promise<void>;
  runPlannerInterpret: (pid: string, taskType: EvalTaskType) => Promise<void>;
  clearEvaluation: () => void;

  runFullPipeline: (pid: string, inputData: Record<string, unknown>, targetScore?: number, maxRetries?: number, videoProvider?: string) => Promise<void>;
  resumePipeline: (pid: string, targetScore?: number, maxRetries?: number, videoProvider?: string) => Promise<void>;
  stopPipeline: () => void;
  optimizeStagePrompt: (pid: string, stage: string, generatorOutput: string, evaluation: EvalResult, plannerFeedback: string) => Promise<boolean>;

  regenerateSeasonWithFeedback: (pid: string) => Promise<void>;
  regenerateScriptWithFeedback: (pid: string, epNum: number) => Promise<void>;
  regenerateClipsWithFeedback: (pid: string, epNum: number) => Promise<void>;
  runStagePipeline: (pid: string, stage: 'season' | 'script' | 'clips', epNum?: number, targetScore?: number, maxRetries?: number, videoProvider?: string) => Promise<void>;

  clearError: () => void;
}

export const useStoryStore = create<StoryStudioState>((set, get) => ({
  characters: [],
  concept: null,
  bible: null,
  episodes: [],
  currentEpisode: 1,
  script: null,
  clips: [],
  frames: [],
  timeline: '',
  loading: false,
  generating: null,
  error: null,

  evaluation: null,
  plannerInit: null,
  plannerDecision: null,
  evaluating: false,
  planning: false,
  evalLoop: 0,
  evalStrategies: [],

  pipelineRunning: false,
  pipelineRunId: null,
  pipelineStage: 'idle',
  pipelineLogs: [],
  pipelineTargetScore: 4.0,
  pipelineMaxRetries: 3,
  pipelineAbort: false,
  pipelineAbortController: null,

  clearError: () => set({ error: null }),
  clearEvaluation: () => set({ evaluation: null, plannerInit: null, plannerDecision: null, evalLoop: 0, evalStrategies: [] }),
  stopPipeline: () => {
    const ctrl = get().pipelineAbortController;
    if (ctrl) ctrl.abort();
    set({ pipelineAbort: true });
  },

  // ── Characters ────────────────────────────────────
  fetchCharacters: async (pid) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/characters`);
      const data = await res.json();
      set({ characters: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  addCharacter: async (pid, data) => {
    try {
      const res = await fetch(`/api/projects/${pid}/story/characters`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message }); }
  },
  updateCharacter: async (pid, cid, data) => {
    try {
      const res = await fetch(`/api/projects/${pid}/story/characters/${cid}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message }); }
  },
  deleteCharacter: async (pid, cid) => {
    try {
      await fetch(`/api/projects/${pid}/story/characters/${cid}`, { method: 'DELETE' });
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message }); }
  },

  // ── Concept (AI 1) ────────────────────────────────
  fetchConcept: async (pid) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/concept`);
      const data = await res.json();
      set({ concept: data, loading: false });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  generateConcept: async (pid, data) => {
    set({ generating: 'concept', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/concept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', ...data }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const result = await res.json();
      set({ concept: result, generating: null });
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },
  reviseConcept: async (pid, feedback) => {
    set({ generating: 'revise', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/concept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revise', feedback }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const result = await res.json();
      set({ concept: result, generating: null });
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },
  extractCharactersFromConcept: async (pid) => {
    set({ generating: 'extract_chars', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/concept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_characters' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      set({ generating: null });
      await get().fetchCharacters(pid);
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ── Bible ─────────────────────────────────────────
  fetchBible: async (pid) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/bible`);
      const data = await res.json();
      set({ bible: data, loading: false });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  generateBible: async (pid, formData) => {
    set({ generating: 'bible', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/bible`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      set({ bible: data, generating: null });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ── Season ────────────────────────────────────────
  fetchSeason: async (pid) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/season`);
      const data = await res.json();
      set({ episodes: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  generateSeason: async (pid) => {
    set({ generating: 'season', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/season`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      set({ episodes: Array.isArray(data) ? data : [], generating: null });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ── Script ────────────────────────────────────────
  setCurrentEpisode: (n) => set({ currentEpisode: n, script: null, clips: [], frames: [], timeline: '' }),
  fetchScript: async (pid, epNum) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}`);
      const data = await res.json();
      set({ script: data, loading: false });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  generateScript: async (pid, epNum) => {
    set({ generating: 'script', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/script`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      set({ script: data, generating: null });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ── Clips + Frames (AI 3) ────────────────────────
  fetchClipsAndFrames: async (pid, epNum) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/clips`);
      const data = await res.json();
      set({
        clips: Array.isArray(data.clips) ? data.clips : [],
        frames: Array.isArray(data.frames) ? data.frames : [],
        loading: false,
      });
    } catch (err) { set({ error: (err as Error).message, loading: false }); }
  },
  generateClipsAndFrames: async (pid, epNum, density, videoProvider) => {
    set({ generating: 'clips', error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/clips`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ density, videoProvider }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      set({
        clips: Array.isArray(data.clips) ? data.clips : [],
        frames: Array.isArray(data.frames) ? data.frames : [],
        timeline: data.timeline || '',
        generating: null,
      });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ── Evaluator ──────────────────────────────────────
  runEvaluation: async (pid, taskType, episodeNumber) => {
    set({ evaluating: true, error: null });
    try {
      const res = await fetch(`/api/projects/${pid}/story/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, episodeNumber }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Evaluation failed'); }
      const result = await res.json();
      set({ evaluation: result, evaluating: false });
    } catch (err) { set({ error: (err as Error).message, evaluating: false }); }
  },

  // ── Planner ────────────────────────────────────────
  runPlannerInit: async (pid, taskType, context) => {
    set({ planning: true, error: null, evalLoop: 0, evalStrategies: [] });
    try {
      const res = await fetch(`/api/projects/${pid}/story/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', taskType, projectContext: context }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Plan init failed'); }
      const result = await res.json();
      set({ plannerInit: result, planning: false });
    } catch (err) { set({ error: (err as Error).message, planning: false }); }
  },

  runPlannerInterpret: async (pid, taskType) => {
    const { evaluation, evalLoop, evalStrategies } = get();
    if (!evaluation) return;
    set({ planning: true, error: null });
    const newLoop = evalLoop + 1;
    try {
      const res = await fetch(`/api/projects/${pid}/story/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'interpret',
          taskType,
          evaluation,
          loop: newLoop,
          previousStrategies: evalStrategies,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Plan interpret failed'); }
      const result = await res.json();
      set({
        plannerDecision: result,
        planning: false,
        evalLoop: newLoop,
        evalStrategies: [...evalStrategies, result.decision || ''],
      });
    } catch (err) { set({ error: (err as Error).message, planning: false }); }
  },

  // ── Prompt Optimizer ──────────────────────────────────
  optimizeStagePrompt: async (pid, stage, generatorOutput, evaluation, plannerFeedback) => {
    try {
      const res = await fetch(`/api/projects/${pid}/story/optimize-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, generatorOutput, evaluation, plannerFeedback }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        console.error(`[Optimizer] Stage ${stage} failed:`, err);
        return false;
      }
      const result = await res.json();
      console.log(`[Optimizer] Stage ${stage} v${result.version || '?'} saved. Confidence: ${result.confidence || '?'}`);
      return true;
    } catch (err) {
      console.error(`[Optimizer] Stage ${stage} exception:`, err);
      return false;
    }
  },

  // ══════════════════════════════════════════════════════
  // Full Auto-Pipeline
  // ══════════════════════════════════════════════════════
  runFullPipeline: async (pid, inputData, targetScore = 4.0, maxRetries = 3, videoProvider = 'seedance_2_0') => {
    const abortCtrl = new AbortController();

    let _dbRunId: string | null = null;
    let _logFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let _logDirty = false;

    const flushLogsToDb = async () => {
      if (!_dbRunId || !_logDirty) return;
      _logDirty = false;
      try {
        await fetch(`/api/projects/${pid}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_logs', runId: _dbRunId, logs: get().pipelineLogs }),
        });
      } catch (e) {
        console.error('[Pipeline] flushLogsToDb failed:', (e as Error).message);
      }
    };

    const scheduleFlush = () => {
      _logDirty = true;
      if (_logFlushTimer) clearTimeout(_logFlushTimer);
      _logFlushTimer = setTimeout(flushLogsToDb, 3000);
    };

    const log = (stage: string, message: string, type: PipelineLog['type'] = 'info') => {
      set(s => ({ pipelineLogs: [...s.pipelineLogs, { stage, message, timestamp: Date.now(), type }] }));
      scheduleFlush();
    };

    const shouldAbort = () => {
      if (get().pipelineAbort) {
        abortCtrl.abort();
        return true;
      }
      return false;
    };

    const buildRevisionBrief = (ev: EvalResult, score: number, target: number): string => {
      const weaknesses = ev.topWeaknesses?.map((w: any) => {
        const issue = typeof w === 'string' ? w : w?.issue || JSON.stringify(w);
        const fix = typeof w === 'string' ? '' : w?.fixDirection || '';
        return fix ? `${issue} → ${fix}` : issue;
      }).join('\n') || '';

      const lowestCriteria = ev.criteria
        ?.slice().sort((a: any, b: any) => (a.score || 0) - (b.score || 0)).slice(0, 3)
        .map((c: any) => `[${c.score}/5] ${c.name}`).join(', ') || '';

      return [
        `★ 현재 점수: ${score.toFixed(1)}/5 | 목표: ${target}/5 | ${(target - score).toFixed(1)}점 부족`,
        lowestCriteria ? `★ 가장 낮은 항목: ${lowestCriteria}` : '',
        ev.revisionBrief || '',
        weaknesses ? `\n약점 상세:\n${weaknesses}` : '',
        `\n반드시 위 약점들을 직접 해결해서 점수를 ${target} 이상으로 올려라. 이전과 비슷한 수준으로 출력하면 실패다.`,
      ].filter(Boolean).join('\n');
    };

    const API_TIMEOUT_MS = 180_000; // 3 minutes per API call

    const apiPost = async (url: string, body?: Record<string, unknown>, retries = 1): Promise<any> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const timeoutCtrl = new AbortController();
        const timeoutId = setTimeout(() => timeoutCtrl.abort(), API_TIMEOUT_MS);

        const combinedSignal = abortCtrl.signal.aborted
          ? abortCtrl.signal
          : timeoutCtrl.signal;

        const onParentAbort = () => timeoutCtrl.abort();
        abortCtrl.signal.addEventListener('abort', onParentAbort, { once: true });

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: timeoutCtrl.signal,
          });
          clearTimeout(timeoutId);
          abortCtrl.signal.removeEventListener('abort', onParentAbort);

          if (!res.ok) {
            const e = await res.json().catch(() => ({ error: 'Unknown error' }));
            const detail = e.error || `Request failed`;
            throw new Error(`[HTTP ${res.status}] ${detail}`);
          }
          return await res.json();
        } catch (err) {
          clearTimeout(timeoutId);
          abortCtrl.signal.removeEventListener('abort', onParentAbort);

          if (abortCtrl.signal.aborted) throw err;

          const isTimeout = (err as Error).name === 'AbortError';
          const msg = isTimeout
            ? `API 타임아웃 (${API_TIMEOUT_MS / 1000}초 초과): ${url}`
            : (err as Error).message;

          if (attempt < retries) {
            log('재시도', `${msg} — ${attempt + 2}/${retries + 1} 시도 중... (${Math.round(API_TIMEOUT_MS / 1000)}초 후)`, 'warn');
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw new Error(msg);
        }
      }
      throw new Error('apiPost: unexpected exit');
    };

    const evaluate = async (taskType: EvalTaskType, epNum?: number): Promise<EvalResult> => {
      const res = await apiPost(`/api/projects/${pid}/story/evaluate`, { taskType, episodeNumber: epNum });
      return res as EvalResult;
    };

    const callPlanner = async (taskType: EvalTaskType, ev: EvalResult, attempt: number, strategies: string[]): Promise<{ decision: string; revisionTargets: any[]; replanReason: string; nextAction: string }> => {
      try {
        const res = await apiPost(`/api/projects/${pid}/story/plan`, {
          action: 'interpret',
          taskType,
          evaluation: ev,
          loop: attempt,
          previousStrategies: strategies,
        });
        return res;
      } catch {
        return { decision: 'revise_partial', revisionTargets: [], replanReason: '', nextAction: 'revise' };
      }
    };

    const buildPlannerRevisionBrief = (ev: EvalResult, plannerResult: any, score: number, target: number): string => {
      const parts: string[] = [];
      parts.push(`★ 현재 점수: ${score.toFixed(1)}/5 | 목표: ${target}/5 | ${(target - score).toFixed(1)}점 부족`);

      const lowestCriteria = ev.criteria
        ?.slice().sort((a: any, b: any) => (a.score || 0) - (b.score || 0)).slice(0, 3)
        .map((c: any) => `[${c.score}/5] ${c.name}`).join(', ') || '';
      if (lowestCriteria) parts.push(`★ 가장 낮은 항목: ${lowestCriteria}`);

      // Planner revision targets (structured feedback)
      if (plannerResult?.revisionTargets?.length) {
        parts.push('\n## Planner 수정 전략:');
        for (const rt of plannerResult.revisionTargets) {
          const target = typeof rt.target === 'string' ? rt.target : JSON.stringify(rt.target);
          const problem = typeof rt.problem === 'string' ? rt.problem : JSON.stringify(rt.problem);
          const fix = typeof rt.fixStrategy === 'string' ? rt.fixStrategy : JSON.stringify(rt.fixStrategy);
          parts.push(`- [${rt.priority || 'medium'}] ${target}: ${problem} → ${fix}`);
        }
      }

      if (ev.revisionBrief) {
        const brief = typeof ev.revisionBrief === 'string' ? ev.revisionBrief : JSON.stringify(ev.revisionBrief);
        parts.push(`\n## Evaluator 수정 지시:\n${brief}`);
      }

      const weaknesses = ev.topWeaknesses?.map((w: any) => {
        const issue = typeof w === 'string' ? w : w?.issue || JSON.stringify(w);
        const fix = typeof w === 'string' ? '' : w?.fixDirection || '';
        return fix ? `${issue} → ${fix}` : issue;
      }).join('\n') || '';
      if (weaknesses) parts.push(`\n약점 상세:\n${weaknesses}`);

      parts.push(`\n반드시 위 지시를 직접 해결해서 점수를 ${target} 이상으로 올려라.`);
      parts.push(`\n★ 절대 보호: AI 1 컨셉의 핵심 설정(세계관 규칙, 크리처 설정, 메인 캐릭터의 역할, 조연의 서사 기능, 사망 이벤트)은 변경하지 마라. 위 수정 지시는 이 핵심을 유지한 채 실행해라.`);

      const lowestCriterion = ev.criteria?.slice().sort((a: any, b: any) => (a.score || 0) - (b.score || 0))[0];
      if (lowestCriterion?.name === 'engine_variety') {
        parts.push(`
★ engine_variety 개선을 위한 참고 배치 안 (그대로 복사하지 말고 영감으로 활용):
1화: power_reveal + discovery_mission
2화: relationship_rupture + confrontation  
3화: mystery_escalation + investigation
4화: hidden_truth + infiltration
5화: false_victory + rescue_extraction
6화: irreversible_choice + defense_siege
7화: grief_fallout + regrouping
8화: betrayal_suspicion + chase_pursuit
9화: strategy_lock_in + countdown_crisis
10화: character_reveal + final_stand
핵심: 인접 화의 narrativeEngine과 actionFormat이 모두 달라야 함.`);
      }

      return parts.filter(Boolean).join('\n');
    };

    const passesThreshold = (ev: EvalResult): boolean => {
      const score = ev.weightedScore || ev.overallScore || 0;
      if (score >= targetScore) return true;
      if (score >= targetScore - 0.1 && ev.finalVerdict === 'approve') return true;
      return false;
    };

    const pipelineApi = async (action: string, extra: Record<string, unknown> = {}) => {
      try {
        const res = await fetch(`/api/projects/${pid}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra }),
        });
        if (!res.ok) console.error(`[Pipeline] pipelineApi(${action}) HTTP ${res.status}`);
      } catch (e) {
        console.error(`[Pipeline] pipelineApi(${action}) failed:`, (e as Error).message);
      }
    };

    try {
      const res = await fetch(`/api/projects/${pid}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', pipelineType: 'story_full', targetScore, maxRetries, currentStage: 'ai1_concept', currentStageLabel: 'AI 1: 스토리 컨셉' }),
      });
      const run = await res.json();
      _dbRunId = run.id || null;
      if (!_dbRunId) console.error('[Pipeline] Failed to create pipeline run — no ID returned');
    } catch (e) {
      console.error('[Pipeline] Failed to create pipeline run:', (e as Error).message);
    }

    const syncStage = (stage: string, label: string, pct: number) => {
      if (_dbRunId) pipelineApi('update_stage', { runId: _dbRunId, stage, stageLabel: label, progressPct: pct });
    };

    set({
      pipelineRunning: true,
      pipelineRunId: _dbRunId,
      pipelineStage: 'ai1_concept',
      pipelineLogs: [],
      pipelineAbort: false,
      pipelineAbortController: abortCtrl,
      pipelineTargetScore: targetScore,
      pipelineMaxRetries: maxRetries,
      error: null,
    });

    try {
      // ════════════ AI 1: Story Concept ════════════
      log('AI 1', '스토리 컨셉 생성 시작...', 'info');
      set({ pipelineStage: 'ai1_concept', generating: 'concept' });
      syncStage('ai1_concept', 'AI 1: 컨셉 생성', 5);
      const conceptResult = await apiPost(`/api/projects/${pid}/story/concept`, { action: 'generate', ...inputData });
      set({ concept: conceptResult, generating: null });
      log('AI 1', `컨셉 v${conceptResult.version} 생성 완료`, 'success');

      let prevScore = 0;
      let stagnantCount = 0;
      let bestScore = 0;
      const ai1Strategies: string[] = [];

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (shouldAbort()) throw new Error('Pipeline stopped by user');

        set({ pipelineStage: 'ai1_eval' });
        syncStage('ai1_eval', `AI 1: 컨셉 평가 (${attempt}/${maxRetries})`, 10 + attempt * 2);
        log('AI 1', `평가 ${attempt}/${maxRetries} 실행 중...`, 'info');
        const ev = await evaluate('concept');
        set({ evaluation: ev });
        const score = ev.weightedScore || ev.overallScore || 0;
        if (score > bestScore) bestScore = score;
        log('AI 1', `점수: ${score.toFixed(1)}/5 | 목표: ${targetScore}/5 | 최고: ${bestScore.toFixed(1)}/5 | verdict: ${ev.finalVerdict}`, 'score');

        if (passesThreshold(ev)) {
          log('AI 1', `통과! (${score.toFixed(1)} ≥ ${targetScore})`, 'success');
          break;
        }

        if (attempt >= maxRetries) {
          log('AI 1', `최대 재시도(${maxRetries}) 도달. 현재 점수(${score.toFixed(1)})로 진행합니다.`, 'warn');
          break;
        }

        // Call Planner for structured revision strategy
        log('AI 1', `Planner 분석 중...`, 'info');
        const plannerResult = await callPlanner('concept', ev, attempt, ai1Strategies);
        ai1Strategies.push(plannerResult.decision || 'revise');
        set({ plannerDecision: plannerResult as PlannerDecision });
        log('AI 1', `Planner 결정: ${plannerResult.decision} | ${(plannerResult.replanReason || '').slice(0, 60)}`, 'info');

        if (plannerResult.decision === 'approve') {
          log('AI 1', `Planner 승인! 다음 단계로 진행.`, 'success');
          break;
        }

        // Detect stagnation
        if (Math.abs(score - prevScore) < 0.15) {
          stagnantCount++;
        } else {
          stagnantCount = 0;
        }
        prevScore = score;

        set({ pipelineStage: 'ai1_revise', generating: 'revise' });

        const revisionBrief = buildPlannerRevisionBrief(ev, plannerResult, score, targetScore);

        if (attempt === 1) {
          log('AI 1', `프롬프트 최적화 중...`, 'info');
          const optimizeSuccess = await get().optimizeStagePrompt(pid, 'ai1', get().concept?.approved_markdown || '', ev, revisionBrief);
          log('AI 1', optimizeSuccess ? '보충 규칙 업데이트 완료' : '보충 규칙 업데이트 실패', optimizeSuccess ? 'success' : 'warn');
        }

        // Strategy: if stagnant 2+ or planner says revise_full, regenerate from scratch
        if (stagnantCount >= 2 || plannerResult.decision === 'revise_full') {
          const reason = stagnantCount >= 2 ? `점수 정체 ${stagnantCount}회` : 'Planner: revise_full';
          log('AI 1', `⚡ ${reason} → 전략 변경: 처음부터 재생성합니다`, 'warn');
          stagnantCount = 0;
          try {
            const fresh = await apiPost(`/api/projects/${pid}/story/concept`, { action: 'generate', ...inputData });
            set({ concept: fresh, generating: null });
            log('AI 1', `v${fresh.version} 완전 재생성 완료 (새로운 접근)`, 'success');
          } catch (genErr) {
            log('AI 1', `재생성 실패: ${(genErr as Error).message}. 수정 모드로 복귀.`, 'warn');
            set({ generating: null });
          }
        } else {
          log('AI 1', `수정 중... attempt ${attempt}/${maxRetries}`, 'info');
          try {
            const revised = await apiPost(`/api/projects/${pid}/story/concept`, { action: 'revise', feedback: revisionBrief });
            set({ concept: revised, generating: null });
            log('AI 1', `v${revised.version} 수정 완료`, 'success');
          } catch (revErr) {
            log('AI 1', `수정 실패: ${(revErr as Error).message}. 재시도합니다...`, 'warn');
            set({ generating: null });
          }
        }
      }

      // ════════════ AI 2: Bible ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      set({ pipelineStage: 'ai2_bible', generating: 'bible' });
      syncStage('ai2_bible', 'AI 2: Series Bible 생성', 25);
      log('AI 2', 'Series Bible 생성 중...', 'info');
      const bibleResult = await apiPost(`/api/projects/${pid}/story/bible`, {});
      set({ bible: bibleResult, generating: null });
      log('AI 2', 'Bible 생성 완료', 'success');

      // ════════════ AI 2: Season Plan ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      set({ pipelineStage: 'ai2_season', generating: 'season' });
      syncStage('ai2_season', 'AI 2: 시즌 플랜 생성', 30);
      log('AI 2', '시즌 플랜 생성 중...', 'info');
      const seasonResult = await apiPost(`/api/projects/${pid}/story/season`);
      const episodeList: StoryEpisodeArc[] = Array.isArray(seasonResult) ? seasonResult : [];
      set({ episodes: episodeList, generating: null });
      log('AI 2', `시즌 플랜 완료 (${episodeList.length}화)`, 'success');

      {
        let ai2BestScore = 0;
        let bestEpisodes: StoryEpisodeArc[] = [...episodeList];
        const ai2Strategies: string[] = [];
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          set({ pipelineStage: 'ai2_eval' });
          log('AI 2', `시즌 평가 ${attempt}/${maxRetries}...`, 'info');
          const ev = await evaluate('season');
          set({ evaluation: ev });
          const score = ev.weightedScore || ev.overallScore || 0;
          if (score > ai2BestScore) {
            ai2BestScore = score;
            bestEpisodes = [...get().episodes];
            log('AI 2', `최고 점수 갱신! v${attempt} (${score.toFixed(1)}) 저장됨`, 'success');
          }
          log('AI 2', `시즌 점수: ${score.toFixed(1)}/5 | 목표: ${targetScore}/5 | 최고: ${ai2BestScore.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 2', `시즌 플랜 통과! (${score.toFixed(1)} ≥ ${targetScore})`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 2', `최대 재시도 도달. 최고 점수(${ai2BestScore.toFixed(1)}) 버전 복원.`, 'warn');
            set({ episodes: bestEpisodes });
            break;
          }

          log('AI 2', `Planner 분석 중...`, 'info');
          const plannerResult = await callPlanner('season', ev, attempt, ai2Strategies);
          ai2Strategies.push(plannerResult.decision || 'revise');
          log('AI 2', `Planner 결정: ${plannerResult.decision}`, 'info');

          if (plannerResult.decision === 'approve') {
            log('AI 2', `Planner 승인!`, 'success');
            break;
          }

          set({ pipelineStage: 'ai2_revise', generating: 'season' });
          let ai2Brief = buildPlannerRevisionBrief(ev, plannerResult, score, targetScore);
          if (plannerResult.decision === 'revise_full') {
            ai2Brief = '이전 시즌 플랜을 전면 재설계하라. 이전 구조에 얽매이지 말고 완전히 다른 엔진 배치와 아크 구조를 시도해라.\n\n' + ai2Brief;
          }

          if (attempt === 1) {
            log('AI 2', `프롬프트 최적화 중...`, 'info');
            const ok = await get().optimizeStagePrompt(pid, 'ai2', JSON.stringify(get().episodes.slice(0, 3)), ev, ai2Brief);
            log('AI 2', ok ? '보충 규칙 업데이트 완료' : '보충 규칙 업데이트 실패', ok ? 'success' : 'warn');
          }

          log('AI 2', `시즌 플랜 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          try {
            const reSeasonResult = await apiPost(`/api/projects/${pid}/story/season`, { revisionFeedback: ai2Brief });
            const reEps: StoryEpisodeArc[] = Array.isArray(reSeasonResult) ? reSeasonResult : [];
            set({ episodes: reEps, generating: null });
            log('AI 2', `시즌 플랜 재생성 완료 (${reEps.length}화)`, 'success');
          } catch (seasonErr) {
            log('AI 2', `시즌 플랜 재생성 실패. 최고 버전 유지.`, 'warn');
            set({ episodes: bestEpisodes, generating: null });
          }
        }
        if (bestEpisodes.length > 0) {
          set({ episodes: bestEpisodes });
        }
      }

      // ════════════ AI 2: Episode Scripts ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      const epCount = get().episodes.length;
      set({ pipelineStage: 'ai2_scripts' });
      syncStage('ai2_scripts', `AI 2: 에피소드 대본 생성 (0/${epCount})`, 45);

      // Heartbeat: periodically log "still waiting" so user knows it's alive
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      const startHeartbeat = (label: string) => {
        stopHeartbeat();
        let elapsed = 0;
        heartbeatTimer = setInterval(() => {
          elapsed += 30;
          log('AI 2', `⏳ ${label} — 응답 대기 중... (${elapsed}초 경과)`, 'info');
          syncStage('ai2_scripts', `AI 2: ${label} — 응답 대기 중 (${elapsed}s)`, 45 + Math.round((get().currentEpisode / epCount) * 20));
        }, 30_000);
      };
      const stopHeartbeat = () => {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      };

      for (let ep = 1; ep <= epCount; ep++) {
        if (shouldAbort()) { stopHeartbeat(); throw new Error('Pipeline stopped by user'); }

        set({ currentEpisode: ep, generating: 'script' });
        syncStage('ai2_scripts', `AI 2: 에피소드 대본 생성 (${ep}/${epCount})`, 45 + Math.round((ep / epCount) * 20));
        log('AI 2', `EP${ep}/${epCount} 대본 생성 중...`, 'info');
        startHeartbeat(`EP${ep}/${epCount} 대본 생성`);
        let scriptResult;
        try {
          scriptResult = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/script`);
        } catch (scriptErr) {
          stopHeartbeat();
          log('AI 2', `EP${ep} 대본 생성 실패: ${(scriptErr as Error).message}. 스킵합니다.`, 'warn');
          set({ generating: null });
          continue;
        }
        stopHeartbeat();
        set({ script: scriptResult, generating: null });
        log('AI 2', `EP${ep} 대본 완료`, 'success');

        let scriptBestScore = 0;
        let bestScript = scriptResult;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          log('AI 2', `EP${ep} 대본 평가 ${attempt}/${maxRetries}...`, 'info');
          startHeartbeat(`EP${ep} 대본 평가 (${attempt}/${maxRetries})`);
          const ev = await evaluate('script', ep);
          stopHeartbeat();
          const score = ev.weightedScore || ev.overallScore || 0;
          if (score > scriptBestScore) {
            scriptBestScore = score;
            bestScript = get().script;
            log('AI 2', `EP${ep} 최고 점수 갱신! v${attempt} (${score.toFixed(1)}) 저장됨`, 'success');
          }
          log('AI 2', `EP${ep} 대본 점수: ${score.toFixed(1)}/5 | 최고: ${scriptBestScore.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 2', `EP${ep} 대본 통과!`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 2', `EP${ep} 대본 최대 재시도 도달. 최고 버전 복원.`, 'warn');
            set({ script: bestScript });
            break;
          }

          set({ generating: 'script' });
          const plannerResult = await callPlanner('script', ev, attempt, []);
          let scriptBrief = buildPlannerRevisionBrief(ev, plannerResult, score, targetScore);
          if (plannerResult.decision === 'revise_full') {
            scriptBrief = '이전 대본을 전면 재설계하라. 이전 장면 구성에 얽매이지 말고 완전히 다른 비트 구조를 시도해라.\n\n' + scriptBrief;
          }

          if ([1, Math.ceil(epCount / 2), epCount].includes(ep) && attempt === 1) {
            log('AI 2', `대본 프롬프트 최적화 중...`, 'info');
            const ok = await get().optimizeStagePrompt(pid, 'ai2', get().script?.markdown || '', ev, scriptBrief);
            log('AI 2', ok ? '보충 규칙 업데이트 완료' : '보충 규칙 업데이트 실패', ok ? 'success' : 'warn');
          }
          log('AI 2', `EP${ep} 대본 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          startHeartbeat(`EP${ep} 대본 재생성 (${attempt}/${maxRetries})`);
          try {
            const reScript = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/script`, { revisionFeedback: scriptBrief });
            stopHeartbeat();
            set({ script: reScript, generating: null });
          } catch (reScriptErr) {
            stopHeartbeat();
            log('AI 2', `EP${ep} 대본 재생성 실패. 최고 버전 유지.`, 'warn');
            set({ script: bestScript, generating: null });
          }
        }
        if (bestScript) set({ script: bestScript });
      }

      // ════════════ AI 3: Clips per Episode ════════════
      stopHeartbeat(); // clean up any leftover from AI2
      set({ pipelineStage: 'ai3_clips' });
      syncStage('ai3_clips', `AI 3: 클립 생성 (0/${epCount})`, 70);

      for (let ep = 1; ep <= epCount; ep++) {
        if (shouldAbort()) throw new Error('Pipeline stopped by user');

        set({ currentEpisode: ep, generating: 'clips' });
        syncStage('ai3_clips', `AI 3: 클립 생성 (${ep}/${epCount})`, 70 + Math.round((ep / epCount) * 20));
        log('AI 3', `EP${ep}/${epCount} 클립 생성 중...`, 'info');
        let clipResult;
        try {
          clipResult = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/clips`, {
            density: 'cinematic_detail',
            videoProvider,
          });
          set({
            clips: Array.isArray(clipResult.clips) ? clipResult.clips : [],
            frames: Array.isArray(clipResult.frames) ? clipResult.frames : [],
            timeline: clipResult.timeline || '',
            generating: null,
          });
          log('AI 3', `EP${ep} 클립 완료 (${clipResult.clips?.length || 0}개)`, 'success');
        } catch (clipInitErr) {
          log('AI 3', `EP${ep} 클립 생성 실패: ${(clipInitErr as Error).message}. 이 에피소드 스킵.`, 'warn');
          set({ generating: null });
          continue;
        }

        let clipBestScore = 0;
        let bestClips = { clips: Array.isArray(clipResult.clips) ? clipResult.clips : [], frames: Array.isArray(clipResult.frames) ? clipResult.frames : [], timeline: clipResult.timeline || '' };
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          set({ pipelineStage: 'ai3_eval' });
          log('AI 3', `EP${ep} 클립 평가 ${attempt}/${maxRetries}...`, 'info');
          const ev = await evaluate('clips', ep);
          const score = ev.weightedScore || ev.overallScore || 0;
          if (score > clipBestScore) {
            clipBestScore = score;
            bestClips = { clips: [...get().clips], frames: [...get().frames], timeline: get().timeline || '' };
            log('AI 3', `EP${ep} 최고 점수 갱신! v${attempt} (${score.toFixed(1)}) 저장됨`, 'success');
          }
          log('AI 3', `EP${ep} 클립 점수: ${score.toFixed(1)}/5 | 최고: ${clipBestScore.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 3', `EP${ep} 클립 통과!`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 3', `EP${ep} 클립 최대 재시도 도달. 최고 버전 복원.`, 'warn');
            set({ clips: bestClips.clips, frames: bestClips.frames, timeline: bestClips.timeline });
            break;
          }

          set({ pipelineStage: 'ai3_revise', generating: 'clips' });
          const plannerResult = await callPlanner('clips', ev, attempt, []);
          let clipBrief = buildPlannerRevisionBrief(ev, plannerResult, score, targetScore);
          clipBrief = `★ 절대 보호 (수정하면서도 반드시 유지할 것):
- 각 클립 duration은 4~14초. 15초 이상 절대 금지.
- 타임코드는 반드시 연속: 이전 clip endTime = 다음 clip startTime
- 클립 번호는 1부터 순차. 중간 누락/점프 금지.
- 프롬프트 문장은 반드시 완결형. 중간에 잘린 문장 금지.

` + clipBrief;
          if (plannerResult.decision === 'revise_full') {
            clipBrief = '이전 클립 설계를 전면 재설계하라. 이전 샷 구성에 얽매이지 말고 완전히 다른 프레이밍과 시퀀스를 시도해라.\n\n' + clipBrief;
          }

          if ([1, Math.ceil(epCount / 2), epCount].includes(ep) && attempt === 1) {
            log('AI 3', `클립 프롬프트 최적화 중...`, 'info');
            const ok = await get().optimizeStagePrompt(pid, 'ai3', JSON.stringify(get().clips.slice(0, 3)), ev, clipBrief);
            log('AI 3', ok ? '보충 규칙 업데이트 완료' : '보충 규칙 업데이트 실패', ok ? 'success' : 'warn');
          }
          log('AI 3', `EP${ep} 클립 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          try {
            const reClip = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/clips`, {
              density: 'cinematic_detail',
              videoProvider,
              revisionFeedback: clipBrief,
            });
            set({
              clips: Array.isArray(reClip.clips) ? reClip.clips : [],
              frames: Array.isArray(reClip.frames) ? reClip.frames : [],
              timeline: reClip.timeline || '',
              generating: null,
            });
          } catch (clipErr) {
            log('AI 3', `EP${ep} 클립 재생성 실패. 최고 버전 유지.`, 'warn');
            set({ clips: bestClips.clips, frames: bestClips.frames, timeline: bestClips.timeline, generating: null });
          }
        }
        set({ clips: bestClips.clips, frames: bestClips.frames, timeline: bestClips.timeline });

        set({ pipelineStage: 'ai3_clips' });
      }

      // ════════════ Season Coherence ════════════
      set({ pipelineStage: 'season_coherence' });
      syncStage('season_coherence', '시즌 일관성 평가', 95);
      log('일관성', '시즌 전체 일관성 평가 시작...', 'info');
      try {
        const coherenceRes = await fetch(`/api/projects/${pid}/story/season-coherence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genreOverlay: inputData.genre_overlay }),
        });
        if (coherenceRes.ok) {
          const coherence = await coherenceRes.json();
          log('일관성', `시즌 일관성 점수: ${coherence.overallScore}/5 (캐릭터 아크: ${coherence.characterArcConsistency}, 플롯 해소: ${coherence.plotThreadResolution}, 페이싱: ${coherence.pacingBalance})`, 'score');
          if (coherence.issues?.length > 0) {
            const critical = coherence.issues.filter((i: any) => i.severity === 'critical');
            if (critical.length > 0) {
              log('일관성', `치명적 일관성 이슈 ${critical.length}건: ${critical.map((i: any) => `EP${i.episode}: ${i.issue}`).join(' | ')}`, 'warn');
            }
          }
        }
      } catch {
        log('일관성', '시즌 일관성 평가 스킵 (오류)', 'warn');
      }

      // ════════════ Complete ════════════
      log('완료', `전체 파이프라인 완료! AI1→AI2→AI3 (${epCount}화) 모두 생성 및 검증됨.`, 'success');
      set({ pipelineStage: 'complete', pipelineRunning: false, pipelineAbortController: null, generating: null });

      if (_logFlushTimer) clearTimeout(_logFlushTimer);
      const completeLogs = get().pipelineLogs;
      if (_dbRunId) {
        await pipelineApi('update_stage', { runId: _dbRunId, stage: 'complete', stageLabel: '완료', progressPct: 100 });
        await pipelineApi('update_status', { runId: _dbRunId, status: 'completed' });
        await pipelineApi('save_logs', { runId: _dbRunId, logs: completeLogs });
      }
      try {
        await fetch(`/api/projects/${pid}/pipeline-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: completeLogs, stage: 'complete' }),
        });
      } catch (e) { console.error('[Pipeline] pipeline-logs file save failed:', (e as Error).message); }
      try {
        const consRes = await fetch('/api/learning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'consolidate' }),
        });
        if (consRes.ok) {
          const { results } = await consRes.json();
          if (results?.length > 0) {
            for (const r of results) {
              log('학습', `${r.stage} 글로벌 규칙 ${r.consolidatedRules}개를 원본 프롬프트에 통합 완료`, 'success');
            }
          }
        }
      } catch { /* non-critical */ }

    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError' || get().pipelineAbort;
      const failedStage = get().pipelineStage;
      const failedStageLabel = get().generating ? `${get().generating} 생성` : failedStage;
      const rawMsg = (err as Error).message;
      const msg = isAbort
        ? '사용자가 파이프라인을 중지했습니다.'
        : `${failedStageLabel} 실패 — ${rawMsg}`;
      log(isAbort ? '중지' : '오류', msg, isAbort ? 'info' : 'error');
      set({ pipelineStage: isAbort ? 'idle' : 'failed', pipelineRunning: false, pipelineAbortController: null, generating: null, error: isAbort ? null : msg });

      if (_logFlushTimer) clearTimeout(_logFlushTimer);
      const currentLogs = get().pipelineLogs;
      const status = isAbort ? 'aborted' : 'failed';

      if (_dbRunId) {
        try {
          await fetch(`/api/projects/${pid}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', runId: _dbRunId, status, errorMessage: msg }),
          });
        } catch (e) { console.error('[Pipeline] update_status on failure:', (e as Error).message); }

        try {
          await fetch(`/api/projects/${pid}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_logs', runId: _dbRunId, logs: currentLogs }),
          });
        } catch (e) { console.error('[Pipeline] save_logs on failure:', (e as Error).message); }
      } else {
        console.error('[Pipeline] No dbRunId — logs cannot be saved to DB. Logs count:', currentLogs.length);
      }

      try {
        await fetch(`/api/projects/${pid}/pipeline-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: currentLogs, stage: status }),
        });
      } catch (e) { console.error('[Pipeline] pipeline-logs file save on failure:', (e as Error).message); }
    }
  },

  // ══════════════════════════════════════════════════════
  // Feedback-Based Regeneration (단건)
  // ══════════════════════════════════════════════════════
  regenerateSeasonWithFeedback: async (pid: string) => {
    const { evaluation, plannerDecision } = get();
    if (!evaluation) return;
    set({ generating: 'season', error: null });
    const feedback = [
      typeof evaluation.revisionBrief === 'string' ? evaluation.revisionBrief : JSON.stringify(evaluation.revisionBrief || ''),
      ...(plannerDecision?.revisionTargets || []).map((rt: any) =>
        `[${rt.priority}] ${typeof rt.target === 'string' ? rt.target : JSON.stringify(rt.target)}: ${typeof rt.problem === 'string' ? rt.problem : JSON.stringify(rt.problem)} → ${typeof rt.fixStrategy === 'string' ? rt.fixStrategy : JSON.stringify(rt.fixStrategy)}`
      ),
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch(`/api/projects/${pid}/story/season`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionFeedback: feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      set({ episodes: data, generating: null });
      const evalRes = await fetch(`/api/projects/${pid}/story/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'season' }),
      });
      if (evalRes.ok) set({ evaluation: await evalRes.json() });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  regenerateScriptWithFeedback: async (pid: string, epNum: number) => {
    const { evaluation, plannerDecision } = get();
    if (!evaluation) return;
    set({ generating: 'script', error: null });
    const feedback = [
      typeof evaluation.revisionBrief === 'string' ? evaluation.revisionBrief : JSON.stringify(evaluation.revisionBrief || ''),
      ...(plannerDecision?.revisionTargets || []).map((rt: any) =>
        `[${rt.priority}] ${typeof rt.problem === 'string' ? rt.problem : JSON.stringify(rt.problem)} → ${typeof rt.fixStrategy === 'string' ? rt.fixStrategy : JSON.stringify(rt.fixStrategy)}`
      ),
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/script`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionFeedback: feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set({ script: await res.json(), generating: null });
      const evalRes = await fetch(`/api/projects/${pid}/story/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'script', episodeNumber: epNum }),
      });
      if (evalRes.ok) set({ evaluation: await evalRes.json() });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  regenerateClipsWithFeedback: async (pid: string, epNum: number) => {
    const { evaluation, plannerDecision } = get();
    if (!evaluation) return;
    set({ generating: 'clips', error: null });
    const feedback = [
      typeof evaluation.revisionBrief === 'string' ? evaluation.revisionBrief : JSON.stringify(evaluation.revisionBrief || ''),
      ...(plannerDecision?.revisionTargets || []).map((rt: any) =>
        `[${rt.priority}] ${typeof rt.problem === 'string' ? rt.problem : JSON.stringify(rt.problem)} → ${typeof rt.fixStrategy === 'string' ? rt.fixStrategy : JSON.stringify(rt.fixStrategy)}`
      ),
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/clips`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ density: 'cinematic_detail', videoProvider: 'seedance_2_0', revisionFeedback: feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      set({ clips: data.clips || [], frames: data.frames || [], timeline: data.timeline || '', generating: null });
      const evalRes = await fetch(`/api/projects/${pid}/story/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'clips', episodeNumber: epNum }),
      });
      if (evalRes.ok) set({ evaluation: await evalRes.json() });
    } catch (err) { set({ error: (err as Error).message, generating: null }); }
  },

  // ══════════════════════════════════════════════════════
  // Resume Pipeline from failure point
  // ══════════════════════════════════════════════════════
  resumePipeline: async (pid, targetScore = 3.7, maxRetries = 3, videoProvider = 'seedance_2_0') => {
    try {
      const pipeRes = await fetch(`/api/projects/${pid}/pipeline`);
      const pipeData = await pipeRes.json();
      const latest = pipeData.latest;
      if (!latest || latest.status === 'running') {
        set({ error: '이어서 실행할 파이프라인이 없거나 이미 실행 중입니다.' });
        return;
      }

      const failedStage = latest.current_stage || 'ai1_concept';

      const hasConcept = !!get().concept;
      const hasBible = !!get().bible;
      const hasEpisodes = get().episodes.length > 0;

      if (!hasConcept) {
        await get().fetchConcept(pid);
      }
      if (!get().concept) {
        set({ error: 'AI 1 컨셉이 없습니다. 처음부터 다시 실행해주세요.' });
        return;
      }

      let resumeFrom: 'bible' | 'season' | 'scripts' | 'clips' = 'bible';

      if (failedStage.startsWith('ai3') || failedStage === 'season_coherence') {
        resumeFrom = 'clips';
      } else if (failedStage.startsWith('ai2_script')) {
        resumeFrom = 'scripts';
      } else if (failedStage.startsWith('ai2_season') || failedStage.startsWith('ai2_eval')) {
        resumeFrom = 'season';
      } else if (failedStage.startsWith('ai2')) {
        if (!hasBible) resumeFrom = 'bible';
        else if (!hasEpisodes) resumeFrom = 'season';
        else resumeFrom = 'scripts';
      }

      if (resumeFrom === 'bible') {
        if (!hasBible) await get().fetchBible(pid);
        if (!get().bible) {
          await get().runStagePipeline(pid, 'season', undefined, targetScore, maxRetries, videoProvider);
          return;
        }
        resumeFrom = 'season';
      }

      if (resumeFrom === 'season') {
        if (!hasEpisodes) await get().fetchSeason(pid);
        await get().runStagePipeline(pid, 'season', undefined, targetScore, maxRetries, videoProvider);
        return;
      }

      if (resumeFrom === 'scripts') {
        const epCount = get().episodes.length || 1;
        await get().runStagePipeline(pid, 'script', 1, targetScore, maxRetries, videoProvider);
        return;
      }

      if (resumeFrom === 'clips') {
        await get().runStagePipeline(pid, 'clips', 1, targetScore, maxRetries, videoProvider);
        return;
      }
    } catch (err) {
      set({ error: `이어서 실행 실패: ${(err as Error).message}` });
    }
  },

  // ══════════════════════════════════════════════════════
  // Stage Mini-Pipeline
  // ══════════════════════════════════════════════════════
  runStagePipeline: async (
    pid: string,
    stage: 'season' | 'script' | 'clips',
    epNum?: number,
    targetScore: number = 4.0,
    maxRetries: number = 5,
    videoProvider: string = 'seedance_2_0',
  ) => {
    const stageAbortCtrl = new AbortController();
    const initialStage = stage === 'season' ? 'ai2_season' : stage === 'script' ? 'ai2_scripts' : 'ai3_clips';
    set({
      pipelineRunning: true,
      pipelineStage: initialStage,
      pipelineLogs: [],
      pipelineAbort: false,
      pipelineAbortController: stageAbortCtrl,
    });

    let dbRunId: string | null = null;
    try {
      const createRes = await fetch(`/api/projects/${pid}/pipeline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', pipelineType: `stage_${stage}`, targetScore, maxRetries, currentStage: initialStage }),
      });
      if (createRes.ok) {
        const runData = await createRes.json();
        dbRunId = runData.id;
      }
    } catch { /* best-effort */ }

    let _stageLogDirty = false;
    let _stageLogTimer: ReturnType<typeof setTimeout> | null = null;

    const flushStageLogs = async () => {
      if (!dbRunId || !_stageLogDirty) return;
      _stageLogDirty = false;
      try {
        await fetch(`/api/projects/${pid}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_logs', runId: dbRunId, logs: get().pipelineLogs }),
        });
      } catch (e) { console.error('[StagePipeline] flushLogs failed:', (e as Error).message); }
    };

    const log = (stg: string, message: string, type: PipelineLog['type'] = 'info') => {
      set(s => ({ pipelineLogs: [...s.pipelineLogs, { stage: stg, message, timestamp: Date.now(), type }] }));
      _stageLogDirty = true;
      if (_stageLogTimer) clearTimeout(_stageLogTimer);
      _stageLogTimer = setTimeout(flushStageLogs, 3000);
    };
    const shouldAbort = () => {
      if (get().pipelineAbort) { stageAbortCtrl.abort(); return true; }
      return false;
    };
    const sig = stageAbortCtrl.signal;
    const aiLabel = stage === 'clips' ? 'AI 3' : 'AI 2';

    try {
      const hasData = stage === 'season' ? get().episodes.length > 0
        : stage === 'script' ? !!get().script
        : get().clips.length > 0;

      if (!hasData) {
        log(aiLabel, `${stage} 초기 생성 중...`, 'info');
        if (stage === 'season') {
          const r = await fetch(`/api/projects/${pid}/story/season`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: sig });
          const seasonData = await r.json();
          set({ episodes: Array.isArray(seasonData) ? seasonData : [] });
        } else if (stage === 'script' && epNum) {
          const r = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: sig });
          set({ script: await r.json() });
        } else if (stage === 'clips' && epNum) {
          const r = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/clips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ density: 'cinematic_detail', videoProvider }), signal: sig });
          const d = await r.json(); set({ clips: d.clips || [], frames: d.frames || [], timeline: d.timeline || '' });
        }
        log(aiLabel, `${stage} 초기 생성 완료`, 'success');
      }

      let bestScore = 0;
      const taskType = stage === 'season' ? 'season' as const : stage === 'script' ? 'script' as const : 'clips' as const;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (shouldAbort()) throw new Error('사용자 중지');

        log(aiLabel, `평가 ${attempt}/${maxRetries}...`, 'info');
        const evalRes = await fetch(`/api/projects/${pid}/story/evaluate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskType, episodeNumber: epNum }), signal: sig,
        });
        const ev = await evalRes.json();
        set({ evaluation: ev });
        const score = ev.weightedScore || ev.overallScore || 0;
        if (score > bestScore) {
          bestScore = score;
          log(aiLabel, `최고 점수 갱신! (${score.toFixed(1)})`, 'success');
        }
        log(aiLabel, `점수: ${score.toFixed(1)}/5 | 목표: ${targetScore} | 최고: ${bestScore.toFixed(1)}`, 'score');

        if (score >= targetScore) { log(aiLabel, `통과! (${score.toFixed(1)} ≥ ${targetScore})`, 'success'); break; }
        if (attempt >= maxRetries) { log(aiLabel, `최대 재시도 도달. 최고: ${bestScore.toFixed(1)}`, 'warn'); break; }

        log(aiLabel, `Planner 분석 중...`, 'info');
        const planRes = await fetch(`/api/projects/${pid}/story/plan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'interpret', taskType, evaluation: ev, loop: attempt, previousStrategies: [] }), signal: sig,
        });
        const plan = await planRes.json();
        log(aiLabel, `Planner 결정: ${plan.decision}`, 'info');
        if (plan.decision === 'approve') { log(aiLabel, `Planner 승인!`, 'success'); break; }

        const feedback = [
          `★ 현재 점수: ${score.toFixed(1)}/5 | 목표: ${targetScore}`,
          typeof ev.revisionBrief === 'string' ? ev.revisionBrief : '',
          ...(plan.revisionTargets || []).map((rt: any) => `- [${rt.priority}] ${rt.problem} → ${rt.fixStrategy}`),
        ].filter(Boolean).join('\n');

        log(aiLabel, `재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
        if (stage === 'season') {
          const r = await fetch(`/api/projects/${pid}/story/season`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionFeedback: feedback }), signal: sig });
          const seasonData = await r.json();
          set({ episodes: Array.isArray(seasonData) ? seasonData : [] });
        } else if (stage === 'script' && epNum) {
          const r = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionFeedback: feedback }), signal: sig });
          set({ script: await r.json() });
        } else if (stage === 'clips' && epNum) {
          const r = await fetch(`/api/projects/${pid}/story/episodes/${epNum}/clips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ density: 'cinematic_detail', videoProvider, revisionFeedback: feedback }), signal: sig });
          const d = await r.json(); set({ clips: d.clips || [], frames: d.frames || [], timeline: d.timeline || '' });
        }
        log(aiLabel, `재생성 완료`, 'success');
      }

      set({ pipelineRunning: false, pipelineStage: 'complete', pipelineAbortController: null });
      log(aiLabel, `${stage} 미니 파이프라인 완료! 최고: ${bestScore.toFixed(1)}`, 'success');
      if (_stageLogTimer) clearTimeout(_stageLogTimer);
      if (dbRunId) {
        try {
          await fetch(`/api/projects/${pid}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', runId: dbRunId, status: 'completed' }) });
        } catch (e) { console.error('[StagePipeline] update_status on success:', (e as Error).message); }
        try {
          await fetch(`/api/projects/${pid}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_logs', runId: dbRunId, logs: get().pipelineLogs }) });
        } catch (e) { console.error('[StagePipeline] save_logs on success:', (e as Error).message); }
      }
    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError' || get().pipelineAbort;
      const failedLabel = get().pipelineStage;
      const rawMsg = (err as Error).message;
      const msg = isAbort ? '사용자가 파이프라인을 중지했습니다.' : `${failedLabel} 실패 — ${rawMsg}`;
      log(isAbort ? '중지' : '오류', msg, isAbort ? 'info' : 'error');
      set({ pipelineRunning: false, pipelineStage: isAbort ? 'idle' : 'failed', pipelineAbortController: null, error: isAbort ? null : msg });
      if (_stageLogTimer) clearTimeout(_stageLogTimer);
      const failLogs = get().pipelineLogs;
      if (dbRunId) {
        const status = isAbort ? 'aborted' : 'failed';
        try {
          await fetch(`/api/projects/${pid}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', runId: dbRunId, status, errorMessage: msg }) });
        } catch (e) { console.error('[StagePipeline] update_status on failure:', (e as Error).message); }
        try {
          await fetch(`/api/projects/${pid}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_logs', runId: dbRunId, logs: failLogs }) });
        } catch (e) { console.error('[StagePipeline] save_logs on failure:', (e as Error).message); }
      } else {
        console.error('[StagePipeline] No dbRunId — logs cannot be saved. Count:', failLogs.length);
      }
    }
  },
}));
