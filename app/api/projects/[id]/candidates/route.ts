import { NextRequest, NextResponse } from 'next/server';
import { candidateRepo, revisionRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(candidateRepo.listByProject(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const latest = revisionRepo.getLatest(id);
  const candidate = candidateRepo.create(id, body.revision_id || latest?.id || '');
  if (body.image_url) candidateRepo.update(candidate.id, { image_url: body.image_url, status: 'uploaded' });
  if (body.image_path) candidateRepo.update(candidate.id, { image_path: body.image_path, status: 'uploaded' });
  return NextResponse.json(candidateRepo.get(candidate.id), { status: 201 });
}
