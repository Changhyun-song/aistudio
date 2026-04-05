import { NextRequest, NextResponse } from 'next/server';
import { evaluateOutput } from '@/lib/story';
import type { EvalTaskType } from '@/lib/story';
import { storyConceptRepo, storyBibleRepo, storyEpisodeArcRepo, storyEpisodeScriptRepo, storyClipPacketRepo, storyBoundaryFrameRepo } from '@/lib/db/repository';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { taskType, episodeNumber } = body as { taskType: EvalTaskType; episodeNumber?: number };

  let content = '';

  try {
    switch (taskType) {
      case 'concept': {
        const concept = storyConceptRepo.getByProject(projectId);
        if (!concept) return NextResponse.json({ error: '스토리 컨셉 없음' }, { status: 404 });
        content = concept.approved_markdown || '';
        break;
      }
      case 'bible': {
        const bible = storyBibleRepo.getByProject(projectId);
        if (!bible) return NextResponse.json({ error: 'Series Bible 없음' }, { status: 404 });
        content = bible.raw_json;
        break;
      }
      case 'season': {
        const arcs = storyEpisodeArcRepo.listByProject(projectId);
        if (!arcs.length) return NextResponse.json({ error: '시즌 플랜 없음' }, { status: 404 });
        content = JSON.stringify(arcs.map(a => ({
          ep: a.episode_number, title: a.title, purpose: a.purpose,
          summary: a.summary, beginning: a.beginning, middle: a.middle,
          climax: a.climax, ending_hook: a.ending_hook, raw: a.raw_json,
        })), null, 2);
        break;
      }
      case 'script': {
        if (!episodeNumber) return NextResponse.json({ error: 'episodeNumber 필요' }, { status: 400 });
        const script = storyEpisodeScriptRepo.getByEpisode(projectId, episodeNumber);
        if (!script) return NextResponse.json({ error: '에피소드 스크립트 없음' }, { status: 404 });
        content = script.scenes_json || script.markdown || '';
        break;
      }
      case 'clips': {
        if (!episodeNumber) return NextResponse.json({ error: 'episodeNumber 필요' }, { status: 400 });
        const clips = storyClipPacketRepo.listByEpisode(projectId, episodeNumber);
        const frames = storyBoundaryFrameRepo.listByEpisode(projectId, episodeNumber);
        content = JSON.stringify({
          clips: clips.map(c => JSON.parse(c.packet_json)),
          frames: frames.map(f => ({ timecode: f.timecode, description: f.description, imagePrompt: f.image_prompt })),
        }, null, 2);
        break;
      }
    }

    let genreOverlay;
    const concept = storyConceptRepo.getByProject(projectId);
    if (concept?.genre_overlay_json) {
      try { genreOverlay = JSON.parse(concept.genre_overlay_json); } catch { /* ignore */ }
    }

    const result = await evaluateOutput(taskType, content, genreOverlay);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
