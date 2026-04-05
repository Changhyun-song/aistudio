import type { CharacterizerConfig } from '@/types';
import { FORTY_SHOTS, ANCHOR_SHOTS } from '@/types';

const SAFETY_RULES = 'age-appropriate, modest, non-sexualized, one character only, no extra people, no text overlay';

function buildCharacterIdentity(config: CharacterizerConfig): string {
  const parts: string[] = [
    'same exact person as in the reference image',
    'identical face, identical hairstyle, identical features',
    'Korean high school student',
  ];
  if (config.character_name) parts.push(`character name: ${config.character_name}`);
  if (config.signature_item) parts.push(`always wearing/carrying: ${config.signature_item}`);
  if (config.signature_color) parts.push(`signature color accent: ${config.signature_color}`);
  if (config.tone_keywords) parts.push(`overall tone: ${config.tone_keywords}`);
  return parts.join('. ');
}

function buildOutfit(config: CharacterizerConfig, shotKey: string): string {
  const casualShots = ['22_after_school_casual', '23_after_school_hoodie'];
  if (casualShots.includes(shotKey)) {
    return config.after_school_style || 'casual streetwear, relaxed fit';
  }
  if (shotKey === '23_after_school_hoodie') {
    return 'oversized hoodie, casual and relaxed';
  }
  if (shotKey === '36_cardigan_reference') {
    return 'cardigan over school uniform';
  }
  return config.school_style || 'modest Korean school uniform, blazer, white shirt, tie';
}

export function generateAnchorPrompt(config: CharacterizerConfig, anchor: typeof ANCHOR_SHOTS[number]): string {
  const identity = buildCharacterIdentity(config);
  const outfit = config.school_style || 'modest Korean school uniform, blazer, white shirt, tie';

  return [
    `Generate an image of this character: ${anchor.desc}`,
    identity,
    `wearing ${outfit}`,
    'realistic live-action, photorealistic, cinematic lighting, high quality',
    SAFETY_RULES,
  ].join('. ');
}

export function generateShotPrompt(config: CharacterizerConfig, shot: typeof FORTY_SHOTS[number]): string {
  const identity = buildCharacterIdentity(config);
  const outfit = buildOutfit(config, shot.key);

  return [
    `Generate an image of this character: ${shot.desc}`,
    identity,
    `wearing ${outfit}`,
    'realistic live-action Korean drama style, photorealistic, cinematic lighting, high quality',
    'character is always the main focus, backgrounds should be subtle and secondary',
    SAFETY_RULES,
  ].join('. ');
}

export function generateAllShotPrompts(config: CharacterizerConfig): { shotKey: string; shotIndex: number; label: string; prompt: string }[] {
  return FORTY_SHOTS.map(shot => ({
    shotKey: shot.key,
    shotIndex: shot.slot,
    label: shot.label,
    prompt: generateShotPrompt(config, shot),
  }));
}

export function generateAllAnchorPrompts(config: CharacterizerConfig): { anchorKey: string; label: string; prompt: string }[] {
  return ANCHOR_SHOTS.map(anchor => ({
    anchorKey: anchor.key,
    label: anchor.label,
    prompt: generateAnchorPrompt(config, anchor),
  }));
}
