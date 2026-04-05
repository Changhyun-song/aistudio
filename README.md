# AI Studio — AI-Powered Content Creation Pipeline

캐릭터 디자인부터 시리즈 스토리 개발, 영상 프롬프트 생성까지 — AI가 창작 전 과정을 자동화하는 통합 웹 스튜디오입니다.

## 주요 기능

### 1. Story Studio (AI 시나리오 파이프라인)

3단계 AI 체인으로 시리즈 드라마를 자동 생성합니다.

| 단계 | AI 역할 | 출력 |
|------|---------|------|
| AI 1 — Story Architect | 컨셉 3개 생성 → 선택 → 시리즈 바이블 | 캐릭터, 세계관, 시즌 아크 |
| AI 2 — Screenplay Director | 시즌 플랜 → 에피소드별 대본 | 씬 비트, 대사, 연출 지시 |
| AI 3 — Frame & Video Prompt Designer | 대본 → 영상 클립 프롬프트 | Higgsfield / Seedance 2.0 호환 |

- **Generator → Evaluator → Planner 루프**: 각 단계에서 3-Lens 평가(엘리트 비평, 대중 매력, 프로덕션 적합성) 후 자동 수정
- **원클릭 파이프라인**: 아이디어 하나로 AI 1→2→3 전체 자동 실행, 목표 점수 도달까지 반복
- **멀티 프로젝트 동시 실행**: 프로젝트별 파이프라인 상태를 DB에 저장, 프로젝트 목록에서 실시간 진행률 확인
- **프롬프트 자가 개선**: Optimizer AI가 평가 피드백을 분석해 시스템 프롬프트를 점진적으로 개선

### 2. Story Warehouse (스토리 아이디어 파이프라인)

4단계 창작 시뮬레이션으로 스토리 아이디어를 대량 생성하고 큐레이션합니다.

| 단계 | 방식 | 설명 |
|------|------|------|
| Seed Generator | 랜덤 조합 (AI 없음) | 107개 소재 풀에서 장르/배경/What-if/아이러니 등 3~5개 조합 |
| Premise Builder | AI (temp=0.95) | 씨앗 → 로그라인, 시놉시스, 갈등, 톤 등 스토리 전제 2개 생성 |
| Idea Evaluator | AI (temp=0) | 참신함/갈등/공감/시각/확장성 5개 기준 평가, 3.5점 이상 필터링 |
| Bulk Pipeline | 배치 | 5 씨앗 × 2 전제 = 10개 생성 → 평가 → 통과한 아이디어만 카드 표시 |

- **자가 개선**: 사용자가 선택한 아이디어의 씨앗 패턴 가중치 자동 상승
- **Story Studio 연동**: "이걸로 시작" 버튼으로 바로 시나리오 개발 전환

### 3. Reference Lab (레퍼런스 분석)

외부 참고 자료를 수집·분석해 Story Studio에 전달합니다.

- 텍스트, 링크, 이미지, 영상/자막 등 다양한 소스 입력
- AI가 구조적 영감 데이터로 합성 (표절 방지)
- 4탭 UI: Sources → Analysis → Synthesis → Send to Story Studio

### 4. Character Studio (캐릭터 이미지 생성)

#### Midjourney 프롬프트 생성
- 자연어 캐릭터 설명 → AI가 Midjourney용 프롬프트 자동 생성
- 반복 수정 → 최종 선택 → 20장 포즈 확장 → ZIP 데이터셋 내보내기

#### 서사 → 비주얼 변환 (Story Studio 연동)
- Story Studio의 캐릭터 서사 정보를 5종 MJ 프롬프트로 AI 변환
  - Base Portrait / Emotional Portrait / Full Body / Action / Expression Sheet

#### Characterizer (40-Shot)
- Gemini API 기반 캐릭터 일관성 유지 포즈 생성

### 5. 영상 프로바이더 지원

| 프로바이더 | 클립 길이 | 특징 |
|-----------|----------|------|
| Higgsfield Cinema Studio | 4~20초 | Frame Chain, Boundary Frames |
| Seedance 2.0 | 4~15초 | Multi-shot Cinematic, Shot/Camera/Reveal/Pacing Progression |

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     Web UI (Next.js)                     │
│  Projects │ Story Studio │ Story Warehouse │ Ref Lab     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    AI Engine Layer                        │
│                                                          │
│  Generator ←→ Evaluator ←→ Planner ←→ Optimizer         │
│  (GPT-5.4)    (5.4-mini)  (5.4-mini)  (5.4-mini)       │
│                                                          │
│  System Prompts: docs/ai-prompts/*.md                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Data Layer (SQLite)                     │
│                                                          │
│  projects │ story_concepts │ story_bibles │ episodes     │
│  characters │ clips │ pipeline_runs │ pipeline_stages    │
│  story_warehouse │ seed_weight_log │ ai_usage_logs      │
│  character_visual_prompts │ prompt_supplements           │
└─────────────────────────────────────────────────────────┘
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (base-ui) |
| State | Zustand |
| Database | SQLite (better-sqlite3) — Local-first |
| AI | OpenAI API (GPT-5.4 / GPT-5.4-mini) |
| Image AI | Google Gemini (Characterizer) |
| Export | archiver (ZIP) |

## 프로젝트 구조

```
app/
  page.tsx                              # 랜딩
  projects/page.tsx                     # 프로젝트 목록 + 파이프라인 현황
  projects/[id]/
    story-studio/page.tsx               # Story Studio 메인 (AI 1/2/3 + 파이프라인)
    references/page.tsx                 # Reference Lab
    brief/page.tsx                      # 캐릭터 Brief 입력
    prompt-lab/page.tsx                 # MJ 프롬프트 생성/수정
    select/page.tsx                     # Base Character 선택
    variants/page.tsx                   # 20장 확장 프롬프트
    characterizer/page.tsx              # 40-Shot Characterizer
    dataset/page.tsx                    # 데이터셋 Export
  story-warehouse/page.tsx              # Story Warehouse
  api/
    projects/[id]/story/...             # Story Studio API (concept, bible, season, episodes, clips, evaluate, plan, export 등)
    projects/[id]/pipeline/             # 파이프라인 상태 관리 API
    projects/[id]/usage/                # AI 비용 추적 API
    pipelines/active/                   # 전체 프로젝트 파이프라인 현황
    story-warehouse/                    # Story Warehouse API (생성, CRUD)

lib/
  ai/index.ts                          # OpenAI Provider + 모델 설정 + 비용 로깅
  story/
    index.ts                            # Story AI 모듈 re-export
    generators.ts                       # AI 1/2/3 생성 함수
    evaluator.ts                        # 3-Lens 평가 AI
    planner.ts                          # 수정 전략 수립 AI
    optimizer.ts                        # 프롬프트 자가 개선 AI
    character-visual.ts                 # 서사→MJ 비주얼 프롬프트 변환
    utils.ts                            # 공통 유틸리티
  story-warehouse/
    seed-pools.ts                       # 107개 소재 풀 정의
    seed-generator.ts                   # 가중치 기반 랜덤 씨앗 조합
    premise-builder.ts                  # AI 스토리 전제 생성
    idea-evaluator.ts                   # AI 아이디어 평가/필터링
    pipeline.ts                         # 4단계 파이프라인 오케스트레이션
  store/
    story-store.ts                      # Story Studio Zustand 스토어 (파이프라인 실행 포함)
  db/
    schema.ts                           # SQLite 스키마 정의
    repository.ts                       # Repository 패턴 DB 추상화

docs/
  ai-prompts/                           # AI 시스템 프롬프트 (Markdown)
    AI_1_Story_Architect.md
    AI_2_Screenplay_Director.md
    AI_3_Frame_Video_Prompt_Designer.md
    AI_Evaluator_Story.md / _Screenplay.md / _FrameVideo.md / _SeasonPlan.md
    AI_Planner_Story.md / _Screenplay.md / _FrameVideo.md
    AI_Prompt_Optimizer.md
    Reference_Lab_System_Prompt.md
  PROMPT_SYSTEM_ARCHITECTURE.md         # 프롬프트 시스템 아키텍처 문서

types/index.ts                          # 전체 TypeScript 인터페이스
```

## 로컬 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일에서 OPENAI_API_KEY 입력

# 개발 서버 실행
npm run dev

# http://localhost:3000 접속
```

### .env.local 설정

```bash
# 필수
OPENAI_API_KEY=sk-your-key-here

# 기본 모델 (선택, 기본값: gpt-5.4-mini)
OPENAI_MODEL=gpt-5.4-mini

# 역할별 모델 세분화 (선택)
OPENAI_MODEL_GENERATOR=gpt-5.4       # AI 1/2/3 생성 — 고품질
OPENAI_MODEL_EVALUATOR=gpt-5.4-mini  # 평가
OPENAI_MODEL_PLANNER=gpt-5.4-mini    # 플래너
OPENAI_MODEL_OPTIMIZER=gpt-5.4-mini  # 프롬프트 최적화

# Characterizer용 (선택)
GEMINI_API_KEY=your-gemini-key
```

### Windows 참고

better-sqlite3는 네이티브 바인딩을 사용합니다. Visual Studio Build Tools가 필요할 수 있습니다.

```bash
# WSL2 Ubuntu에서 실행 (권장)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
cd /mnt/c/character
npm install && npm run dev
```

## AI 파이프라인 흐름

### Story Studio 원클릭 파이프라인

```
[아이디어 입력] → AI 1 컨셉 생성 → 평가 → (수정 반복) → 통과
    → AI 2 바이블/시즌플랜/대본 → 평가 → (수정 반복) → 통과
    → AI 3 영상 클립 프롬프트 → 평가 → (수정 반복) → 통과
    → 시즌 일관성 평가 → 완료
```

각 단계에서:
1. **Generator** — 콘텐츠 생성 (temp=0.8)
2. **Evaluator** — 3-Lens 평가: 엘리트 비평 / 대중 매력 / 프로덕션 적합성 (temp=0)
3. **Planner** — 평가 기반 수정 전략 결정 (approve / revise_partial / revise_full)
4. **Optimizer** — 누적 피드백 분석 → 시스템 프롬프트 보완 규칙 자동 생성

### Story Warehouse 파이프라인

```
[버튼 클릭] → 씨앗 5세트 (랜덤) → 전제 10개 (AI) → 평가 (AI) → 3.5점+ 필터 → 카드 표시
```

## 향후 확장

- [ ] 트렌드 분석 → 소재 풀 자동 업데이트
- [ ] Supabase 클라우드 DB 마이그레이션
- [ ] 팀 협업 (멀티유저)
- [ ] Discord Bot 연동 semi-auto 모드
- [ ] 영상 프로바이더 API 직접 연동
