import { NextRequest, NextResponse } from 'next/server';
import { storyBibleRepo, storyEpisodeArcRepo, storyConceptRepo, projectRepo } from '@/lib/db/repository';
import { generateSeasonPlan } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';
import type { GenreOverlay } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const arcs = storyEpisodeArcRepo.listByProject(id);
  return NextResponse.json(arcs);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const bible = storyBibleRepo.getByProject(id);
  if (!bible) return NextResponse.json({ error: 'Generate Series Bible first' }, { status: 400 });

  const concept = storyConceptRepo.getByProject(id);

  let genreOverlay: GenreOverlay | undefined;
  try {
    const raw = concept?.genre_overlay_json ? JSON.parse(concept.genre_overlay_json) : null;
    if (raw?.genre_stack?.length) genreOverlay = raw;
  } catch { /* empty */ }

  try {
    const arcs = await generateSeasonPlan(bible, concept?.approved_markdown, genreOverlay, id);

    storyEpisodeArcRepo.replaceBatch(
      id,
      arcs.map((a) => ({
        project_id: id,
        episode_number: a.episodeNumber,
        title: a.title,
        purpose: a.purpose,
        summary: a.summary,
        beginning: a.beginning,
        middle: a.middle,
        climax: a.climax,
        ending_hook: a.endingHook,
        key_characters: JSON.stringify(a.keyCharacters),
        raw_json: JSON.stringify(a),
      }))
    );

    return NextResponse.json(storyEpisodeArcRepo.listByProject(id));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
