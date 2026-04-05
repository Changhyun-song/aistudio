import { NextRequest, NextResponse } from 'next/server';
import { storyBibleRepo, storyCharacterRepo, storyConceptRepo, projectRepo } from '@/lib/db/repository';
import { generateSeriesBible } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';
import type { GenreOverlay } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bible = storyBibleRepo.getByProject(id);
  return NextResponse.json(bible ?? null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const body = await req.json();
  const characters = storyCharacterRepo.list(id);
  const concept = storyConceptRepo.getByProject(id);
  const conceptText = concept?.approved_markdown || '';

  let genreOverlay: GenreOverlay | undefined;
  try {
    const raw = concept?.genre_overlay_json ? JSON.parse(concept.genre_overlay_json) : null;
    if (raw?.genre_stack?.length) genreOverlay = raw;
  } catch { /* empty */ }

  try {
    const result = await generateSeriesBible({
      title: body.title || project.name,
      genre: body.genre || concept?.genre || '',
      tone: body.tone || concept?.tone || '',
      worldRules: body.world_rules || '',
      seasonGoal: body.season_goal || '',
      coreConflict: body.core_conflict || '',
      endingDirection: body.ending_direction || concept?.ending_mood || '',
      audience: body.audience || concept?.target_audience || '',
      referenceMood: body.reference_mood || '',
    }, characters, conceptText, genreOverlay, id);

    const bible = storyBibleRepo.upsert(id, {
      title: body.title || project.name,
      genre: body.genre || concept?.genre || '',
      tone: body.tone || concept?.tone || '',
      world_rules: body.world_rules || '',
      season_goal: body.season_goal || '',
      core_conflict: body.core_conflict || '',
      ending_direction: body.ending_direction || '',
      audience: body.audience || concept?.target_audience || '',
      reference_mood: body.reference_mood || '',
      raw_json: JSON.stringify(result),
    });

    return NextResponse.json(bible);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
