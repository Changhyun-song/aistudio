import { getProvider } from '@/lib/ai';
import {
  getPromptOptimizerPrompt,
  loadSystemPrompt,
} from '@/lib/ai/story-studio/load-system-prompt';
import { promptSupplementRepo, promptSupplementRuleRepo } from '@/lib/db/repository';
import { extractJsonBlock, getSupplementForStage, isContentAgnostic, MODEL_OPTIMIZER } from './utils';
import type { EvalResult } from './evaluator';

export type OptimizeStage = 'ai1' | 'ai2' | 'ai3';

export interface PromptDiagnosis {
  weakPattern: string;
  promptCause: string;
  causeType: 'missing_rule' | 'vague_rule' | 'low_priority' | 'conflicting_rule';
}

export interface SupplementRule {
  action: 'add' | 'replace' | 'strengthen';
  targetSection: string;
  rule: string;
  reason: string;
  replaces?: string;
}

export interface PromptOptimizeResult {
  stage: OptimizeStage;
  diagnosis: PromptDiagnosis[];
  supplementRules: SupplementRule[];
  fullSupplement: string;
  expectedImprovement: string;
  confidence: 'high' | 'medium' | 'low';
}

const STAGE_PROMPT_FILE: Record<OptimizeStage, string> = {
  ai1: 'AI_1_Story_Architect.md',
  ai2: 'AI_2_Screenplay_Director.md',
  ai3: 'AI_3_Frame_Video_Prompt_Designer.md',
};

export async function optimizePrompt(
  projectId: string,
  stage: OptimizeStage,
  generatorOutput: string,
  evaluation: EvalResult,
  plannerFeedback: string,
  userIdea: string,
): Promise<PromptOptimizeResult> {
  const basePrompt = loadSystemPrompt(STAGE_PROMPT_FILE[stage]);
  const currentSupplement = getSupplementForStage(projectId, stage);

  const userMsg = `## 프롬프트 최적화 요청

### Stage: ${stage}

### 사용자 원래 아이디어
${userIdea.slice(0, 1000)}

### 현재 Base 프롬프트 (전문)
${basePrompt}

### 현재 프로젝트별 보충 규칙
${currentSupplement || '(없음 - 아직 보충이 추가되지 않음)'}

### Generator 출력 (요약)
${generatorOutput.slice(0, 2000)}

### Evaluator 평가 결과
- Overall Score: ${evaluation.weightedScore || evaluation.overallScore}
- Pass: ${evaluation.pass}
- Top Weaknesses: ${JSON.stringify(evaluation.topWeaknesses, null, 2)}
- Critical Issues: ${JSON.stringify(evaluation.criticalIssues)}
- Must-Fix Criteria: ${JSON.stringify(evaluation.criteria?.filter(c => c.mustFix), null, 2)}
- Revision Brief: ${evaluation.revisionBrief}

### Planner 피드백
${plannerFeedback}

## 지시
위 정보를 분석해서:
1. 평가에서 반복되는 약점 패턴을 식별
2. 현재 프롬프트에서 그 약점의 원인을 추적
3. 근본 원인을 해결하는 구체적 보충 규칙 생성

★ 중요: fullSupplement는 이전 보충을 포함해 **전체 교체용 통합본**으로 작성해라.
- 이전 보충에서 여전히 유효한 규칙은 유지
- 더 이상 필요 없는 규칙은 제거
- 새 규칙 추가
- 최종 fullSupplement는 3000자 이내로 압축

반드시 유효한 JSON만 출력. 다른 텍스트 없이.

\`\`\`json
{
  "stage": "${stage}",
  "diagnosis": [
    {"weakPattern": "패턴", "promptCause": "원인", "causeType": "missing_rule|vague_rule|low_priority|conflicting_rule"}
  ],
  "supplementRules": [
    {"action": "add|replace|strengthen", "targetSection": "섹션명", "rule": "실제 규칙 텍스트", "reason": "이유"}
  ],
  "fullSupplement": "모든 보충 규칙을 합친 마크다운 텍스트",
  "expectedImprovement": "예상 개선 효과",
  "confidence": "high|medium|low"
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(getPromptOptimizerPrompt(), userMsg, { maxTokens: 4000, temperature: 0, model: MODEL_OPTIMIZER });

  try {
    const result = JSON.parse(extractJsonBlock(raw)) as PromptOptimizeResult;

    if (result.fullSupplement) {
      promptSupplementRepo.upsert(projectId, stage, result.fullSupplement, JSON.stringify(result.diagnosis));

      if (isContentAgnostic(result.fullSupplement)) {
        promptSupplementRepo.upsertGlobal(stage, result.fullSupplement, JSON.stringify(result.diagnosis));
      }

      for (const rule of (result.supplementRules || [])) {
        promptSupplementRuleRepo.create({
          projectId,
          stage,
          ruleText: rule.rule,
          source: 'optimizer',
          scoreBefore: evaluation.weightedScore || evaluation.overallScore,
        });
      }
    }

    return result;
  } catch {
    return {
      stage,
      diagnosis: [],
      supplementRules: [],
      fullSupplement: '',
      expectedImprovement: 'Parse failed',
      confidence: 'low',
    };
  }
}
