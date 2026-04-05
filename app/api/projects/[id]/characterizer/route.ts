import { NextRequest, NextResponse } from 'next/server';
import { projectRepo, characterizerConfigRepo, characterizerAnchorRepo, storyCharacterRepo, characterVisualPromptRepo } from '@/lib/db/repository';
import { generateAnchorShot, isGeminiConfigured } from '@/lib/providers/gemini/gemini-image-provider';
import { generateAllAnchorPrompts } from '@/lib/characterizer/shot-prompt-engine';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const config = characterizerConfigRepo.getByProject(id);
  const anchors = characterizerAnchorRepo.listByProject(id);
  const storyCharacters = storyCharacterRepo.list(id);
  const visualPrompts = characterVisualPromptRepo.listByProject(id);
  return NextResponse.json({
    config: config || null,
    anchors,
    geminiConfigured: isGeminiConfigured(),
    storyCharacters,
    visualPrompts,
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const config = characterizerConfigRepo.upsert(id, body);
  return NextResponse.json(config);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as string;

  if (action === 'sync_character') {
    const charId = body.characterId as string;
    if (!charId) return NextResponse.json({ error: 'characterId required' }, { status: 400 });
    const char = storyCharacterRepo.get(charId);
    if (!char) return NextResponse.json({ error: 'Character not found' }, { status: 404 });

    const existingConfig = characterizerConfigRepo.getByProject(id);
    const config = characterizerConfigRepo.upsert(id, {
      character_name: char.name,
      signature_item: char.signature_item || '',
      signature_color: char.signature_color || '',
      base_image_path: existingConfig?.base_image_path || '',
    });
    return NextResponse.json(config);
  }

  if (action === 'generate_anchors') {
    const project = projectRepo.get(id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const config = characterizerConfigRepo.getByProject(id);
    if (!config || !config.base_image_path) {
      return NextResponse.json({ error: 'Config or base image not set' }, { status: 400 });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
    }

    const projectFolder = project.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 50);
    const anchorPrompts = generateAllAnchorPrompts(config);

    characterizerAnchorRepo.deleteByProject(id);
    const results = [];

    for (const ap of anchorPrompts) {
      const anchor = characterizerAnchorRepo.create(id, ap.anchorKey, ap.label, ap.prompt);

      try {
        characterizerAnchorRepo.update(anchor.id, { status: 'generating' });
        const result = await generateAnchorShot(ap.prompt, config.base_image_path, projectFolder, ap.anchorKey);

        if (result.success) {
          characterizerAnchorRepo.update(anchor.id, { file_path: result.publicPath, status: 'completed' });
          results.push({ ...anchor, file_path: result.publicPath, status: 'completed' });
        } else {
          characterizerAnchorRepo.update(anchor.id, { status: 'failed' });
          results.push({ ...anchor, status: 'failed', error: result.error });
        }
      } catch (err) {
        characterizerAnchorRepo.update(anchor.id, { status: 'failed' });
        results.push({ ...anchor, status: 'failed', error: (err as Error).message });
      }
    }

    return NextResponse.json({ anchors: characterizerAnchorRepo.listByProject(id), results });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
