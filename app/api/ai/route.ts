import { NextRequest, NextResponse } from 'next/server';
import { briefRepo, revisionRepo, projectRepo, baseCharacterRepo, variantRepo } from '@/lib/db/repository';
import {
  generateCharacterPrompt, reviseCharacterPrompt,
  generateTwentyPromptSet, structureBrief, isAIConfigured,
} from '@/lib/ai';
import { fallbackGeneratePrompt, fallbackGenerateTwentyPrompts } from '@/lib/prompt-engine';
import { TWENTY_SHOTS } from '@/types';

async function tryAI<T>(aiFn: () => Promise<T>, fallbackFn: () => T): Promise<{ result: T; usedFallback: boolean }> {
  if (!isAIConfigured()) return { result: fallbackFn(), usedFallback: true };
  try {
    return { result: await aiFn(), usedFallback: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit');
    if (isQuota) {
      console.warn('[AI] Quota/rate limit hit, falling back to template engine');
      return { result: fallbackFn(), usedFallback: true };
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, projectId } = body;

  try {
    if (action === 'check') {
      return NextResponse.json({ configured: isAIConfigured() });
    }

    if (action === 'structure') {
      if (!isAIConfigured()) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });
      }
      try {
        const structured = await structureBrief(body.naturalInput);
        return NextResponse.json(structured);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI error';
        return NextResponse.json({ error: `AI 구조화 실패: ${msg}. 폼에 직접 입력해 주세요.` }, { status: 500 });
      }
    }

    if (action === 'generate') {
      const brief = briefRepo.getByProject(projectId);
      if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 400 });

      const { result: prompt, usedFallback } = await tryAI(
        () => generateCharacterPrompt(brief),
        () => fallbackGeneratePrompt(brief),
      );

      const note = usedFallback ? 'Template fallback (AI quota exceeded)' : 'AI generated';
      const revision = revisionRepo.create(projectId, prompt, '', note);
      projectRepo.update(projectId, { status: 'prompting' });
      return NextResponse.json({ ...revision, usedFallback });
    }

    if (action === 'revise') {
      const brief = briefRepo.getByProject(projectId);
      const latest = revisionRepo.getLatest(projectId);
      if (!brief || !latest) return NextResponse.json({ error: 'Brief or revision not found' }, { status: 400 });

      const { result: prompt, usedFallback } = await tryAI(
        () => reviseCharacterPrompt(brief, latest.prompt, body.feedback),
        () => fallbackGeneratePrompt(brief),
      );

      const note = usedFallback ? 'Template fallback (AI unavailable)' : 'Revised by AI';
      const revision = revisionRepo.create(projectId, prompt, body.feedback, note);
      return NextResponse.json({ ...revision, usedFallback });
    }

    if (action === 'twenty') {
      const brief = briefRepo.getByProject(projectId);
      const base = baseCharacterRepo.getByProject(projectId);
      if (!brief || !base) return NextResponse.json({ error: 'Brief or base character not found' }, { status: 400 });

      variantRepo.deleteByProject(projectId);

      const { result: promptSet, usedFallback } = await tryAI(
        () => generateTwentyPromptSet(brief, base.summary),
        () => fallbackGenerateTwentyPrompts(brief, base.summary),
      );

      const items = promptSet.map((p) => {
        const shotDef = TWENTY_SHOTS.find(s => s.slot === p.slot) || TWENTY_SHOTS[p.slot - 1];
        return {
          project_id: projectId,
          base_character_id: base.id,
          slot: p.slot,
          shot_key: shotDef.key,
          label: shotDef.label,
          prompt: p.prompt,
          status: 'pending' as const,
          image_url: '',
          image_path: '',
          quality_notes: '',
        };
      });

      variantRepo.createBatch(items);
      projectRepo.update(projectId, { status: 'expanding' });
      const variants = variantRepo.listByProject(projectId);
      return NextResponse.json({ variants, usedFallback });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI Route Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
