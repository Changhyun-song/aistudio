import { NextRequest, NextResponse } from 'next/server';
import { revisionRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(revisionRepo.listByProject(id));
}
