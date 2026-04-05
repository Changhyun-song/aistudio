import { NextRequest, NextResponse } from 'next/server';
import { storyBoundaryFrameRepo } from '@/lib/db/repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const epParam = req.nextUrl.searchParams.get('episode');
  if (!epParam) return NextResponse.json({ error: 'episode param required' }, { status: 400 });
  const frames = storyBoundaryFrameRepo.listByEpisode(id, parseInt(epParam, 10));
  return NextResponse.json(frames);
}
