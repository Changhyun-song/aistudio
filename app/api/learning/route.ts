import { NextRequest, NextResponse } from 'next/server';
import { promptSupplementRuleRepo } from '@/lib/db/repository';
import { checkAndConsolidate } from '@/lib/story/optimizer';

export async function GET() {
  const stages = ['ai1', 'ai2', 'ai3'] as const;
  const stats: Record<string, {
    globalActive: number;
    globalRetired: number;
    globalAll: number;
    consolidationReady: boolean;
  }> = {};

  for (const stage of stages) {
    const all = promptSupplementRuleRepo.listGlobalAll(stage);
    const active = all.filter(r => r.status === 'active');
    const retired = all.filter(r => r.status === 'retired');
    stats[stage] = {
      globalActive: active.length,
      globalRetired: retired.length,
      globalAll: all.length,
      consolidationReady: active.length >= 10,
    };
  }

  const totalGlobal = promptSupplementRuleRepo.countGlobalActive();
  const allGlobal = promptSupplementRuleRepo.listGlobalAll();

  return NextResponse.json({
    stats,
    totalGlobalActive: totalGlobal,
    rules: allGlobal.map(r => ({
      id: r.id,
      stage: r.stage,
      rule_text: r.rule_text,
      status: r.status,
      effectiveness: r.global_effectiveness ?? r.effectiveness,
      apply_count: r.global_apply_count,
      success_count: r.global_success_count,
      origin_project_id: r.origin_project_id,
      promoted_at: r.promoted_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === 'consolidate') {
    const results = await checkAndConsolidate();
    return NextResponse.json({ results });
  }

  if (action === 'retire_rule') {
    const { ruleId } = body;
    if (!ruleId) return NextResponse.json({ error: 'ruleId required' }, { status: 400 });
    promptSupplementRuleRepo.retire(ruleId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
