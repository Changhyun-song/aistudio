import { NextRequest, NextResponse } from 'next/server';
import { storyEpisodeScriptRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; epNum: string }> }) {
  const { id, epNum } = await params;
  const script = storyEpisodeScriptRepo.getByEpisode(id, parseInt(epNum, 10));
  return NextResponse.json(script ?? null);
}
