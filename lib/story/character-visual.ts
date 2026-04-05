import { getProvider } from '@/lib/ai';
import type { StoryCharacter, GenreOverlay } from '@/types';
import { extractJsonBlock, formatOverlayBlock, MODEL_GENERATOR } from './utils';

export interface CharacterVisualGenResult {
  characterId: string;
  characterName: string;
  visualBrief: string;
  mjBasePrompt: string;
  mjPortraitPrompt: string;
  mjFullBodyPrompt: string;
  mjActionPrompt: string;
  mjExpressionSheet: string;
  negativePrompts: string;
  styleKeywords: string;
}

const SYSTEM_PROMPT = `You are a Midjourney prompt engineer who converts narrative character descriptions into precise visual prompts.

ROLE: Given a story character's narrative description (personality, role, signature items, powers, etc.), generate multiple Midjourney prompts that capture this character's visual identity.

CRITICAL RULES:
1. Convert NARRATIVE traits to VISUAL elements:
   - "조용하고 관찰력 있는 성격" → "calm piercing gaze, observant eyes, still posture"
   - "불같은 성격" → "intense expression, dynamic hair movement, warm color palette"
   - "수면안대가 시그니처" → "distinctive sleep mask pushed up on forehead as signature accessory"

2. Maintain moderation-safe language:
   - Use "Korean student, age 17-18" (not "schoolgirl")
   - "age-appropriate, modest outfit"
   - NEVER use: schoolgirl, sexy, seductive, adorable, body emphasis, revealing

3. Every prompt must include:
   - Character's physical description (derived from narrative)
   - Signature item prominently featured
   - Signature color woven into the scene
   - "realistic live-action, photorealistic, cinematic lighting"
   - "one character only, no extra people, no text"

4. Style consistency: all prompts for the same character must describe the SAME person with identical features.

5. Prompt endings:
   - Base/Portrait/Expression: --ar 2:3 --v 7 --raw --stylize 50
   - Full body: --ar 2:3 --v 7 --raw --stylize 45
   - Action: --ar 16:9 --v 7 --raw --stylize 55

Output ONLY valid JSON. No other text.`;

export async function generateCharacterVisualPrompts(
  character: StoryCharacter,
  genreOverlay?: GenreOverlay,
  worldContext?: string,
): Promise<CharacterVisualGenResult> {
  const provider = getProvider();
  const overlayBlock = formatOverlayBlock(genreOverlay);

  const userMsg = `## 캐릭터 서사 정보

이름: ${character.name}
역할: ${character.role}
성격/특징: ${character.traits}
시그니처 아이템: ${character.signature_item}
시그니처 컬러: ${character.signature_color}
말투: ${character.speech_style}
감정적 약점: ${character.emotional_weakness}
능력/특기: ${character.power_or_specialty}

${overlayBlock}

${worldContext ? `## 세계관 맥락\n${worldContext.slice(0, 1000)}\n` : ''}

## 요청
위 서사 정보를 바탕으로, 이 캐릭터의 시각적 정체성을 정의하고 Midjourney 프롬프트를 생성해줘.

\`\`\`json
{
  "visualBrief": "이 캐릭터의 외형을 3~5문장으로 묘사 (얼굴형, 머리스타일, 체형, 평소 표정, 전체 분위기). 서사 정보에서 추론.",
  "styleKeywords": "이 캐릭터를 정의하는 시각적 키워드 5~8개 (comma separated)",
  "mjBasePrompt": "기본 초상화 MJ 프롬프트 — 정면, 중립 배경, 캐릭터 정체성 확인용. --ar 2:3 --v 7 --raw --stylize 50 으로 끝",
  "mjPortraitPrompt": "감정이 드러나는 3/4 초상화 — 이 캐릭터의 핵심 감정을 담은 시네마틱 초상화. --ar 2:3 --v 7 --raw --stylize 50 으로 끝",
  "mjFullBodyPrompt": "전신 레퍼런스 — 의상, 체형, 포즈까지 보이는 전신샷. 시그니처 아이템 강조. --ar 2:3 --v 7 --raw --stylize 45 으로 끝",
  "mjActionPrompt": "액션/능력 발동 장면 — 16:9 비율, 이 캐릭터의 능력이나 핵심 행동 순간. --ar 16:9 --v 7 --raw --stylize 55 으로 끝",
  "mjExpressionSheet": "표정 시트 — 4개 표정 (기본/웃음/분노/슬픔) 그리드. --ar 1:1 --v 7 --raw --stylize 40 으로 끝",
  "negativePrompts": "이 캐릭터에 맞지 않는 요소들 (comma separated)"
}
\`\`\`

규칙:
- 모든 프롬프트는 영어로 작성
- visualBrief만 한국어
- "same exact person, identical face" 포함 필수 (base 제외 모든 프롬프트)
- 시그니처 아이템과 컬러를 모든 프롬프트에 자연스럽게 포함
- 캐릭터의 서사적 특성(성격, 약점, 능력)을 시각적 요소로 변환
- 반드시 유효한 JSON만 출력`;

  const raw = await provider.chat(SYSTEM_PROMPT, userMsg, {
    maxTokens: 4000,
    temperature: 0.7,
    model: MODEL_GENERATOR,
  });

  try {
    const parsed = JSON.parse(extractJsonBlock(raw));
    return {
      characterId: character.id,
      characterName: character.name,
      visualBrief: parsed.visualBrief || '',
      mjBasePrompt: parsed.mjBasePrompt || '',
      mjPortraitPrompt: parsed.mjPortraitPrompt || '',
      mjFullBodyPrompt: parsed.mjFullBodyPrompt || '',
      mjActionPrompt: parsed.mjActionPrompt || '',
      mjExpressionSheet: parsed.mjExpressionSheet || '',
      negativePrompts: parsed.negativePrompts || '',
      styleKeywords: parsed.styleKeywords || '',
    };
  } catch {
    return {
      characterId: character.id,
      characterName: character.name,
      visualBrief: '',
      mjBasePrompt: '',
      mjPortraitPrompt: '',
      mjFullBodyPrompt: '',
      mjActionPrompt: '',
      mjExpressionSheet: '',
      negativePrompts: '',
      styleKeywords: '',
    };
  }
}

export async function generateAllCharacterVisuals(
  characters: StoryCharacter[],
  genreOverlay?: GenreOverlay,
  worldContext?: string,
): Promise<CharacterVisualGenResult[]> {
  const results: CharacterVisualGenResult[] = [];
  for (const char of characters) {
    const result = await generateCharacterVisualPrompts(char, genreOverlay, worldContext);
    results.push(result);
  }
  return results;
}
