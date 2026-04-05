import { NextRequest, NextResponse } from 'next/server';
import { characterizerShotRepo } from '@/lib/db/repository';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const shots = characterizerShotRepo.listByProject(id);
  return NextResponse.json(shots);
}
