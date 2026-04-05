import { NextRequest, NextResponse } from 'next/server';
import { storyCharacterRepo } from '@/lib/db/repository';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; charId: string }> }) {
  const { charId } = await params;
  const body = await req.json();
  const existing = storyCharacterRepo.get(charId);
  if (!existing) return NextResponse.json({ error: 'Character not found' }, { status: 404 });

  const updated = storyCharacterRepo.update(charId, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; charId: string }> }) {
  const { charId } = await params;
  storyCharacterRepo.delete(charId);
  return NextResponse.json({ ok: true });
}
