import { NextRequest, NextResponse } from 'next/server';
import { projectRepo } from '@/lib/db/repository';

export async function GET() {
  return NextResponse.json(projectRepo.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const project = projectRepo.create(body.name || 'New Character', body.description || '', body.mode || 'midjourney_manual');
  return NextResponse.json(project, { status: 201 });
}
