import { NextRequest, NextResponse } from 'next/server';
import { candidateRepo } from '@/lib/db/repository';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { candidateId } = await params;
  const body = await req.json();
  return NextResponse.json(candidateRepo.update(candidateId, body));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { candidateId } = await params;
  candidateRepo.delete(candidateId);
  return NextResponse.json({ ok: true });
}
