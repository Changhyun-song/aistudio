# CharaCraft — AI-Powered Midjourney Character Studio

캐릭터를 자연어로 설명하면 AI가 Midjourney용 프롬프트를 생성하고, 반복 수정 → 최종 선택 → 20장 확장 → Soul ID용 데이터셋 패키징까지 한 곳에서 처리하는 웹 도구입니다.

## 핵심 전제

- **이 앱은 ChatGPT GPTs를 임베드하지 않습니다.** 앱 내 Prompt Assistant는 OpenAI API 기반입니다.
- **Midjourney 공식 API를 전제로 하지 않습니다.** 사용자가 Midjourney 웹 Create 또는 Discord Bot으로 이미지를 생성하고, 본 앱에 다시 업로드하는 Manual Mode입니다.
- Midjourney V7 기준, `--oref` (Omni Reference)로 동일 인물 확장이 가능하지만, MVP 1차에서는 프롬프트 세트 생성까지만 구현합니다.
- Soul ID용 데이터셋은 **얼굴만이 아니라 전신/상반신/측면/감정/약한 배경 컷**이 섞여야 합니다. (Higgsfield 가이드: 최소 20장, 고화질, 여러 각도, 전신 최소 1장)

## 제품 흐름

```
[Brief] 자연어 또는 폼으로 캐릭터 설명
    ↓ AI가 구조화 + 프롬프트 생성
[Prompt Lab] 프롬프트 확인 → Midjourney에 복사/실행 → 결과 업로드 → 보완 요청 → 반복
    ↓ 마음에 드는 결과 나올 때까지
[Select] 업로드된 후보 중 최종 1장 BASE CHARACTER 지정
    ↓
[Variants] AI가 동일 인물 기준 20장 프롬프트 자동 생성 → 각각 MJ 실행 → 업로드 → Keep/Reject/Maybe
    ↓
[Dataset] 최종 선택 이미지 + metadata.json + prompts.txt → ZIP 다운로드
```

## 사용자가 준비해야 하는 것

1. **OpenAI API Key** — AI 프롬프트 생성에 필요 (없으면 Fallback 템플릿 모드로 동작)
2. **Midjourney 구독** — 이미지 생성을 위해 Midjourney 웹 또는 Discord 접근 필요
3. **Node.js 18+** — 로컬 실행 환경

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | Zustand |
| Database | SQLite (better-sqlite3) |
| AI | OpenAI API (GPT-4o) |
| Export | archiver (ZIP) |

## 로컬 실행

```bash
# 의존성 설치
npm install

# OpenAI API 키 설정
cp .env.local.example .env.local
# .env.local 파일에서 OPENAI_API_KEY 입력

# 개발 서버 실행
npm run dev

# http://localhost:3000 접속
```

### Windows 참고
- better-sqlite3는 네이티브 바인딩을 사용합니다. Visual Studio Build Tools가 필요할 수 있습니다.
- 문제가 있으면 WSL2 + Ubuntu에서 실행하는 것을 권장합니다.

```bash
# WSL2 Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
cd /mnt/c/character
npm install && npm run dev
```

### .env.local 설정

```
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o          # 선택, 기본값 gpt-4o
```

API 키 없이도 앱은 동작합니다. AI 프롬프트 생성만 Fallback 템플릿 모드로 전환됩니다.

## AI Prompt Assistant

세 가지 AI 함수가 핵심입니다:

| 함수 | 역할 | 트리거 |
|------|------|--------|
| `generateCharacterPrompt(brief)` | 캐릭터 brief → MJ 프롬프트 1개 | Brief 페이지 "AI 프롬프트 생성" |
| `reviseCharacterPrompt(brief, prev, feedback)` | 피드백 반영 수정 프롬프트 1개 | Prompt Lab "수정 프롬프트 생성" |
| `generateTwentyPromptSet(brief, summary)` | 동일 인물 20장 프롬프트 세트 | Variants "AI 20장 생성" |

추가로 `structureBrief(naturalInput)` — 자연어 입력을 구조화된 brief JSON으로 변환합니다.

Provider Abstraction (`AIProvider` 인터페이스)을 통해 나중에 다른 LLM으로 교체 가능합니다.

## Fixed 20-Shot Template

모든 캐릭터에 동일 구조 사용:

| # | Shot | 설명 |
|---|------|------|
| 1 | Base Portrait | 정면 중립 포트레이트 |
| 2 | Front Portrait | 정면 아이컨택 |
| 3 | Three-Quarter | 45도 |
| 4 | Left Side | 좌측면 |
| 5 | Right Side | 우측면 |
| 6 | Half Body | 상반신 |
| 7 | Full Body Standing | 전신 서있는 |
| 8 | Classroom Desk | 교실 책상 |
| 9 | Classroom Window | 교실 창가 |
| 10 | Hallway Walking | 복도 |
| 11 | Just-Woke-Up | 방금 깬 |
| 12 | Surprised Reaction | 놀란 |
| 13 | Soft Smile | 미소 |
| 14 | School Stairs | 계단 |
| 15 | Library | 도서관 |
| 16 | Rooftop | 옥상 |
| 17 | Rainy Window | 비오는 창가 |
| 18 | After-School Casual | 방과 후 |
| 19 | Full Body Reference | 전신 레퍼런스 |
| 20 | Dramatic Close-Up | 드라마틱 클로즈업 |

## Midjourney 프롬프트 파라미터

- 캐릭터 생성용: `--ar 2:3 --v 7 --raw --stylize 50`
- 20장 확장용: `--ar 2:3 --v 7 --raw --stylize 35~45`

## 프로젝트 구조

```
app/
  projects/page.tsx              # 프로젝트 목록
  projects/[id]/
    brief/page.tsx               # 자연어 + 폼 입력
    prompt-lab/page.tsx          # AI 프롬프트 생성/수정/업로드
    select/page.tsx              # BASE CHARACTER 선택
    variants/page.tsx            # 20장 확장 프롬프트
    dataset/page.tsx             # 데이터셋 & Export
  api/
    ai/route.ts                  # AI 엔드포인트 (4가지 action)
    projects/...                 # CRUD
    upload/route.ts              # 이미지 업로드

lib/
  ai/                            # OpenAI API + system prompts + provider abstraction
  prompt-engine/                 # Fallback 템플릿 프롬프트 생성
  providers/                     # Midjourney adapter (Manual / Discord placeholder)
  store/                         # Zustand 스토어
  db/                            # SQLite + Repository

types/index.ts                   # 타입, 20-Shot 정의
```

## 미완성/Placeholder 항목

- **Semi-Auto Discord Mode**: `lib/providers/discord.ts`에 인터페이스만 존재. Discord bot webhook 연동은 미구현.
- **--oref 자동 삽입**: 20장 프롬프트에 `--oref` URL 자동 주입은 미구현. 사용자가 프롬프트를 수동 편집하여 추가 가능.
- **이미지 자동 다운로드**: 외부 URL 이미지를 로컬로 자동 저장하는 기능 미구현. ZIP에는 로컬 업로드 이미지만 포함.

## 향후 확장

- [ ] `--oref` 기반 동일 인물 자동 참조
- [ ] Discord Bot webhook semi-auto 모드
- [ ] Supabase로 DB 마이그레이션
- [ ] Higgsfield Soul Cinema 연동
- [ ] 멀티 캐릭터 프로젝트
- [ ] 팀 협업
