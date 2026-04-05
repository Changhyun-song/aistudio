@AGENTS.md

# CharaCraft — AI-Powered Character & Story Studio

## 프로젝트 개요
AI 기반 캐릭터 이미지 생성 + 스토리 파이프라인 통합 도구.
3가지 모드를 지원: Midjourney Manual / Characterizer 40-Shot / Story Studio.

## 기술 스택
- Next.js 16 (App Router, Turbopack) + TypeScript strict
- Tailwind CSS v4 + shadcn/ui + Zustand 5
- SQLite (better-sqlite3) — 15개 테이블
- OpenAI API (GPT-4o/5.4) + Gemini Image API
- archiver (ZIP export), nanoid (ID 생성)
- Package Manager: npm

## 3가지 프로젝트 모드
1. midjourney_manual — MJ 프롬프트 생성 → 수동 업로드 → 20장 확장 → ZIP
2. characterizer_40 — 40-shot 캐릭터 시트 자동 생성 (Gemini 이미지)
3. story_studio — 3단계 AI 파이프라인 (스토리→대본→영상 프롬프트)

## 핵심 디렉토리
- app/projects/[id]/ — 8개 서브페이지 (brief, prompt-lab, select, variants, dataset, characterizer, story-studio, references)
- app/api/ — 38개 API 라우트
- components/ — layout(1), shared(3), story(2), ui(17), variants(2)
- lib/ai/ — OpenAI 연동 + system prompt loader + reference-lab
- lib/story/ — Story Studio 서버 로직 (1,813줄, 10개 AI 역할 호출)
- lib/store/ — 4개 Zustand 스토어 (main, story, characterizer, reference)
- lib/db/ — SQLite schema(15 테이블) + repository(683줄)
- lib/providers/ — 4개 프로바이더 (OpenAI, Gemini, Manual, Discord placeholder)
- lib/characterizer/ — 40-shot prompt engine
- lib/prompt-engine/ — MJ 프롬프트 Fallback 생성
- types/index.ts — 전체 타입 (668줄, 20-Shot/40-Shot/GenreOverlay/Video Provider)
- docs/ai-prompts/ — 14개 AI 시스템 프롬프트 마크다운

## AI 파이프라인 아키텍처 (Story Studio)
Generator → Evaluator → Planner → (Optimizer) → Generator 재생성 루프.
- AI 1 (Story Architect): 컨셉 생성/수정
- AI 2 (Screenplay Director): Bible, 시즌 플랜, 대본
- AI 3 (Frame/Video Designer): 영상 프레임/클립 프롬프트
- Evaluator × 3: 각 단계 결과 점수 평가 (temperature=0)
- Planner × 3: 수정 전략 결정 (approve/revise_partial/revise_full)
- Prompt Optimizer: 프롬프트 자체를 개선하는 메타 AI

## 핵심 대형 파일 (변경 시 특별 주의)
- lib/story/index.ts (1,813줄) — Story Studio 서버 로직 전체
- lib/store/story-store.ts (900줄) — 파이프라인 상태 + 자동 평가/재생성
- types/index.ts (668줄) — 전체 타입 정의
- lib/db/repository.ts (683줄) — 전체 DB 접근 계층
- app/projects/[id]/story-studio/page.tsx (1,370줄) — Story Studio UI

## 환경 변수 (모델 라우팅)
OPENAI_MODEL_GENERATOR — AI 1/2/3 Generator용 (창의적, 고비용)
OPENAI_MODEL_EVALUATOR — Evaluator용 (빠르고 저렴, temp=0)
OPENAI_MODEL_PLANNER — Planner용 (빠르고 저렴, temp=0)
OPENAI_MODEL_OPTIMIZER — Prompt Optimizer용 (temp=0)

## 변경 금지 (사전 확인 필수)
- next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs
- .env.local (커밋 금지)
- docs/ai-prompts/*.md (AI 시스템 프롬프트 — 변경 시 파이프라인 전체에 영향)

## 미완성 영역
- lib/providers/discord.ts — 인터페이스만 존재 (25줄)
- --oref 자동 삽입 — 미구현
- 이미지 자동 다운로드 — 미구현

## 향후 확장 계획
- Supabase DB 마이그레이션 (SQLite → Supabase)
- Discord Bot webhook semi-auto 모드
- --oref 기반 동일 인물 자동 참조
- Higgsfield Soul Cinema / Seedance 2.0 연동
- 멀티 캐릭터 프로젝트
- 팀 협업 기능