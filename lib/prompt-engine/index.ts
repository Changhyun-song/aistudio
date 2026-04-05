import type { CharacterBrief, ShotKey } from '@/types';
import { TWENTY_SHOTS } from '@/types';

/**
 * Fallback prompt generation when OpenAI API is not configured.
 * Uses template-based generation instead of AI.
 */

function buildIdentityCore(brief: CharacterBrief): string {
  const parts: string[] = [];
  const genderLabel = brief.gender === 'male' ? 'young Korean male' : brief.gender === 'female' ? 'young Korean female' : 'young Korean person';
  parts.push(`${genderLabel}, ${brief.age_group || 'high school student age 17-18'}`);
  if (brief.face_keywords) parts.push(brief.face_keywords);
  if (brief.hairstyle) parts.push(`${brief.hairstyle} hairstyle`);
  if (brief.hair_color) parts.push(`${brief.hair_color} hair`);
  if (brief.body_type) parts.push(brief.body_type);
  if (brief.mood) parts.push(`${brief.mood} mood`);
  if (brief.personality) parts.push(`${brief.personality} vibe`);
  return parts.join(', ');
}

function buildIdentityTokens(brief: CharacterBrief): string {
  const tokens: string[] = [];
  if (brief.signature_item) tokens.push(brief.signature_item);
  if (brief.signature_color) tokens.push(`signature color: ${brief.signature_color}`);
  return tokens.join(', ');
}

function buildNegative(brief: CharacterBrief): string {
  return brief.negative_prompts || 'nsfw, nude, deformed, ugly, blurry, low quality, extra limbs, extra fingers, watermark, text, logo, signature, multiple people, extra people';
}

export function fallbackGeneratePrompt(brief: CharacterBrief): string {
  const identity = buildIdentityCore(brief);
  const tokens = buildIdentityTokens(brief);
  const uniform = brief.uniform_style || 'modest Korean school uniform, blazer, white shirt, tie';
  const neg = buildNegative(brief);

  const parts = [
    'portrait photo, face closeup',
    identity,
    tokens || undefined,
    `wearing ${uniform}`,
    'realistic live-action Korean drama casting look, attractive, photorealistic, cinematic lighting, shallow depth of field',
    'one character only, no extra people, no text',
  ].filter(Boolean).join(', ');

  return `${parts} --no ${neg} --ar 2:3 --v 7 --raw --stylize 50`;
}

export function fallbackGenerateTwentyPrompts(
  brief: CharacterBrief,
  _baseCharacterSummary: string,
): { slot: number; prompt: string }[] {
  const identity = buildIdentityCore(brief);
  const tokens = buildIdentityTokens(brief);
  const neg = buildNegative(brief);
  const uniform = brief.uniform_style || 'modest Korean school uniform, blazer, white shirt, tie';
  const casual = brief.casual_style || 'casual streetwear, relaxed fit';

  return TWENTY_SHOTS.map((shot) => {
    const outfit = shot.key === 'after_school_casual' ? casual : uniform;
    const stylize = 35 + Math.floor(Math.random() * 11);

    const parts = [
      shot.desc,
      'same exact person, identical face, consistent hairstyle',
      identity,
      tokens || undefined,
      `wearing ${outfit}`,
      'realistic live-action Korean drama casting look, photorealistic, cinematic lighting',
      'one character only, no extra people, no text',
    ].filter(Boolean).join(', ');

    return {
      slot: shot.slot,
      prompt: `${parts} --no ${neg} --ar 2:3 --v 7 --raw --stylize ${stylize}`,
    };
  });
}
