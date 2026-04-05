/**
 * Idea Evaluator — 3단계: 스토리 전제를 5개 기준으로 평가
 *
 * - temperature=0으로 일관된 평가
 * - 3.5점(5점 만점) 이상만 통과
 * - 가장 싼 모델 사용
 */

import { getProvider } from '@/lib/ai';
import { extractJsonBlock } from '@/lib/story/utils';
import type { StoryPremise } from './premise-builder';

export interface IdeaEvaluation {
  freshness: number;
  conflictPotential: number;
  empathy: number;
  visualPotential: number;
  expandability: number;
  overall: number;
  verdict: 'pass' | 'fail';
  strengths: string[];
  weaknesses: string[];
  oneLiner: string;
}

export interface EvaluatedPremise extends StoryPremise {
  evaluation: IdeaEvaluation;
}

const EVAL_SYSTEM = `너는 드라마 기획사의 수석 심사역이다. 스토리 전제(premise)를 냉정하고 정확하게 평가해라.

평가 기준 (각 1~5점):
1. freshness (참신함): 기존에 많이 본 설정인가? 독창적 요소가 있는가?
   - 1점: 어디서 많이 봤음 / 3점: 보통 / 5점: 이런 건 처음이다
2. conflictPotential (갈등 잠재력): 이 전제에서 충분한 갈등과 긴장이 나올 수 있는가?
   - 1점: 갈등이 약함 / 3점: 기본적 / 5점: 갈등이 자연스럽게 끝없이 나옴
3. empathy (공감 가능성): 시청자가 주인공에게 감정이입할 수 있는가?
   - 1점: 공감 어려움 / 3점: 보통 / 5점: 바로 몰입됨
4. visualPotential (시각적 잠재력): 영상으로 만들었을 때 볼거리가 있는가?
   - 1점: 대화만 / 3점: 보통 / 5점: 강력한 비주얼 장면이 그려짐
5. expandability (확장성): 1화에서 끝나지 않고 시즌으로 이어갈 수 있는가?
   - 1점: 단편이 한계 / 3점: 4화 가능 / 5점: 시즌 3까지도 가능

채점 규칙:
- 4점 이상은 정말 뛰어난 경우만
- 3점이 "괜찮은" 기본값
- 뻔한 로맨스 설정에 freshness 4점 주지 마라
- 일상물에 visualPotential 4점 주지 마라

반드시 JSON만 출력:
\`\`\`json
{
  "freshness": 3,
  "conflictPotential": 4,
  "empathy": 3,
  "visualPotential": 4,
  "expandability": 3,
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1"],
  "oneLiner": "이 아이디어에 대한 한 줄 평 (예: '설정은 좋은데 갈등이 약하다')"
}
\`\`\``;

const MODEL_WAREHOUSE = process.env.OPENAI_MODEL_WAREHOUSE || process.env.OPENAI_MODEL_EVALUATOR || 'gpt-5.4-mini';
const PASS_THRESHOLD = 3.5;

export async function evaluatePremise(premise: StoryPremise): Promise<IdeaEvaluation> {
  const provider = getProvider();

  const userMsg = `아래 스토리 전제를 평가해줘:

제목: ${premise.title}
로그라인: ${premise.logline}
시놉시스: ${premise.synopsis}
내적 갈등: ${premise.innerConflict}
외적 장애물: ${premise.outerObstacle}
톤: ${premise.tone}
예상 화수: ${premise.expectedEpisodes}
고유 매력: ${premise.hook}`;

  try {
    const raw = await provider.chat(EVAL_SYSTEM, userMsg, {
      maxTokens: 1000,
      temperature: 0,
      model: MODEL_WAREHOUSE,
    });

    const parsed = JSON.parse(extractJsonBlock(raw));

    const scores = {
      freshness: clamp(parsed.freshness || 3),
      conflictPotential: clamp(parsed.conflictPotential || 3),
      empathy: clamp(parsed.empathy || 3),
      visualPotential: clamp(parsed.visualPotential || 3),
      expandability: clamp(parsed.expandability || 3),
    };

    const overall = (
      scores.freshness * 0.25 +
      scores.conflictPotential * 0.25 +
      scores.empathy * 0.2 +
      scores.visualPotential * 0.15 +
      scores.expandability * 0.15
    );

    return {
      ...scores,
      overall: Math.round(overall * 10) / 10,
      verdict: overall >= PASS_THRESHOLD ? 'pass' : 'fail',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      oneLiner: parsed.oneLiner || '',
    };
  } catch {
    return {
      freshness: 0, conflictPotential: 0, empathy: 0,
      visualPotential: 0, expandability: 0,
      overall: 0, verdict: 'fail',
      strengths: [], weaknesses: ['평가 실패'],
      oneLiner: '평가 중 오류 발생',
    };
  }
}

export async function evaluateAndFilter(premises: StoryPremise[]): Promise<EvaluatedPremise[]> {
  const results: EvaluatedPremise[] = [];

  for (const premise of premises) {
    const evaluation = await evaluatePremise(premise);
    results.push({ ...premise, evaluation });
  }

  return results.sort((a, b) => b.evaluation.overall - a.evaluation.overall);
}

function clamp(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v * 10) / 10));
}

export { PASS_THRESHOLD };
