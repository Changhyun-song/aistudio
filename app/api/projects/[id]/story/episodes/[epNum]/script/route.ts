import { NextRequest, NextResponse } from 'next/server';
import {
  storyBibleRepo, storyEpisodeArcRepo, storyEpisodeScriptRepo,
  storyCharacterRepo, storyConceptRepo, projectRepo,
} from '@/lib/db/repository';
import { generateEpisodeScript } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';
import type { GenreOverlay } from '@/types';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; epNum: string }> }) {
  const { id, epNum } = await params;
  const epNumber = parseInt(epNum, 10);

  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const bible = storyBibleRepo.getByProject(id);
  if (!bible) return NextResponse.json({ error: 'Generate Series Bible first' }, { status: 400 });

  const arc = storyEpisodeArcRepo.getByEpisode(id, epNumber);
  if (!arc) return NextResponse.json({ error: `Episode ${epNumber} arc not found.` }, { status: 400 });

  const characters = storyCharacterRepo.list(id);
  const concept = storyConceptRepo.getByProject(id);

  let genreOverlay: GenreOverlay | undefined;
  try {
    const raw = concept?.genre_overlay_json ? JSON.parse(concept.genre_overlay_json) : null;
    if (raw?.genre_stack?.length) genreOverlay = raw;
  } catch { /* empty */ }

  try {
    const result = await generateEpisodeScript(bible, arc, characters, concept?.approved_markdown, genreOverlay, id);
    const script = storyEpisodeScriptRepo.upsert(
      id, epNumber,
      result.markdownScript || '',
      JSON.stringify(result.scenes || []),
    );
    return NextResponse.json(script);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
