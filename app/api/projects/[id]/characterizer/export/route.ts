import { NextRequest, NextResponse } from 'next/server';
import { projectRepo, characterizerConfigRepo, characterizerShotRepo, characterizerAnchorRepo } from '@/lib/db/repository';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const config = characterizerConfigRepo.getByProject(id);
  const anchors = characterizerAnchorRepo.listByProject(id);
  const shots = characterizerShotRepo.listByProject(id);
  const includeAll = new URL(_req.url).searchParams.get('all') === '1';
  const kept = includeAll
    ? shots.filter(s => s.status === 'completed' && s.file_path && s.selection_state !== 'reject')
    : shots.filter(s => s.selection_state === 'keep' && s.file_path);

  const metadata = {
    character_name: config?.character_name || project.name,
    mode: 'characterizer_40',
    provider: 'nano_banana_2',
    provider_model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation',
    base_image: config?.base_image_path || '',
    signature_item: config?.signature_item || '',
    signature_color: config?.signature_color || '',
    total_shots: 40,
    kept_shots: kept.length,
    shots: kept.map(s => ({
      index: s.shot_index,
      key: s.shot_key,
      label: s.label,
      file: `shots/${s.shot_key}.png`,
    })),
    anchors: anchors.filter(a => a.status === 'completed').map(a => ({
      key: a.anchor_key,
      label: a.label,
      file: `anchors/${a.anchor_key}.png`,
    })),
    created_at: new Date().toISOString(),
  };

  const promptsTxt = shots.map(s =>
    `[${String(s.shot_index).padStart(2, '0')}] ${s.label}\nStatus: ${s.status} | Selection: ${s.selection_state}\n${s.prompt_used}\n`
  ).join('\n---\n\n');

  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Uint8Array[] = [];
  archive.on('data', (chunk) => chunks.push(chunk));

  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
  archive.append(promptsTxt, { name: 'prompts.txt' });

  const publicDir = path.join(process.cwd(), 'public');

  for (const anchor of anchors) {
    if (anchor.file_path && anchor.status === 'completed') {
      const absPath = path.join(publicDir, anchor.file_path);
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: `anchors/${anchor.anchor_key}${path.extname(absPath)}` });
      }
    }
  }

  for (const shot of kept) {
    if (shot.file_path) {
      const absPath = path.join(publicDir, shot.file_path);
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: `shots/${shot.shot_key}${path.extname(absPath)}` });
      }
    }
  }

  await archive.finalize();
  const buffer = Buffer.concat(chunks);

  const safeName = (project.name || 'character').replace(/[^a-zA-Z0-9]/g, '_');
  const encodedName = encodeURIComponent(`${project.name || 'character'}_characterizer40.zip`);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}_characterizer40.zip"; filename*=UTF-8''${encodedName}`,
    },
  });
}
