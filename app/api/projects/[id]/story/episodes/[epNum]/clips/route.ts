import { NextRequest, NextResponse } from 'next/server';
import {
  storyBibleRepo, storyEpisodeArcRepo, storyEpisodeScriptRepo,
  storyClipPacketRepo, storyBoundaryFrameRepo, storyCharacterRepo,
  storyConceptRepo, projectRepo,
} from '@/lib/db/repository';
import { generateFrameAndVideoPackets } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';
import type { GenreOverlay, VideoProvider } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; epNum: string }> }) {
  const { id, epNum } = await params;
  const epNumber = parseInt(epNum, 10);
  const clips = storyClipPacketRepo.listByEpisode(id, epNumber);
  const frames = storyBoundaryFrameRepo.listByEpisode(id, epNumber);
  return NextResponse.json({ clips, frames });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; epNum: string }> }) {
  const { id, epNum } = await params;
  const epNumber = parseInt(epNum, 10);

  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const bible = storyBibleRepo.getByProject(id);
  if (!bible) return NextResponse.json({ error: 'Series Bible required' }, { status: 400 });

  const arc = storyEpisodeArcRepo.getByEpisode(id, epNumber);
  if (!arc) return NextResponse.json({ error: `Episode ${epNumber} arc not found` }, { status: 400 });

  const scriptRow = storyEpisodeScriptRepo.getByEpisode(id, epNumber);
  if (!scriptRow) return NextResponse.json({ error: `Episode ${epNumber} script not found.` }, { status: 400 });

  let scenes: unknown[] = [];
  try { scenes = JSON.parse(scriptRow.scenes_json); } catch { /* empty */ }

  const characters = storyCharacterRepo.list(id);
  const concept = storyConceptRepo.getByProject(id);
  const body = await req.json().catch(() => ({}));
  const density = body.density === 'balanced' ? 'balanced' : 'cinematic_detail';
  const videoProvider: VideoProvider = body.videoProvider === 'seedance_2_0' ? 'seedance_2_0' : 'higgsfield';

  let genreOverlay: GenreOverlay | undefined;
  try {
    const raw = concept?.genre_overlay_json ? JSON.parse(concept.genre_overlay_json) : null;
    if (raw?.genre_stack?.length) genreOverlay = raw;
  } catch { /* empty */ }

  try {
    const result = await generateFrameAndVideoPackets(
      bible, arc,
      { scenes: scenes as Parameters<typeof generateFrameAndVideoPackets>[2]['scenes'] },
      characters, density, genreOverlay, videoProvider, id,
    );

    if (result.boundaryFrames?.length) {
      storyBoundaryFrameRepo.replaceBatch(
        id, epNumber,
        result.boundaryFrames.map(f => ({
          frameId: f.frameId,
          timecode: f.timecode,
          description: f.description,
          imagePrompt: f.imagePrompt,
          rawJson: JSON.stringify(f),
        }))
      );
    }

    if (videoProvider === 'seedance_2_0' && result.seedanceClipPackets?.length) {
      storyClipPacketRepo.replaceBatch(
        id, epNumber,
        result.seedanceClipPackets.map(p => ({
          clipNumber: p.clipNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          durationSec: p.totalDurationSec,
          packetJson: JSON.stringify({ ...p, provider: videoProvider }),
        }))
      );
    } else if (result.higgsfieldClipPackets?.length) {
      storyClipPacketRepo.replaceBatch(
        id, epNumber,
        result.higgsfieldClipPackets.map(p => ({
          clipNumber: p.clipNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          durationSec: p.durationSec,
          packetJson: JSON.stringify({ ...p, provider: videoProvider }),
        }))
      );
    }

    return NextResponse.json({
      clips: storyClipPacketRepo.listByEpisode(id, epNumber),
      frames: storyBoundaryFrameRepo.listByEpisode(id, epNumber),
      timeline: result.timeline || '',
      provider: videoProvider,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
