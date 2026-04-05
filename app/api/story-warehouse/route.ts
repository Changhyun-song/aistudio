import { NextResponse } from 'next/server';
import { storyWarehouseRepo } from '@/lib/db/repository';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const fmt = searchParams.get('format');

  const items = q ? storyWarehouseRepo.search(q) : storyWarehouseRepo.list(200);

  if (fmt === 'txt') {
    const lines: string[] = [];
    for (const item of items) {
      lines.push('═'.repeat(60));
      lines.push(`제목: ${item.title}`);
      lines.push(`장르: ${item.genre || '-'}  |  톤: ${item.tone || '-'}  |  출처: ${item.source}`);
      lines.push(`종합 점수: ${item.eval_overall || '-'}/5  |  판정: ${item.eval_verdict || '-'}`);
      lines.push(`생성일: ${item.created_at}`);
      lines.push('─'.repeat(60));

      let rawData: Record<string, unknown> | null = null;
      try { rawData = JSON.parse(item.raw_json || '{}'); } catch { /* */ }

      const protagonist = rawData?.protagonist as { name?: string; desire?: string; flaw?: string } | undefined;
      if (protagonist?.name) {
        lines.push(`\n[주인공] ${protagonist.name}`);
        lines.push(`  Desire: ${protagonist.desire || '-'}`);
        lines.push(`  Flaw: ${protagonist.flaw || '-'}`);
      }

      const keyRel = rawData?.keyRelationship as { person?: string; bond?: string; tension?: string } | undefined;
      if (keyRel?.person) {
        lines.push(`\n[핵심 관계] ${keyRel.person} — ${keyRel.bond || '-'} / 긴장: ${keyRel.tension || '-'}`);
      }

      if (rawData?.smallMoment) {
        lines.push(`[Small Moment] ${rawData.smallMoment}`);
      }

      if (item.logline) lines.push(`\n[로그라인] ${item.logline}`);

      const eventChain = rawData?.event_chain as { beat?: string; event?: string; emotion?: string }[] | undefined;
      if (Array.isArray(eventChain) && eventChain.length > 0) {
        lines.push(`\n[사건 체인] (${eventChain.length} beats)`);
        for (const e of eventChain) {
          lines.push(`  [${e.beat}] ${e.event}  (${e.emotion})`);
        }
      } else if (item.synopsis) {
        lines.push(`\n[시놉시스] ${item.synopsis}`);
      }

      if (rawData?.why_this_premise_matters) {
        lines.push(`\n[소재 필수성] ${rawData.why_this_premise_matters}`);
      }

      if (item.inner_conflict) lines.push(`[내적 갈등/Flaw] ${item.inner_conflict}`);
      if (item.outer_obstacle) lines.push(`[외적 장애물/소재필수성] ${item.outer_obstacle}`);
      if (item.hook) lines.push(`[고유 매력] ${item.hook}`);

      lines.push(`\n[AI 평가]`);
      lines.push(`  보고 싶은가: ${item.eval_clarity || '-'}  자연스러움: ${item.eval_conflict || '-'}  소재↔관계: ${item.eval_narrative_flow || '-'}  캐릭터 호감: ${item.eval_focus || '-'}  관계 중심: ${item.eval_freshness || '-'}`);
      if (item.eval_summary) lines.push(`  한줄평: "${item.eval_summary}"`);

      const strengths = (rawData?.strengths as string[]) || [];
      const weaknesses = (rawData?.weaknesses as string[]) || [];
      if (strengths.length > 0) lines.push(`  강점: ${strengths.join(', ')}`);
      if (weaknesses.length > 0) lines.push(`  약점: ${weaknesses.join(', ')}`);

      let seedInfo = '';
      try {
        const seed = JSON.parse(item.seed_json || '{}');
        if (Array.isArray(seed.elements)) {
          seedInfo = seed.elements.map((e: { category: string; item: { value: string } }) => `[${e.category}] ${e.item.value}`).join(' / ');
        }
      } catch { /* */ }
      if (seedInfo) lines.push(`\n[씨앗] ${seedInfo}`);

      lines.push('');
    }

    lines.unshift(`Story Warehouse Export — ${new Date().toISOString().slice(0, 19)} — ${items.length}개\n`);

    const text = lines.join('\n');
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="story_warehouse_${Date.now()}.txt"`,
      },
    });
  }

  return NextResponse.json(items);
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const action = body.action as string;

  if (action === 'delete_many') {
    const ids = body.ids as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 });
    }
    const deleted = storyWarehouseRepo.deleteMany(ids);
    return NextResponse.json({ deleted });
  }

  if (action === 'delete_all') {
    const deleted = storyWarehouseRepo.deleteAll();
    return NextResponse.json({ deleted });
  }

  if (action === 'delete_below_score') {
    const threshold = body.threshold as number;
    if (typeof threshold !== 'number') {
      return NextResponse.json({ error: 'threshold required' }, { status: 400 });
    }
    const deleted = storyWarehouseRepo.deleteBelowScore(threshold);
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = storyWarehouseRepo.create({
    title: body.title || 'Untitled',
    logline: body.logline || '',
    genre: body.genre || '',
    tone: body.tone || '',
    hook: body.hook || '',
    target_audience: body.target_audience || '',
    tags: JSON.stringify(body.tags || []),
    source: body.source || 'manual',
    status: body.status || 'idea',
    project_id: body.project_id || null,
    raw_json: JSON.stringify(body.raw_json || {}),
  });
  return NextResponse.json(item);
}
