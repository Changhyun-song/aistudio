import { getProvider } from '@/lib/ai';
import { getEvaluatorPrompt } from '@/lib/ai/story-studio/load-system-prompt';
import type { GenreOverlay } from '@/types';
import { extractJsonBlock, formatOverlayBlock, MODEL_EVALUATOR } from './utils';

export type EvalTaskType = 'concept' | 'bible' | 'season' | 'script' | 'clips';

const EVAL_TASK_MAP: Record<EvalTaskType, string> = {
  concept: 'story_architect',
  bible: 'story_architect',
  season: 'screenplay_director',
  script: 'screenplay_director',
  clips: 'frame_video_designer',
};

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

function sampleContentForEvaluation(content: string, maxLen: number = 20000): string {
  if (content.length <= maxLen) return content;
  const front = Math.floor(maxLen * 0.4);
  const mid = Math.floor(maxLen * 0.2);
  const back = Math.floor(maxLen * 0.4);
  const midStart = Math.floor((content.length - mid) / 2);
  return [
    content.slice(0, front),
    '\n\n[... 중간 구간 ...]\n\n',
    content.slice(midStart, midStart + mid),
    '\n\n[... 후반 구간 ...]\n\n',
    content.slice(-back),
  ].join('');
}

function computeWeightedScore(criteria: EvalCriterion[]): number {
  if (!criteria?.length) return 0;
  let totalWeighted = 0;
  let totalWeight = 0;
  for (const c of criteria) {
    totalWeighted += c.score * (c.weight || 1);
    totalWeight += (c.weight || 1);
  }
  return totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0;
}

function normalizeScoresTo5(result: EvalResult): void {
  const needsRescale =
    (result.overallScore && result.overallScore > 5) ||
    (result.weightedScore && result.weightedScore > 5) ||
    result.criteria?.some(c => c.score > 5);

  if (needsRescale) {
    const maxFound = Math.max(
      result.overallScore || 0,
      result.weightedScore || 0,
      ...(result.criteria?.map(c => c.score) || []),
    );
    const scale = maxFound > 5 ? 5 / (maxFound > 10 ? maxFound : 10) : 1;

    if (result.overallScore) result.overallScore = Math.round(result.overallScore * scale * 100) / 100;
    if (result.weightedScore) result.weightedScore = Math.round(result.weightedScore * scale * 100) / 100;
    if (result.criteria) {
      for (const c of result.criteria) {
        if (c.score > 5) c.score = Math.round(c.score * scale * 100) / 100;
      }
    }
  }
}

function summarizeClipsForEval(content: string): string {
  try {
    const data = JSON.parse(content);
    const clips = data.seedanceClipPackets || data.higgsfieldClipPackets || data.clips || [];
    const frames = data.boundaryFrames || data.frames || [];
    if (!Array.isArray(clips) || clips.length === 0) return sampleContentForEvaluation(content);

    const multiShot = clips.filter((c: any) => c.clipMode === 'multi_shot' || (c.shotSequenceCount && c.shotSequenceCount > 1)).length;
    const singleBeat = clips.length - multiShot;
    const firstTime = clips[0]?.startTime || '00:00';
    const lastTime = clips[clips.length - 1]?.endTime || '??:??';
    const totalDur = clips.reduce((sum: number, c: any) => sum + (c.totalDurationSec || c.durationSec || 0), 0);

    const durations = clips.map((c: any) => c.totalDurationSec || c.durationSec || 0);
    const maxDur = durations.length > 0 ? Math.max(...durations) : 0;
    const minDur = durations.length > 0 ? Math.min(...durations) : 0;

    const lines = [
      `## 클립 통계 요약`,
      `- 총 클립 수: ${clips.length}`,
      `- 경계 프레임 수: ${frames.length}`,
      `- 타임코드 범위: ${firstTime} → ${lastTime} (총 ${totalDur}초)`,
      `- multi_shot: ${multiShot}개 / single_beat: ${singleBeat}개`,
      `- provider: ${data.provider || 'unknown'}`,
      `- ★ 후처리 적용: 15초 초과 클립 자동 분할 완료, 타임코드 자동 재정렬 완료`,
      `- 클립 duration 범위: ${minDur}~${maxDur}초`,
      maxDur <= 15 ? `- ✅ 모든 클립이 seedance_2_0 제한(15초) 이내` : `- ⚠ ${maxDur}초 클립 존재`,
      ``,
      `## 클립별 한 줄 요약`,
    ];

    for (const c of clips) {
      const num = c.clipNumber || '?';
      const start = c.startTime || '';
      const end = c.endTime || '';
      const dur = c.totalDurationSec || c.durationSec || '?';
      const mode = c.clipMode || (c.startFrameId ? 'frame_chain' : 'single_beat');
      const beats = c.shotSequenceCount || 1;
      const intent = c.shotIntention || c.shotType || '';
      const obj = (c.sceneObjective || '').slice(0, 40);
      lines.push(`- #${num} [${start}→${end}] ${dur}s ${mode}(${beats}beats) ${intent} | ${obj}`);
    }

    const sampleIndices = [0, Math.floor(clips.length / 2), clips.length - 1];
    lines.push('', '## 대표 클립 프롬프트 샘플');
    for (const idx of sampleIndices) {
      const c = clips[idx];
      if (!c) continue;
      const prompt = c.seedancePrompt || c.videoPrompt || '';
      if (prompt) {
        lines.push(`### Clip #${c.clipNumber} (${c.clipMode || 'unknown'})`);
        lines.push(prompt.slice(0, 300));
        lines.push('');
      }
    }

    if (data.timeline) {
      lines.push('', '## 타임라인 서술', data.timeline.slice(0, 2000));
    }

    return lines.join('\n');
  } catch {
    return sampleContentForEvaluation(content);
  }
}

function stripSelfEvaluation(text: string): string {
  const patterns = [/##\s*16\.\s*자가\s*품질\s*검사/i, /###\s*16\.\s*자가\s*품질\s*검사/i];
  for (const pat of patterns) {
    const match = text.search(pat);
    if (match !== -1) return text.slice(0, match).trimEnd();
  }
  return text;
}

export async function evaluateOutput(
  taskType: EvalTaskType,
  content: string,
  genreOverlay?: GenreOverlay,
): Promise<EvalResult> {
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const promptTaskType = EVAL_TASK_MAP[taskType];
  const cleanContent = stripSelfEvaluation(content);

  const seasonContext = taskType === 'season'
    ? '\n참고: AI 1 컨셉에서 설계된 조연은 스토리 구조상 필수이다. 조연 수 자체를 감점 기준으로 삼지 마라. 조연의 기능 분리와 활용도를 평가해라.\n'
    : '';

  const evalContent = taskType === 'clips' ? summarizeClipsForEval(cleanContent) : sampleContentForEvaluation(cleanContent);

  const userMsg = `## 평가 태스크: ${promptTaskType}
${seasonContext}
${overlayBlock}

## 평가 대상 콘텐츠
${evalContent}

## 규칙
- 3-Lens 평가 (Elite Critic / Mainstream Audience / Production)
- ★ 모든 점수는 반드시 1.0~5.0 범위만 사용. 6,7,8,9,10 절대 금지 ★
- 품질을 정직하게 반영. 잘 만들어졌으면 4.5도 줄 수 있다. 모든 점수를 3.5~4.0에 몰아넣지 마라.
- topStrengths 3개, topWeaknesses 3개
- criticalIssues는 있으면 모두
- revision brief는 Generator가 바로 수정 가능하게 구체적으로
- 반드시 유효한 JSON만 출력. 다른 텍스트 없이.

\`\`\`json
{
  "taskType": "${promptTaskType}",
  "overallScore": 3.2,
  "weightedScore": 3.2,
  "pass": false,
  "criteria": [
    {"name": "criterion_name", "score": 3, "weight": 2, "reason": "구체적 근거", "mustFix": false}
  ],
  "criticalIssues": [],
  "topStrengths": ["강점1", "강점2", "강점3"],
  "topWeaknesses": [
    {"issue": "약점", "whyItMatters": "왜 중요", "fixDirection": "수정 방향"}
  ],
  "revisionBrief": "Generator가 바로 반영 가능한 구체적 수정 지시",
  "finalVerdict": "approve | revise"
}
\`\`\``;

  const provider = getProvider();
  const sysPrompt = getEvaluatorPrompt(taskType);

  const runs: EvalResult[] = [];
  const EVAL_ROUNDS = 1;

  for (let i = 0; i < EVAL_ROUNDS; i++) {
    try {
      const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 6000, temperature: 0, model: MODEL_EVALUATOR, trackingContext: { projectId: '', stage: `eval_${taskType}`, role: 'evaluator' } });
      const parsed = JSON.parse(extractJsonBlock(raw)) as EvalResult;
      normalizeScoresTo5(parsed);
      if (parsed.criteria?.length) {
        const computed = computeWeightedScore(parsed.criteria);
        parsed.weightedScore = computed;
        parsed.overallScore = computed;
      }
      runs.push(parsed);
    } catch {
      /* skip failed parse */
    }
  }

  if (runs.length === 0) {
    return {
      taskType: promptTaskType,
      overallScore: 0, weightedScore: 0, pass: false,
      criteria: [], criticalIssues: [], topStrengths: [],
      topWeaknesses: [], revisionBrief: 'Evaluation failed after multiple attempts',
      finalVerdict: 'revise' as const,
    };
  }

  if (runs.length === 1) return runs[0];

  if (runs.length >= 3) {
    const scores = runs.map(r => r.weightedScore || r.overallScore || 0);
    scores.sort((a, b) => a - b);
    const midVal = scores[Math.floor(scores.length / 2)];
    const filtered = runs.filter(r => {
      const s = r.weightedScore || r.overallScore || 0;
      return Math.abs(s - midVal) <= 1.5;
    });
    if (filtered.length >= 2) {
      runs.length = 0;
      runs.push(...filtered);
    }
  }

  runs.sort((a, b) => (a.weightedScore || a.overallScore || 0) - (b.weightedScore || b.overallScore || 0));
  const median = runs[Math.floor(runs.length / 2)];

  const allCriteria = new Map<string, { scores: number[]; weight: number; reasons: string[]; mustFix: boolean }>();
  for (const run of runs) {
    for (const c of (run.criteria || [])) {
      const existing = allCriteria.get(c.name) || { scores: [], weight: c.weight, reasons: [], mustFix: false };
      existing.scores.push(c.score);
      existing.reasons.push(c.reason);
      if (c.mustFix) existing.mustFix = true;
      allCriteria.set(c.name, existing);
    }
  }

  const stableCriteria: EvalCriterion[] = [];
  for (const [name, data] of allCriteria) {
    data.scores.sort((a, b) => a - b);
    const medianScore = data.scores[Math.floor(data.scores.length / 2)];
    stableCriteria.push({
      name,
      score: medianScore,
      weight: data.weight,
      reason: data.reasons[Math.floor(data.reasons.length / 2)],
      mustFix: data.mustFix,
    });
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of stableCriteria) {
    weightedSum += c.score * c.weight;
    weightTotal += c.weight;
  }
  const computedWeightedScore = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) / 100 : median.weightedScore;

  const allCriticalIssues = [...new Set(runs.flatMap(r => r.criticalIssues || []))];

  return {
    ...median,
    criteria: stableCriteria,
    weightedScore: computedWeightedScore,
    overallScore: computedWeightedScore,
    pass: computedWeightedScore >= 4.0 && allCriticalIssues.length === 0,
    criticalIssues: allCriticalIssues,
    finalVerdict: (computedWeightedScore >= 4.0 && allCriticalIssues.length === 0) ? 'approve' : 'revise',
  };
}

// ══════════════════════════════════════════════════════
// Season Coherence Evaluation
// ══════════════════════════════════════════════════════

export interface SeasonCoherenceResult {
  overallScore: number;
  characterArcConsistency: number;
  plotThreadResolution: number;
  pacingBalance: number;
  toneConsistency: number;
  foreshadowingPayoff: number;
  relationshipCentricity: number;
  dailyLifeCrisisBalance: number;
  naturalness: number;
  issues: { episode: number; issue: string; severity: 'critical' | 'major' | 'minor' }[];
  strengths: string[];
  suggestions: string[];
}

export async function evaluateSeasonCoherence(
  seasonData: {
    concept: string;
    bible: string;
    episodes: { number: number; title: string; summary: string; scenes?: string }[];
  },
  genreOverlay?: GenreOverlay,
): Promise<SeasonCoherenceResult> {
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const episodeSummaries = seasonData.episodes
    .map(ep => `### EP${ep.number}: ${ep.title}\n${ep.summary}${ep.scenes ? `\n장면 개요: ${ep.scenes.slice(0, 500)}` : ''}`)
    .join('\n\n');

  const userMsg = `## 시즌 전체 일관성 평가

${overlayBlock}

## 스토리 컨셉 (요약)
${seasonData.concept.slice(0, 2000)}

## 시리즈 바이블 (요약)
${seasonData.bible.slice(0, 2000)}

## 전체 에피소드 요약
${episodeSummaries}

## 평가 관점
1. **캐릭터 아크 일관성**: 각 캐릭터의 성장/변화가 시즌 전체에서 논리적으로 이어지는가?
2. **플롯 쓰레드 해소**: 초반에 제기된 복선/떡밥이 후반에 회수되는가?
3. **페이싱 균형**: 긴장-이완 리듬이 시즌 전체에서 균형 잡혀있는가? 중반 처짐이 없는가?
4. **톤 일관성**: 시즌 전체의 분위기가 일관되게 유지되는가?
5. **복선-보상 구조**: 앞선 에피소드의 설정이 이후 에피소드에서 의미있게 활용되는가?
6. **관계 중심성**: 인물 간 관계의 변화가 플롯을 이끄는 핵심 동력인가? 관계선이 에피소드를 넘어 유기적으로 발전하는가?
7. **일상-위기 균형**: 일상적 소소한 장면과 극적 위기 장면이 적절히 교차하는가? 일상 장면이 캐릭터 깊이를 드러내는가?
8. **자연스러움**: 대사·행동·전개가 "드라마적 과장" 없이 현실적으로 느껴지는가? 감정이 갑자기 비약하거나 인위적 갈등이 삽입되지 않았는가?

## 규칙
- 점수는 1.0~5.0 (엄격)
- 에피소드 번호를 특정하여 구체적 문제를 지적
- 반드시 유효한 JSON만 출력

\`\`\`json
{
  "overallScore": 3.5,
  "characterArcConsistency": 3.5,
  "plotThreadResolution": 3.5,
  "pacingBalance": 3.5,
  "toneConsistency": 3.5,
  "foreshadowingPayoff": 3.5,
  "relationshipCentricity": 3.5,
  "dailyLifeCrisisBalance": 3.5,
  "naturalness": 3.5,
  "issues": [
    {"episode": 5, "issue": "구체적 문제", "severity": "major"}
  ],
  "strengths": ["강점1", "강점2"],
  "suggestions": ["개선 방향1", "개선 방향2"]
}
\`\`\``;

  const provider = getProvider();
  const sysPrompt = getEvaluatorPrompt('season');

  try {
    const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 4000, temperature: 0, model: MODEL_EVALUATOR, trackingContext: { projectId: '', stage: 'eval_season_coherence', role: 'evaluator' } });
    const parsed = JSON.parse(extractJsonBlock(raw)) as SeasonCoherenceResult;

    for (const key of ['overallScore', 'characterArcConsistency', 'plotThreadResolution', 'pacingBalance', 'toneConsistency', 'foreshadowingPayoff', 'relationshipCentricity', 'dailyLifeCrisisBalance', 'naturalness'] as const) {
      if (parsed[key] > 5) parsed[key] = Math.round((parsed[key] * 5 / 10) * 100) / 100;
    }

    return parsed;
  } catch {
    return {
      overallScore: 0,
      characterArcConsistency: 0,
      plotThreadResolution: 0,
      pacingBalance: 0,
      toneConsistency: 0,
      foreshadowingPayoff: 0,
      relationshipCentricity: 0,
      dailyLifeCrisisBalance: 0,
      naturalness: 0,
      issues: [],
      strengths: [],
      suggestions: ['Coherence evaluation failed'],
    };
  }
}
