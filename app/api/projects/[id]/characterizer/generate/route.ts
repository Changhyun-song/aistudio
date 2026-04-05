import { NextRequest, NextResponse } from 'next/server';
import { projectRepo, characterizerConfigRepo, characterizerShotRepo } from '@/lib/db/repository';
import { generateShotImage, isGeminiConfigured } from '@/lib/providers/gemini/gemini-image-provider';
import { generateAllShotPrompts } from '@/lib/characterizer/shot-prompt-engine';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as string;

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

  if (action === 'generate_all') {
    characterizerShotRepo.deleteByProject(id);
    const shotPrompts = generateAllShotPrompts(config);

    characterizerShotRepo.createBatch(
      shotPrompts.map(sp => ({
        projectId: id,
        shotKey: sp.shotKey,
        shotIndex: sp.shotIndex,
        label: sp.label,
        promptUsed: sp.prompt,
      }))
    );

    const shots = characterizerShotRepo.listByProject(id);
    const concurrency = parseInt(process.env.GEMINI_CONCURRENCY || '2', 10);

    const queue = [...shots];
    const results: { id: string; status: string; error?: string }[] = [];

    async function processShot(shot: typeof shots[0]) {
      try {
        characterizerShotRepo.update(shot.id, { status: 'generating' });
        const result = await generateShotImage(shot.prompt_used, config!.base_image_path, projectFolder, shot.shot_key);

        if (result.success) {
          characterizerShotRepo.update(shot.id, { file_path: result.publicPath, status: 'completed' });
          results.push({ id: shot.id, status: 'completed' });
        } else {
          characterizerShotRepo.update(shot.id, { status: 'failed', error_message: result.error || '' });
          results.push({ id: shot.id, status: 'failed', error: result.error });
        }
      } catch (err) {
        characterizerShotRepo.update(shot.id, { status: 'failed', error_message: (err as Error).message });
        results.push({ id: shot.id, status: 'failed', error: (err as Error).message });
      }
    }

    // Process with limited concurrency
    async function processBatch() {
      const active: Promise<void>[] = [];
      while (queue.length > 0) {
        while (active.length < concurrency && queue.length > 0) {
          const shot = queue.shift()!;
          const p = processShot(shot).then(() => {
            active.splice(active.indexOf(p), 1);
          });
          active.push(p);
        }
        if (active.length > 0) await Promise.race(active);
      }
      await Promise.all(active);
    }

    await processBatch();

    return NextResponse.json({
      shots: characterizerShotRepo.listByProject(id),
      summary: {
        total: shots.length,
        completed: results.filter(r => r.status === 'completed').length,
        failed: results.filter(r => r.status === 'failed').length,
      },
    });
  }

  if (action === 'regenerate_shot') {
    const shotId = body.shotId as string;
    if (!shotId) return NextResponse.json({ error: 'shotId required' }, { status: 400 });

    const shot = characterizerShotRepo.get(shotId);
    if (!shot) return NextResponse.json({ error: 'Shot not found' }, { status: 404 });

    try {
      characterizerShotRepo.update(shotId, { status: 'generating', error_message: '' });
      const result = await generateShotImage(shot.prompt_used, config.base_image_path, projectFolder, shot.shot_key);

      if (result.success) {
        const updated = characterizerShotRepo.update(shotId, { file_path: result.publicPath, status: 'completed' });
        return NextResponse.json(updated);
      } else {
        const updated = characterizerShotRepo.update(shotId, { status: 'failed', error_message: result.error || '' });
        return NextResponse.json(updated);
      }
    } catch (err) {
      const updated = characterizerShotRepo.update(shotId, { status: 'failed', error_message: (err as Error).message });
      return NextResponse.json(updated);
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
