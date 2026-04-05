import { NextRequest, NextResponse } from 'next/server';
import { autoFillFromIdea } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';

export async function POST(req: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  }

  const { raw_idea } = await req.json();
  if (!raw_idea?.trim()) {
    return NextResponse.json({ error: 'raw_idea required' }, { status: 400 });
  }

  try {
    const result = await autoFillFromIdea(raw_idea.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
