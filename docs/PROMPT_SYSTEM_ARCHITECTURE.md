# AI Studio — 프롬프트 시스템 아키텍처 전체 문서

> 이 문서는 코드베이스의 AI 프롬프트 시스템 전체를 설명합니다.
> Claude/GPT 등 외부 AI에게 프롬프트 수정 작업을 의뢰할 때 이 문서를 공유하세요.

---

## 1. 시스템 개요

이 앱은 **AI 기반 스토리·캐릭터·영상 프롬프트 파이프라인**입니다.

핵심 흐름:
```
사용자 아이디어 → AI 1 (스토리 설계) → AI 2 (대본화) → AI 3 (영상 프롬프트)
                    ↑                      ↑                  ↑
              Evaluator AI 1         Evaluator AI 2     Evaluator AI 3
                    ↑                      ↑                  ↑
              Planner AI 1           Planner AI 2       Planner AI 3
                    ↑
            Prompt Optimizer AI (메타 엔지니어)
```

각 단계는 **Generator → Evaluator → Planner → (Optimizer) → Generator 재생성** 루프를 반복합니다.

---

## 2. AI 역할별 정리 (총 10개 역할)

| # | 역할 | 시스템 프롬프트 파일 | GPT 모델 | Temperature | 용도 |
|---|------|---------------------|----------|-------------|------|
| 1 | **AI 1 Generator** (Story Architect) | `AI_1_Story_Architect.md` (228줄) | `gpt-5.4` (OPENAI_MODEL_GENERATOR) | 0.8 | 스토리 컨셉 생성/수정 |
| 2 | **AI 2 Generator** (Screenplay Director) | `AI_2_Screenplay_Director.md` (153줄) | `gpt-5.4` (OPENAI_MODEL_GENERATOR) | 0.7 (default) | Series Bible, 시즌 플랜, 에피소드 대본 |
| 3 | **AI 3 Generator** (Frame & Video Designer) | `AI_3_Frame_Video_Prompt_Designer.md` (268줄) | `gpt-5.4` (OPENAI_MODEL_GENERATOR) | 0.7 (default) | 영상 프레임/클립 프롬프트 |
| 4 | **Evaluator (Story)** | `AI_Evaluator_Story.md` (117줄) | `gpt-5.4-mini` (OPENAI_MODEL_EVALUATOR) | **0** (결정적) | AI 1 결과 평가 |
| 5 | **Evaluator (Screenplay)** | `AI_Evaluator_Screenplay.md` (126줄) | `gpt-5.4-mini` | **0** | AI 2 결과 평가 |
| 6 | **Evaluator (FrameVideo)** | `AI_Evaluator_FrameVideo.md` (123줄) | `gpt-5.4-mini` | **0** | AI 3 결과 평가 |
| 7 | **Planner (Story)** | `AI_Planner_Story.md` (82줄) | `gpt-5.4-mini` (OPENAI_MODEL_PLANNER) | **0** | AI 1 수정 전략 |
| 8 | **Planner (Screenplay)** | `AI_Planner_Screenplay.md` (86줄) | `gpt-5.4-mini` | **0** | AI 2 수정 전략 |
| 9 | **Planner (FrameVideo)** | `AI_Planner_FrameVideo.md` (80줄) | `gpt-5.4-mini` | **0** | AI 3 수정 전략 |
| 10 | **Prompt Optimizer** | `AI_Prompt_Optimizer.md` (148줄) | `gpt-5.4-mini` (OPENAI_MODEL_OPTIMIZER) | **0** | 프롬프트 자체를 분석/개선하는 메타 AI |

추가로 **Auto-Fill AI** (아이디어 → 구조화 설정 변환)와 **Character Extractor AI** (컨셉에서 등장인물 추출)가 있지만, 이들은 별도 프롬프트 파일 없이 코드 내 인라인으로 정의됩니다.

---

## 3. 환경 변수 (.env.local)

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.4              # 기본 모델 (fallback)
OPENAI_MODEL_GENERATOR=gpt-5.4    # AI 1/2/3 Generator용 (비싸지만 창의적)
OPENAI_MODEL_EVALUATOR=gpt-5.4-mini  # Evaluator용 (빠르고 저렴)
OPENAI_MODEL_PLANNER=gpt-5.4-mini    # Planner용
OPENAI_MODEL_OPTIMIZER=gpt-5.4-mini  # Prompt Optimizer용
```

코드에서의 모델 선택 로직 (`lib/story/index.ts`):
```typescript
const MODEL_GENERATOR = process.env.OPENAI_MODEL_GENERATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_EVALUATOR = process.env.OPENAI_MODEL_EVALUATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_PLANNER   = process.env.OPENAI_MODEL_PLANNER   || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const MODEL_OPTIMIZER = process.env.OPENAI_MODEL_OPTIMIZER  || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
```

---

## 4. 프롬프트 파일 구조

모든 시스템 프롬프트는 **마크다운 파일**로 관리됩니다:

```
docs/ai-prompts/
├── AI_1_Story_Architect.md          ← Generator 1 (스토리 설계)
├── AI_2_Screenplay_Director.md      ← Generator 2 (대본화)
├── AI_3_Frame_Video_Prompt_Designer.md ← Generator 3 (영상 프롬프트)
├── AI_Evaluator_Story.md            ← Evaluator for AI 1
├── AI_Evaluator_Screenplay.md       ← Evaluator for AI 2
├── AI_Evaluator_FrameVideo.md       ← Evaluator for AI 3
├── AI_Planner_Story.md              ← Planner for AI 1
├── AI_Planner_Screenplay.md         ← Planner for AI 2
├── AI_Planner_FrameVideo.md         ← Planner for AI 3
├── AI_Prompt_Optimizer.md           ← 메타 프롬프트 최적화 AI
├── AI_Evaluator.md                  ← (레거시, 현재 미사용)
├── AI_Planner.md                    ← (레거시, 현재 미사용)
└── Reference_Lab_System_Prompt.md   ← 레퍼런스 분석 AI
```

### 로딩 메커니즘 (`lib/ai/story-studio/load-system-prompt.ts`)

```typescript
// 파일을 읽어서 메모리 캐시에 저장
function loadSystemPrompt(filename: string): string {
  if (cache.has(filename)) return cache.get(filename)!;
  const filePath = path.join(process.cwd(), 'docs', 'ai-prompts', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  cache.set(filename, content);
  return content;
}

// 보충 규칙이 있으면 base 프롬프트 뒤에 붙임
function withSupplement(base: string, supplement?: string): string {
  if (!supplement?.trim()) return base;
  return `${base}\n\n---\n\n# ★ 프로젝트별 보충 규칙\n\n${supplement}`;
}
```

**중요**: 캐시는 서버 프로세스 수명 동안 유지됩니다. MD 파일을 수정하면 **서버 재시작**이 필요합니다.

### 라우팅 로직

```typescript
// Generator: 파일명 직접 매핑
getStoryArchitectPrompt(supplement?)         → AI_1_Story_Architect.md + supplement
getScreenplayDirectorPrompt(supplement?)     → AI_2_Screenplay_Director.md + supplement
getFrameVideoPromptDesignerPrompt(supplement?) → AI_3_Frame_Video_Prompt_Designer.md + supplement

// Evaluator: stage 파라미터에 따라 분기
getEvaluatorPrompt('concept')  → AI_Evaluator_Story.md
getEvaluatorPrompt('season')   → AI_Evaluator_Screenplay.md
getEvaluatorPrompt('script')   → AI_Evaluator_Screenplay.md
getEvaluatorPrompt('clips')    → AI_Evaluator_FrameVideo.md

// Planner: 동일 분기 방식
getPlannerPrompt('concept')    → AI_Planner_Story.md
getPlannerPrompt('season')     → AI_Planner_Screenplay.md
getPlannerPrompt('clips')      → AI_Planner_FrameVideo.md
```

---

## 5. 프롬프트 구성 방식 — 3층 구조

각 Generator AI가 받는 최종 시스템 프롬프트는 3개 층으로 구성됩니다:

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Base System Prompt (MD 파일)            │
│   - AI_1_Story_Architect.md 등                   │
│   - 공통 스토리 엔진 규칙                          │
│   - 장르 불문 품질 기준                            │
│   - 출력 형식 정의                                │
├─────────────────────────────────────────────────┤
│ Layer 2: Supplement Rules (DB에서 동적 로딩)       │
│   - [글로벌 보충 규칙] — 모든 프로젝트에 적용        │
│   - [프로젝트 보충 규칙] — 해당 프로젝트에만 적용     │
│   - Prompt Optimizer AI가 자동 생성/갱신           │
├─────────────────────────────────────────────────┤
│ Layer 3: User Message (호출 시점에 동적 구성)       │
│   - 사용자 아이디어 텍스트                          │
│   - 프로젝트 제약 (GenreOverlay) 블록              │
│   - 캐릭터 정보                                   │
│   - 품질 규칙 체크리스트                            │
│   - 출력 JSON 스키마                              │
└─────────────────────────────────────────────────┘
```

### Layer 1: Base System Prompt

MD 파일에 정의된 정적 규칙. 프롬프트의 **핵심 지시서**.

**수정 방법**: `docs/ai-prompts/` 디렉토리의 해당 `.md` 파일을 직접 편집 → 서버 재시작

### Layer 2: Supplement Rules

Prompt Optimizer AI가 평가 피드백을 분석해서 자동으로 생성하는 **보충 규칙**.

- SQLite DB (`data/character.db`)의 `prompt_supplements` 테이블에 저장
- 프로젝트별 (`project_id = 프로젝트ID`) + 글로벌 (`project_id = '__global__'`) 2종류
- `getEffective(projectId, stage)` 함수가 글로벌 + 프로젝트 보충을 합쳐서 반환
- Base prompt 뒤에 `\n\n---\n\n# ★ 프로젝트별 보충 규칙\n\n{supplement}` 형태로 추가됨

**중요 규칙**: 보충 규칙에 특정 캐릭터명·작품명 등 콘텐츠 특화 내용 포함 금지 (구조적 규칙만 허용)

### Layer 3: User Message

함수 호출 시 동적으로 구성되는 메시지. `lib/story/index.ts`의 각 함수 내부에서 정의됩니다.

---

## 6. 각 AI 함수의 상세 호출 구조

### 6.1 AI 1 — Story Architect

#### `generateStoryConcept(input, projectId?)`
```
System Prompt = AI_1_Story_Architect.md + getSupplementForStage(projectId, 'ai1')
User Message  = 아이디어 + GenreOverlay 블록 + 캐릭터 + 품질 규칙 체크리스트 (A~H, 28개 항목)
Temperature   = 0.8
Max Tokens    = 16000
Model         = MODEL_GENERATOR (gpt-5.4)
Output        = 마크다운 텍스트 (구조화된 15개 섹션)
```

#### `reviseStoryConcept(previousDraft, feedback, genreOverlay?, projectId?)`
```
System Prompt = AI_1_Story_Architect.md + supplement
User Message  = 이전 초안 + 피드백 + GenreOverlay + 수정 규칙 13개
Temperature   = 0.8
Max Tokens    = 16000
Output        = 수정된 마크다운 텍스트
```

#### `extractCharactersFromConcept(conceptMarkdown)`
```
System Prompt = 인라인 정의 (캐릭터 파서 역할)
User Message  = 컨셉 마크다운 전문
Temperature   = 0.1 (거의 결정적)
Max Tokens    = 12000
Output        = JSON 배열 (ExtractedCharacter[])
```

### 6.2 AI 2 — Screenplay Director

#### `generateSeriesBible(input, characters, conceptMarkdown?, genreOverlay?, projectId?)`
```
System Prompt = AI_2_Screenplay_Director.md + supplement
User Message  = AI 1 컨셉 전문(!) + GenreOverlay + 캐릭터 + 품질 규칙 (섹션별 역할 분리)
Max Tokens    = 8000
Output        = JSON (BibleOutput: logline, premise, theme, characterArcs, worldRules...)
```

**핵심**: AI 1의 컨셉 마크다운이 `conceptSection`으로 **전문 전달**됩니다. 절삭 없음.

#### `generateSeasonPlan(bible, concept?, genreOverlay?, projectId?)`
```
System Prompt = AI_2_Screenplay_Director.md + supplement
User Message  = Bible JSON + AI 1 컨셉 + GenreOverlay + 시즌 플래너 규칙 6개
Max Tokens    = 16000 (JSON 파싱 재시도 3회)
Output        = JSON 배열 (EpisodeArcOutput[] — 에피소드별 title, narrativeEngine, summary, beginning/middle/climax)
```

#### `generateEpisodeScript(bible, arc, characters, concept?, genreOverlay?, projectId?)`
```
System Prompt = AI_2_Screenplay_Director.md + supplement
User Message  = Bible + 에피소드 Arc + 캐릭터 + 대본 품질 규칙 5개
Max Tokens    = 16000 (JSON 파싱 재시도 3회)
Output        = JSON (EpisodeScriptOutput: scenes[] + markdownScript)
각 scene 필수 필드: sceneObjective, visualIntroduction, emotionalBeat, conflictBeat, dialogueBeat, revealBeat, visualMotif, transitionToNext
```

### 6.3 AI 3 — Frame & Video Prompt Designer

두 가지 영상 프로바이더를 지원합니다:

#### Higgsfield 모드: `generateFrameAndVideoPackets(..., 'higgsfield')`
```
System Prompt = AI_3_Frame_Video_Prompt_Designer.md + supplement
User Message  = 에피소드 정보 + 장면 JSON + 캐릭터 + 연속 타임코드 규칙 + Shot Intention First 규칙
Output        = JSON { boundaryFrames[], higgsfieldClipPackets[], seedanceClipPackets: [] }
핵심: N+1 boundary frames → N clips (frame-chain 구조)
```

#### Seedance 2.0 모드: `generateFrameAndVideoPackets(..., 'seedance_2_0')`
```
System Prompt = AI_3_Frame_Video_Prompt_Designer.md + supplement
User Message  = 에피소드 정보 + 장면 JSON + 캐릭터 + 멀티샷 시네마틱 규칙
Output        = JSON { boundaryFrames: [], higgsfieldClipPackets: [], seedanceClipPackets[] }
seedanceClipPackets 필드: totalDurationSec, shotSequenceCount, shotSequence[], finalSeedancePrompt
```

---

## 7. Evaluator AI 호출 구조

#### `evaluateOutput(taskType, content, genreOverlay?)`
```
System Prompt = AI_Evaluator_{Story|Screenplay|FrameVideo}.md (taskType에 따라 선택)
User Message  = 평가 태스크명 + GenreOverlay + 콘텐츠 (12000자 제한) + 평가 규칙 + JSON 출력 스키마
Temperature   = 0 (결정적)
Max Tokens    = 6000
Model         = MODEL_EVALUATOR (gpt-5.4-mini)
Output        = JSON (EvalResult)
```

**평가 출력 구조**:
```json
{
  "taskType": "story_concept",
  "overallScore": 3.8,
  "weightedScore": 3.8,
  "pass": false,
  "criteria": [
    {"name": "originality", "score": 4.0, "weight": 2, "reason": "...", "mustFix": false}
  ],
  "criticalIssues": [],
  "topStrengths": ["강점1", "강점2", "강점3"],
  "topWeaknesses": [
    {"issue": "약점", "whyItMatters": "이유", "fixDirection": "방향"}
  ],
  "revisionBrief": "구체적 수정 지시",
  "finalVerdict": "approve | revise"
}
```

**점수 정규화**: 만약 AI가 1~5 범위를 벗어난 점수(예: 8.1)를 반환하면, `normalizeScoresTo5()` 함수가 자동으로 5점 만점으로 리스케일링합니다.

**현재 평가 라운드**: 1회 (이전에는 3회 중앙값이었으나, 속도 문제로 1회로 축소)

---

## 8. Planner AI 호출 구조

#### `plannerInit(taskType, projectContext, genreOverlay?)`
```
System Prompt = AI_Planner_{Story|Screenplay|FrameVideo}.md
User Message  = 프로젝트 컨텍스트 + JSON 출력 요청
Temperature   = 0
Output        = JSON { stage, goal, successContract[], generatorInstructions }
```

#### `plannerInterpretEvaluation(taskType, evaluation, loop, previousStrategies?, genreOverlay?)`
```
System Prompt = AI_Planner_{Story|Screenplay|FrameVideo}.md
User Message  = Evaluator JSON 결과 + 이전 전략 이력 + 의사결정 규칙
Temperature   = 0
Output        = JSON { decision, replanReason, revisionTargets[], nextAction }
```

**Planner 의사결정 옵션**: `approve` / `revise_partial` / `revise_full` / `ask_user`

---

## 9. Prompt Optimizer AI — 프롬프트 자체를 개선하는 메타 AI

#### `optimizePrompt(projectId, stage, generatorOutput, evaluation, plannerFeedback, userIdea)`
```
System Prompt = AI_Prompt_Optimizer.md
User Message  = stage + 현재 base 프롬프트(일부) + 현재 보충 규칙 + Generator 출력 + Evaluator 결과 + Planner 피드백
Temperature   = 0
Max Tokens    = 4000
Model         = MODEL_OPTIMIZER (gpt-5.4-mini)
```

**Output**:
```json
{
  "stage": "ai1",
  "diagnosis": [
    {"weakPattern": "패턴", "promptCause": "원인", "causeType": "missing_rule|vague_rule|low_priority|conflicting_rule"}
  ],
  "supplementRules": [
    {"action": "add|replace|strengthen", "targetSection": "섹션명", "rule": "규칙 텍스트", "reason": "이유"}
  ],
  "fullSupplement": "통합 보충 프롬프트 마크다운",
  "expectedImprovement": "예상 효과",
  "confidence": "high|medium|low"
}
```

**저장 방식**:
- `fullSupplement` → 프로젝트별 DB에 저장 (project_id + stage 키)
- `fullSupplement` → 글로벌 DB에도 저장 (단, 특정 캐릭터명 등 콘텐츠 특화 내용이 없을 때만)

**호출 빈도**: 1회차 + 이후 매 5회차마다 (속도 최적화)

**절대 규칙 (콘텐츠 불가지론)**:
- 보충 규칙에 특정 캐릭터명(윤서, 하린 등) 금지
- 특정 작품명, 장소명, 능력명 금지
- 어떤 콘텐츠가 생성되더라도 적용 가능한 **구조적 규칙만** 포함

---

## 10. 프로젝트 제약 시스템 (GenreOverlay)

사용자가 입력하는 프로젝트별 설정입니다. 모든 AI에게 전달됩니다.

```typescript
interface GenreOverlay {
  genre_stack: string[];              // ["drama", "sf", "thriller"]
  tone: string;                       // "어두운 학원 판타지"
  world_mode: string;                 // "현실+판타지"
  story_central_axis: string;         // "character|mystery|action|romance|relationship|twist|ensemble"
  protagonist_count: number;          // 5
  protagonist_composition: string;    // "all_female|all_male|mixed|female_lead|male_lead|unspecified"
  cast_total_limit: number;           // 10
  supporting_cast_min: number;        // 2
  supporting_cast_max: number;        // 5
  setting_region: string;             // "korea|japan|global|fantasy_world"
  age_group: string;                  // "high_school|college|adult|mixed"
  target_audience: string;
  romance_level: string;              // "none|low|medium|high"
  mystery_level: string;
  action_level: string;
  tragedy_level: string;
  twist_level: string;
  ending_type: string;                // "happy|bittersweet|tragic|unresolved"
  death_event: string;                // "none|optional|required"
  creature_usage: string;             // "none|optional|required"
  power_system_usage: string;         // "none|optional|required"
  episode_count: number;              // 10
  runtime_per_episode: number;        // 5 (분)
  must_have_elements: string[];
  nice_to_have_elements: string[];
  forbidden_elements: string[];
  required_character_types: string[];
  optional_character_types: string[];
}
```

이 데이터는 `formatOverlayBlock()` 함수에 의해 마크다운 블록으로 변환되어 모든 AI의 User Message에 포함됩니다.

---

## 11. 자동화 파이프라인 (Full Pipeline)

`lib/store/story-store.ts`의 `runFullPipeline()` 함수가 전체 흐름을 관리합니다.

### 파이프라인 흐름

```
1. AI 1: 스토리 컨셉 생성
   → 평가 루프 (최대 N회)
   → 점수 ≥ 목표 → 통과
   → 정체 감지 (2회 연속 0.15점 미만 변화) → 전략 변경: 완전 재생성
   → 프롬프트 최적화 (1회차, 이후 5회마다)

2. AI 2: Bible 생성 (평가 없음)
   → 시즌 플랜 생성 → 평가 루프
   → 에피소드별 대본 생성 → 평가 루프

3. AI 3: 에피소드별 클립 생성 → 평가 루프
```

### 핵심 설정값

```typescript
// page.tsx에서 UI로 설정 가능
pipelineTargetScore = 4.0;  // 목표 점수 (5점 만점)
pipelineMaxRetries = 10;    // 각 단계 최대 재시도
```

### passesThreshold 로직

```typescript
function passesThreshold(ev: EvalResult): boolean {
  const score = ev.weightedScore || ev.overallScore || 0;
  if (score >= targetScore) return true;
  if (score >= targetScore - 0.1 && ev.finalVerdict === 'approve') return true;
  return false;
}
```

### 정체 감지 & 전략 변경

```
if (2회 연속 점수 변화 < 0.15) {
  → "수정" 대신 "처음부터 재생성"으로 전략 변경
  → 누적된 보충 규칙은 새 생성에도 적용됨
}
```

### buildRevisionBrief 로직

평가 결과를 Generator에게 전달할 수정 지시서로 변환:
```
★ 현재 점수: 3.8/5 | 목표: 4.5/5 | 0.7점 부족
★ 가장 낮은 항목: [2.8/5] internal_consistency, [3.2/5] hook_strength
[Evaluator 수정 지시]:
...revisionBrief 내용...
```

---

## 12. DB 스키마 (prompt_supplements)

```sql
CREATE TABLE prompt_supplements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,       -- 프로젝트 ID 또는 '__global__'
  stage TEXT NOT NULL DEFAULT 'ai1',  -- 'ai1' | 'ai2' | 'ai3'
  supplement_text TEXT DEFAULT '', -- 보충 규칙 마크다운 텍스트
  diagnosis_json TEXT DEFAULT '[]', -- Optimizer 진단 결과 JSON
  version INTEGER NOT NULL DEFAULT 1, -- 업데이트 횟수
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(project_id, stage)
);
```

### 보충 규칙 합성 로직

```typescript
getEffective(projectId, stage): string {
  const global  = getGlobal(stage);        // project_id = '__global__'
  const project = get(projectId, stage);   // project_id = 실제 프로젝트 ID
  
  // 두 층을 합침
  return "[글로벌 보충 규칙]\n{global}" + "\n\n" + "[프로젝트 보충 규칙]\n{project}";
}
```

---

## 13. 프롬프트 수정 가이드

### MD 파일 직접 수정 시

1. `docs/ai-prompts/` 디렉토리의 해당 파일을 편집
2. **서버 재시작 필요** (캐시 초기화를 위해)
3. 변경 사항은 모든 새 API 호출에 즉시 반영

### 수정 시 주의사항

- **Generator 프롬프트** (AI_1, AI_2, AI_3): 출력 형식을 바꾸면 코드의 JSON 파싱 로직도 함께 수정 필요
- **Evaluator 프롬프트**: 점수 범위는 반드시 1.0~5.0 유지. 코드에 정규화 로직 있지만 프롬프트에서도 명시 필요
- **Planner 프롬프트**: 출력 JSON 스키마가 코드의 `PlannerDecisionResult` 타입과 일치해야 함

### 코드 내 User Message 수정 시

`lib/story/index.ts`의 각 함수 내부 `userMsg` 변수를 수정합니다. 서버 재시작 후 적용.

주요 위치:
- `generateStoryConcept()` — 라인 ~197 (AI 1 컨셉 생성)
- `reviseStoryConcept()` — 라인 ~273 (AI 1 컨셉 수정)
- `generateSeriesBible()` — 라인 ~453 (AI 2 Bible)
- `generateSeasonPlan()` — 라인 ~549 (AI 2 시즌 플랜)
- `generateEpisodeScript()` — 라인 ~660 (AI 2 에피소드 대본)
- `evaluateOutput()` — 라인 ~1095 (평가 User Message)
- `plannerInterpretEvaluation()` — 라인 ~1313 (Planner 평가 해석)
- `optimizePrompt()` — 라인 ~1422 (Optimizer)

---

## 14. 현재 알려진 문제 및 개선 기회

### 해결된 문제
- ✅ Evaluator 점수 불일치 (temp=0 + 1회 평가로 해결)
- ✅ 보충 규칙에 캐릭터명 포함 → 재생성 시 점수 하락 (콘텐츠 불가지론 규칙 추가)
- ✅ 속도 문제 (평가 3회→1회, 최적화 빈도 축소)
- ✅ max_tokens vs max_completion_tokens 호환성

### 현재 개선 기회
- AI 1 컨셉이 4.0~4.2 수준에서 정체되는 경향 → base 프롬프트 자체의 품질 규칙 강화 필요
- Evaluator가 여전히 비일관적일 수 있음 → 평가 기준의 명확화/구체화 필요
- AI 2 에피소드 대본의 밀도가 부족할 때가 있음 → 대본 품질 규칙 강화
- AI 3 타임코드 연속성이 가끔 깨짐 → 규칙 강화 또는 코드 레벨 후처리

---

## 15. 요약: 프롬프트 수정 체크리스트

프롬프트를 수정할 때 확인해야 할 것들:

- [ ] 어떤 AI 역할의 프롬프트를 수정하는가? (Generator/Evaluator/Planner/Optimizer)
- [ ] MD 파일 수정인가, 코드 내 User Message 수정인가?
- [ ] 출력 JSON 형식을 바꾸는가? → 코드 파싱 로직도 함께 수정
- [ ] 점수 범위를 바꾸는가? → normalizeScoresTo5() 함수 확인
- [ ] 새로운 필드를 추가하는가? → TypeScript 타입 정의 업데이트
- [ ] 서버 재시작이 필요한가? (MD 파일 수정 시 항상 필요)
- [ ] 기존 보충 규칙과 충돌하지 않는가?
