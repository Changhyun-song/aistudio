import { NextRequest, NextResponse } from 'next/server';
import { optimizePrompt } from '@/lib/story';
import type { OptimizeStage, EvalResult } from '@/lib/story';
import { promptSupplementRepo, storyConceptRepo } from '@/lib/db/repository';
import { isAIConfigured } from '@/lib/ai';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplements = promptSupplementRepo.listByProject(id);
  return NextResponse.json(supplements);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const body = await req.json();
  const { stage, generatorOutput, evaluation, plannerFeedback } = body as {
    stage: OptimizeStage;
    generatorOutput: string;
    evaluation: EvalResult;
    plannerFeedback: string;
  };

  if (!stage || !generatorOutput || !evaluation) {
    return NextResponse.json({ error: 'Missing required fields: stage, generatorOutput, evaluation' }, { status: 400 });
  }

  const concept = storyConceptRepo.getByProject(projectId);
  const userIdea = concept?.raw_input || '';

  try {
    const result = await optimizePrompt(projectId, stage, generatorOutput, evaluation, plannerFeedback || '', userIdea);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
