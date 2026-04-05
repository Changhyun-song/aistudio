import { NextRequest, NextResponse } from 'next/server';
import { baseCharacterRepo, candidateRepo, projectRepo, revisionRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = baseCharacterRepo.getByProject(id);
  if (!base) return NextResponse.json(null);
  const candidate = candidateRepo.get(base.candidate_id);
  return NextResponse.json({ ...base, candidate });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  candidateRepo.clearBase(id);
  candidateRepo.update(body.candidate_id, { is_base: true, status: 'selected' });

  const candidate = candidateRepo.get(body.candidate_id);
  const latestRevision = revisionRepo.getLatest(id);

  const base = baseCharacterRepo.create(
    id,
    body.candidate_id,
    body.summary || latestRevision?.prompt || '',
    latestRevision?.prompt || '',
  );

  projectRepo.update(id, { status: 'selecting' });
  return NextResponse.json(base, { status: 201 });
}
