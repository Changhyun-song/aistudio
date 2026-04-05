import { NextRequest, NextResponse } from 'next/server';
import { projectRepo, briefRepo, baseCharacterRepo, candidateRepo, variantRepo } from '@/lib/db/repository';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import type { DatasetMetadata } from '@/types';
import { TWENTY_SHOTS } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const brief = briefRepo.getByProject(id);
  const base = baseCharacterRepo.getByProject(id);
  const baseCandidate = base ? candidateRepo.get(base.candidate_id) : null;
  const variants = variantRepo.listByProject(id);
  const kept = variants.filter(v => v.status === 'keep' && (v.image_url || v.image_path));

  const metadata: DatasetMetadata = {
    character_name: brief?.name || project.name,
    concept: `${brief?.mood || ''} ${brief?.personality || ''} Korean high school character`.trim(),
    base_prompt: base?.base_prompt || '',
    base_image: baseCandidate?.image_url || baseCandidate?.image_path || '',
    total_images: kept.length,
    shots: kept.map(v => ({
      slot: v.slot,
      key: v.shot_key,
      label: v.label,
      image: v.image_url || v.image_path,
    })),
    notes: `Generated for Soul ID / Soul Cinema dataset. ${kept.length} images selected.`,
    created_at: new Date().toISOString(),
  };

  const promptsTxt = variants.map(v =>
    `[${v.slot}] ${v.label}\n${v.prompt}\nStatus: ${v.status}\n`
  ).join('\n---\n\n');

  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Uint8Array[] = [];
  archive.on('data', (chunk) => chunks.push(chunk));

  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
  archive.append(promptsTxt, { name: 'prompts.txt' });

  const publicDir = path.join(process.cwd(), 'public');

  if (baseCandidate?.image_path) {
    const absPath = path.join(publicDir, baseCandidate.image_path);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: `base/${path.basename(absPath)}` });
    }
  }

  for (const v of kept) {
    const imgPath = v.image_path;
    if (imgPath) {
      const absPath = path.join(publicDir, imgPath);
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: `images/${String(v.slot).padStart(2, '0')}_${v.shot_key}${path.extname(imgPath)}` });
      }
    }
  }

  await archive.finalize();
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${(project.name || 'dataset').replace(/[^a-zA-Z0-9]/g, '_')}_character.zip"; filename*=UTF-8''${encodeURIComponent(`${project.name || 'dataset'}_character.zip`)}`,
    },
  });
}
