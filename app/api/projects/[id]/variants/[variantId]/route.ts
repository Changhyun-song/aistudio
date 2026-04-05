import { NextRequest, NextResponse } from 'next/server';
import { variantRepo } from '@/lib/db/repository';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { variantId } = await params;
  const body = await req.json();
  return NextResponse.json(variantRepo.update(variantId, body));
}
