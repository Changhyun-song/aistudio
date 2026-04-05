import { getProvider } from '@/lib/ai';
import {
  getStoryArchitectPrompt,
  getScreenplayDirectorPrompt,
  getFrameVideoPromptDesignerPrompt,
} from '@/lib/ai/story-studio/load-system-prompt';
import type { StoryCharacter, StorySeriesBible, StoryEpisodeArc, GenreOverlay, VideoProvider, FrameVideoOutputV2 } from '@/types';
import {
  extractJsonBlock,
  formatOverlayBlock,
  getSupplementForStage,
  MODEL_GENERATOR,
  MODEL_AI1_CONCEPT,
  MODEL_AI2_BIBLE,
  MODEL_AI2_SEASON,
  MODEL_AI2_SCRIPT,
  MODEL_AI3_CLIPS,
} from './utils';

// ══════════════════════════════════════════════════════
// AI Auto-Fill — Analyze idea text → structured overlay
// ══════════════════════════════════════════════════════

export interface AutoFillResult {
  overlay: Partial<GenreOverlay>;
  suggestions: {
    must_have: string[];
    forbidden: string[];
    nice_to_have: string[];
    required_characters: string[];
    optional_characters: string[];
  };
}

export async function autoFillFromIdea(rawIdea: string): Promise<AutoFillResult> {
  const provider = getProvider();

  const systemMsg = `너는 스토리 아이디어 분석기다. 사용자의 자연어 아이디어를 분석해서 구조화된 스토리 설정을 추론해라.

반드시 아래 JSON만 출력. 다른 텍스트 없이.

\`\`\`json
{
  "overlay": {
    "genre": "주 장르 (fantasy/sci-fi/romance/thriller/horror/drama/comedy/action/mystery/slice_of_life)",
    "sub_genre": "서브 장르",
    "tone": "톤 (dark/light/mixed/gritty/whimsical/melancholic)",
    "setting_region": "배경 지역",
    "setting_era": "시대",
    "age_group": "캐릭터 연령대",
    "target_audience": "타겟 시청자",
    "protagonist_count": 0,
    "protagonist_composition": "unspecified/female_lead/male_lead/mixed_equal/ensemble",
    "supporting_cast_min": 3,
    "supporting_cast_max": 8,
    "cast_total_limit": 15,
    "creature_usage": "none/background/important/central",
    "power_system": "none/subtle/moderate/central",
    "death_event": "none/implied/moderate/heavy",
    "romance_level": "none/subtle/moderate/central",
    "mystery_level": "none/subtle/moderate/central",
    "action_level": "none/low/medium/high",
    "comedy_level": "none/subtle/moderate/central",
    "horror_level": "none/subtle/moderate/central",
    "ending_type": "happy/bittersweet/tragic/open/twist",
    "story_central_axis": "unspecified/growth/revenge/survival/mystery/love/redemption/power_struggle/identity/sacrifice/justice",
    "episode_count": 10,
    "runtime_per_episode": 5
  },
  "suggestions": {
    "must_have": ["이 아이디어에 반드시 필요한 요소들"],
    "forbidden": ["이 장르/톤과 맞지 않는 요소들"],
    "nice_to_have": ["있으면 좋을 요소들"],
    "required_characters": ["필수 캐릭터 유형"],
    "optional_characters": ["선택 캐릭터 유형"]
  }
}
\`\`\`

규칙:
- 아이디어에서 명시되지 않은 항목은 장르/톤에 맞게 적절히 추론
- protagonist_count: 명시 없으면 0 (AI가 결정)
- 확실하지 않은 항목은 unspecified/none 유지
- 아이디어가 매우 짧아도 최선의 추론을 해라`;

  const userMsg = `아래 스토리 아이디어를 분석해줘:\n\n${rawIdea}`;

  const raw = await provider.chat(systemMsg, userMsg, { maxTokens: 2000, temperature: 0.3 });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    return {
      overlay: {},
      suggestions: {
        must_have: [],
        forbidden: [],
        nice_to_have: [],
        required_characters: [],
        optional_characters: [],
      },
    };
  }
}

// ══════════════════════════════════════════════════════
// AI 1 — Story Architect
// ══════════════════════════════════════════════════════

export interface ConceptInput {
  rawIdea: string;
  genre: string;
  tone: string;
  worldKeywords: string;
  romanceLevel: string;
  mysteryLevel: string;
  actionLevel: string;
  endingMood: string;
  targetAudience: string;
  characters: StoryCharacter[];
  genreOverlay?: GenreOverlay;
}

export async function generateStoryConcept(input: ConceptInput, projectId?: string): Promise<string> {
  const charBlock = input.characters.length
    ? input.characters.map((c, i) => `${i + 1}. ${c.name} (${c.role}) — 성격: ${c.traits}, 시그니처: ${c.signature_item}, 말투: ${c.speech_style}, 약점: ${c.emotional_weakness}, 능력: ${c.power_or_specialty}`).join('\n')
    : '';

  const overlayBlock = formatOverlayBlock(input.genreOverlay);

  const totalRuntime = (input.genreOverlay?.episode_count || 10) * (input.genreOverlay?.runtime_per_episode || 5);

  const userMsg = `아래 소재와 프로젝트 제약을 바탕으로, 시스템 프롬프트의 PHASE 0→1→2→3을 따라 총 ${totalRuntime}분짜리 전체 스토리를 설계해줘.

## 소재
${input.rawIdea}

${overlayBlock}

${input.worldKeywords ? `## 세계관 키워드\n${input.worldKeywords}` : ''}

${charBlock ? `## 사용자 지정 등장인물\n${charBlock}` : ''}

## ★ 반드시 지킬 것

### A. 프로세스
1. PHASE 0 작품 진단 먼저 — 장르 중심축, 핵심 재미, 활성/비활성/금지 요소, 클리셰 7개
2. PHASE 1→2→3 순서
3. 콘셉트 3안은 서로 완전히 다른 중심 축
4. 각 안의 핵심 갈등 300자+
5. 각 안에 "이 작품만의 고유 장치" 1개

### B. 캐릭터
6. protagonist_count를 따를 것 (0이면 AI 결정)
7. protagonist_composition을 따를 것 (unspecified면 AI 결정, female_lead/male_lead면 해당 성별 다수+소수 혼성 허용)
8. cast_total_limit 이내로 전체 캐릭터 구성
9. supporting_cast_min~supporting_cast_max 범위 내에서 조연 구성
10. required_character_types는 반드시 반영
11. 모든 조연은 개별 이름 + 개별 설정 (집합명사 금지)
12. 조연은 기능 축 배치

### C. 조건부 섹션
13. none인 항목의 섹션은 출력하지 말 것
14. required/optional인 항목만 해당 섹션 출력
15. forbidden_elements는 절대 포함하지 말 것

### D. 품질
16. 제목은 generic 금지. 이 작품의 핵심 이미지/장치/감정이 드러나는 강렬한 것
17. PHASE 2 후 고유 장치 1개 추가
18. 자가검사: 약한 3개 + 점수표(엄격) + 6점 이하 수정 + 자동 1회 수정 패스
19. 일관성 검증: 캐스팅 규칙/사건/조연/금지요소 최종 확인
20. 출력 형식 0~18번 빠짐없이 (해당 없는 섹션은 "해당 없음")

### E. 스토리 중심축
21. story_central_axis가 지정되어 있으면 해당 축이 스토리의 주된 동력이 되도록 구성

### F. 세계관 훅
22. 세계관의 핵심 장소/시스템이 단순 게이트/배경이면 안 됨
23. 반드시 "한 줄로 설명 가능한 독특한 핵심 훅" + "감정/시간/기억/관계와의 기이한 연결" 포함
24. "왜 이 장소, 왜 이 인물들, 왜 이 규칙"에 예상 가능한 답이면 한 단계 더 비틀어라

### G. 조연 존재감
25. 조연은 배경인물이 아님 — 각 조연의 행동이 주인공의 판단/행동을 실제로 바꾸게 설계
26. 시즌 구조에서 최소 2~3화에 걸쳐 조연이 사건을 촉발/정보 제공/갈등 유발
27. 각 조연의 서사적 기능이 시즌 전체에서 어떻게 작동하는지 명시

### H. AI 2 전달용 bible 준비
28. 출력에 "다음 AI에게 넘길 포인트"로 아래 포함:
    - 매 화의 중심 장치 추천 (narrative engine 후보)
    - 조연이 시즌 구조에서 영향을 미치는 화 번호와 역할
    - 시각/감정 힌트

한국어로 작성해.`;

  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai1') : '';
  return provider.chat(getStoryArchitectPrompt(supplement), userMsg, { maxTokens: 16000, temperature: 0.8, model: MODEL_AI1_CONCEPT });
}

export async function reviseStoryConcept(
  previousDraft: string,
  feedback: string,
  genreOverlay?: GenreOverlay,
  projectId?: string,
): Promise<string> {
  const overlayBlock = formatOverlayBlock(genreOverlay);

  const userMsg = `## 이전 초안
${previousDraft}

## 사용자 피드백
${feedback}

${overlayBlock}

## 지시
위 피드백을 반영하여 스토리 컨셉을 수정해줘. 이전 초안의 전체 형식을 유지하면서 피드백에서 요청한 부분만 개선해.
한국어로 작성해.`;

  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai1') : '';
  return provider.chat(getStoryArchitectPrompt(supplement), userMsg, { maxTokens: 16000, temperature: 0.8, model: MODEL_AI1_CONCEPT });
}

// ══════════════════════════════════════════════════════
// Character Extraction
// ══════════════════════════════════════════════════════

export interface ExtractedCharacter {
  name: string;
  is_main: boolean;
  role: string;
  role_type: string;
  age_range: string;
  gender_presentation: string;
  first_impression: string;
  real_personality: string;
  narrative_function: string;
  relationship_to_main: string;
  visual_identity: string;
  signature_item: string;
  signature_color: string;
  speech_style: string;
  emotional_weakness: string;
  power_or_specialty: string;
  characterization_priority: string;
  should_generate_assets: boolean;
  traits: string;
  archetype?: string;
  power_activation?: string;
  power_cost?: string;
  power_visual?: string;
  appearance_power_link?: string;
  desire?: string;
  secret?: string;
  team_role?: string;
  emotion_arc?: string;
  relationship_conflict?: string;
  romance?: string;
  visual_symbol?: string;
  axis?: string;
  hidden_role?: string;
}

export async function extractCharactersFromConcept(conceptMarkdown: string): Promise<ExtractedCharacter[]> {
  const provider = getProvider();

  const systemMsg = `너는 스토리 컨셉 마크다운에서 등장인물 정보를 추출하는 파서다.

**핵심 규칙:**
1. **메인 캐릭터와 조연 캐릭터를 모두 빠짐없이 추출해라.**
2. 조연이 집합명사(학교 선생님, 가족, 배후 세력 등)로 되어 있어도, 개별 이름이 있으면 개별 캐릭터로 추출.
3. 마크다운에서 찾을 수 있는 정보만 채워라. 없는 정보는 빈 문자열.
4. is_main: 메인 캐스트면 true, 조연이면 false.
5. should_generate_assets: 메인과 조연은 모두 true. 언급만 된 마이너 캐릭터만 false.

반드시 아래 JSON 배열 형식으로만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "name": "이름",
    "is_main": true,
    "role": "역할 설명",
    "role_type": "Main Hero / Supporting / Minor",
    "age_range": "17세, 고2 등",
    "gender_presentation": "여성 / 남성 / 기타",
    "first_impression": "겉 이미지, 첫인상",
    "real_personality": "실제 성격, 내면",
    "narrative_function": "이 인물이 없으면 스토리에서 무엇이 빠지는가",
    "relationship_to_main": "메인과의 관계 (메인이면 팀 내 관계)",
    "visual_identity": "외형적 특징, 스타일",
    "signature_item": "시각 상징물",
    "signature_color": "대표 컬러",
    "speech_style": "말투 특징",
    "emotional_weakness": "감정적 약점",
    "power_or_specialty": "능력/특기",
    "characterization_priority": "high / medium / low",
    "should_generate_assets": true,
    "traits": "성격과 특징을 2~3문장으로",
    "archetype": "아키타입 태그",
    "power_activation": "발동 조건",
    "power_cost": "대가/부작용",
    "power_visual": "시각적 연출",
    "appearance_power_link": "외형과 능력의 연결",
    "desire": "욕망",
    "secret": "비밀",
    "team_role": "팀 내 역할",
    "emotion_arc": "감정 아크 (시작→중반→결말)",
    "relationship_conflict": "관계 갈등",
    "romance": "로맨스 가능성/서사 기능",
    "visual_symbol": "시각 상징물",
    "axis": "조연 기능 축 (로맨스/일상/시스템·권력/진실·회색지대)",
    "hidden_role": "숨겨진 역할이나 반전 가능성"
  }
]
\`\`\``;

  const userMsg = `아래 스토리 컨셉 마크다운에서 **모든 등장인물(메인+조연+언급된 인물)을 빠짐없이** 추출해줘.
- 메인/조연 구분은 마크다운의 구조를 따라라
- 조연도 개별 인물로 추출 (집합명사 금지)
- 이름이 있는 모든 인물을 추출
- 주인공 수나 성별에 대한 사전 가정 없이, 마크다운에 있는 그대로 추출

${conceptMarkdown}`;

  const raw = await provider.chat(systemMsg, userMsg, { maxTokens: 12000, temperature: 0.1 });

  try {
    const parsed = JSON.parse(extractJsonBlock(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════
// AI 2 — Screenplay Director
// ══════════════════════════════════════════════════════

export interface BibleInput {
  title: string;
  genre: string;
  tone: string;
  worldRules: string;
  seasonGoal: string;
  coreConflict: string;
  endingDirection: string;
  audience: string;
  referenceMood: string;
}

export interface BibleOutput {
  logline: string;
  premise: string;
  seriesOverview: string;
  theme: string;
  seasonGoal: string;
  coreConflict: string;
  characterArcs: { name: string; arc: string }[];
  worldRules: string[];
  visualTone: string;
  episodeProgressionLogic: string;
  endingHook: string;
}

export async function generateSeriesBible(
  input: BibleInput,
  characters: StoryCharacter[],
  conceptMarkdown?: string,
  genreOverlay?: GenreOverlay,
  projectId?: string,
): Promise<BibleOutput> {
  const charBlock = characters
    .map((c, i) => `${i + 1}. ${c.name} (${c.role}) — Traits: ${c.traits}, Signature: ${c.signature_item} / ${c.signature_color}, Speech: ${c.speech_style}, Weakness: ${c.emotional_weakness}, Power: ${c.power_or_specialty}`)
    .join('\n');

  const conceptSection = conceptMarkdown
    ? `## AI 1 승인된 스토리 컨셉 (전문)\n${conceptMarkdown}\n`
    : '';

  const overlayBlock = formatOverlayBlock(genreOverlay);

  const userMsg = `## 시리즈 기본 정보
Title: ${input.title}
Genre: ${input.genre}
Tone: ${input.tone}

${overlayBlock}

${conceptSection}

## 등장인물 (전원 개별 설정 포함)
${charBlock || '(아직 지정된 캐릭터 없음)'}

## 세계관 핵심
${input.worldRules}

## 시즌 목표
${input.seasonGoal}

## 핵심 갈등
${input.coreConflict}

## 엔딩 방향
${input.endingDirection}

## 타겟 시청자
${input.audience}

## 레퍼런스 무드
${input.referenceMood}

위 정보를 바탕으로 시리즈 바이블을 JSON으로 작성해줘.
이 바이블은 AI 2(Screenplay Director)가 에피소드별 시즌 플랜과 대본을 작성하는 기초 자료가 됩니다.

★ 바이블 역할 분리 규칙:
- logline: 1~2문장. "누가, 어디서, 무엇과 맞서, 무엇을 위해" 형식. 세부 설정 나열 금지.
- premise: 2~3문장. "왜 이 이야기가 가치있나" — 기획 의도/핵심 메시지.
- theme: 1~2문장. 이 시리즈가 탐구하는 추상적 주제 (예: "소속감의 대가").
- seasonGoal: 3~4문장. 시즌 1이 시작부터 끝까지 이동하는 서사적 목표.
- coreConflict: 3~4문장. 시리즈 전체를 관통하는 갈등 구조.
- seriesOverview: 시즌 전체 스토리 아크를 2~3문단으로.
- characterArcs: 캐릭터별 변화 궤적 (초반→중반→후반).
- worldRules: 세계관 규칙 목록. 각 규칙은 "~하면 ~된다" 형식.
- visualTone: 색감, 조명, 미술 방향 2~3문장.
- episodeProgressionLogic: 10화 전체의 페이싱 논리 (1~3화 setup, 4~6 escalation, 7~9 crisis, 10 resolution 등).
- endingHook: 시즌 피날레 후 떡밥 1~2줄.

반드시 아래 JSON 형식으로만 출력. 다른 텍스트 없이.
\`\`\`json
{
  "logline": "...",
  "premise": "...",
  "seriesOverview": "...",
  "theme": "...",
  "seasonGoal": "...",
  "coreConflict": "...",
  "characterArcs": [{"name": "캐릭터명", "arc": "변화 궤적"}],
  "worldRules": ["규칙1", "규칙2"],
  "visualTone": "...",
  "episodeProgressionLogic": "...",
  "endingHook": "..."
}
\`\`\``;

  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai2') : '';
  const raw = await provider.chat(getScreenplayDirectorPrompt(supplement), userMsg, { maxTokens: 8000, temperature: 0.7, model: MODEL_AI2_BIBLE });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    return {
      logline: '', premise: '', seriesOverview: '', theme: '', seasonGoal: '',
      coreConflict: '', characterArcs: [], worldRules: [], visualTone: '',
      episodeProgressionLogic: '', endingHook: '',
    };
  }
}

// ══════════════════════════════════════════════════════
// Season Plan + Episode Script
// ══════════════════════════════════════════════════════

export interface EpisodeArcOutput {
  episodeNumber: number;
  title: string;
  narrativeEngine: string;
  actionFormat: string;
  purpose: string;
  centralCharacter: string;
  supportingCastRole: string;
  summary: string;
  beginning: string;
  middle: string;
  climax: string;
  endingHook: string;
  keyCharacters: string[];
  emotionalProgression: string;
  revealOrConflict: string;
}

export async function generateSeasonPlan(
  bible: StorySeriesBible,
  concept?: string,
  genreOverlay?: GenreOverlay,
  projectId?: string,
  revisionFeedback?: string,
): Promise<EpisodeArcOutput[]> {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  const overlayBlock = formatOverlayBlock(genreOverlay);
  const epCount = genreOverlay?.episode_count || 10;
  const epRuntime = genreOverlay?.runtime_per_episode || 5;

  const feedbackBlock = revisionFeedback
    ? `## ★ 이전 평가 피드백 (반드시 반영할 것)\n${revisionFeedback.slice(0, 1500)}\n\n`
    : '';

  const bibleEssentials = JSON.stringify({
    logline: bibleJson.logline,
    premise: bibleJson.premise,
    theme: bibleJson.theme,
    seasonGoal: bibleJson.seasonGoal,
    coreConflict: bibleJson.coreConflict,
    visualTone: bibleJson.visualTone,
    episodeProgressionLogic: bibleJson.episodeProgressionLogic,
  }, null, 2);

  const userMsg = `${feedbackBlock}## 시리즈 정보
Title: ${bible.title}
Genre: ${bible.genre}
Tone: ${bible.tone}

${overlayBlock}

## Series Bible (핵심)
${bibleEssentials}

${concept ? `## AI 1 승인된 스토리 컨셉 (전문)\n${concept}\n` : ''}

## ★ 시즌 플래너 규칙

이 시리즈를 **${epCount}부작 x ${epRuntime}분** 구조로 분할해줘.

### 필수 규칙:
1. 매 화마다 반드시 narrative engine 1개 + action format 1개를 배정
   - narrative engine: character_reveal / relationship_rupture / mystery_escalation / false_victory / grief_fallout / hidden_truth / betrayal_suspicion / power_reveal / strategy_lock_in / irreversible_choice
   - action format: discovery_mission / chase_pursuit / infiltration / defense_siege / confrontation / rescue_extraction / countdown_crisis / investigation / regrouping / final_stand
2. **연속 2화가 같은 narrative engine을 쓰면 안 된다**
3. **연속 2화가 같은 action format을 쓰면 안 된다**
4. 10화 기준 action format은 **최소 6종류** 사용. discovery_mission은 **최대 2회**
5. 제목은 generic 금지 — 그 화의 핵심 이미지/장치를 반영하는 구체적 제목
6. 매 화에 최소 1명의 조연이 **주인공의 행동/판단에 직접 영향**을 주는 역할을 해야 한다
7. beginning/middle/climax는 각각 **최소 3문장**, 각각 "목표 1개 + 방해 1개 + 결과 1개" 포함
8. summary는 **최소 5문장**

반드시 아래 JSON 배열 형식으로만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "구체적이고 이미지가 있는 제목",
    "narrativeEngine": "character_reveal",
    "actionFormat": "discovery_mission",
    "purpose": "이 화가 시즌 전체에서 하는 역할",
    "centralCharacter": "이 화의 중심 캐릭터",
    "supportingCastRole": "이 화에서 조연이 하는 구체적 역할",
    "summary": "줄거리 요약 (5문장+)",
    "beginning": "도입: 목표+방해+결과 포함 (3문장+)",
    "middle": "중반: 목표+방해+결과 포함 (3문장+)",
    "climax": "클라이맥스: 목표+방해+결과 포함 (3문장+)",
    "endingHook": "다음 화 연결: 누가+무엇을+왜위험 (1~2문장)",
    "keyCharacters": ["캐릭터1", "캐릭터2"],
    "emotionalProgression": "감정선: A → B → C",
    "revealOrConflict": "이 화에서 드러나는 정보/갈등"
  }
]
\`\`\`

${epCount}개의 에피소드를 출력. 한국어로 작성.`;

  const provider = getProvider();
  const sysPrompt = getScreenplayDirectorPrompt(projectId ? getSupplementForStage(projectId, 'ai2') : '');

  for (let retry = 0; retry < 3; retry++) {
    const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 16000, model: MODEL_AI2_SEASON });
    try {
      const parsed = JSON.parse(extractJsonBlock(raw));
      const episodes = Array.isArray(parsed) ? parsed : [];
      if (episodes.length < epCount) {
        console.warn(`[SeasonPlan] retry ${retry}: got ${episodes.length} episodes, expected ${epCount}`);
        if (retry === 2) return episodes;
        continue;
      }
      return episodes;
    } catch {
      if (retry === 2) {
        throw new Error(`시즌 플랜 JSON 파싱 실패 (3회 재시도 후): ${raw.slice(0, 200)}...`);
      }
    }
  }
  return [];
}

export interface SceneOutput {
  sceneNumber: number;
  title: string;
  purpose: string;
  timeRange: string;
  characters: string[];
  location: string;
  sceneObjective?: string;
  visualIntroduction?: string;
  emotionalBeat?: string;
  conflictBeat?: string;
  dialogueBeat?: string;
  revealBeat?: string | null;
  visualMotif?: string;
  transitionToNext?: string;
  dramaticTension: string;
  keyAction: string;
  keyDialogue: string;
  transition: string;
  mood: string;
}

export interface EpisodeScriptOutput {
  episodeNumber: number;
  title: string;
  totalDuration: string;
  scenes: SceneOutput[];
  markdownScript: string;
}

export async function generateEpisodeScript(
  bible: StorySeriesBible,
  arc: StoryEpisodeArc,
  characters: StoryCharacter[],
  concept?: string,
  genreOverlay?: GenreOverlay,
  projectId?: string,
  revisionFeedback?: string,
): Promise<EpisodeScriptOutput> {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  let arcJson: Record<string, unknown>;
  try { arcJson = JSON.parse(arc.raw_json); } catch { arcJson = {}; }

  const charBlock = characters
    .map((c) => `- ${c.name} (${c.role}): ${c.traits}. 말투: ${c.speech_style}, 약점: ${c.emotional_weakness}, 능력: ${c.power_or_specialty}, 시그니처: ${c.signature_item}/${c.signature_color}`)
    .join('\n');

  const overlayBlock = formatOverlayBlock(genreOverlay);
  const epRuntime = genreOverlay?.runtime_per_episode || 5;

  const userMsg = `## Series Bible
${JSON.stringify(bibleJson, null, 2).slice(0, 4000)}

${overlayBlock}

${concept ? `## AI 1 승인된 스토리 컨셉 (전문)\n${concept}\n` : ''}

## Episode Arc (Episode ${arc.episode_number})
Title: ${arc.title}
Purpose: ${arc.purpose}
Summary: ${arc.summary}
Beginning: ${arc.beginning}
Middle: ${arc.middle}
Climax: ${arc.climax}
Ending Hook: ${arc.ending_hook}
${JSON.stringify(arcJson, null, 2)}

## Characters
${charBlock}

## ★ 에피소드 대본 품질 규칙

이 에피소드의 **${epRuntime}분 상세 대본**을 만들어라.

### 밀도 규칙:
1. **최소 4~6개 scene** (${epRuntime}분 기준)
2. 각 scene은 아래 **모든 필드**를 포함해야 한다:
   - sceneObjective: 이 장면이 끝났을 때 관객이 알게 되는 것
   - visualIntroduction: 가장 먼저 화면에 보이는 것 (구체적으로)
   - emotionalBeat: 감정 변화 "시작감정 → 끝감정"
   - conflictBeat: 갈등/긴장 포인트
   - dialogueBeat: 핵심 대사 2~3개 (실제 대사문, "대화한다" 금지)
   - revealBeat: 새로 드러나는 정보 (없으면 null)
   - visualMotif: 시각적 모티프 (색, 빛, 오브젝트, 구도)
   - transitionToNext: 다음 장면으로의 전환 방식
3. "한 줄 장면 요약 + 한 줄 대사" 수준 → **실패**
4. AI 3가 바로 shot packet을 만들 수 있을 정도의 밀도
5. 최소 1개 scene에서 조연이 주인공 행동/판단에 직접 영향을 줘야 한다

### markdownScript 규칙:
- 각 장면: 장소, 시간, 행동 서술, **실제 대사** (따옴표), 감정 지시, 카메라 힌트 포함
- AI 3가 읽고 바로 shot 단위로 분해할 수 있는 수준

${revisionFeedback ? `## ★ 이전 평가 피드백 (반드시 반영할 것)\n${revisionFeedback}\n` : ''}
아래 JSON 형식으로만 출력:
\`\`\`json
{
  "episodeNumber": ${arc.episode_number},
  "title": "...",
  "totalDuration": "${epRuntime}:00",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "구체적 장면 제목",
      "purpose": "장면의 역할",
      "timeRange": "0:00~1:10",
      "characters": ["캐릭터1", "캐릭터2"],
      "location": "구체적 장소",
      "sceneObjective": "관객이 알게 되는 것",
      "visualIntroduction": "가장 먼저 보이는 것",
      "emotionalBeat": "불안 → 결의",
      "conflictBeat": "갈등 포인트",
      "dialogueBeat": "실제 대사 2~3개",
      "revealBeat": "새 정보 or null",
      "visualMotif": "시각적 모티프",
      "transitionToNext": "전환 방식",
      "dramaticTension": "7",
      "keyAction": "구체적 행동",
      "keyDialogue": "핵심 대사",
      "transition": "전환",
      "mood": "분위기"
    }
  ],
  "markdownScript": "연출 대본 마크다운"
}
\`\`\``;

  const provider = getProvider();
  const sysPrompt = getScreenplayDirectorPrompt(projectId ? getSupplementForStage(projectId, 'ai2') : '');

  for (let retry = 0; retry < 3; retry++) {
    const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 16000, model: MODEL_AI2_SCRIPT });
    try {
      return JSON.parse(extractJsonBlock(raw));
    } catch {
      if (retry === 2) {
        throw new Error(`에피소드 스크립트 JSON 파싱 실패 (3회 재시도 후): ${raw.slice(0, 200)}...`);
      }
    }
  }
  throw new Error('에피소드 스크립트 생성 실패');
}

// ══════════════════════════════════════════════════════
// AI 3 — Frame & Video Prompt Designer (Multi-Provider)
// ══════════════════════════════════════════════════════

export interface BoundaryFrameOutput {
  frameId: string;
  timecode: string;
  description: string;
  imagePrompt: string;
}

export interface ClipPacketOutput {
  clipNumber: number;
  startTime: string;
  endTime: string;
  durationSec: number;
  startFrameId: string;
  endFrameId: string;
  shotType: string;
  cameraMovement: string;
  speedRamp: string;
  audio: string;
  dialogue: string | null;
  sceneObjective: string;
  videoPrompt: string;
}

export interface FrameVideoOutput {
  header: { title: string; episodeNumber: number; duration: string };
  timeline: string;
  boundaryFrames: BoundaryFrameOutput[];
  clipPackets: ClipPacketOutput[];
}

function compactScenes(scenes: SceneOutput[]): string {
  return scenes.map((s, i) => `### Scene ${i + 1}: ${s.title || ''}
- 장소: ${s.location || ''}
- 시간: ${s.timeRange || ''}
- 캐릭터: ${(s.characters || []).join(', ')}
- 목표: ${s.sceneObjective || ''}
- 첫 화면: ${s.visualIntroduction || ''}
- 감정: ${s.emotionalBeat || ''}
- 갈등: ${s.conflictBeat || ''}
- 대사: ${s.dialogueBeat || ''}
- 모티프: ${s.visualMotif || ''}
- 전환: ${s.transitionToNext || ''}`).join('\n\n');
}

function buildHiggsfieldUserMsg(
  bible: StorySeriesBible, arc: StoryEpisodeArc,
  script: { scenes: SceneOutput[] }, characters: StoryCharacter[],
  density: string, genreOverlay?: GenreOverlay,
): string {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  const charBlock = characters
    .map((c) => `- ${c.name}: ${c.traits}, 시그니처 ${c.signature_item}, 컬러 ${c.signature_color}`)
    .join('\n');

  const locations = [...new Set(script.scenes.map(s => s.location))];
  const overlayBlock = formatOverlayBlock(genreOverlay);

  const totalSec = (genreOverlay?.runtime_per_episode || 5) * 60;

  return `## Provider: higgsfield
Frame-chain 방식으로 생성해야 합니다.

## 에피소드 정보
시리즈: ${bibleJson.logline || bible.title}
장르: ${bible.genre}
톤: ${bible.tone}
에피소드 ${arc.episode_number}: "${arc.title}"

${overlayBlock}

## 장면 구성
${compactScenes(script.scenes)}

## 등장인물
${charBlock}

## 장소 목록
${locations.map((l, i) => `${i + 1}. ${l}`).join('\n')}

## 설정
- Shot density: ${density}
- 전체 러닝타임: ${totalSec}초 (${genreOverlay?.runtime_per_episode || 5}분)
- 클립 길이: 4~20초
- boundary frame(이미지) 개수 = clip 개수 + 1

## ★ 필수 규칙

### 연속 타임코드
- 이전 clip의 endTime = 다음 clip의 startTime (정확히)
- 예: 00:00→00:12, 00:12→00:22, 00:22→00:35 ...
- 전체 clip duration 합 = ${totalSec}초 (±5초)
- MM:SS 형식

### Shot Intention First
매 클립마다 아래를 먼저 결정한 뒤 프레이밍/카메라를 정해라:
- shotIntention: 이 클립이 전달하는 것 (character_intro / threat_reveal / reaction_beat / scale_reveal / dialogue_beat / action_beat / mystery_clue)
- AI 2의 scene beat(sceneObjective, visualIntroduction, emotionalBeat, conflictBeat, revealBeat)를 기반으로 설계
- AI 2에 없는 정보를 generic하게 임의 발명 금지
- wide→medium→close-up 범용 패턴 반복 금지

아래 JSON 형식으로만 출력:
{
  "provider": "higgsfield",
  "header": { "title": "${arc.title}", "episodeNumber": ${arc.episode_number}, "duration": "${genreOverlay?.runtime_per_episode || 5}:00" },
  "timeline": "전체 타임라인 시나리오를 텍스트로",
  "boundaryFrames": [
    { "frameId": "image_001", "timecode": "00:00", "description": "프레임 설명", "imagePrompt": "image prompt in English" }
  ],
  "higgsfieldClipPackets": [
    { "clipNumber": 1, "startTime": "00:00", "endTime": "00:12", "durationSec": 12, "startFrameId": "image_001", "endFrameId": "image_002", "shotType": "attitude intro — body to face", "cameraMovement": "slow push-in", "speedRamp": "auto", "audio": "ambient", "dialogue": null, "sceneObjective": "목적", "videoPrompt": "detailed English cinematic prompt" }
  ],
  "seedanceClipPackets": []
}

규칙:
- boundaryFrames 개수 = higgsfieldClipPackets 개수 + 1
- 체인 구조 유지
- seedanceClipPackets는 빈 배열
- 한국어 대사는 dialogue, videoPrompt/imagePrompt는 영어`;
}

function buildSeedanceUserMsg(
  bible: StorySeriesBible, arc: StoryEpisodeArc,
  script: { scenes: SceneOutput[] }, characters: StoryCharacter[],
  density: string, genreOverlay?: GenreOverlay,
): string {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  const charBlock = characters
    .map((c) => `- ${c.name}: ${c.traits}, 시그니처 ${c.signature_item}, 컬러 ${c.signature_color}`)
    .join('\n');

  const locations = [...new Set(script.scenes.map(s => s.location))];
  const overlayBlock = formatOverlayBlock(genreOverlay);

  const totalSec = (genreOverlay?.runtime_per_episode || 5) * 60;

  return `## Provider: seedance_2_0
Multi-shot cinematic clip 방식으로 생성해야 합니다.
각 클립마다 single_beat인지 multi_shot인지 판단하세요.
multi_shot 클립은 한 클립 안에서 여러 shot beat(intro/reveal/reaction/scale/dialogue/action/transition)를 설계합니다.

## 에피소드 정보
시리즈: ${bibleJson.logline || bible.title}
장르: ${bible.genre}
톤: ${bible.tone}
에피소드 ${arc.episode_number}: "${arc.title}"

${overlayBlock}

## 장면 구성
${compactScenes(script.scenes)}

## 등장인물
${charBlock}

## 장소 목록
${locations.map((l, i) => `${i + 1}. ${l}`).join('\n')}

## 설정
- Shot density: ${density}
- 전체 러닝타임: ${totalSec}초 (${genreOverlay?.runtime_per_episode || 5}분)
- 클립 길이: 4~15초
- multi_shot 클립을 적극 활용하세요 (단순 컷은 single_beat)

## ★ 필수 규칙

### 연속 타임코드
- 이전 clip의 endTime = 다음 clip의 startTime (정확히)
- 예: 00:00→00:12, 00:12→00:22, 00:22→00:35 ...
- 전체 clip totalDurationSec 합 = ${totalSec}초 (±5초)
- MM:SS 형식

### Shot Intention First
매 클립마다 아래를 먼저 결정한 뒤 beat를 설계해라:
- shotIntention: character_intro / threat_reveal / reaction_beat / scale_reveal / dialogue_beat / action_beat / mystery_clue
- AI 2의 scene beat(sceneObjective, visualIntroduction, emotionalBeat, conflictBeat, revealBeat)를 기반
- AI 2에 없는 정보를 generic하게 임의 발명 금지
- wide→medium→close-up 범용 패턴 반복 금지
- character_intro: body_to_face, attitude_intro, silhouette_to_reveal
- threat_reveal: environment_to_threat, detail_to_scale
- reaction_beat: eyes_to_expression, hands_to_face

아래 JSON 형식으로만 출력:
{
  "provider": "seedance_2_0",
  "header": { "title": "${arc.title}", "episodeNumber": ${arc.episode_number}, "duration": "${genreOverlay?.runtime_per_episode || 5}:00" },
  "timeline": "전체 타임라인 시나리오를 텍스트로",
  "boundaryFrames": [],
  "higgsfieldClipPackets": [],
  "seedanceClipPackets": [
    {
      "clipNumber": 1,
      "startTime": "00:00", "endTime": "00:12",
      "totalDurationSec": 12,
      "clipMode": "multi_shot",
      "shotSequenceCount": 4,
      "shotSequence": [
        {
          "beatIndex": 0, "startSec": 0, "endSec": 3,
          "beatType": "intro",
          "framing": "torso close crop, soft focus background",
          "cameraProgression": "static → slow push-in",
          "revealProgression": "character silhouette only",
          "pacingNote": "quiet tension build",
          "description": "..."
        }
      ],
      "shotProgression": "close → medium → close → wide",
      "cameraProgression": "static → push-in → cut → zoom-out",
      "revealProgression": "silhouette → face → emotion → environment",
      "pacingProgression": "tension → anchor → impact → expansion",
      "sceneObjective": "...",
      "dialogue": null,
      "audio": "ambient + sfx",
      "seedancePrompt": "Full cinematic English prompt — must reflect shot/camera/reveal/pacing progression, not just action description."
    }
  ]
}

규칙:
- boundaryFrames와 higgsfieldClipPackets는 빈 배열
- 매 클립마다 clipMode 판단 필수
- single_beat: shotSequenceCount=1, shotSequence에 beat 1개
- multi_shot: shotSequenceCount=2~5, 각 beat에 startSec/endSec 시간 배분
- seedancePrompt는 반드시 shot/camera/reveal/pacing progression을 반영한 영어 시네마틱 서술
- 한국어 대사는 dialogue 필드에
- **연속 타임코드 필수 — 전체 합 = ${totalSec}초 (±5초)**`;
}

function buildSceneUserMsg(
  bible: StorySeriesBible, arc: StoryEpisodeArc,
  scene: SceneOutput, sceneIndex: number, totalScenes: number,
  characters: StoryCharacter[], density: string,
  genreOverlay: GenreOverlay | undefined, videoProvider: VideoProvider,
  timeOffset: string, allocatedSec: number,
): string {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  const charBlock = characters
    .map((c) => `- ${c.name}: ${c.traits}, 시그니처 ${c.signature_item}, 컬러 ${c.signature_color}`)
    .join('\n');

  const providerLabel = videoProvider === 'seedance_2_0' ? 'seedance_2_0' : 'higgsfield';
  const clipRange = videoProvider === 'seedance_2_0' ? '4~15초' : '4~20초';

  const sceneBlock = `### Scene ${sceneIndex + 1}/${totalScenes}: ${scene.title || ''}
- 장소: ${scene.location || ''}
- 시간: ${scene.timeRange || ''}
- 캐릭터: ${(scene.characters || []).join(', ')}
- 목표: ${scene.sceneObjective || ''}
- 첫 화면: ${scene.visualIntroduction || ''}
- 감정: ${scene.emotionalBeat || ''}
- 갈등: ${scene.conflictBeat || ''}
- 대사: ${scene.dialogueBeat || ''}
- 공개: ${scene.revealBeat || ''}
- 모티프: ${scene.visualMotif || ''}
- 전환: ${scene.transitionToNext || ''}`;

  const seedanceExtra = videoProvider === 'seedance_2_0'
    ? `\n- 각 클립마다 clipMode(single_beat/multi_shot) 판단 필수
- multi_shot: shotSequenceCount=2~5, beat별 startSec/endSec 배분
- seedancePrompt는 shot/camera/reveal/pacing progression을 반영한 영어 시네마틱 서술`
    : `\n- boundary frame(이미지) 개수 = clip 개수 + 1 (frame-chain)`;

  const outputHint = videoProvider === 'seedance_2_0'
    ? `"seedanceClipPackets": [{ "clipNumber": N, "startTime": "MM:SS", "endTime": "MM:SS", "totalDurationSec": X, "clipMode": "single_beat|multi_shot", "shotIntention": "character_intro|threat_reveal|reaction_beat|scale_reveal|dialogue_beat|action_beat|mystery_clue", "shotSequenceCount": N, "shotSequence": [...], "shotProgression": "...", "cameraProgression": "...", "revealProgression": "...", "pacingProgression": "...", "sceneObjective": "...", "startFrame": "첫 화면 설명", "endFrame": "마지막 화면 설명", "revealTarget": "관객이 새로 알게 되는 시각적 변화", "seedancePrompt": "English prompt" }]`
    : `"higgsfieldClipPackets": [{ "clipNumber": N, "startTime": "MM:SS", "endTime": "MM:SS", "durationSec": X, "startFrameId": "image_NNN", "endFrameId": "image_NNN", "shotType": "...", "shotIntention": "character_intro|threat_reveal|reaction_beat|scale_reveal|dialogue_beat|action_beat|mystery_clue", "cameraMovement": "...", "sceneObjective": "...", "startFrame": "첫 화면", "endFrame": "마지막 화면", "revealTarget": "시각적 발견", "videoPrompt": "English prompt" }],
"boundaryFrames": [{ "frameId": "image_NNN", "timecode": "MM:SS", "description": "...", "imagePrompt": "English prompt" }]`;

  const targetClips = Math.max(2, Math.min(5, Math.round(allocatedSec / 20)));

  return `## Provider: ${providerLabel}
## 에피소드 정보
시리즈: ${bibleJson.logline || bible.title}
장르: ${bible.genre} | 톤: ${bible.tone}
에피소드 ${arc.episode_number}: "${arc.title}"

## 이 장면 정보
${sceneBlock}

## 등장인물
${charBlock}

## 설정
- Shot density: ${density}
- 이 장면 시작 타임코드: ${timeOffset}
- 이 장면 할당 시간: ${allocatedSec}초
- 클립 길이: ${clipRange}
- 이 장면에서 ${targetClips}~${targetClips + 1}개 클립 생성 (총 ${allocatedSec}초 할당)${seedanceExtra}
- ★ 클립 모드 가이드:
  - 대화/감정/반응 장면 → single_beat (짧고 집중, 4~6초)
  - 위협 등장/능력 발동/반전/추격 → multi_shot (3~4 beat)
  - 전체 클립 중 single_beat이 최소 30% → 모든 클립이 multi_shot이면 실패
- ★ 프레이밍 필수:
  - 각 클립에 shotIntention 명시 (character_intro/threat_reveal/reaction_beat/dialogue_beat/action_beat 등)
  - start frame(첫 화면)과 end frame(마지막 화면) 명시
  - reveal target: 관객이 새로 알게 되는 시각적 변화 1개

## ★ 필수 규칙
- 연속 타임코드: 이전 clip endTime = 다음 clip startTime (정확히)
- 시작 타임코드: ${timeOffset}
- 이 장면 클립 duration 합 = ${allocatedSec}초 (±3초)
- 각 클립 duration: 4~14초. 15초 이상 절대 금지.
- MM:SS 형식

★ 카메라 다양성 규칙 (shot_variety):
이 장면의 ${targetClips}개 클립은 각각 다른 시작 프레이밍을 써야 한다.
아래에서 골라 사용하되, 같은 것을 2번 이상 쓰지 마라:
- tight detail insert (오브젝트 클로즈업으로 시작)
- over-the-shoulder (캐릭터 뒤에서 시작)
- low-angle push-in (아래에서 위로 올려보는 시작)
- wide establishing (공간 전체를 보여주고 시작)
- lateral tracking (옆에서 따라가며 시작)
- foreground obstruction (앞에 뭔가 가리고 뒤를 보여주는 시작)
- whip-pan arrival (빠른 회전으로 도착하는 시작)
- static symmetry (정면 대칭 구도로 시작)

★ 프롬프트 완결성:
- 각 클립의 seedancePrompt는 반드시 완결된 영어 문장으로 끝나야 한다.
- 문장이 중간에 잘린 프롬프트는 실패 처리.
- 구조: "Open on [시작 프레임]. [카메라 동작]. [reveal]. End on [마지막 프레임]."

- Shot Intention First: 매 클립마다 shotIntention을 먼저 결정 (character_intro / threat_reveal / reaction_beat / scale_reveal / dialogue_beat / action_beat / mystery_clue)
- AI 2 scene beat 기반 설계. 임의 발명 금지.
- clipNumber는 ${sceneIndex > 0 ? '이전 장면 마지막 번호 다음부터' : '1부터'} 시작

아래 JSON 형식으로만 출력. 다른 텍스트 없이.
{ ${outputHint} }`;
}

function parseTimeToSec(t: string): number {
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function secToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function generateFrameAndVideoPackets(
  bible: StorySeriesBible,
  arc: StoryEpisodeArc,
  script: { scenes: SceneOutput[]; markdownScript?: string },
  characters: StoryCharacter[],
  density: 'balanced' | 'cinematic_detail' = 'cinematic_detail',
  genreOverlay?: GenreOverlay,
  videoProvider: VideoProvider = 'higgsfield',
  projectId?: string,
  revisionFeedback?: string,
): Promise<FrameVideoOutputV2> {
  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai3') : '';
  const sysPrompt = getFrameVideoPromptDesignerPrompt(supplement);

  const scenes = script.scenes || [];
  if (scenes.length === 0) {
    throw new Error('장면 데이터가 없습니다');
  }

  const totalSec = (genreOverlay?.runtime_per_episode || 5) * 60;
  const secPerScene = Math.floor(totalSec / scenes.length);

  const allBoundaryFrames: any[] = [];
  const allHiggsfieldClips: any[] = [];
  const allSeedanceClips: any[] = [];
  const timelineParts: string[] = [];

  let currentClipNum = 1;
  let currentTimeSec = 0;
  let currentFrameNum = 1;

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const isLast = si === scenes.length - 1;
    const allocSec = isLast ? (totalSec - currentTimeSec) : secPerScene;
    const timeOffset = secToTime(currentTimeSec);

    let sceneMsg = buildSceneUserMsg(
      bible, arc, scene, si, scenes.length, characters, density,
      genreOverlay, videoProvider, timeOffset, allocSec,
    );
    if (revisionFeedback && si === 0) {
      sceneMsg += `\n\n## ★ 이전 평가 피드백 (반드시 반영할 것)\n${revisionFeedback.slice(0, 800)}`;
    }

    let parsed: any = null;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const raw = await provider.chat(sysPrompt, sceneMsg, { maxTokens: 8000, model: MODEL_AI3_CLIPS });
        parsed = JSON.parse(extractJsonBlock(raw));
        break;
      } catch (err) {
        console.warn(`[AI 3] Scene ${si + 1} retry ${retry + 1}/3 실패: ${(err as Error).message?.slice(0, 80)}`);
        if (retry === 2) {
          console.error(`[AI 3] Scene ${si + 1} 생성 포기, 스킵`);
        }
      }
    }

    if (!parsed) {
      currentTimeSec += allocSec;
      continue;
    }

    if (parsed.timeline) timelineParts.push(parsed.timeline);

    const frames = parsed.boundaryFrames || [];
    const frameIdMap: Record<string, string> = {};
    for (const f of frames) {
      const newId = `image_${String(currentFrameNum).padStart(3, '0')}`;
      frameIdMap[f.frameId] = newId;
      f.frameId = newId;
      currentFrameNum++;
      allBoundaryFrames.push(f);
    }

    const hClips = parsed.higgsfieldClipPackets || parsed.clipPackets || [];
    for (const c of hClips) {
      c.clipNumber = currentClipNum++;
      if (c.startFrameId && frameIdMap[c.startFrameId]) c.startFrameId = frameIdMap[c.startFrameId];
      if (c.endFrameId && frameIdMap[c.endFrameId]) c.endFrameId = frameIdMap[c.endFrameId];
      allHiggsfieldClips.push(c);
    }

    const sClips = parsed.seedanceClipPackets || [];
    for (const c of sClips) {
      c.clipNumber = currentClipNum++;

      if (c.seedancePrompt) {
        const prompt = c.seedancePrompt.trim();
        if (prompt.length > 0 && !prompt.match(/[.!?"']$/)) {
          const lastPeriod = prompt.lastIndexOf('.');
          if (lastPeriod > prompt.length * 0.5) {
            c.seedancePrompt = prompt.slice(0, lastPeriod + 1);
          } else {
            c.seedancePrompt = prompt + '.';
          }
        }
      }

      allSeedanceClips.push(c);
    }

    const sceneDurations = [...hClips.map((c: any) => c.durationSec || 0), ...sClips.map((c: any) => c.totalDurationSec || 0)];
    const actualSceneSec = sceneDurations.reduce((a: number, b: number) => a + b, 0);
    currentTimeSec += actualSceneSec > 0 ? actualSceneSec : allocSec;
  }

  if (videoProvider === 'seedance_2_0') {
    fixSeedanceClips(allSeedanceClips);
  }
  if (videoProvider === 'higgsfield') {
    let curSec = 0;
    for (let i = 0; i < allHiggsfieldClips.length; i++) {
      allHiggsfieldClips[i].clipNumber = i + 1;
      allHiggsfieldClips[i].startTime = secToTime(curSec);
      const dur = allHiggsfieldClips[i].durationSec || 10;
      curSec += dur;
      allHiggsfieldClips[i].endTime = secToTime(curSec);
    }
  }

  return {
    provider: videoProvider,
    header: { title: arc.title, episodeNumber: arc.episode_number, duration: `${genreOverlay?.runtime_per_episode || 5}:00` },
    timeline: timelineParts.join('\n\n'),
    boundaryFrames: allBoundaryFrames,
    higgsfieldClipPackets: allHiggsfieldClips,
    seedanceClipPackets: allSeedanceClips,
  };
}

function fixSeedanceClips(clips: any[]): void {
  const MAX_DURATION = 15;

  const expanded: any[] = [];
  for (const c of clips) {
    const dur = c.totalDurationSec || 0;
    if (dur > MAX_DURATION) {
      const half = Math.floor(dur / 2);
      const startSec = parseTimeToSec(c.startTime || '00:00');

      const clip1 = { ...c };
      clip1.totalDurationSec = half;
      clip1.endTime = secToTime(startSec + half);
      clip1.clipMode = 'single_beat';
      clip1.shotSequenceCount = 1;
      clip1.shotSequence = (c.shotSequence || []).slice(0, Math.ceil((c.shotSequence || []).length / 2));

      const clip2 = { ...c };
      clip2.totalDurationSec = dur - half;
      clip2.startTime = secToTime(startSec + half);
      clip2.endTime = secToTime(startSec + dur);
      clip2.clipMode = 'single_beat';
      clip2.shotSequenceCount = 1;
      clip2.shotSequence = (c.shotSequence || []).slice(Math.ceil((c.shotSequence || []).length / 2));
      clip2.seedancePrompt = clip2.seedancePrompt || c.seedancePrompt || '';

      expanded.push(clip1, clip2);
    } else {
      expanded.push(c);
    }
  }

  let currentSec = 0;
  if (expanded.length > 0 && expanded[0].startTime) {
    currentSec = parseTimeToSec(expanded[0].startTime);
  }
  for (let i = 0; i < expanded.length; i++) {
    expanded[i].clipNumber = i + 1;
    expanded[i].startTime = secToTime(currentSec);
    const dur = expanded[i].totalDurationSec || 10;
    currentSec += dur;
    expanded[i].endTime = secToTime(currentSec);
  }

  clips.length = 0;
  clips.push(...expanded);
}
