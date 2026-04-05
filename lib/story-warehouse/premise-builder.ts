/**
 * Premise Builder — 2단계: 씨앗 조합을 받아 AI가 스토리 전제를 생성
 *
 * - 높은 temperature (0.95)로 다양성 확보
 * - 가장 싼 모델 사용 (비용 최소화)
 * - 하나의 씨앗으로 2개의 다른 방향 제시
 */

import { getProvider } from '@/lib/ai';
import { extractJsonBlock } from '@/lib/story/utils';
import { seedToPromptText, type StorySeed } from './seed-generator';

export interface StoryPremise {
  seedId: string;
  variantIndex: number;
  title: string;
  logline: string;
  synopsis: string;
  innerConflict: string;
  outerObstacle: string;
  tone: string;
  expectedEpisodes: string;
  hook: string;
  genre: string;
  targetAudience: string;
  tags: string[];
}

const SYSTEM_PROMPT = `너는 한국 드라마 스토리 전문 작가다.
주어진 소재 조합(씨앗)을 받아서, 이것들을 유기적으로 엮어 매력적인 드라마 스토리 전제(premise)를 만들어라.

규칙:
1. 모든 소재 요소를 의미 있게 연결해라. 억지로 붙이지 말고, 자연스럽게 하나의 이야기가 되게.
2. 로그라인은 반드시 "누가 + 무엇을 하는데 + 왜 어려운지" 구조.
3. 시놉시스는 시작→중간→결말 방향이 보여야 하지만, 결말은 완전히 밝히지 마라.
4. 갈등은 반드시 "내적 갈등"과 "외적 장애물" 두 축으로.
5. 뻔한 설정은 피하고, 소재 조합에서 나오는 독특한 조합의 매력을 극대화해라.
6. 하나의 씨앗 조합으로 2개의 완전히 다른 방향을 제시해라.

반드시 아래 JSON 배열만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "title": "강렬하고 기억에 남는 제목",
    "logline": "1문장 로그라인 (누가 + 무엇을 + 왜 어려운지)",
    "synopsis": "3~5문장 시놉시스 (시작-중간-결말 방향)",
    "innerConflict": "주인공의 내적 갈등 (1~2문장)",
    "outerObstacle": "외적 장애물 (1~2문장)",
    "tone": "분위기/톤 (예: 긴장감 있는 멜로, 유머러스한 스릴러)",
    "expectedEpisodes": "단편 1화 / 미니시리즈 4화 / 시즌 8~12화 중 하나",
    "hook": "이 이야기만의 고유한 매력 포인트 (1~2문장)",
    "genre": "메인 장르",
    "targetAudience": "타겟 시청자",
    "tags": ["태그1", "태그2", "태그3"]
  }
]
\`\`\``;

const MODEL_WAREHOUSE = process.env.OPENAI_MODEL_WAREHOUSE || process.env.OPENAI_MODEL_EVALUATOR || 'gpt-5.4-mini';

export async function buildPremises(seed: StorySeed): Promise<StoryPremise[]> {
  const provider = getProvider();
  const seedText = seedToPromptText(seed);

  const userMsg = `아래 소재 씨앗 조합으로 2개의 완전히 다른 스토리 전제를 만들어줘.

=== 소재 씨앗 ===
${seedText}

중요: 이 소재들을 억지로 나열하지 말고, 하나의 유기적인 이야기로 엮어라.
2개의 전제는 같은 소재를 사용하되, 장르 비중/톤/주인공/방향이 완전히 달라야 한다.`;

  try {
    const raw = await provider.chat(SYSTEM_PROMPT, userMsg, {
      maxTokens: 3000,
      temperature: 0.95,
      model: MODEL_WAREHOUSE,
    });

    const parsed = JSON.parse(extractJsonBlock(raw));
    if (!Array.isArray(parsed)) return [];

    return parsed.map((p: Record<string, unknown>, i: number): StoryPremise => ({
      seedId: seed.id,
      variantIndex: i,
      title: (p.title as string) || 'Untitled',
      logline: (p.logline as string) || '',
      synopsis: (p.synopsis as string) || '',
      innerConflict: (p.innerConflict as string) || '',
      outerObstacle: (p.outerObstacle as string) || '',
      tone: (p.tone as string) || '',
      expectedEpisodes: (p.expectedEpisodes as string) || '',
      hook: (p.hook as string) || '',
      genre: (p.genre as string) || '',
      targetAudience: (p.targetAudience as string) || '',
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    }));
  } catch {
    return [];
  }
}

/**
 * 여러 씨앗에 대해 배치 처리
 */
export async function buildPremisesBatch(seeds: StorySeed[]): Promise<StoryPremise[]> {
  const results: StoryPremise[] = [];
  for (const seed of seeds) {
    const premises = await buildPremises(seed);
    results.push(...premises);
  }
  return results;
}
