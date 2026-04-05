import { NextRequest, NextResponse } from 'next/server';
import { storyCharacterRepo, projectRepo } from '@/lib/db/repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chars = storyCharacterRepo.list(id);
  return NextResponse.json(chars);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json();
  const char = storyCharacterRepo.create(id, {
    name: body.name || '',
    role: body.role || '',
    traits: body.traits || '',
    signature_item: body.signature_item || '',
    signature_color: body.signature_color || '',
    speech_style: body.speech_style || '',
    emotional_weakness: body.emotional_weakness || '',
    power_or_specialty: body.power_or_specialty || '',
  });
  return NextResponse.json(char, { status: 201 });
}
