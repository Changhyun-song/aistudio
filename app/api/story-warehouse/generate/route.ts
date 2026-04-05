import { NextResponse } from 'next/server';
import { storyWarehouseRepo } from '@/lib/db/repository';
import {
  runWarehousePipeline,
  recordSelection,
  type EvaluatedPremise,
} from '@/lib/story-warehouse';

export async function POST(req: Request) {
  const body = await req.json();
  const { seedCount = 5, action = 'generate' } = body;

  if (action === 'record_pick') {
    const { itemId } = body;
    if (itemId) {
      storyWarehouseRepo.update(itemId, { pick_count: 1 } as never);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await runWarehousePipeline(seedCount);

    const saved = [];
    for (const p of result.passed) {
      const item = storyWarehouseRepo.create({
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        tone: p.tone,
        hook: p.hook,
        target_audience: p.targetAudience,
        tags: JSON.stringify(p.tags),
        source: 'pipeline',
        status: 'idea',
        project_id: null,
        synopsis: p.synopsis,
        inner_conflict: p.innerConflict,
        outer_obstacle: p.outerObstacle,
        expected_episodes: p.expectedEpisodes,
        seed_json: JSON.stringify(result.seeds.find(s => s.id === p.seedId) || {}),
        eval_freshness: p.evaluation.freshness,
        eval_conflict: p.evaluation.conflictPotential,
        eval_empathy: p.evaluation.empathy,
        eval_visual: p.evaluation.visualPotential,
        eval_expandability: p.evaluation.expandability,
        eval_overall: p.evaluation.overall,
        eval_verdict: p.evaluation.verdict,
        eval_summary: p.evaluation.oneLiner,
        raw_json: JSON.stringify({
          strengths: p.evaluation.strengths,
          weaknesses: p.evaluation.weaknesses,
        }),
      });
      saved.push(item);
    }

    // Record selection patterns for passed seeds
    for (const p of result.passed) {
      recordSelection(p, result.seeds);
    }

    return NextResponse.json({
      ideas: saved,
      count: saved.length,
      stats: {
        totalSeeds: result.totalSeeds,
        totalPremises: result.totalPremises,
        totalEvaluated: result.totalEvaluated,
        passedCount: result.passed.length,
        failedCount: result.failed.length,
        failedPreviews: result.failed.slice(0, 3).map((f: EvaluatedPremise) => ({
          title: f.title,
          score: f.evaluation.overall,
          reason: f.evaluation.oneLiner,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
