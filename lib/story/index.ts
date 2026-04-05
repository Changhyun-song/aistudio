import { getProvider } from '@/lib/ai';
import {
  getStoryArchitectPrompt,
  getScreenplayDirectorPrompt,
  getFrameVideoPromptDesignerPrompt,
  getEvaluatorPrompt,
  getPlannerPrompt,
  getPromptOptimizerPrompt,
  loadSystemPrompt,
} from '@/lib/ai/story-studio/load-system-prompt';
import { promptSupplementRepo } from '@/lib/db/repository';
import type { StoryCharacter, StorySeriesBible, StoryEpisodeArc, GenreOverlay } from '@/types';

function getSupplementForStage(projectId: string, stage: string): string {
  try {
    return promptSupplementRepo.getEffective(projectId, stage);
  } catch { return ''; }
}

const MODEL_GENERATOR = process.env.OPENAI_MODEL_GENERATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_EVALUATOR = process.env.OPENAI_MODEL_EVALUATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_PLANNER   = process.env.OPENAI_MODEL_PLANNER   || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_OPTIMIZER = process.env.OPENAI_MODEL_OPTIMIZER  || process.env.OPENAI_MODEL || 'gpt-5.4-mini';

function extractJsonBlock(raw: string): string {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();
  const braceStart = raw.indexOf('{');
  const bracketStart = raw.indexOf('[');
  if (braceStart === -1 && bracketStart === -1) return raw.trim();
  const start = braceStart === -1 ? bracketStart : bracketStart === -1 ? braceStart : Math.min(braceStart, bracketStart);
  return raw.slice(start).trim();
}

function formatOverlayBlock(overlay?: GenreOverlay): string {
  if (!overlay || !overlay.genre_stack?.length) return '';

  const comp = overlay.protagonist_composition || overlay.protagonist_gender_rule || 'unspecified';

  const lines: string[] = [
    `## 프로젝트 제약 (이번 작품의 규칙)`,
    ``,
    `### 장르/톤`,
    `- genre_stack: ${overlay.genre_stack.join(', ')}`,
    `- tone: ${overlay.tone || '자유'}`,
    `- world_mode: ${overlay.world_mode || '자유'}`,
    `- target_audience: ${overlay.target_audience || '자유'}`,
    `- story_central_axis: ${overlay.story_central_axis || 'unspecified'}`,
    ``,
    `### 캐스팅`,
    `- protagonist_count: ${overlay.protagonist_count || '(AI가 결정)'}`,
    `- protagonist_composition: ${comp}`,
    `  - all_female=전원 여성, all_male=전원 남성, mixed=혼성, female_lead=여성 중심(혼성 허용), male_lead=남성 중심(혼성 허용)`,
    `- cast_total_limit: ${overlay.cast_total_limit || 10}`,
    `- supporting_cast_min: ${overlay.supporting_cast_min ?? 2}`,
    `- supporting_cast_max: ${overlay.supporting_cast_max ?? 5}`,
    `- setting_region: ${overlay.setting_region === 'custom' ? overlay.setting_region_custom : overlay.setting_region || 'korea'}`,
    `- age_group: ${overlay.age_group || 'unspecified'}`,
    ``,
    `### 레벨`,
    `- romance_level: ${overlay.romance_level}`,
    `- mystery_level: ${overlay.mystery_level}`,
    `- action_level: ${overlay.action_level}`,
    `- tragedy_level: ${overlay.tragedy_level}`,
    `- twist_level: ${overlay.twist_level}`,
    ``,
    `### 결말/이벤트`,
    `- ending_type: ${overlay.ending_type}`,
    `- death_event: ${overlay.death_event}`,
    `- creature_usage: ${overlay.creature_usage}`,
    `- power_system_usage: ${overlay.power_system_usage || 'none'}`,
    ``,
    `### 시리즈 구조`,
    `- episode_count: ${overlay.episode_count || 10}`,
    `- runtime_per_episode: ${overlay.runtime_per_episode || 5}분`,
  ];

  if (overlay.must_have_elements?.length) lines.push(``, `### 필수 요소`, ...overlay.must_have_elements.map(e => `- ${e}`));
  if (overlay.nice_to_have_elements?.length) lines.push(``, `### 있으면 좋은 요소`, ...overlay.nice_to_have_elements.map(e => `- ${e}`));
  if (overlay.forbidden_elements?.length) lines.push(``, `### 금지 요소 (절대 포함 금지)`, ...overlay.forbidden_elements.map(e => `- ❌ ${e}`));
  if (overlay.required_character_types?.length) lines.push(``, `### 필수 캐릭터 유형 (반드시 포함)`, ...overlay.required_character_types.map(e => `- ✅ ${e}`));
  if (overlay.optional_character_types?.length) lines.push(``, `### 선택 캐릭터 유형 (있으면 좋음)`, ...overlay.optional_character_types.map(e => `- 💡 ${e}`));

  lines.push(``, `**규칙:**`,
    `- none인 항목은 넣지 마라`,
    `- required인 항목만 반드시 넣어라`,
    `- forbidden_elements에 있는 것은 절대 넣지 마라`,
    `- protagonist_count가 0이거나 비어있으면 AI가 작품에 맞게 결정`,
    `- protagonist_composition이 unspecified면 AI가 작품에 맞게 결정`,
    `- protagonist_composition이 female_lead/male_lead면 해당 성별이 주인공 중 다수이되, 다른 성별도 메인 캐스트에 1~2명 허용`,
    `- 조연은 반드시 supporting_cast_min~supporting_cast_max 범위 내에서 개별 이름+설정 부여`,
    `- story_central_axis가 unspecified 아니면, 해당 축이 스토리의 주된 동력이 되도록 구성`,
  );

  return lines.join('\n');
}

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
    "genre_stack": ["drama", "sf", ...],
    "tone": "분위기 키워드",
    "world_mode": "세계관 모드",
    "story_central_axis": "character|mystery|action|romance|relationship|twist|ensemble|unspecified",
    "protagonist_count": 0,
    "protagonist_composition": "unspecified|all_female|all_male|mixed|female_lead|male_lead",
    "cast_total_limit": 10,
    "supporting_cast_min": 2,
    "supporting_cast_max": 5,
    "setting_region": "korea|japan|global|fantasy_world|custom",
    "age_group": "high_school|college|adult|mixed|unspecified",
    "target_audience": "타겟",
    "romance_level": "none|low|medium|high",
    "mystery_level": "none|low|medium|high",
    "action_level": "none|low|medium|high",
    "tragedy_level": "none|low|medium|high",
    "twist_level": "low|medium|high|extreme",
    "ending_type": "happy|bittersweet|tragic|unresolved",
    "death_event": "none|optional|required",
    "creature_usage": "none|optional|required",
    "power_system_usage": "none|optional|required",
    "episode_count": 10,
    "runtime_per_episode": 5
  },
  "suggestions": {
    "must_have": ["이 아이디어에 반드시 필요한 요소 3~5개"],
    "forbidden": ["이 장르에서 피해야 할 클리셰 2~3개"],
    "nice_to_have": ["있으면 좋을 요소 3~5개"],
    "required_characters": ["이 스토리에 꼭 필요한 캐릭터 유형 2~3개"],
    "optional_characters": ["있으면 좋을 캐릭터 유형 2~3개"]
  }
}
\`\`\`

규칙:
- genre_stack은 drama/sf/thriller/comedy/romance/action/mystery/fantasy/school/creature 중 선택
- 아이디어에서 추론 불가한 항목은 합리적인 기본값
- protagonist_count 0 = AI가 나중에 결정
- suggestions는 한국어로`;

  const raw = await provider.chat(systemMsg, `아이디어: ${rawIdea}`, { maxTokens: 2000, temperature: 0.3, model: MODEL_GENERATOR });

  try {
    const parsed = JSON.parse(extractJsonBlock(raw));
    return {
      overlay: parsed.overlay || {},
      suggestions: parsed.suggestions || { must_have: [], forbidden: [], nice_to_have: [], required_characters: [], optional_characters: [] },
    };
  } catch {
    return {
      overlay: {},
      suggestions: { must_have: [], forbidden: [], nice_to_have: [], required_characters: [], optional_characters: [] },
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
  return provider.chat(getStoryArchitectPrompt(supplement), userMsg, { maxTokens: 16000, temperature: 0.8, model: MODEL_GENERATOR });
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

## 수정 규칙
1. 피드백을 반영해서 출력 형식 0~18번 전체를 다시 작성
2. 프로젝트 제약 재확인 — 위반 수정
3. 제약에 없는 요소가 임의 추가되었으면 제거
4. protagonist_count / protagonist_composition / supporting_cast_min~max / forbidden_elements 위반 확인
5. 조연이 집합명사면 개별로 풀기
6. none인 항목의 섹션이 출력되었으면 제거
7. 자가검사: 약한 3개 → 점수표(엄격) → 6점 이하 수정 → 자동 1회 수정 패스
8. 일관성 검증
9. 변경 부분에 [수정됨] 표시
10. 세계관 훅: 핵심 장소/시스템이 단순 배경이면 한 단계 더 비틀어라
11. 조연 존재감: 각 조연의 행동이 주인공 판단을 실제로 바꾸는지 확인. 시즌에서 영향 미치는 화/역할 명시
12. 제목 generic 금지 ("시작", "결전" 등)
13. "다음 AI에게 넘길 포인트"에 narrative engine 후보 + 조연 역할 + 시각/감정 힌트 포함

한국어로 작성해.`;

  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai1') : '';
  return provider.chat(getStoryArchitectPrompt(supplement), userMsg, { maxTokens: 16000, temperature: 0.8, model: MODEL_GENERATOR });
}

// ══════════════════════════════════════════════════════
// AI 1 — Character Extraction (Enhanced v2)
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
    ? `## AI 1 스토리 아키텍트 — 승인된 스토리 컨셉 (전문)\n모든 설정을 유지해야 합니다.\n\n${conceptMarkdown}\n\n---`
    : '';

  const overlayBlock = formatOverlayBlock(genreOverlay);

  const userMsg = `${conceptSection}
${overlayBlock}

## Series Concept
Title: ${input.title}
Genre: ${input.genre}
Tone: ${input.tone}
World Rules: ${input.worldRules}
Season Goal: ${input.seasonGoal}
Core Conflict: ${input.coreConflict}
Ending Direction: ${input.endingDirection}
Target Audience: ${input.audience}
Reference Mood: ${input.referenceMood}

## Characters (${characters.length})
${charBlock || '(스토리 컨셉에 포함된 인물 사용)'}

**프로젝트 제약에 따라 에피소드 리듬과 장면 밀도를 조절하세요.**

## ★ 품질 규칙 — 각 섹션은 역할이 분리되어야 한다
- logline: 한 문장 후킹. 세계관 설명 넣지 마라
- premise: 세계관 + 주인공 + 핵심 갈등 구조. logline 반복 금지
- theme: "이 이야기는 결국 ___에 대한 이야기다". 줄거리 요약 금지
- seasonGoal: 시즌 끝에 해결되어야 할 구체적 과제. 추상적 성장 금지
- coreConflict: 내부 갈등 + 외부 위협의 구체적 충돌. theme 반복 금지
- visualTone: 색감·조명·질감·공간감. 분위기 형용사만 나열 금지
- episodeProgressionLogic: 전체 시즌이 어떤 리듬으로 고조되는지
- endingHook: 시즌 후 관객이 다음을 기다리게 할 구체적 장치

중복 설명 발견 시 → 해당 섹션을 다시 써라.

반드시 유효한 JSON 객체만 출력. 다른 텍스트 없이.
\`\`\`json
{
  "logline": "한 문장 후킹 (세계관 설명 X)",
  "premise": "세계관 + 주인공 + 핵심 갈등 구조적 전제",
  "seriesOverview": "시리즈 전체 개요 (3~5문장)",
  "theme": "감정적/철학적 중심축",
  "seasonGoal": "이번 시즌의 구체적 해결 과제",
  "coreConflict": "내부 갈등 + 외부 위협 (premise와 다른 관점)",
  "characterArcs": [{"name": "이름", "arc": "구체적 아크 (시작→전환→결말)"}],
  "worldRules": ["규칙1 (한 줄 구체적)", "규칙2"],
  "visualTone": "구체적 색감·조명·질감 (형용사만 나열 금지)",
  "episodeProgressionLogic": "시즌 전체 고조 리듬",
  "endingHook": "시즌 끝 장치 (구체적)"
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(getScreenplayDirectorPrompt(projectId ? getSupplementForStage(projectId, 'ai2') : ''), userMsg, { maxTokens: 8000, model: MODEL_GENERATOR });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    return {
      logline: '', premise: raw.slice(0, 500), seriesOverview: raw,
      theme: '', seasonGoal: input.seasonGoal, coreConflict: input.coreConflict,
      characterArcs: [], worldRules: [], visualTone: '',
      episodeProgressionLogic: '', endingHook: '',
    };
  }
}

export interface EpisodeArcOutput {
  episodeNumber: number;
  title: string;
  narrativeEngine?: string;
  centralCharacter?: string;
  supportingCastRole?: string;
  purpose: string;
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
): Promise<EpisodeArcOutput[]> {
  let bibleJson: Record<string, unknown>;
  try { bibleJson = JSON.parse(bible.raw_json); } catch { bibleJson = {}; }

  const bibleStr = JSON.stringify(bibleJson, null, 2);
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const epCount = genreOverlay?.episode_count || 10;
  const epRuntime = genreOverlay?.runtime_per_episode || 5;

  const userMsg = `## 시리즈 정보
Title: ${bible.title}
Genre: ${bible.genre}
Tone: ${bible.tone}

${overlayBlock}

## Series Bible
${bibleStr.slice(0, 6000)}

${concept ? `## AI 1 승인된 스토리 컨셉 (전문)\n${concept}\n` : ''}

## ★ 시즌 플래너 규칙

이 시리즈를 **${epCount}부작 x ${epRuntime}분** 구조로 분할해줘.

### 필수 규칙:
1. 매 화마다 반드시 아래 narrative engine 중 하나를 중심 동력으로 배치:
   character_reveal / relationship_rupture / mystery_escalation / false_victory / grief_fallout / hidden_truth / betrayal_suspicion / power_reveal / strategy_lock_in / irreversible_choice
2. **연속 2화가 같은 engine을 쓰면 안 된다**
3. 제목은 generic 금지 — 그 화의 핵심 이미지/장치를 반영하는 구체적 제목
4. 매 화에 최소 1명의 조연이 **주인공의 행동/판단에 직접 영향**을 주는 역할을 해야 한다
5. beginning/middle/climax는 각각 **최소 3문장**, 구체적 비주얼/행동 포함
6. summary는 **최소 5문장**

반드시 아래 JSON 배열 형식으로만 출력. 다른 텍스트 없이.

\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "구체적이고 이미지가 있는 제목",
    "narrativeEngine": "character_reveal",
    "purpose": "이 화가 시즌 전체에서 하는 역할",
    "centralCharacter": "이 화의 중심 캐릭터",
    "supportingCastRole": "이 화에서 조연이 하는 구체적 역할",
    "summary": "줄거리 요약 (5문장+)",
    "beginning": "도입 (3문장+, 구체적 비주얼)",
    "middle": "중반 (3문장+, 갈등 전개와 감정 변화)",
    "climax": "클라이맥스 (3문장+, 구체적 장면)",
    "endingHook": "다음 회 연결 (구체적 시각적 장면)",
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
    const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 16000, model: MODEL_GENERATOR });
    try {
      const parsed = JSON.parse(extractJsonBlock(raw));
      return Array.isArray(parsed) ? parsed : [];
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
    const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 16000, model: MODEL_GENERATOR });
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

import type { VideoProvider, FrameVideoOutputV2 } from '@/types';

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
${JSON.stringify(script.scenes, null, 2)}

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
${JSON.stringify(script.scenes, null, 2)}

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

export async function generateFrameAndVideoPackets(
  bible: StorySeriesBible,
  arc: StoryEpisodeArc,
  script: { scenes: SceneOutput[]; markdownScript?: string },
  characters: StoryCharacter[],
  density: 'balanced' | 'cinematic_detail' = 'cinematic_detail',
  genreOverlay?: GenreOverlay,
  videoProvider: VideoProvider = 'higgsfield',
  projectId?: string,
): Promise<FrameVideoOutputV2> {
  const userMsg = videoProvider === 'seedance_2_0'
    ? buildSeedanceUserMsg(bible, arc, script, characters, density, genreOverlay)
    : buildHiggsfieldUserMsg(bible, arc, script, characters, density, genreOverlay);

  const provider = getProvider();
  const supplement = projectId ? getSupplementForStage(projectId, 'ai3') : '';
  const raw = await provider.chat(getFrameVideoPromptDesignerPrompt(supplement), userMsg, { maxTokens: 16000, model: MODEL_GENERATOR });
  try {
    const parsed = JSON.parse(extractJsonBlock(raw));
    return {
      provider: videoProvider,
      header: parsed.header || { title: arc.title, episodeNumber: arc.episode_number, duration: `${genreOverlay?.runtime_per_episode || 5}:00` },
      timeline: parsed.timeline || '',
      boundaryFrames: parsed.boundaryFrames || [],
      higgsfieldClipPackets: parsed.higgsfieldClipPackets || parsed.clipPackets || [],
      seedanceClipPackets: parsed.seedanceClipPackets || [],
    };
  } catch {
    throw new Error(`프레임/비디오 패킷 JSON 파싱 실패: ${raw.slice(0, 200)}...`);
  }
}

// ══════════════════════════════════════════════════════
// Evaluator AI
// ══════════════════════════════════════════════════════

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

export async function evaluateOutput(
  taskType: EvalTaskType,
  content: string,
  genreOverlay?: GenreOverlay,
): Promise<EvalResult> {
  const overlayBlock = formatOverlayBlock(genreOverlay);
  const promptTaskType = EVAL_TASK_MAP[taskType];

  const userMsg = `## 평가 태스크: ${promptTaskType}

${overlayBlock}

## 평가 대상 콘텐츠
${content.slice(0, 12000)}

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
      const raw = await provider.chat(sysPrompt, userMsg, { maxTokens: 6000, temperature: 0, model: MODEL_EVALUATOR });
      const parsed = JSON.parse(extractJsonBlock(raw)) as EvalResult;
      normalizeScoresTo5(parsed);
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

  // Outlier removal: if one score deviates by >1.5 from the others, drop it
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
// Planner AI
// ══════════════════════════════════════════════════════

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

const STAGE_MAP: Record<EvalTaskType, string> = {
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
  const stage = STAGE_MAP[taskType];

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
  const raw = await provider.chat(getPlannerPrompt(stage), userMsg, { maxTokens: 2000, temperature: 0, model: MODEL_PLANNER });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    return {
      stage,
      goal: '품질 높은 결과 생성',
      successContract: ['품질 기준 충족'],
      generatorInstructions: '',
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
  const stage = STAGE_MAP[taskType];
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
  const raw = await provider.chat(getPlannerPrompt(stage), userMsg, { maxTokens: 4000, temperature: 0, model: MODEL_PLANNER });
  try {
    return JSON.parse(extractJsonBlock(raw));
  } catch {
    const mustFixItems = evaluation.criteria?.filter(c => c.mustFix) || [];
    return {
      stage,
      goal: '',
      successContract: [],
      currentVersion: '',
      evaluationSummary: evaluation.revisionBrief || '',
      decision: 'revise_partial',
      replanReason: 'JSON 파싱 실패로 기본 partial revision',
      revisionTargets: mustFixItems.map(f => ({
        target: stage,
        problem: f.name,
        whyItMatters: f.reason,
        priority: 'high' as const,
        fixStrategy: '재생성',
        expectedImpact: '품질 향상',
      })),
      nextAction: '수정 후 재평가',
    };
  }
}

// ══════════════════════════════════════════════════════
// Prompt Optimizer
// ══════════════════════════════════════════════════════

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

### 현재 Base 프롬프트 (일부)
${basePrompt.slice(0, 6000)}

### 현재 프로젝트별 보충 규칙
${currentSupplement || '(없음 - 아직 보충이 추가되지 않음)'}

### Generator 출력 (요약)
${generatorOutput.slice(0, 4000)}

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
      // Project-specific: save as-is (may contain content-specific references)
      promptSupplementRepo.upsert(projectId, stage, result.fullSupplement, JSON.stringify(result.diagnosis));

      // Global: only save if it looks content-agnostic (no Korean proper nouns that look like character names)
      // The Prompt Optimizer is now instructed to avoid content-specific rules, but we double-check
      const hasProperNouns = /[가-힣]{2,4}=[가-힣]|서준혁|윤서|하린|다인|가현|유진|한서아/.test(result.fullSupplement);
      if (!hasProperNouns) {
        promptSupplementRepo.upsertGlobal(stage, result.fullSupplement, JSON.stringify(result.diagnosis));
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
