# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## 프로젝트 전체 구조

### 3가지 모드
- midjourney_manual: Brief → Prompt Lab → Select → Variants → Dataset
- characterizer_40: Config → 40-Shot 자동 생성 → 리뷰/선택 → Export
- story_studio: References → Concept(AI1) → Bible+Season(AI2) → Script(AI2) → Clips(AI3)

### AI 파이프라인 (Story Studio)
lib/story/index.ts가 핵심. 10개 AI 역할이 Generator→Evaluator→Planner 루프로 동작.
docs/PROMPT_SYSTEM_ARCHITECTURE.md에 전체 설계 문서가 있음.
docs/ai-prompts/ 에 14개 시스템 프롬프트 원본이 있음.
변경 전 반드시 이 문서들을 먼저 읽을 것.

### 4개 Zustand 스토어
- useAppStore (lib/store/index.ts) — 프로젝트 CRUD, Brief, MJ 모드
- useStoryStore (lib/store/story-store.ts, 900줄) — Story Studio 전체
- useCharacterizerStore (lib/store/characterizer-store.ts) — 40-Shot
- useReferenceStore (lib/store/reference-store.ts) — Reference Lab

### DB 구조
lib/db/schema.ts에 15개 테이블 정의.
lib/db/repository.ts에 모든 CRUD 함수.
repository 패턴 사용. 직접 SQL 실행 금지, 반드시 repository 함수 사용.

## 에이전트 역할 배정

### planner
새 기능 추가 전 반드시 계획 수립. 특히:
- Story Studio 파이프라인 수정 시 → lib/story/index.ts + store + API 3곳 모두 영향
- DB 스키마 변경 시 → schema.ts + repository.ts + types/index.ts 동시 수정 필요
- 새 AI 역할 추가 시 → docs/ai-prompts/ + load-system-prompt.ts + story/index.ts

### code-reviewer
코드 변경 후 품질 점검. 특히:
- 타입 안전성 (types/index.ts와 실제 사용 일치 여부)
- Zustand 스토어의 상태 관리 패턴 (set/get 사용법)
- API 라우트의 에러 처리 일관성
- 1000줄+ 대형 파일 변경 시 사이드이펙트 확인

### architect
대규모 구조 변경 시 먼저 상담:
- Supabase 마이그레이션 (15개 테이블 + repository 전체)
- 멀티 캐릭터/팀 협업 (스키마 + 권한 모델)
- 새 프로젝트 모드 추가 (types + store + pages + API 세트)
- AI 파이프라인 구조 변경 (10개 AI 역할 간 의존성)

### security-reviewer
보안 점검 포인트:
- OpenAI/Gemini API 키 서버사이드 격리
- 이미지 업로드 (app/api/upload/route.ts) — 확장자/크기/MIME
- Reference Lab 파일 업로드 — 텍스트/이미지/자막 파일 처리
- better-sqlite3 parameterized query 사용 여부
- .env.local 커밋 방지

### refactor-cleaner
특히 주목해야 할 대형 파일:
- lib/story/index.ts (1,813줄) — 함수 분리 필요 가능성
- app/projects/[id]/story-studio/page.tsx (1,370줄) — 컴포넌트 분리
- types/index.ts (668줄) — 도메인별 타입 파일 분리 고려

### build-error-resolver
Next.js 16 + Turbopack + React 19 특유의 이슈 주의.
better-sqlite3 네이티브 바인딩 관련 빌드 에러 주의.