/**
 * Drama Engine — 2단계: 씨앗으로 "사건 체인"을 생성
 *
 * premise-builder를 대체. 시놉시스 대신 구체적 장면 단위의 event_chain을 출력한다.
 * 주인공의 desire가 이야기를 끌고 가야 하며, 각 event는 이전 event의 결과여야 한다.
 *
 * 5가지 beat 템플릿으로 다양성을 확보하고,
 * 같은 씨앗에서 나온 2개 스토리는 반드시 다른 템플릿/장르/갈등 유형을 사용한다.
 */

import { getProvider } from '@/lib/ai';
import { extractJsonBlock } from '@/lib/story/utils';
import { seedToPromptText, type StorySeed } from './seed-generator';

export interface EventBeat {
  beat: string;
  event: string;
  emotion: string;
}

export interface DramaProtagonist {
  name: string;
  desire: string;
  flaw: string;
}

export interface DramaKeyRelationship {
  person: string;
  bond: string;
  tension: string;
}

export interface DramaOutput {
  seedId: string;
  premise: string;
  protagonist: DramaProtagonist;
  keyRelationship?: DramaKeyRelationship;
  smallMoment?: string;
  event_chain: EventBeat[];
  genre: string;
  tone: string;
  why_this_premise_matters: string;
  title: string;
  hook: string;
  tags: string[];
  beatTemplate?: string;
  endingType?: string;
}

// ── 5가지 beat 템플릿 ──────────────────────────────────

export const BEAT_TEMPLATES = {
  loss: {
    id: 'loss',
    label: '상실형 (붙잡다 → 놓아주다)',
    beats: ['일상+미련', '촉발', '붙잡기', '숨기기', '균열', '들킴', '대가', '놓아주기'],
    description: '소중한 것을 잃을 위기에서 붙잡으려다 결국 놓아주는 이야기. 로맨스, 가족극에 적합.',
  },
  discovery: {
    id: 'discovery',
    label: '발견형 (모르다 → 진실)',
    beats: ['무지의 일상', '이상한 단서', '첫 추적', '예상 밖 증인', '잘못된 확신', '뒤집히는 증거', '진짜 진실', '진실 후의 선택'],
    description: '뭔가 이상하다는 느낌에서 시작해 진실을 발견하는 이야기. 미스터리, 휴먼드라마에 적합.',
  },
  growth: {
    id: 'growth',
    label: '성장형 (약하다 → 극복)',
    beats: ['결핍의 일상', '도전 기회', '첫 시도+실패', '뜻밖의 조력', '진짜 벽', '포기의 순간', '깨달음', '다시 도전'],
    description: '약점을 안고 도전하며 성장하는 이야기. 성장물, 코미디, 학원물에 적합.',
  },
  reversal: {
    id: 'reversal',
    label: '반전형 (믿다 → 뒤집힘)',
    beats: ['확신의 일상', '신뢰 강화', '미세한 균열', '의심의 시작', '결정적 장면', '세계 뒤집힘', '재구성', '새로운 선택'],
    description: '믿고 있던 것이 뒤집히는 이야기. 스릴러, 멜로, 블랙코미디에 적합.',
  },
  dilemma: {
    id: 'dilemma',
    label: '딜레마형 (두 가지 중 하나)',
    beats: ['평범한 일상', '두 갈래 등장', '한쪽 선택', '선택의 보상', '다른 쪽의 대가', '되돌릴 수 없음', '양쪽 모두 위기', '최종 결단'],
    description: '양립 불가능한 두 가치 사이에서 갈등하는 이야기. 도덕 갈등, 멜로, 가족극에 적합.',
  },
} as const;

export type BeatTemplateId = keyof typeof BEAT_TEMPLATES;
const ALL_TEMPLATE_IDS: BeatTemplateId[] = ['loss', 'discovery', 'growth', 'reversal', 'dilemma'];

function pickTwoTemplates(): [BeatTemplateId, BeatTemplateId] {
  const shuffled = [...ALL_TEMPLATE_IDS].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function pickTemplateForSeed(seedIndex: number, usedCounts: Map<BeatTemplateId, number>): [BeatTemplateId, BeatTemplateId] {
  const sorted = [...ALL_TEMPLATE_IDS].sort(
    (a, b) => (usedCounts.get(a) || 0) - (usedCounts.get(b) || 0)
  );
  const t1 = sorted[0];
  const t2 = sorted.find(t => t !== t1) || sorted[1];
  return [t1, t2];
}

function templateToPromptText(t: BeatTemplateId): string {
  const tpl = BEAT_TEMPLATES[t];
  return `[${tpl.label}]\nbeat 순서: ${tpl.beats.join(' → ')}\n설명: ${tpl.description}`;
}

const GENRE_POOLS = [
  ['로맨스', '가족극', '코미디', '힐링'],
  ['미스터리', '스릴러', '느와르', '공포'],
  ['성장물', '학원물', '스포츠', '직업극'],
  ['SF', '판타지', '시대극', '다큐멘터리'],
];

function pickTwoGenres(): [string, string] {
  const pool1idx = Math.floor(Math.random() * GENRE_POOLS.length);
  let pool2idx = pool1idx;
  while (pool2idx === pool1idx && GENRE_POOLS.length > 1) {
    pool2idx = Math.floor(Math.random() * GENRE_POOLS.length);
  }
  const g1 = GENRE_POOLS[pool1idx][Math.floor(Math.random() * GENRE_POOLS[pool1idx].length)];
  const g2 = GENRE_POOLS[pool2idx][Math.floor(Math.random() * GENRE_POOLS[pool2idx].length)];
  return [g1, g2];
}

// ── 결말 유형 풀 ──────────────────────────────────

const ENDING_TYPES = [
  { id: 'confession', label: '고백/결단', desc: '숨겨온 것을 말하거나, 전부 걸고 행동한다' },
  { id: 'silence', label: '침묵', desc: '말하지 않기로 한다. 그 침묵이 더 많은 것을 전달한다' },
  { id: 'departure', label: '떠남', desc: '그 자리를 떠난다. 돌아올지는 열어둔다' },
  { id: 'waiting', label: '기다림', desc: '행동하지 않고 기다린다. 시간에 맡긴다' },
  { id: 'acceptance', label: '수용', desc: '바꿀 수 없는 것을 받아들인다. 체념이 아닌 성숙' },
  { id: 'repetition', label: '반복', desc: '처음과 같은 일상으로 돌아가지만, 주인공만 달라져 있다' },
  { id: 'refusal', label: '거부', desc: '제안/기회/관계를 거절한다. 거절이 곧 자기 정의' },
  { id: 'surrender', label: '포기', desc: '원하던 것을 내려놓는다. 하지만 그 과정에서 다른 것을 얻는다' },
] as const;

function pickEndingType(usedEndings: Map<string, number>): string {
  const nonConfession = ENDING_TYPES.filter(e => e.id !== 'confession');
  const sorted = nonConfession.sort(
    (a, b) => (usedEndings.get(a.id) || 0) - (usedEndings.get(b.id) || 0)
  );
  return sorted[0].id;
}

function endingToPromptText(endingId: string): string {
  const ending = ENDING_TYPES.find(e => e.id === endingId);
  if (!ending) return '';
  return `결말 유형: [${ending.label}] — ${ending.desc}`;
}

// ── System Prompt ──────────────────────────────────

const SYSTEM_PROMPT = `너는 한국 드라마 작가다. 너의 특기는 "관계가 살아있는 이야기".

★★★ 최상위 원칙: 소재 20%, 관계와 감정 80% ★★★

좋은 이야기의 핵심은 신박한 소재가 아니다. 관계다.
- 인터스텔라: 웜홀이 아니라 아빠↔딸
- 인셉션: 꿈 구조가 아니라 남편↔죽은 아내의 죄책감
- 도깨비: 도깨비 설정이 아니라 도깨비↔신부
- 기생충: 반지하가 아니라 두 가족

소재(SF/판타지/미스터리)는 관계를 압박하는 장치일 뿐이다.
시놉시스 첫 문장은 "이 세계에서는~"이 아니라 "이 사람은~"이어야 한다.
세계관 규칙은 1개만. 그 규칙이 관계를 아프게 만드는 데만 사용.

★★★ 핵심 질문: "누가 누구를 왜 필요로 하는가" ★★★

이야기의 엔진은 "설정"이 아니라 "두 사람 사이의 필요"다.
- 좋은 예: "울면 비가 오는 여자" + "비를 좋아하는 남자" → 이 둘의 관계가 이야기
- 나쁜 예: "울면 비가 오는 세계의 규칙과 기상청의 음모" → 설정이 이야기

★★ 관계는 로맨스만이 아니다 ★★
SF: 아빠↔딸 (인터스텔라) / 스릴러: 두 가족 (기생충)
코미디: 친구들 / 호러: 엄마↔딸 (엑소시스트)
5개 생성 시 최소 3가지 다른 장르 포함. 로맨스는 최대 2개.

★★★ 일상 장면 필수 ★★★

위기만 있는 이야기는 감동이 없다. 캐릭터를 좋아할 시간이 필요하다.

event_chain의 앞 2~3개 beat는 반드시 일상이어야 한다:
- 캐릭터의 매력이 보이는 사소한 장면
- 관계의 온도가 느껴지는 대화나 행동
- 소재가 일상에 스며드는 방식 (위기가 아니라 불편함/웃김/아이러니 수준)

"일상"은 장르마다 다르다:
- 로맨스: 어색한 첫 만남, 사소한 배려
- SF: 우주선 루틴, 크루 농담
- 스릴러: 의심 없는 출근길, 평범한 저녁 식사
- 코미디: 사소한 상황에서 벌어지는 웃긴 장면
- 호러: 공포 전의 평화 (이게 있어야 공포가 작동)

★ small_moment 필수: 사소하지만 기억에 남는 장면 1개.
도깨비의 메밀밭, 첫눈 같은 것. 이 장면이 결말에서 다시 떠오르면 감동이 된다.

★★★ 캐릭터가 플롯을 만든다 ★★★

"감동적인 beat를 먼저 정하고 캐릭터를 끼워넣는" 실수를 뒤집어라.
캐릭터를 먼저 이해하고, 그 사람이 진짜로 할 행동을 써라.

각 beat를 쓸 때 자문:
- "이 사람이 이 상황에서 정말로 이렇게 행동할까?"
- "이건 캐릭터의 선택인가, 감동을 위해 배치한 장치인가?"

★★★ 우연 금지 ★★★

"마침", "때마침", "우연히", "갑자기", "어쩌다" ← 이 단어가 나오면 실패.
모든 전환점은 캐릭터의 의지적 선택이어야 한다.
외부 사건(전화, 날씨, 사고)이 전환점이면 안 된다.

★★★ 감정은 행동으로 보여준다 ★★★

emotion 필드에 "충격", "절박", "해방" 같은 추상어 금지.
대신 "손이 떨려 컵을 놓친다", "처음으로 크게 숨을 쉰다" 같은 행동 묘사.

★★ beat 템플릿 시스템 ★★

지정된 beat 템플릿을 따르되, 앞 2~3 beat는 일상/관계 설정에 써라.
같은 씨앗으로 2개를 만들 때:
1. 서로 다른 beat 템플릿 + 장르 + 결말 유형 (지정됨)
2. 주인공의 desire/flaw/관계 구조가 달라야 함
3. 하나는 관계 중심(누구↔누구), 하나는 내면 중심(자기 자신과의 싸움)

★★★ 절대 금지: "조직 음모" 공식 ★★★
- "회사/조직/정부가 비밀을 은폐한다"
- "내부 세력이 주인공을 추적한다"
갈등은 "주인공 자신의 flaw + 가까운 사람과의 관계"에서 와야 한다.

★★ 4화 미니시리즈 규칙 ★★
짧은 부작에서는 규칙이 단순해야 한다:
- 세계관 규칙 1개만
- 핵심 관계 2축만 (예: 주인공↔연인 + 주인공↔가족)
- 나머지는 관계가 만드는 사건으로 채운다

★★ why_this_premise_matters ★★
"이 소재가 이 관계를 아프게/특별하게 만드는 이유"를 한 문장으로.
소재를 빼도 이 관계가 아프면 실패 — 소재가 관계의 아픔을 만들어야 한다.

반드시 아래 JSON 배열만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "title": "제목 (5~8자)",
    "premise": "소재 한 줄 설명",
    "beatTemplate": "사용한 템플릿 ID",
    "endingType": "결말 유형 ID",
    "protagonist": {
      "name": "한국 이름",
      "desire": "간절히 원하는 구체적인 것 (1문장)",
      "flaw": "이 소재 때문에 생긴 결함 (1문장)"
    },
    "keyRelationship": {
      "person": "관계 대상 이름",
      "bond": "둘 사이의 관계 (1문장)",
      "tension": "소재가 이 관계에 만드는 긴장 (1문장)"
    },
    "smallMoment": "사소하지만 기억에 남는 장면 1개 (결말에서 다시 떠오를 것)",
    "event_chain": [
      { "beat": "beat 이름", "event": "구체적 장면 서술", "emotion": "감정이 드러나는 행동 묘사" }
    ],
    "genre": "메인 장르",
    "tone": "분위기/톤",
    "why_this_premise_matters": "소재가 관계를 아프게 만드는 이유 (1문장)",
    "hook": "왜 보고 싶은지 (1문장)",
    "tags": ["태그1", "태그2", "태그3"]
  }
]
\`\`\``;

const MODEL_WAREHOUSE = process.env.OPENAI_MODEL_WAREHOUSE || process.env.OPENAI_MODEL_EVALUATOR || 'gpt-5.4-mini';

export async function generateDrama(
  seed: StorySeed,
  templates?: [BeatTemplateId, BeatTemplateId],
  genres?: [string, string],
  endings?: [string, string],
): Promise<DramaOutput[]> {
  const provider = getProvider();
  const seedText = seedToPromptText(seed);

  const [t1, t2] = templates || pickTwoTemplates();
  const [g1, g2] = genres || pickTwoGenres();
  const [e1, e2] = endings || ['', ''];

  const ending1Text = e1 ? endingToPromptText(e1) : '';
  const ending2Text = e2 ? endingToPromptText(e2) : '';

  const userMsg = `아래 소재 씨앗으로 2개의 완전히 다른 이야기를 만들어줘.

=== 소재 씨앗 ===
${seedText}

=== 스토리 1: ${BEAT_TEMPLATES[t1].label} + ${g1} ===
${templateToPromptText(t1)}
장르: ${g1}
${ending1Text}

=== 스토리 2: ${BEAT_TEMPLATES[t2].label} + ${g2} ===
${templateToPromptText(t2)}
장르: ${g2}
${ending2Text}

★ 핵심 규칙 (이것을 반드시 지켜라):

1. 캐릭터가 플롯을 만든다.
   "감동적인 장면을 먼저 정하고 캐릭터를 끼워넣지 마라."
   캐릭터가 이 상황에서 진짜로 할 행동을 써라.
   매 beat마다 자문: "현실의 이 사람이 정말 이렇게 할까?"

2. 우연 금지.
   "마침", "때마침", "우연히", "갑자기" ← 이 단어가 나오면 실패.
   전화가 오거나, 비가 오거나, 누군가 나타나는 것으로 이야기를 전환하지 마라.
   모든 전환점은 캐릭터의 선택이어야 한다.

3. 감정을 라벨로 달지 마라.
   emotion 필드에 "충격", "절박", "해방" 같은 추상어 금지.
   대신 "손이 떨려 컵을 놓친다", "처음으로 크게 숨을 쉰다" 같은 행동 묘사.

4. 결말 유형이 지정되어 있으면 반드시 그 유형으로 끝내라.
   "숨겨온 진실을 고백한다"가 유일한 결말이 아니다.
   침묵, 떠남, 기다림, 수용, 포기 — 말 안 하는 것도 선택이다.

5. 두 이야기의 주인공은 다른 사람이어야 한다.
6. 각 이야기의 beat 이름은 지정된 템플릿의 beat를 정확히 사용해라.
7. 갈등 유형이 지정되어 있으면 반드시 그 유형으로.`;

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await provider.chat(SYSTEM_PROMPT, userMsg, {
        maxTokens: 4000,
        temperature: 0.95,
        model: MODEL_WAREHOUSE,
      });

      const jsonStr = extractJsonBlock(raw);
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error(`[DramaEngine] seed=${seed.id} attempt=${attempt}: not a non-empty array`);
        if (attempt < MAX_RETRIES) continue;
        return [];
      }

      return parsed.map((p: Record<string, unknown>): DramaOutput => {
        const kr = p.keyRelationship as Record<string, unknown> | undefined;
        return {
          seedId: seed.id,
          title: (p.title as string) || 'Untitled',
          premise: (p.premise as string) || '',
          protagonist: {
            name: ((p.protagonist as Record<string, unknown>)?.name as string) || '',
            desire: ((p.protagonist as Record<string, unknown>)?.desire as string) || '',
            flaw: ((p.protagonist as Record<string, unknown>)?.flaw as string) || '',
          },
          keyRelationship: kr ? {
            person: (kr.person as string) || '',
            bond: (kr.bond as string) || '',
            tension: (kr.tension as string) || '',
          } : undefined,
          smallMoment: (p.smallMoment as string) || undefined,
          event_chain: Array.isArray(p.event_chain)
            ? (p.event_chain as Record<string, unknown>[]).map(e => ({
                beat: (e.beat as string) || '',
                event: (e.event as string) || '',
                emotion: (e.emotion as string) || '',
              }))
            : [],
          genre: (p.genre as string) || '',
          tone: (p.tone as string) || '',
          why_this_premise_matters: (p.why_this_premise_matters as string) || '',
          hook: (p.hook as string) || '',
          tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
          beatTemplate: (p.beatTemplate as string) || '',
          endingType: (p.endingType as string) || '',
        };
      });
    } catch (err) {
      console.error(`[DramaEngine] seed=${seed.id} attempt=${attempt} error:`, (err as Error).message);
      if (attempt >= MAX_RETRIES) throw new Error(`Drama 생성 실패 (seed=${seed.id}): ${(err as Error).message}`);
    }
  }
  return [];
}

export async function generateDramaBatch(seeds: StorySeed[]): Promise<DramaOutput[]> {
  const results: DramaOutput[] = [];
  const usedTemplateCounts = new Map<BeatTemplateId, number>();
  const usedEndingCounts = new Map<string, number>();
  let confessionCount = 0;

  for (let i = 0; i < seeds.length; i++) {
    const [t1, t2] = pickTemplateForSeed(i, usedTemplateCounts);
    const [g1, g2] = pickTwoGenres();

    let e1: string, e2: string;
    if (confessionCount < 2 && Math.random() < 0.3) {
      e1 = 'confession';
      e2 = pickEndingType(usedEndingCounts);
      confessionCount++;
    } else {
      e1 = pickEndingType(usedEndingCounts);
      e2 = pickEndingType(usedEndingCounts);
      while (e2 === e1) e2 = pickEndingType(usedEndingCounts);
    }

    const dramas = await generateDrama(seeds[i], [t1, t2], [g1, g2], [e1, e2]);
    results.push(...dramas);

    usedTemplateCounts.set(t1, (usedTemplateCounts.get(t1) || 0) + 1);
    usedTemplateCounts.set(t2, (usedTemplateCounts.get(t2) || 0) + 1);
    usedEndingCounts.set(e1, (usedEndingCounts.get(e1) || 0) + 1);
    usedEndingCounts.set(e2, (usedEndingCounts.get(e2) || 0) + 1);
  }
  return results;
}
