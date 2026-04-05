import OpenAI from 'openai';
import {
  SYSTEM_PROMPT_GENERATE,
  SYSTEM_PROMPT_REVISE,
  SYSTEM_PROMPT_TWENTY,
  SYSTEM_PROMPT_STRUCTURE,
} from './system-prompts';
import type { CharacterBrief } from '@/types';

// ── Provider Abstraction ─────────────────────────────

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIChatResult {
  text: string;
  usage: AIUsage;
  model: string;
}

export interface AIChatOpts {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  trackingContext?: {
    projectId: string;
    pipelineRunId?: string;
    stage: string;
    role: string;
  };
}

export interface AIProvider {
  name: string;
  chat(system: string, user: string, opts?: AIChatOpts): Promise<string>;
  chatWithUsage(system: string, user: string, opts?: AIChatOpts): Promise<AIChatResult>;
}

class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      timeout: 150_000, // 150 seconds per request
      maxRetries: 0,    // we handle retries ourselves in callWithRetry
    });
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  }

  private buildRequest(system: string, user: string, opts?: AIChatOpts) {
    const model = opts?.model || this.defaultModel;
    const isLegacy = model.startsWith('gpt-4') || model.startsWith('gpt-3');
    const tokenParam = isLegacy
      ? { max_tokens: opts?.maxTokens ?? 4096 }
      : { max_completion_tokens: opts?.maxTokens ?? 4096 };
    return {
      model,
      messages: [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: user },
      ],
      temperature: opts?.temperature ?? 0.7,
      ...tokenParam,
    };
  }

  private logUsage(opts: AIChatOpts | undefined, model: string, usage: AIUsage): void {
    if (!opts?.trackingContext) return;
    try {
      const { aiUsageLogRepo } = require('@/lib/db/repository');
      aiUsageLogRepo.insert({
        projectId: opts.trackingContext.projectId,
        pipelineRunId: opts.trackingContext.pipelineRunId,
        stage: opts.trackingContext.stage,
        role: opts.trackingContext.role,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      });
    } catch { /* best-effort logging */ }
  }

  private formatError(err: unknown, model: string, stage?: string): string {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];

    if (stage) parts.push(`[stage: ${stage}]`);
    parts.push(`[model: ${model}]`);

    if (e && typeof e === 'object') {
      const status = (e as any).status ?? (e as any).statusCode ?? (e as any).code;
      if (status) parts.push(`[HTTP ${status}]`);

      const errObj = (e as any).error;
      if (errObj && typeof errObj === 'object') {
        if (errObj.type) parts.push(`[type: ${errObj.type}]`);
        if (errObj.code) parts.push(`[code: ${errObj.code}]`);
        if (errObj.message) parts.push(errObj.message);
      } else if ((e as any).message) {
        parts.push((e as any).message);
      }
    } else {
      parts.push(String(err));
    }

    return parts.join(' ');
  }

  private async callWithRetry(
    reqParams: ReturnType<typeof this.buildRequest>,
    opts?: AIChatOpts,
    maxRetries = 2,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const stage = opts?.trackingContext?.stage;
    let lastError: unknown;

    const sysLen = reqParams.messages[0]?.content?.length ?? 0;
    const userLen = reqParams.messages[1]?.content?.length ?? 0;
    console.log(`[AI] ${stage || 'unknown'} model=${reqParams.model} sys=${sysLen}chars user=${userLen}chars total=${sysLen + userLen}chars`);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.chat.completions.create(reqParams);
      } catch (err) {
        lastError = err;
        const errMsg = this.formatError(err, reqParams.model, stage);
        console.error(`[AI] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${errMsg}`);

        if (attempt < maxRetries) {
          const isRetryable = this.isRetryableError(err);
          if (!isRetryable) {
            console.error(`[AI] Non-retryable error, skipping retry`);
            break;
          }
          const delay = (attempt + 1) * 3000;
          console.log(`[AI] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    const finalMsg = this.formatError(lastError, reqParams.model, stage);
    const enriched = new Error(finalMsg);
    (enriched as any).originalError = lastError;
    throw enriched;
  }

  private isRetryableError(err: unknown): boolean {
    const e = err as Record<string, unknown>;
    if (!e || typeof e !== 'object') return true;

    const status = (e as any).status ?? (e as any).statusCode;
    if (status === 401 || status === 403) return false;

    if (status === 400) {
      const errMsg = String((e as any).error?.message || (e as any).message || '');
      if (errMsg.includes('could not parse the JSON body') || errMsg.includes('invalid JSON')) {
        return true;
      }
      return false;
    }

    if (status === 429 || status >= 500) return true;

    const msg = String((e as any).message || '');
    if (msg.includes('Failed to fetch') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) return true;

    return true;
  }

  async chat(system: string, user: string, opts?: AIChatOpts): Promise<string> {
    const req = this.buildRequest(system, user, opts);
    const res = await this.callWithRetry(req, opts);
    const usage: AIUsage = {
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
      totalTokens: res.usage?.total_tokens ?? 0,
    };
    this.logUsage(opts, req.model, usage);
    return res.choices[0]?.message?.content?.trim() || '';
  }

  async chatWithUsage(system: string, user: string, opts?: AIChatOpts): Promise<AIChatResult> {
    const req = this.buildRequest(system, user, opts);
    const res = await this.callWithRetry(req, opts);
    const usage: AIUsage = {
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
      totalTokens: res.usage?.total_tokens ?? 0,
    };
    this.logUsage(opts, req.model, usage);
    return {
      text: res.choices[0]?.message?.content?.trim() || '',
      usage,
      model: req.model,
    };
  }
}

class FallbackProvider implements AIProvider {
  name = 'fallback';
  async chat(_system: string, _user: string, _opts?: AIChatOpts): Promise<string> {
    throw new Error('OPENAI_API_KEY is not configured. Please set it in .env.local');
  }
  async chatWithUsage(_system: string, _user: string, _opts?: AIChatOpts): Promise<AIChatResult> {
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
