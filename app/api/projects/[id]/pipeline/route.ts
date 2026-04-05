import { NextRequest, NextResponse } from 'next/server';
import { pipelineRunRepo, pipelineStageRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const active = pipelineRunRepo.getActiveByProject(id);
  const recent = pipelineRunRepo.listByProject(id, 5);

  const stages = active ? pipelineStageRepo.listByRun(active.id) : [];

  return NextResponse.json({
    active: active || null,
    stages,
    recent,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === 'create') {
    const run = pipelineRunRepo.create(id, {
      pipelineType: body.pipelineType || 'story_full',
      targetScore: body.targetScore || 4.0,
      maxRetries: body.maxRetries || 3,
      currentStage: body.currentStage || 'idle',
      currentStageLabel: body.currentStageLabel || '',
    });
    return NextResponse.json(run, { status: 201 });
  }

  if (action === 'update_stage') {
    const { runId, stage, stageLabel, progressPct } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    pipelineRunRepo.updateStage(runId, stage, stageLabel || '', progressPct ?? 0);
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_status') {
    const { runId, status, errorMessage } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    pipelineRunRepo.updateStatus(runId, status, errorMessage);
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_summary') {
    const { runId, summary } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    pipelineRunRepo.updateSummary(runId, summary || {});
    return NextResponse.json({ ok: true });
  }

  if (action === 'add_stage') {
    const { runId, stage, stageLabel, maxAttempts } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    const s = pipelineStageRepo.create(runId, id, stage, stageLabel || stage, maxAttempts || 3);
    return NextResponse.json(s, { status: 201 });
  }

  if (action === 'update_stage_status') {
    const { stageId, status, attempt, score, detailJson } = body;
    if (!stageId) return NextResponse.json({ error: 'stageId required' }, { status: 400 });
    pipelineStageRepo.updateStatus(stageId, status, { attempt, score, detailJson });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
