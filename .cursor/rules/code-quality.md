# 코드 품질 규칙

## TypeScript
- any 금지 → unknown 또는 구체 타입
- non-null assertion (!) 최소화 → optional chaining + nullish coalescing
- 함수 반환 타입 명시 (특히 API 라우트, AI 함수, repository 함수)

## 패턴
- 에러 처리: catch (err) { set({ error: (err as Error).message }) }
- API 유틸: api<T>(url, init) 헬퍼 패턴 (lib/store/index.ts 참고)
- ID 생성: nanoid() 사용 (uuid도 일부 사용중)
- JSON 추출: extractJsonBlock() 패턴 (lib/story/index.ts 참고)

## 성능
- next/image 사용 (lazy loading)
- AI API 호출 시 AbortController 취소 지원
- Zustand 셀렉터로 불필요한 리렌더링 방지
- 파이프라인 상태(pipelineStage) 변경 최소화