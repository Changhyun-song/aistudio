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
주어진 소재 씨앗을 바탕으로 **명확하고 이해 가능한** 드라마 스토리 전제(premise)를 만들어라.

★ 최우선 원칙: 단순하고 강렬하게
- "핵심 전제(what-if)"가 이야기의 중심축이다. 이걸 중심으로 모든 것을 구성해라.
- 보조 소재는 중심을 돋보이게 하는 배경/톤일 뿐이다. 빠지는 소재가 있어도 된다.

★★★ 절대 금지: "조직 음모" 공식 ★★★
아래 패턴은 전부 금지다. 하나라도 쓰면 불합격:
- "회사/조직/정부가 비밀을 은폐한다"
- "내부 세력이 주인공을 추적한다"
- "거대한 시스템/권력이 진실을 감춘다"
- "주인공이 진실을 밝혀 세상을 바꾼다"
- "데이터 조작 / 불법 실험 / 음모론"

이 패턴이 왜 금지인가:
→ "울면 비가 온다" → 기상청이 데이터를 조작... (✗ 공식 대입)
→ "음악이 사라진 세계" → AI 통치 시스템이 음악을 삭제... (✗ 공식 대입)
→ "거짓말이 얼굴에 드러남" → 회사 불법 조작, 내부 고발... (✗ 공식 대입)
이 모든 결과는 같은 스릴러 공식이다. 다양한 이야기가 아니라 템플릿 대입이다.

★★ 갈등은 "거대한 적"이 아니다 ★★
씨앗에 "갈등 유형"이 지정되어 있으면 반드시 그 유형으로 써라.
지정이 없더라도, 갈등은 다음 중 하나여야 한다:

- 관계 갈등: 소재 때문에 사랑하는 사람과의 관계가 위태로워짐
  예) "울면 비가 온다" → 좋아하는 사람 앞에서 절대 울면 안 되는 여자
- 내면 갈등: 소재가 주는 능력/저주를 받아들일 것인가
  예) "감정을 사고팔 수 있다면" → 슬픔을 팔아 행복해졌지만 점점 공허해지는 사람
- 상황 갈등: 소재가 일상에서 만드는 구체적 문제들
  예) "울면 비가 온다" → 가뭄 마을에서 "울어주세요" 부탁받는 사람
- 도덕 갈등: 소재를 어떻게 쓰는 게 옳은가
  예) "기억을 지우는 약" → 치매 환자에게 쓸 수 있는데, 그게 옳은가
- 성장 갈등: 소재를 통해 자신의 상처를 이해해가는 과정
  예) "울면 비가 온다" → 울지 않으려고 감정을 닫아버린 아이가 다시 우는 법을 배움
- 상실/정체성 갈등: 소재가 "나는 누구인가"를 흔드는 이야기

★ 로그라인 필수 구조:
"[주인공]이(가) [핵심 사건/상황]에 빠지면서 [목표]를 추구하지만, [하나의 장애물] 때문에 어렵다."
→ 이 한 문장이 명확하지 않으면 실패한 아이디어다.
→ 장애물은 "조직의 추적"이 아니라 "주인공 자신의 감정/관계/상황"이어야 한다.

★★ 시놉시스 필수 구조: 인과 체인 ★★
시놉시스는 "사건의 인과적 흐름"이어야 한다.

좋은 구조:
  "[주인공]은 [일상]을 보내고 있다.
  → 그런데 [핵심 사건]이 벌어진다.
  → 그래서 [주인공의 선택/행동]을 하게 된다.
  → 그런데 [예상치 못한 장애물]이 나타난다.
  → 결국 [주인공이 직면하는 핵심 딜레마]에 빠진다."

나쁜 구조:
  "A라는 설정이 있다. 그리고 B라는 캐릭터가 있다."
  → 설정 나열이다. 이건 이야기가 아니다.

★ 인과 연결어 규칙:
- 허용: "그래서", "그런데", "결국", "하지만", "때문에", "그러자"
- 금지: "그리고", "또한", "한편", "뿐만 아니라"

★ 2개 방향의 다양성 규칙:
하나의 씨앗으로 2개를 만들되, **반드시 서로 다른 장르/톤**이어야 한다.
예를 들어 "울면 비가 온다"로:
  1번: 로맨스 — 좋아하는 사람 앞에서 울면 안 되는 여자의 이야기
  2번: 가족극 — 엄마 장례식에서 울고 싶지만 동네가 침수될까봐 참는 딸
둘 다 스릴러이면 안 된다. 둘 다 "조직의 비밀"이면 안 된다.
최소 1개는 로맨스, 가족극, 성장물, 힐링, 코미디, 일상 드라마 중 하나여야 한다.

★ 추가 금지:
- 키워드 짜맞추기 금지
- 갈등 3개 이상 금지: 핵심 1개, 보조 최대 1개
- 장르 3개 이상 믹스 금지
- 세계관 설명으로 시놉시스를 채우지 마라

반드시 아래 JSON 배열만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "title": "강렬하고 기억에 남는 제목 (5~8자)",
    "logline": "1문장 로그라인 — 누가, 무엇을, 왜 어려운지가 명확해야 함",
    "synopsis": "3~5문장 시놉시스 — 인과 체인 구조 필수. '그래서/그런데/결국' 연결어 사용.",
    "innerConflict": "주인공의 핵심 내적 갈등 1가지 (1~2문장) — 조직이 아니라 감정/관계에서 오는 갈등",
    "outerObstacle": "핵심 외적 장애물 1가지 — 회사/조직/정부가 아닌, 일상적이고 구체적인 장애물",
    "tone": "분위기/톤 (예: 따뜻한 로맨스, 잔잔한 가족극, 유쾌한 성장물)",
    "expectedEpisodes": "단편 1화 / 미니시리즈 4화 / 시즌 8~12화 중 하나",
    "hook": "이 이야기만의 고유 매력 — 한 문장으로 왜 보고 싶은지",
    "genre": "메인 장르 1개 (2개 중 최소 1개는 스릴러가 아닌 장르)",
    "targetAudience": "타겟 시청자",
    "tags": ["태그1", "태그2", "태그3"]
  }
]
\`\`\``;

const MODEL_WAREHOUSE = process.env.OPENAI_MODEL_WAREHOUSE || process.env.OPENAI_MODEL_EVALUATOR || 'gpt-5.4-mini';

export async function buildPremises(seed: StorySeed): Promise<StoryPremise[]> {
  const provider = getProvider();
  const seedText = seedToPromptText(seed);

  const userMsg = `아래 소재 씨앗으로 2개의 다른 스토리 전제를 만들어줘.

=== 소재 씨앗 ===
${seedText}

★ 핵심 규칙:
1. "핵심 전제(what-if)"를 이야기의 중심축으로 삼아라
2. "갈등 유형"이 지정되어 있으면 반드시 그 유형으로 갈등을 구성해라
3. 2개는 서로 다른 장르/톤이어야 한다. 둘 다 스릴러 금지. 최소 1개는 따뜻한/일상적 장르로.
4. ★★ 절대 금지: "조직이 비밀을 은폐하고 주인공이 진실을 밝힌다" 패턴
   → 이걸 쓰면 불합격이다. 갈등은 조직이 아니라 인간관계/감정/일상에서 와야 한다.
5. 시놉시스는 인과 체인으로: "[상황] → 그런데 [사건] → 그래서 [행동] → 하지만 [장애물] → 결국 [딜레마]"
6. 소재의 "감정적 가능성"을 탐색해라. 같은 소재도 로맨스, 가족극, 성장물로 만들 수 있다.`;

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await provider.chat(SYSTEM_PROMPT, userMsg, {
        maxTokens: 3000,
        temperature: 0.95,
        model: MODEL_WAREHOUSE,
      });

      const jsonStr = extractJsonBlock(raw);
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error(`[PremiseBuilder] seed=${seed.id} attempt=${attempt}: parsed result is not a non-empty array. Raw snippet: ${raw.slice(0, 200)}`);
        if (attempt < MAX_RETRIES) continue;
        return [];
      }

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
    } catch (err) {
      console.error(`[PremiseBuilder] seed=${seed.id} attempt=${attempt} error:`, (err as Error).message);
      if (attempt >= MAX_RETRIES) throw new Error(`Premise 생성 실패 (seed=${seed.id}): ${(err as Error).message}`);
    }
  }
  return [];
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
