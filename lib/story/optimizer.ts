import path from 'path';
import { getProvider } from '@/lib/ai';
import {
  getPromptOptimizerPrompt,
  loadSystemPrompt,
} from '@/lib/ai/story-studio/load-system-prompt';
import { promptSupplementRepo, promptSupplementRuleRepo } from '@/lib/db/repository';
import type { RuleScope } from '@/lib/db/repository';
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
  scope: RuleScope;
  genreTags: string[];
}

export interface PromptOptimizeResult {
  stage: OptimizeStage;
  diagnosis: PromptDiagnosis[];
  supplementRules: SupplementRule[];
  fullSupplement: string;
  expectedImprovement: string;
  confidence: 'high' | 'medium' | 'low';
  promotedRules: string[];
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

  const globalRules = promptSupplementRuleRepo.listGlobalActive(stage);
  const globalSection = globalRules.length > 0
    ? globalRules.map((r, i) => `G${i + 1}. ${r.rule_text}`).join('\n')
    : '(없음)';

  const userMsg = `## 프롬프트 최적화 요청

### Stage: ${stage}

### 사용자 원래 아이디어
${userIdea.slice(0, 1000)}

### 현재 Base 프롬프트 (전문)
${basePrompt}

### 현재 보충 규칙 (적용 중)
${currentSupplement || '(없음)'}

### 현재 글로벌 학습 규칙 (프로젝트 공통)
${globalSection}

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

★ 규칙 분류 기준:
- scope: "global" = 어떤 프로젝트/장르에서든 적용 가능한 범용 규칙
  예: "대사는 보여주기(show) 방식으로 작성", "장면 전환 시 감정선 연결"
- scope: "project" = 이 프로젝트의 장르/톤/세계관에 특화된 규칙
  예: "판타지 세계관 규칙 일관성 유지", "학원물 대사 자연스러움"

★ 장르 태그 (scope: "project"인 규칙만):
- 나중에 비슷한 장르의 프로젝트가 참고할 수 있도록 태그를 붙여라
- 예: ["로맨스", "학원물"], ["판타지", "액션"], ["느와르", "스릴러"]

★ fullSupplement는 이전 보충을 포함해 **전체 교체용 통합본**으로 작성해라.
- 최종 fullSupplement는 3000자 이내로 압축

반드시 유효한 JSON만 출력. 다른 텍스트 없이.

\`\`\`json
{
  "stage": "${stage}",
  "diagnosis": [
    {"weakPattern": "패턴", "promptCause": "원인", "causeType": "missing_rule|vague_rule|low_priority|conflicting_rule"}
  ],
  "supplementRules": [
    {
      "action": "add|replace|strengthen",
      "targetSection": "섹션명",
      "rule": "실제 규칙 텍스트",
      "reason": "이유",
      "scope": "global|project",
      "genreTags": ["태그1", "태그2"]
    }
  ],
  "fullSupplement": "모든 보충 규칙을 합친 마크다운 텍스트",
  "expectedImprovement": "예상 개선 효과",
  "confidence": "high|medium|low"
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(getPromptOptimizerPrompt(), userMsg, { maxTokens: 4000, temperature: 0, model: MODEL_OPTIMIZER });

  try {
    const result = JSON.parse(extractJsonBlock(raw));

    const promotedRules: string[] = [];

    if (result.fullSupplement) {
      promptSupplementRepo.upsert(projectId, stage, result.fullSupplement, JSON.stringify(result.diagnosis));

      if (isContentAgnostic(result.fullSupplement)) {
        promptSupplementRepo.upsertGlobal(stage, result.fullSupplement, JSON.stringify(result.diagnosis));
      }

      for (const rule of (result.supplementRules || [])) {
        const ruleScope: RuleScope = rule.scope === 'global' ? 'global' : 'project';
        const genreTags: string[] = Array.isArray(rule.genreTags) ? rule.genreTags : [];
        const isCA = ruleScope === 'global' || isContentAgnostic(rule.rule);

        promptSupplementRuleRepo.create({
          projectId,
          stage,
          ruleText: rule.rule,
          source: 'optimizer',
          scoreBefore: evaluation.weightedScore || evaluation.overallScore,
          scope: isCA ? 'global' : ruleScope,
          genreTags,
          isContentAgnostic: isCA,
        });
      }
    }

    const autoPromoted = promptSupplementRuleRepo.tryAutoPromote(stage);
    for (const r of autoPromoted) {
      promotedRules.push(r.rule_text);
      console.log(`[Optimizer] Global 승격: "${r.rule_text.slice(0, 60)}..." (eff: ${r.effectiveness})`);
    }

    for (const gRule of globalRules) {
      const scoreAfter = evaluation.weightedScore || evaluation.overallScore || 0;
      const scoreBefore = gRule.score_before ?? 0;
      promptSupplementRuleRepo.recordGlobalApplication(gRule.id, scoreAfter > scoreBefore);
    }

    return {
      stage: result.stage || stage,
      diagnosis: result.diagnosis || [],
      supplementRules: result.supplementRules || [],
      fullSupplement: result.fullSupplement || '',
      expectedImprovement: result.expectedImprovement || '',
      confidence: result.confidence || 'low',
      promotedRules,
    };
  } catch {
    return {
      stage,
      diagnosis: [],
      supplementRules: [],
      fullSupplement: '',
      expectedImprovement: 'Parse failed',
      confidence: 'low',
      promotedRules: [],
    };
  }
}

// ══════════════════════════════════════════════════════
// Global Rule Consolidation
// N개 이상의 global 규칙이 쌓이면 원본 프롬프트에 통합
// ══════════════════════════════════════════════════════

const CONSOLIDATION_THRESHOLD = 10;

export interface ConsolidationResult {
  stage: OptimizeStage;
  consolidatedRules: number;
  newPromptLength: number;
  retiredRuleIds: string[];
}

export async function consolidateGlobalRules(
  stage: OptimizeStage,
): Promise<ConsolidationResult | null> {
  const globalRules = promptSupplementRuleRepo.listGlobalActive(stage);
  if (globalRules.length < CONSOLIDATION_THRESHOLD) return null;

  const promptFile = STAGE_PROMPT_FILE[stage];
  const basePrompt = loadSystemPrompt(promptFile);

  const ruleList = globalRules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n');

  const userMsg = `## 프롬프트 통합 요청

아래 Base 프롬프트에 ${globalRules.length}개의 검증된 글로벌 학습 규칙을 자연스럽게 통합해라.

### Base 프롬프트
${basePrompt}

### 통합할 글로벌 규칙 (모두 검증됨)
${ruleList}

## 지시
1. 글로벌 규칙을 Base 프롬프트의 적절한 위치에 자연스럽게 녹여라
2. 중복되는 규칙은 하나로 합쳐라
3. Base 프롬프트의 기존 구조/섹션은 유지해라
4. 결과물은 통합된 완전한 프롬프트만 출력해라
5. 마크다운 형식 유지

통합된 프롬프트만 출력. JSON이 아니라 마크다운 텍스트로.`;

  try {
    const provider = getProvider();
    const consolidated = await provider.chat(
      '너는 AI 시스템 프롬프트 전문 편집자다. 기존 프롬프트에 검증된 규칙을 자연스럽게 통합하는 역할이다.',
      userMsg,
      { maxTokens: 16000, temperature: 0, model: MODEL_OPTIMIZER },
    );

    if (!consolidated || consolidated.length < basePrompt.length * 0.5) {
      console.error('[Consolidation] Result too short, skipping');
      return null;
    }

    const fs = await import('fs');
    const promptPath = path.join(process.cwd(), 'docs', 'ai-prompts', promptFile);
    const backupPath = promptPath + `.backup-${Date.now()}`;
    fs.writeFileSync(backupPath, basePrompt, 'utf-8');
    fs.writeFileSync(promptPath, consolidated, 'utf-8');

    const retiredIds: string[] = [];
    for (const rule of globalRules) {
      promptSupplementRuleRepo.retire(rule.id);
      retiredIds.push(rule.id);
    }

    console.log(`[Consolidation] ${stage}: ${globalRules.length} rules merged into base prompt. Backup at ${backupPath}`);

    return {
      stage,
      consolidatedRules: globalRules.length,
      newPromptLength: consolidated.length,
      retiredRuleIds: retiredIds,
    };
  } catch (err) {
    console.error(`[Consolidation] ${stage} failed:`, err);
    return null;
  }
}

export async function checkAndConsolidate(): Promise<ConsolidationResult[]> {
  const results: ConsolidationResult[] = [];
  for (const stage of ['ai1', 'ai2', 'ai3'] as OptimizeStage[]) {
    const count = promptSupplementRuleRepo.listGlobalActive(stage).length;
    if (count >= CONSOLIDATION_THRESHOLD) {
      const r = await consolidateGlobalRules(stage);
      if (r) results.push(r);
    }
  }
  return results;
}
