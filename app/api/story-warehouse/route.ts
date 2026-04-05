import { NextResponse } from 'next/server';
import { storyWarehouseRepo } from '@/lib/db/repository';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const items = q ? storyWarehouseRepo.search(q) : storyWarehouseRepo.list();
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = storyWarehouseRepo.create({
    title: body.title || 'Untitled',
    logline: body.logline || '',
    genre: body.genre || '',
    tone: body.tone || '',
    hook: body.hook || '',
    target_audience: body.target_audience || '',
    tags: JSON.stringify(body.tags || []),
    source: body.source || 'manual',
    status: body.status || 'idea',
    project_id: body.project_id || null,
    raw_json: JSON.stringify(body.raw_json || {}),
  });
  return NextResponse.json(item);
}
