import { NextResponse } from 'next/server';
import { aiUsageLogRepo } from '@/lib/db/repository';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const total = aiUsageLogRepo.getProjectTotal(id);
  const recent = aiUsageLogRepo.getByProject(id, 50);
  return NextResponse.json({ ...total, recent });
}
