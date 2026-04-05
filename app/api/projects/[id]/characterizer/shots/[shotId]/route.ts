import { NextRequest, NextResponse } from 'next/server';
import { characterizerShotRepo } from '@/lib/db/repository';

type Params = { params: Promise<{ id: string; shotId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { shotId } = await params;
  const body = await req.json();
  const shot = characterizerShotRepo.update(shotId, body);
  return NextResponse.json(shot);
}
