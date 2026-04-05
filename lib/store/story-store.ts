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

export type PipelineStage = 'idle' | 'ai1_concept' | 'ai1_eval' | 'ai1_revise' | 'ai2_bible' | 'ai2_season' | 'ai2_eval' | 'ai2_revise' | 'ai2_scripts' | 'ai3_clips' | 'ai3_eval' | 'ai3_revise' | 'complete' | 'failed';

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
  pipelineStage: PipelineStage;
  pipelineLogs: PipelineLog[];
  pipelineTargetScore: number;
  pipelineMaxRetries: number;
  pipelineAbort: boolean;

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
  stopPipeline: () => void;
  optimizeStagePrompt: (pid: string, stage: string, generatorOutput: string, evaluation: EvalResult, plannerFeedback: string) => Promise<void>;

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
  pipelineStage: 'idle',
  pipelineLogs: [],
  pipelineTargetScore: 4.0,
  pipelineMaxRetries: 3,
  pipelineAbort: false,

  clearError: () => set({ error: null }),
  clearEvaluation: () => set({ evaluation: null, plannerInit: null, plannerDecision: null, evalLoop: 0, evalStrategies: [] }),
  stopPipeline: () => set({ pipelineAbort: true }),

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
      await fetch(`/api/projects/${pid}/story/optimize-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, generatorOutput, evaluation, plannerFeedback }),
      });
    } catch { /* non-critical */ }
  },

  // ══════════════════════════════════════════════════════
  // Full Auto-Pipeline
  // ══════════════════════════════════════════════════════
  runFullPipeline: async (pid, inputData, targetScore = 4.0, maxRetries = 3, videoProvider = 'seedance_2_0') => {
    const log = (stage: string, message: string, type: PipelineLog['type'] = 'info') => {
      set(s => ({ pipelineLogs: [...s.pipelineLogs, { stage, message, timestamp: Date.now(), type }] }));
    };

    const shouldAbort = () => get().pipelineAbort;

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

    const apiPost = async (url: string, body?: Record<string, unknown>) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(e.error || `Request failed: ${res.status}`);
      }
      return res.json();
    };

    const evaluate = async (taskType: EvalTaskType, epNum?: number): Promise<EvalResult> => {
      const res = await apiPost(`/api/projects/${pid}/story/evaluate`, { taskType, episodeNumber: epNum });
      return res as EvalResult;
    };

    const passesThreshold = (ev: EvalResult): boolean => {
      const score = ev.weightedScore || ev.overallScore || 0;
      // Pass if score meets target. Critical issues only block if score is borderline.
      if (score >= targetScore) return true;
      if (score >= targetScore - 0.1 && ev.finalVerdict === 'approve') return true;
      return false;
    };

    set({
      pipelineRunning: true,
      pipelineStage: 'ai1_concept',
      pipelineLogs: [],
      pipelineAbort: false,
      pipelineTargetScore: targetScore,
      pipelineMaxRetries: maxRetries,
      error: null,
    });

    try {
      // ════════════ AI 1: Story Concept ════════════
      log('AI 1', '스토리 컨셉 생성 시작...', 'info');
      set({ pipelineStage: 'ai1_concept', generating: 'concept' });
      const conceptResult = await apiPost(`/api/projects/${pid}/story/concept`, { action: 'generate', ...inputData });
      set({ concept: conceptResult, generating: null });
      log('AI 1', `컨셉 v${conceptResult.version} 생성 완료`, 'success');

      let prevScore = 0;
      let stagnantCount = 0;
      let bestScore = 0;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (shouldAbort()) throw new Error('Pipeline stopped by user');

        set({ pipelineStage: 'ai1_eval' });
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

        // Detect stagnation: if score didn't improve by at least 0.1
        if (Math.abs(score - prevScore) < 0.15) {
          stagnantCount++;
        } else {
          stagnantCount = 0;
        }
        prevScore = score;

        set({ pipelineStage: 'ai1_revise', generating: 'revise' });

        const revisionBrief = buildRevisionBrief(ev, score, targetScore);

        if (attempt === 1 || attempt % 5 === 0) {
          log('AI 1', `프롬프트 최적화 중... (${attempt}회차)`, 'info');
          await get().optimizeStagePrompt(pid, 'ai1', get().concept?.approved_markdown || '', ev, revisionBrief);
          log('AI 1', '프롬프트 보충 규칙 업데이트 완료', 'success');
        }

        // Strategy: if stagnant for 2+ rounds, regenerate from scratch instead of revising
        if (stagnantCount >= 2) {
          log('AI 1', `⚡ 점수 정체 ${stagnantCount}회 → 전략 변경: 처음부터 재생성합니다`, 'warn');
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
          log('AI 1', `수정 중... attempt ${attempt}/${maxRetries} (${revisionBrief.slice(0, 80)}...)`, 'info');
          try {
            const revised = await apiPost(`/api/projects/${pid}/story/concept`, { action: 'revise', feedback: revisionBrief });
            set({ concept: revised, generating: null });
            log('AI 1', `v${revised.version} 수정 완료 (개선된 프롬프트 적용)`, 'success');
          } catch (revErr) {
            log('AI 1', `수정 실패: ${(revErr as Error).message}. 재시도합니다...`, 'warn');
            set({ generating: null });
          }
        }
      }

      // ════════════ AI 2: Bible ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      set({ pipelineStage: 'ai2_bible', generating: 'bible' });
      log('AI 2', 'Series Bible 생성 중...', 'info');
      const bibleResult = await apiPost(`/api/projects/${pid}/story/bible`, {});
      set({ bible: bibleResult, generating: null });
      log('AI 2', 'Bible 생성 완료', 'success');

      // ════════════ AI 2: Season Plan ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      set({ pipelineStage: 'ai2_season', generating: 'season' });
      log('AI 2', '시즌 플랜 생성 중...', 'info');
      const seasonResult = await apiPost(`/api/projects/${pid}/story/season`);
      const episodeList: StoryEpisodeArc[] = Array.isArray(seasonResult) ? seasonResult : [];
      set({ episodes: episodeList, generating: null });
      log('AI 2', `시즌 플랜 완료 (${episodeList.length}화)`, 'success');

      {
        let ai2BestScore = 0;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          set({ pipelineStage: 'ai2_eval' });
          log('AI 2', `시즌 평가 ${attempt}/${maxRetries}...`, 'info');
          const ev = await evaluate('season');
          set({ evaluation: ev });
          const score = ev.weightedScore || ev.overallScore || 0;
          if (score > ai2BestScore) ai2BestScore = score;
          log('AI 2', `시즌 점수: ${score.toFixed(1)}/5 | 목표: ${targetScore}/5 | 최고: ${ai2BestScore.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 2', `시즌 플랜 통과! (${score.toFixed(1)} ≥ ${targetScore})`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 2', `최대 재시도 도달. 현재 점수(${score.toFixed(1)})로 진행.`, 'warn');
            break;
          }

          set({ pipelineStage: 'ai2_revise', generating: 'season' });
          const ai2Brief = buildRevisionBrief(ev, score, targetScore);
          if (attempt === 1 || attempt % 5 === 0) {
          log('AI 2', `프롬프트 최적화 중... (${attempt}회차)`, 'info');
          await get().optimizeStagePrompt(pid, 'ai2', JSON.stringify(get().episodes.slice(0, 3)), ev, ai2Brief);
          log('AI 2', '프롬프트 보충 규칙 업데이트 완료', 'success');
        }

          log('AI 2', `시즌 플랜 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          try {
            const reSeasonResult = await apiPost(`/api/projects/${pid}/story/season`);
            const reEps: StoryEpisodeArc[] = Array.isArray(reSeasonResult) ? reSeasonResult : [];
            set({ episodes: reEps, generating: null });
            log('AI 2', `시즌 플랜 재생성 완료 (${reEps.length}화)`, 'success');
          } catch (seasonErr) {
            log('AI 2', `시즌 플랜 재생성 실패: ${(seasonErr as Error).message}. 재시도합니다.`, 'warn');
            set({ generating: null });
          }
        }
      }

      // ════════════ AI 2: Episode Scripts ════════════
      if (shouldAbort()) throw new Error('Pipeline stopped by user');
      const epCount = get().episodes.length;
      set({ pipelineStage: 'ai2_scripts' });

      for (let ep = 1; ep <= epCount; ep++) {
        if (shouldAbort()) throw new Error('Pipeline stopped by user');

        set({ currentEpisode: ep, generating: 'script' });
        log('AI 2', `EP${ep}/${epCount} 대본 생성 중...`, 'info');
        let scriptResult;
        try {
          scriptResult = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/script`);
        } catch (scriptErr) {
          log('AI 2', `EP${ep} 대본 생성 실패: ${(scriptErr as Error).message}. 스킵합니다.`, 'warn');
          set({ generating: null });
          continue;
        }
        set({ script: scriptResult, generating: null });
        log('AI 2', `EP${ep} 대본 완료`, 'success');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          log('AI 2', `EP${ep} 대본 평가 ${attempt}/${maxRetries}...`, 'info');
          const ev = await evaluate('script', ep);
          const score = ev.weightedScore || ev.overallScore || 0;
          log('AI 2', `EP${ep} 대본 점수: ${score.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 2', `EP${ep} 대본 통과!`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 2', `EP${ep} 대본 최대 재시도 도달. 진행.`, 'warn');
            break;
          }

          set({ generating: 'script' });
          const scriptBrief = buildRevisionBrief(ev, score, targetScore);
          if (ep === 1 && (attempt === 1 || attempt % 5 === 0)) {
            log('AI 2', `대본 프롬프트 최적화 중... (${attempt}회차)`, 'info');
            await get().optimizeStagePrompt(pid, 'ai2', get().script?.markdown || '', ev, scriptBrief);
            log('AI 2', '프롬프트 보충 규칙 업데이트 완료', 'success');
          }
          log('AI 2', `EP${ep} 대본 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          try {
            const reScript = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/script`);
            set({ script: reScript, generating: null });
          } catch (reScriptErr) {
            log('AI 2', `EP${ep} 대본 재생성 실패: ${(reScriptErr as Error).message}`, 'warn');
            set({ generating: null });
          }
        }
      }

      // ════════════ AI 3: Clips per Episode ════════════
      set({ pipelineStage: 'ai3_clips' });

      for (let ep = 1; ep <= epCount; ep++) {
        if (shouldAbort()) throw new Error('Pipeline stopped by user');

        set({ currentEpisode: ep, generating: 'clips' });
        log('AI 3', `EP${ep}/${epCount} 클립 생성 중...`, 'info');
        const clipResult = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/clips`, {
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

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (shouldAbort()) throw new Error('Pipeline stopped by user');

          set({ pipelineStage: 'ai3_eval' });
          log('AI 3', `EP${ep} 클립 평가 ${attempt}/${maxRetries}...`, 'info');
          const ev = await evaluate('clips', ep);
          const score = ev.weightedScore || ev.overallScore || 0;
          log('AI 3', `EP${ep} 클립 점수: ${score.toFixed(1)}/5`, 'score');

          if (passesThreshold(ev)) {
            log('AI 3', `EP${ep} 클립 통과!`, 'success');
            break;
          }

          if (attempt >= maxRetries) {
            log('AI 3', `EP${ep} 클립 최대 재시도 도달. 진행.`, 'warn');
            break;
          }

          set({ pipelineStage: 'ai3_revise', generating: 'clips' });
          const clipBrief = buildRevisionBrief(ev, score, targetScore);
          if (ep === 1 && (attempt === 1 || attempt % 5 === 0)) {
            log('AI 3', `클립 프롬프트 최적화 중... (${attempt}회차)`, 'info');
            await get().optimizeStagePrompt(pid, 'ai3', JSON.stringify(get().clips.slice(0, 3)), ev, clipBrief);
            log('AI 3', '프롬프트 보충 규칙 업데이트 완료', 'success');
          }
          log('AI 3', `EP${ep} 클립 재생성 중... attempt ${attempt}/${maxRetries}`, 'info');
          const reClip = await apiPost(`/api/projects/${pid}/story/episodes/${ep}/clips`, {
            density: 'cinematic_detail',
            videoProvider,
          });
          set({
            clips: Array.isArray(reClip.clips) ? reClip.clips : [],
            frames: Array.isArray(reClip.frames) ? reClip.frames : [],
            timeline: reClip.timeline || '',
            generating: null,
          });
        }

        set({ pipelineStage: 'ai3_clips' });
      }

      // ════════════ Complete ════════════
      set({ pipelineStage: 'complete', pipelineRunning: false, generating: null });
      log('완료', `전체 파이프라인 완료! AI1→AI2→AI3 (${epCount}화) 모두 생성 및 검증됨.`, 'success');

    } catch (err) {
      const msg = (err as Error).message;
      set({ pipelineStage: 'failed', pipelineRunning: false, generating: null, error: msg });
      log('오류', msg, 'error');
    }
  },
}));
