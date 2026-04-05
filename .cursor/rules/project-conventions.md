# CharaCraft 프로젝트 컨벤션

## 파일 구조 규칙
- 페이지: app/projects/[id]/[step]/page.tsx
- API: app/api/projects/[id]/[domain]/route.ts
- 컴포넌트: components/[domain]/[ComponentName].tsx
- 스토어: lib/store/[domain]-store.ts (4개 존재)
- AI 시스템 프롬프트: docs/ai-prompts/[AI_역할].md
- 타입: types/index.ts (중앙 관리, 668줄)

## 컴포넌트 규칙
- shadcn/ui 우선 (components/ui/ 에 17개 이미 설치)
- 'use client'는 useState/useEffect 등 클라이언트 훅 필요 시에만
- Props 타입은 interface로 파일 상단 정의

## Zustand 스토어 규칙
- 신규 도메인은 별도 스토어 파일 생성 (기존 4개 참고)
- API 호출은 스토어 내부에서 fetch → set 패턴
- 에러 처리: try-catch → set({ error: message })
- loading/generating 상태 반드시 관리

## API 라우트 규칙
- POST: jsonPost helper 패턴 (스토어의 jsonPost 참고)
- 에러: NextResponse.json({ error: message }, { status: code })
- DB 접근: repository 함수만 사용 (직접 SQL 금지)
- AI 호출: lib/story/index.ts의 기존 패턴 따르기

## AI 시스템 프롬프트 수정 규칙
- docs/ai-prompts/*.md 수정 전 PROMPT_SYSTEM_ARCHITECTURE.md 반드시 읽기
- 프롬프트 변경은 파이프라인 전체에 연쇄 영향
- temperature 값 변경 주의 (Evaluator/Planner는 0 고정)
- 수정 후 파이프라인 전체 테스트 필수

## DB 스키마 변경 규칙
- schema.ts 수정 → repository.ts CRUD 함수 추가 → types/index.ts 타입 추가
- 3곳 동시 수정 필수 (하나라도 빠지면 런타임 에러)
- 기존 테이블 컬럼 변경 시 마이그레이션 고려

## 대형 파일 수정 주의
- 1000줄+ 파일 수정 시 반드시 영향 범위 먼저 확인
- lib/story/index.ts — 10개 AI 역할 간 의존성 주의
- story-store.ts — 파이프라인 상태 머신 로직 주의
- types/index.ts — 타입 변경은 전체 프로젝트에 영향

## 보안
- API 키: 서버 사이드에서만 (process.env)
- 파일 업로드: 확장자/크기/MIME 검증
- SQLite: parameterized query (repository 패턴)
- .env.local 절대 커밋 금지