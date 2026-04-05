import { NextResponse } from 'next/server';
import { storyConceptRepo, storyBibleRepo, storyEpisodeArcRepo, storyEpisodeScriptRepo } from '@/lib/db/repository';
import { evaluateSeasonCoherence } from '@/lib/story';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const genreOverlay = body.genreOverlay;

  const concept = storyConceptRepo.getByProject(id);
  const bible = storyBibleRepo.getByProject(id);
  const arcs = storyEpisodeArcRepo.listByProject(id);

  if (!concept || !bible || arcs.length === 0) {
    return NextResponse.json({ error: 'Insufficient data for coherence evaluation' }, { status: 400 });
  }

  const episodes = arcs.map(arc => {
    const script = storyEpisodeScriptRepo.getByEpisode(id, arc.episode_number);
    let sceneSummary = '';
    if (script?.scenes_json) {
      try {
        const scenes = JSON.parse(script.scenes_json);
        sceneSummary = (Array.isArray(scenes) ? scenes : []).map((s: { title?: string; purpose?: string }) => `${s.title}: ${s.purpose}`).join('; ');
      } catch { /* ignore */ }
    }
    return {
      number: arc.episode_number,
      title: arc.title,
      summary: arc.summary,
      scenes: sceneSummary,
    };
  });

  try {
    const result = await evaluateSeasonCoherence(
      {
        concept: concept.approved_markdown || '',
        bible: bible.raw_json || '',
        episodes,
      },
      genreOverlay,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
