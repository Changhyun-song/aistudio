import { NextRequest, NextResponse } from 'next/server';
import { referenceSourceRepo, referenceAnalysisRepo } from '@/lib/db/repository';
import { analyzeReferenceSource } from '@/lib/ai/reference-lab';
import { isAIConfigured } from '@/lib/ai';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const { sourceId } = await params;
  const source = referenceSourceRepo.get(sourceId);
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  const analysis = referenceAnalysisRepo.getBySource(sourceId);
  return NextResponse.json({ source, analysis });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const { sourceId } = await params;
  const body = await req.json();
  const updated = referenceSourceRepo.update(sourceId, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const { sourceId } = await params;
  referenceSourceRepo.delete(sourceId);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const { id, sourceId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'analyze') {
    if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const source = referenceSourceRepo.get(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    try {
      const result = await analyzeReferenceSource(source);
      const analysis = referenceAnalysisRepo.upsert(sourceId, id, {
        genre: String(result.genre || ''),
        tone: String(result.tone || ''),
        themes_json: JSON.stringify(result.themes || []),
        character_types_json: JSON.stringify(result.characterTypes || []),
        relationship_dynamics_json: JSON.stringify(result.relationshipDynamics || []),
        mystery_elements_json: JSON.stringify(result.mysteryElements || []),
        visual_motifs_json: JSON.stringify(result.visualMotifs || []),
        pacing_notes: String(result.pacingNotes || ''),
        romance_pattern: String(result.romancePattern || ''),
        twist_pattern: String(result.twistPattern || ''),
        avoid_cliches_json: JSON.stringify(result.avoidCliches || []),
        raw_json: JSON.stringify(result),
      });
      return NextResponse.json(analysis);
    } catch (err: unknown) {
      return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
