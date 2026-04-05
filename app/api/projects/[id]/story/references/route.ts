import { NextRequest, NextResponse } from 'next/server';
import { referenceSourceRepo, projectRepo } from '@/lib/db/repository';
import type { ReferenceSourceType } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(referenceSourceRepo.list(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json();
  const source = referenceSourceRepo.create(id, {
    type: (body.type || 'text') as ReferenceSourceType,
    title: body.title || 'Untitled',
    rawText: body.raw_text || '',
    filePath: body.file_path || '',
    sourceUrl: body.source_url || '',
    tagsJson: body.tags_json || '[]',
    userNote: body.user_note || '',
  });
  return NextResponse.json(source, { status: 201 });
}
