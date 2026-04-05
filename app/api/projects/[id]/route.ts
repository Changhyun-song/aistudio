import { NextRequest, NextResponse } from 'next/server';
import {
  projectRepo, storyConceptRepo, storyBibleRepo, storyEpisodeArcRepo,
  storyEpisodeScriptRepo, storyClipPacketRepo, storyBoundaryFrameRepo,
  storyCharacterRepo, promptSupplementRepo,
} from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Handle reset actions
  if (body._resetType) {
    const resetType = body._resetType;
    try {
      if (resetType === 'soft' || resetType === 'project' || resetType === 'hard') {
        // Soft: clear outputs only, keep learned supplements
        storyConceptRepo.deleteByProject(id);
        storyBibleRepo.deleteByProject(id);
        storyEpisodeArcRepo.deleteByProject(id);
        storyEpisodeScriptRepo.deleteByProject(id);
        storyClipPacketRepo.deleteByProject(id);
        storyBoundaryFrameRepo.deleteByProject(id);
        storyCharacterRepo.deleteByProject(id);
      }
      if (resetType === 'project' || resetType === 'hard') {
        promptSupplementRepo.deleteByProject(id);
      }
      if (resetType === 'hard') {
        promptSupplementRepo.resetGlobal();
      }
      return NextResponse.json({ ok: true, resetType });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json(projectRepo.update(id, body));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  projectRepo.delete(id);
  return NextResponse.json({ ok: true });
}
