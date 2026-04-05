import { NextRequest, NextResponse } from 'next/server';
import { pipelineRunRepo, pipelineStageRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const active = pipelineRunRepo.getActiveByProject(id);
  const recent = pipelineRunRepo.listByProject(id, 5);
  const latest = pipelineRunRepo.getLatestByProject(id);

  const stages = active ? pipelineStageRepo.listByRun(active.id) : [];

  return NextResponse.json({
    active: active || null,
    stages,
    recent,
    latest: latest || null,
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

  if (action === 'save_logs') {
    const { runId, logs } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    pipelineRunRepo.saveLogs(runId, Array.isArray(logs) ? logs : []);
    return NextResponse.json({ ok: true });
  }

  if (action === 'get_logs') {
    const { runId } = body;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    const logs = pipelineRunRepo.getLogs(runId);
    return NextResponse.json({ logs });
  }

  if (action === 'force_reset') {
    const active = pipelineRunRepo.getActiveByProject(id);
    if (active) {
      pipelineRunRepo.updateStatus(active.id, 'failed', '강제 리셋 — 파이프라인이 응답하지 않아 수동으로 중단됨');
      const logs = pipelineRunRepo.getLogs(active.id);
      if (Array.isArray(logs)) {
        logs.push({ stage: '리셋', message: '사용자가 파이프라인을 강제 리셋했습니다.', timestamp: Date.now(), type: 'warn' });
        pipelineRunRepo.saveLogs(active.id, logs);
      }
      return NextResponse.json({ ok: true, resetRunId: active.id });
    }
    return NextResponse.json({ ok: true, message: '활성 파이프라인 없음' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
