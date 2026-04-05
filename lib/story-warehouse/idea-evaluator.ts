/**
 * Idea Evaluator — 4단계: event_chain 기반 드라마를 평가
 *
 * 평가 기준 (5개):
 * 1. watchability (이 이야기를 영상으로 보고 싶은가) — 30%, hard fail < 3
 * 2. characterLikability (캐릭터를 좋아하게 되는가) — 20%
 * 3. relationshipDriven (관계가 이야기를 끄는가) — 20%
 * 4. naturalness (자연스러운가) — 15%, hard fail < 3
 * 5. premiseInRelationship (소재가 관계를 아프게 만드는가) — 15%
 */

import { getProvider } from '@/lib/ai';
import { extractJsonBlock } from '@/lib/story/utils';
import type { DramaOutput } from './drama-engine';
import { checkForFormula, checkPremiseNecessity } from './anti-cliche-filter';

export interface DramaEvaluation {
  watchability: number;
  characterLikability: number;
  relationshipDriven: number;
  naturalness: number;
  premiseInRelationship: number;
  formulaPenalty: number;
  overall: number;
  verdict: 'pass' | 'fail';
  strengths: string[];
  weaknesses: string[];
  oneLiner: string;
}

export interface EvaluatedDrama extends DramaOutput {
  evaluation: DramaEvaluation;
}

const EVAL_SYSTEM = `너는 드라마 기획사의 수석 심사역이다.
event_chain(사건 체인) 형태의 드라마를 평가해라. "기획서가 잘 정리되었나"가 아니라 "시청자가 보고 싶은 이야기인가"를 본다.

★★ 평가 기준 (5개, 각각 엄격하게) ★★

1. watchability (이 이야기를 영상으로 보고 싶은가) — 가중치 30%, 3점 미만 시 무조건 불합격:
   - 5점: 시놉시스만 읽어도 1화를 켜고 싶다. "이 다음에 뭐가 되는데?"가 멈추지 않는다.
   - 4점: 끝까지 읽히고 흥미롭지만 1~2 beat에서 예측됨.
   - 3점: 설정은 신기한데 보고 싶진 않다. 이야기가 안 끌린다.
   - 2점: 기획서로는 괜찮지만 영상으로 보고 싶은 마음이 안 듦.
   - 1점: 읽다가 멈춤.
   ★ 절대 규칙: "예측 가능" "뻔하다" 키워드를 사용했으면 4점 이상 불가

2. characterLikability (캐릭터를 좋아하게 되는가) — 가중치 20%:
   - 5점: 일상 장면만으로 이 사람이 좋다. 위기가 오면 진심으로 걱정됨.
   - 4점: 흥미로운 캐릭터지만 좋아하기까지는 시간이 더 필요.
   - 3점: 사건의 도구처럼 느껴짐. 이름을 바꿔도 같은 이야기.
   - 2점: 캐릭터가 플롯에 끌려다님.
   - 1점: 캐릭터가 없어도 이야기 진행됨.

3. relationshipDriven (관계가 이야기를 끄는가) — 가중치 20%:
   - 5점: 두 사람의 대화/행동만으로 장면이 성립. 소재가 관계를 압박하는 장치로 작동.
   - 4점: 관계가 중요하긴 하지만 세계관 규칙이 더 눈에 띔.
   - 3점: 관계가 있지만 이야기를 끄는 건 설정/사건.
   - 2점: 캐릭터가 설정 전달 도구.
   - 1점: 관계 자체가 없거나 기능하지 않음.

4. naturalness (자연스러운가) — 가중치 15%, 3점 미만 시 무조건 불합격:
   - 5점: 우연 없이 캐릭터 선택에서 모든 사건이 나옴. 모든 행동이 납득됨.
   - 4점: 대부분 자연스럽지만 1개가 플롯 장치 느낌.
   - 3점: 우연 1~2번 또는 비합리적 행동.
   - 2점: "마침" 패턴 2회+. 캐릭터가 플롯에 끌려다님.
   - 1점: 전체가 감동 시퀀스 역설계.

5. premiseInRelationship (소재가 관계를 아프게 만드는가) — 가중치 15%:
   - 5점: 소재를 빼면 이 관계의 아픔이 성립 안 함. 소재와 관계가 불가분.
   - 4점: 소재가 관계에 영향을 주지만 빼도 비슷한 갈등 가능.
   - 3점: 소재가 배경. 관계의 갈등이 소재와 무관하게 진행.
   - 2점: 소재가 첫 설정에만 쓰이고 관계와 별개.
   - 1점: 소재와 관계가 완전히 분리.

★★ 감점 규칙 ★★
- 같은 beat 패턴 (붙잡다→숨기다→들키다→놓아주다 등 반복) → -1
- 우연 키워드 2번+ → naturalness 자동 3점 캡
- 추상 감정 라벨 4개+ → naturalness 자동 3점 캡
- "예측 가능" 키워드 사용 → watchability 자동 3점 캡
- 조직 음모 공식 → -2

★★ 채점 함정 ★★
- "예측 가능하다"고 적어놓고 watchability 4점 → ✗ (모순)
- 감동적이면 naturalness 4점 → ✗ ("감동적"과 "자연스러운"은 다르다!)
- 관계가 있으면 relationshipDriven 4점 → ✗ (관계가 이야기를 "끄는가"를 봐야 함)
- "조직이 은폐하고 주인공이 밝힌다" 패턴 → watchability 3점 이하

반드시 JSON만 출력:
\`\`\`json
{
  "watchability": 4,
  "characterLikability": 4,
  "relationshipDriven": 4,
  "naturalness": 4,
  "premiseInRelationship": 4,
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1"],
  "oneLiner": "한 줄 평"
}
\`\`\``;

const MODEL_WAREHOUSE = process.env.OPENAI_MODEL_WAREHOUSE || process.env.OPENAI_MODEL_EVALUATOR || 'gpt-5.4-mini';
const DEFAULT_PASS_THRESHOLD = 4.0;

export async function evaluateDrama(drama: DramaOutput, passThreshold: number = DEFAULT_PASS_THRESHOLD): Promise<DramaEvaluation> {
  const provider = getProvider();

  const eventChainText = drama.event_chain
    .map((e, i) => `  ${i + 1}. [${e.beat}] ${e.event} (감정: ${e.emotion})`)
    .join('\n');

  const userMsg = `아래 드라마를 평가해줘:

제목: ${drama.title}
소재: ${drama.premise}

주인공:
  이름: ${drama.protagonist.name}
  desire: ${drama.protagonist.desire}
  flaw: ${drama.protagonist.flaw}

사건 체인:
${eventChainText}

장르: ${drama.genre}
톤: ${drama.tone}
소재 필수성: ${drama.why_this_premise_matters}`;

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await provider.chat(EVAL_SYSTEM, userMsg, {
        maxTokens: 1000,
        temperature: 0,
        model: MODEL_WAREHOUSE,
      });

      const jsonStr = extractJsonBlock(raw);
      const parsed = JSON.parse(jsonStr);

      const scores = {
        watchability: clamp(parsed.watchability || 3),
        characterLikability: clamp(parsed.characterLikability || 3),
        relationshipDriven: clamp(parsed.relationshipDriven || 3),
        naturalness: clamp(parsed.naturalness || 3),
        premiseInRelationship: clamp(parsed.premiseInRelationship || 3),
      };

      const weaknessText = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.join(' ') : '';
      const oneLinerText = (parsed.oneLiner || '') as string;
      const allEvalText = (weaknessText + ' ' + oneLinerText).toLowerCase();

      const PREDICTABLE_KEYWORDS = ['예측 가능', '예측가능', '뻔하', '전형적', '흔한 전개', '익숙한 패턴', '패턴이 보', '예상 범위', '예상범위', '공식적', '정형화'];
      const hasPredictableFlag = PREDICTABLE_KEYWORDS.some(kw => allEvalText.includes(kw));
      if (hasPredictableFlag && scores.watchability > 3) {
        scores.watchability = 3;
      }

      const COINCIDENCE_WORDS = ['마침', '때마침', '우연히', '갑자기', '그때 마침', '공교롭게', '어쩌다'];
      const allEventText = drama.event_chain.map(e => e.event).join(' ');
      const coincidenceCount = COINCIDENCE_WORDS.reduce((count, word) => {
        const matches = allEventText.match(new RegExp(word, 'g'));
        return count + (matches ? matches.length : 0);
      }, 0);

      const EMOTION_LABELS = ['충격', '절박', '해방', '용기', '각성', '결심', '공포', '환희', '비통', '경악'];
      const emotionText = drama.event_chain.map(e => e.emotion).join(' ');
      const abstractEmotionCount = EMOTION_LABELS.reduce((count, label) => {
        return count + (emotionText.includes(label) ? 1 : 0);
      }, 0);

      const weaknesses = Array.isArray(parsed.weaknesses) ? [...parsed.weaknesses] : [];

      if (coincidenceCount >= 2 && scores.naturalness > 3) {
        scores.naturalness = 3;
        weaknesses.push(`우연 남용 감지: "${COINCIDENCE_WORDS.filter(w => allEventText.includes(w)).join(', ')}" (${coincidenceCount}회)`);
      } else if (coincidenceCount === 1 && scores.naturalness > 4) {
        scores.naturalness = 4;
      }

      if (abstractEmotionCount >= 4 && scores.naturalness > 3) {
        scores.naturalness = Math.min(scores.naturalness, 3);
        weaknesses.push(`감정 라벨링: 추상적 감정 태그 ${abstractEmotionCount}개 감지 (행동 묘사로 대체 필요)`);
      }

      if (hasPredictableFlag && !weaknesses.some(w => PREDICTABLE_KEYWORDS.some(kw => w.includes(kw)))) {
        weaknesses.push('watchability 자동 보정: 예측 가능 키워드 감지됨');
      }

      const BEAT_PATTERN_KEYWORDS = ['붙잡', '숨기', '들키', '놓아주', '도망', '쫓아', '잡히'];
      const beatTexts = drama.event_chain.map(e => e.event);
      let beatPatternPenalty = 0;
      const beatPatternMatches: string[] = [];
      for (const kw of BEAT_PATTERN_KEYWORDS) {
        const matchCount = beatTexts.filter(t => t.includes(kw)).length;
        if (matchCount >= 2) beatPatternMatches.push(`"${kw}" ×${matchCount}`);
      }
      if (beatPatternMatches.length >= 2) {
        beatPatternPenalty = -1;
        weaknesses.push(`반복 beat 패턴 감지: ${beatPatternMatches.join(', ')}`);
      }

      const clicheCheck = checkForFormula(drama);
      let formulaPenalty = 0;

      if (clicheCheck.isFormula) {
        formulaPenalty = -2;
        weaknesses.push(`공식 고착 감지: ${clicheCheck.reason}`);
      }

      if (!checkPremiseNecessity(drama)) {
        scores.premiseInRelationship = Math.max(1, scores.premiseInRelationship - 1);
        weaknesses.push('소재가 event_chain에 충분히 반영되지 않음');
      }

      const raw_overall = (
        scores.watchability * 0.30 +
        scores.characterLikability * 0.20 +
        scores.relationshipDriven * 0.20 +
        scores.naturalness * 0.15 +
        scores.premiseInRelationship * 0.15
      );
      const totalPenalty = formulaPenalty + beatPatternPenalty;
      const overall = Math.max(0, Math.round((raw_overall + totalPenalty) * 10) / 10);

      const hardFail = scores.watchability < 3 || scores.naturalness < 3 || formulaPenalty <= -2;

      return {
        ...scores,
        formulaPenalty: totalPenalty,
        overall: Math.min(5, overall),
        verdict: hardFail ? 'fail' : (overall >= passThreshold ? 'pass' : 'fail'),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses,
        oneLiner: parsed.oneLiner || '',
      };
    } catch (err) {
      console.error(`[DramaEvaluator] "${drama.title}" attempt=${attempt} error:`, (err as Error).message);
      if (attempt >= MAX_RETRIES) {
        return {
          watchability: 0, characterLikability: 0, relationshipDriven: 0, naturalness: 0, premiseInRelationship: 0,
          formulaPenalty: 0, overall: 0, verdict: 'fail' as const,
          strengths: [], weaknesses: [`평가 실패: ${(err as Error).message}`],
          oneLiner: '평가 중 오류 발생',
        };
      }
    }
  }
  return {
    watchability: 0, characterLikability: 0, relationshipDriven: 0, naturalness: 0, premiseInRelationship: 0,
    formulaPenalty: 0, overall: 0, verdict: 'fail' as const,
    strengths: [], weaknesses: ['평가 실패'],
    oneLiner: '평가 중 오류 발생',
  };
}

export async function evaluateAndFilter(dramas: DramaOutput[], passThreshold: number = DEFAULT_PASS_THRESHOLD): Promise<EvaluatedDrama[]> {
  const results: EvaluatedDrama[] = [];
  for (const drama of dramas) {
    const evaluation = await evaluateDrama(drama, passThreshold);
    results.push({ ...drama, evaluation });
  }
  return results.sort((a, b) => b.evaluation.overall - a.evaluation.overall);
}

function clamp(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v * 10) / 10));
}

export { DEFAULT_PASS_THRESHOLD };
