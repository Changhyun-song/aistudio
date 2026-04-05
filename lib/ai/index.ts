import OpenAI from 'openai';
import {
  SYSTEM_PROMPT_GENERATE,
  SYSTEM_PROMPT_REVISE,
  SYSTEM_PROMPT_TWENTY,
  SYSTEM_PROMPT_STRUCTURE,
} from './system-prompts';
import type { CharacterBrief } from '@/types';

// ── Provider Abstraction ─────────────────────────────

export interface AIProvider {
  name: string;
  chat(system: string, user: string, opts?: { maxTokens?: number; temperature?: number; model?: string }): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  }

  async chat(system: string, user: string, opts?: { maxTokens?: number; temperature?: number; model?: string }): Promise<string> {
    const model = opts?.model || this.defaultModel;
    const isLegacy = model.startsWith('gpt-4') || model.startsWith('gpt-3');
    const tokenParam = isLegacy
      ? { max_tokens: opts?.maxTokens ?? 4096 }
      : { max_completion_tokens: opts?.maxTokens ?? 4096 };
    const res = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts?.temperature ?? 0.7,
      ...tokenParam,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  }
}

class FallbackProvider implements AIProvider {
  name = 'fallback';
  async chat(_system: string, _user: string): Promise<string> {
    throw new Error('OPENAI_API_KEY is not configured. Please set it in .env.local');
  }
}

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (_provider) return _provider;
  if (process.env.OPENAI_API_KEY) {
    _provider = new OpenAIProvider();
  } else {
    _provider = new FallbackProvider();
  }
  return _provider;
}

// ── Brief → Structured Data ──────────────────────────

function briefToUserMessage(brief: CharacterBrief): string {
  const parts: string[] = [];
  if (brief.natural_input) parts.push(`Description: ${brief.natural_input}`);
  if (brief.name) parts.push(`Name: ${brief.name}`);
  if (brief.gender) parts.push(`Gender: ${brief.gender}`);
  parts.push(`Age: ${brief.age_group}`);
  if (brief.face_keywords) parts.push(`Face: ${brief.face_keywords}`);
  if (brief.hairstyle) parts.push(`Hairstyle: ${brief.hairstyle}`);
  if (brief.hair_color) parts.push(`Hair color: ${brief.hair_color}`);
  if (brief.body_type) parts.push(`Body type: ${brief.body_type}`);
  if (brief.mood) parts.push(`Mood: ${brief.mood}`);
  if (brief.personality) parts.push(`Personality: ${brief.personality}`);
  if (brief.signature_item) parts.push(`Signature item: ${brief.signature_item}`);
  if (brief.signature_color) parts.push(`Signature color: ${brief.signature_color}`);
  if (brief.uniform_style) parts.push(`Uniform: ${brief.uniform_style}`);
  if (brief.casual_style) parts.push(`Casual: ${brief.casual_style}`);
  if (brief.negative_prompts) parts.push(`Avoid: ${brief.negative_prompts}`);
  return parts.join('\n');
}

// ── Public API ───────────────────────────────────────

export async function structureBrief(naturalInput: string): Promise<Record<string, string>> {
  const raw = await getProvider().chat(SYSTEM_PROMPT_STRUCTURE, naturalInput);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

export async function generateCharacterPrompt(brief: CharacterBrief): Promise<string> {
  const userMsg = briefToUserMessage(brief);
  return getProvider().chat(SYSTEM_PROMPT_GENERATE, userMsg);
}

export async function reviseCharacterPrompt(
  brief: CharacterBrief,
  previousPrompt: string,
  userFeedback: string,
): Promise<string> {
  const userMsg = `ORIGINAL BRIEF:\n${briefToUserMessage(brief)}\n\nPREVIOUS PROMPT:\n${previousPrompt}\n\nUSER FEEDBACK:\n${userFeedback}`;
  return getProvider().chat(SYSTEM_PROMPT_REVISE, userMsg);
}

export async function generateTwentyPromptSet(
  brief: CharacterBrief,
  baseCharacterSummary: string,
): Promise<{ slot: number; prompt: string }[]> {
  const stylizeRange = brief.prompt_strength === 'conservative' ? '30-38' : brief.prompt_strength === 'strong' ? '42-50' : '35-45';
  const userMsg = `CHARACTER:\n${briefToUserMessage(brief)}\n\nBASE CHARACTER SUMMARY:\n${baseCharacterSummary}\n\nUse stylize values in the range ${stylizeRange}.`;
  const raw = await getProvider().chat(SYSTEM_PROMPT_TWENTY, userMsg);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
