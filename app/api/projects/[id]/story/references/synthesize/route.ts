import { NextRequest, NextResponse } from 'next/server';
import { referenceSourceRepo, referenceAnalysisRepo, referenceSynthesisRepo } from '@/lib/db/repository';
import { synthesizeReferences } from '@/lib/ai/reference-lab';
import { isAIConfigured } from '@/lib/ai';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const synthesis = referenceSynthesisRepo.getByProject(id);
  return NextResponse.json(synthesis ?? null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const selectedIds: string[] = body.source_ids || [];
  const userGoal: string = body.user_goal || '';

  const allSources = referenceSourceRepo.list(id);
  const sources = selectedIds.length ? allSources.filter(s => selectedIds.includes(s.id)) : allSources;

  if (sources.length === 0) return NextResponse.json({ error: 'No sources to synthesize' }, { status: 400 });

  const pairs = sources.map(source => {
    const analysis = referenceAnalysisRepo.getBySource(source.id);
    return { source, analysis };
  }).filter(p => p.analysis) as { source: typeof sources[0]; analysis: NonNullable<ReturnType<typeof referenceAnalysisRepo.getBySource>> }[];

  if (pairs.length === 0) return NextResponse.json({ error: 'No analyzed sources found. Analyze sources first.' }, { status: 400 });

  try {
    const result = await synthesizeReferences(pairs, userGoal);
    const synthesis = referenceSynthesisRepo.upsert(id, {
      selectedSourceIdsJson: JSON.stringify(pairs.map(p => p.source.id)),
      summaryMarkdown: String(result.overallInspirationSummary || ''),
      structuredJson: JSON.stringify(result),
    });
    return NextResponse.json(synthesis);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
