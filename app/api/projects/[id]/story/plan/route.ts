import { NextRequest, NextResponse } from 'next/server';
import { plannerInit, plannerInterpretEvaluation } from '@/lib/story';
import type { EvalTaskType, EvalResult } from '@/lib/story';
import { storyConceptRepo } from '@/lib/db/repository';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { action, taskType, projectContext, evaluation, loop, previousStrategies } = body as {
    action: 'init' | 'interpret';
    taskType: EvalTaskType;
    projectContext?: string;
    evaluation?: EvalResult;
    loop?: number;
    previousStrategies?: string[];
  };

  let genreOverlay;
  const concept = storyConceptRepo.getByProject(projectId);
  if (concept?.genre_overlay_json) {
    try { genreOverlay = JSON.parse(concept.genre_overlay_json); } catch { /* ignore */ }
  }

  try {
    if (action === 'init') {
      const result = await plannerInit(taskType, projectContext || '', genreOverlay);
      return NextResponse.json(result);
    }

    if (action === 'interpret' && evaluation) {
      const result = await plannerInterpretEvaluation(
        taskType, evaluation, loop || 1, previousStrategies, genreOverlay,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
