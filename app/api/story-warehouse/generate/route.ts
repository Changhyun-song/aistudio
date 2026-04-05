import { NextResponse } from 'next/server';
import { storyWarehouseRepo } from '@/lib/db/repository';
import {
  runWarehousePipeline,
  recordSelection,
  type EvaluatedDrama,
} from '@/lib/story-warehouse';

export const maxDuration = 300;

// Background job tracking
let _bgJob: {
  running: boolean;
  startedAt: number;
  stage: string;
  error: string | null;
  stats: Record<string, unknown> | null;
} = { running: false, startedAt: 0, stage: 'idle', error: null, stats: null };

function saveDramaResults(result: Awaited<ReturnType<typeof runWarehousePipeline>>) {
  const saved = [];
  for (const d of result.passed) {
    const logline = `${d.protagonist.name}${d.protagonist.desire.includes('다') ? '은' : '는'} ${d.protagonist.desire}. 하지만 ${d.protagonist.flaw}`;

    const item = storyWarehouseRepo.create({
      title: d.title,
      logline,
      genre: d.genre,
      tone: d.tone,
      hook: d.hook,
      target_audience: '',
      tags: JSON.stringify(d.tags),
      source: 'pipeline',
      status: 'idea',
      project_id: null,
      synopsis: d.event_chain.map(e => `[${e.beat}] ${e.event}`).join(' → '),
      inner_conflict: d.protagonist.flaw,
      outer_obstacle: d.why_this_premise_matters,
      expected_episodes: '',
      seed_json: JSON.stringify(result.seeds.find(s => s.id === d.seedId) || {}),
      eval_clarity: d.evaluation.watchability,
      eval_narrative_flow: d.evaluation.relationshipDriven,
      eval_focus: d.evaluation.characterLikability,
      eval_freshness: d.evaluation.premiseInRelationship,
      eval_conflict: d.evaluation.naturalness,
      eval_empathy: 0,
      eval_visual: 0,
      eval_expandability: 0,
      eval_overall: d.evaluation.overall,
      eval_verdict: d.evaluation.verdict,
      eval_summary: d.evaluation.oneLiner,
      raw_json: JSON.stringify({
        protagonist: d.protagonist,
        event_chain: d.event_chain,
        why_this_premise_matters: d.why_this_premise_matters,
        premise: d.premise,
        beatTemplate: d.beatTemplate || '',
        endingType: d.endingType || '',
        keyRelationship: d.keyRelationship || null,
        smallMoment: d.smallMoment || null,
        naturalness: d.evaluation.naturalness,
        strengths: d.evaluation.strengths,
        weaknesses: d.evaluation.weaknesses,
        formulaPenalty: d.evaluation.formulaPenalty,
      }),
    });
    saved.push(item);
  }
  for (const d of result.passed) {
    recordSelection(d, result.seeds);
  }
  return saved;
}

function runBackground(seedCount: number, passThreshold: number) {
  _bgJob = { running: true, startedAt: Date.now(), stage: 'seeds', error: null, stats: null };

  runWarehousePipeline(seedCount, passThreshold, (p) => {
    _bgJob.stage = p.stage;
  })
    .then(result => {
      const saved = saveDramaResults(result);
      _bgJob = {
        running: false,
        startedAt: _bgJob.startedAt,
        stage: 'done',
        error: null,
        stats: {
          totalSeeds: result.totalSeeds,
          totalDramas: result.totalDramas,
          totalEvaluated: result.totalEvaluated,
          passedCount: result.passed.length,
          failedCount: result.failed.length,
          clicheFiltered: result.clicheFiltered,
          savedCount: saved.length,
          failedPreviews: result.failed.slice(0, 3).map((f: EvaluatedDrama) => ({
            title: f.title,
            score: f.evaluation.overall,
            reason: f.evaluation.oneLiner,
          })),
          errors: result.errors,
        },
      };
      console.log(`[StoryWarehouse] Background pipeline done: ${saved.length} saved`);
    })
    .catch(err => {
      _bgJob = {
        running: false,
        startedAt: _bgJob.startedAt,
        stage: 'error',
        error: (err as Error).message,
        stats: null,
      };
      console.error('[StoryWarehouse] Background pipeline error:', (err as Error).message);
    });
}

export async function GET() {
  return NextResponse.json(_bgJob);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { seedCount = 5, passThreshold = 3.8, action = 'generate' } = body;

  if (action === 'record_pick') {
    const { itemId } = body;
    if (itemId) {
      storyWarehouseRepo.update(itemId, { pick_count: 1 } as never);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'status') {
    return NextResponse.json(_bgJob);
  }

  if (_bgJob.running) {
    return NextResponse.json(
      { error: '이미 생성이 진행 중입니다.', status: _bgJob },
      { status: 409 },
    );
  }

  runBackground(seedCount, passThreshold);

  return NextResponse.json({ status: 'started', startedAt: _bgJob.startedAt });
}
