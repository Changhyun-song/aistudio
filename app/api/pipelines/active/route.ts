import { NextResponse } from 'next/server';
import { pipelineRunRepo } from '@/lib/db/repository';

export async function GET() {
  const summaries = pipelineRunRepo.listAllLatest();
  return NextResponse.json(summaries);
}
