import { NextRequest, NextResponse } from 'next/server';
import { referenceSynthesisRepo, storyConceptRepo, storyInputBridgeRepo } from '@/lib/db/repository';
import { buildStoryInput, buildStoryInputMarkdown } from '@/lib/ai/reference-lab';
import { isAIConfigured } from '@/lib/ai';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bridge = storyInputBridgeRepo.getByProject(id);
  return NextResponse.json(bridge ?? null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'full';
  const action = body.action || 'build_and_send';

  const synthesis = referenceSynthesisRepo.getByProject(id);
  if (!synthesis) return NextResponse.json({ error: 'No synthesis found. Generate a synthesis first.' }, { status: 400 });

  let structured: Record<string, unknown> = {};
  try { structured = JSON.parse(synthesis.structured_json); } catch { /* empty */ }

  if (action === 'build') {
    if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
      const storyInput = await buildStoryInput(structured, body.user_concept || '');
      const bridge = storyInputBridgeRepo.create(id, {
        referenceSynthesisId: synthesis.id,
        promptReadySummary: String(storyInput.promptReadySummary || ''),
        structuredJson: JSON.stringify(storyInput),
      });
      return NextResponse.json({ bridge, storyInput });
    } catch (err: unknown) {
      return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
    }
  }

  // build_and_send: use existing bridge or create new one, then send to concept
  if (action === 'build_and_send') {
    let storyInput: Record<string, unknown>;
    const existingBridge = storyInputBridgeRepo.getByProject(id);

    if (existingBridge?.structured_json) {
      try { storyInput = JSON.parse(existingBridge.structured_json); } catch { storyInput = structured; }
    } else if (isAIConfigured()) {
      try {
        storyInput = await buildStoryInput(structured, body.user_concept || '');
        storyInputBridgeRepo.create(id, {
          referenceSynthesisId: synthesis.id,
          promptReadySummary: String(storyInput.promptReadySummary || ''),
          structuredJson: JSON.stringify(storyInput),
        });
      } catch {
        storyInput = structured;
      }
    } else {
      storyInput = structured;
    }

    const inspirationText = buildStoryInputMarkdown(storyInput, mode);

    const existing = storyConceptRepo.getByProject(id);
    const newInput = existing?.raw_input
      ? `${existing.raw_input}\n\n${inspirationText}`
      : inspirationText;

    const concept = storyConceptRepo.upsert(id, {
      raw_input: newInput,
      approved_json: JSON.stringify(storyInput),
    });

    return NextResponse.json({ concept, inspirationText, storyInput });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
