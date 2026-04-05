import { getProvider } from '@/lib/ai';
import { getPlannerPrompt } from '@/lib/ai/story-studio/load-system-prompt';
import type { GenreOverlay } from '@/types';
import { extractJsonBlock, formatOverlayBlock, MODEL_PLANNER } from './utils';
import type { EvalTaskType, EvalResult } from './evaluator';

export type PlannerAction = 'approve' | 'revise_partial' | 'revise_full' | 'ask_user';

export interface RevisionTarget {
  target: string;
  problem: string;
  whyItMatters: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  fixStrategy: string;
  expectedImpact: string;
}

export interface PlannerInitResult {
  stage: string;
  goal: string;
  successContract: string[];
  generatorInstructions: string;
}

export interface PlannerDecisionResult {
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

const STAGE_DISPLAY: Record<EvalTaskType, string> = {
  concept: 'Story Architect',
  bible: 'Story Architect',
  season: 'Screenplay Director',
  script: 'Screenplay Director',
  clips: 'Frame & Video Prompt Designer',
};

export async function plannerInit(
  taskType: EvalTaskType,
  projectContext: string,
  genreOverlay?: GenreOverlay,
): Promise<PlannerInitResult> {
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const stage = STAGE_DISPLAY[taskType];

  const userMsg = `## 프로젝트 시작: ${stage} 단계

${overlayBlock}

## 프로젝트 컨텍스트
${projectContext.slice(0, 4000)}

이 단계의 목표, success contract, Generator 지침을 JSON으로 출력해줘.

\`\`\`json
{
  "stage": "${stage}",
  "goal": "이 단계의 목표",
  "successContract": ["기준1", "기준2", "기준3"],
  "generatorInstructions": "Generator에게 전달할 지침"
}
\`\`\`
반드시 유효한 JSON만 출력. 다른 텍스트 없이.`;

  const provider = getProvider();
  const raw = await provider.chat(getPlannerPrompt(taskType), userMsg, { maxTokens: 2000, temperature: 0, model: MODEL_PLANNER, trackingContext: { projectId: '', stage: `plan_init_${taskType}`, role: 'planner' } });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    return {
      stage,
      goal: '품질 높은 결과 생성',
      successContract: ['평가 점수 4.0 이상', '치명적 이슈 없음'],
      generatorInstructions: '시스템 프롬프트의 지시를 정확히 따르세요.',
    };
  }
}

export async function plannerInterpretEvaluation(
  taskType: EvalTaskType,
  evaluation: EvalResult,
  loop: number,
  previousStrategies?: string[],
  genreOverlay?: GenreOverlay,
): Promise<PlannerDecisionResult> {
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const stage = STAGE_DISPLAY[taskType];
  const prevBlock = previousStrategies?.length
    ? `## 이전 수정 전략 이력\n${previousStrategies.map((s, i) => `Loop ${i + 1}: ${s}`).join('\n')}\n\n같은 전략 반복 금지. 개선되지 않은 부분은 다른 접근으로 시도해라.`
    : '';

  const userMsg = `## 평가 해석 요청: ${stage} (Loop ${loop})

${overlayBlock}

## Evaluator 결과
${JSON.stringify(evaluation, null, 2)}

${prevBlock}

## 의사결정 규칙
- stage별 최대 자동 수정 2회
- critical issue가 있으면 revise
- weightedScore ≥ 4.0 + critical 없음 → approve 가능
- weightedScore 3.0~3.9 → revise_partial 또는 revise_full
- weightedScore < 3.0 → revise_full
- 방향성 갈림 → ask_user

\`\`\`json
{
  "stage": "${stage}",
  "goal": "현재 목표",
  "successContract": ["기준"],
  "currentVersion": "현재 버전 요약",
  "evaluationSummary": "평가 결과 해석",
  "decision": "approve | revise_partial | revise_full | ask_user",
  "replanReason": "왜 이 결정인지",
  "revisionTargets": [
    {"target": "대상", "problem": "문제", "whyItMatters": "왜 중요", "priority": "critical", "fixStrategy": "전략", "expectedImpact": "효과"}
  ],
  "nextAction": "다음 할 일"
}
\`\`\`
반드시 유효한 JSON만 출력. 다른 텍스트 없이.`;

  const provider = getProvider();
  const raw = await provider.chat(getPlannerPrompt(taskType), userMsg, { maxTokens: 4000, temperature: 0, model: MODEL_PLANNER, trackingContext: { projectId: '', stage: `plan_interpret_${taskType}`, role: 'planner' } });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    const mustFixItems = evaluation.criteria?.filter(c => c.mustFix) || [];
    return {
      stage,
      goal: '품질 개선',
      successContract: ['평가 점수 향상'],
      currentVersion: '현재 버전',
      evaluationSummary: `Score: ${evaluation.weightedScore || evaluation.overallScore}`,
      decision: evaluation.weightedScore >= 4.0 ? 'approve' : 'revise_partial',
      replanReason: 'Auto-fallback from parse failure',
      revisionTargets: mustFixItems.map(item => ({
        target: item.name,
        problem: item.reason,
        whyItMatters: '필수 수정 항목',
        priority: 'high' as const,
        fixStrategy: `${item.name} 개선`,
        expectedImpact: '품질 향상',
      })),
      nextAction: '수정 후 재평가',
    };
  }
}
