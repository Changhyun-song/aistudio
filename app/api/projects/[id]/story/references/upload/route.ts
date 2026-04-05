import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { referenceSourceRepo, projectRepo } from '@/lib/db/repository';
import type { ReferenceSourceType } from '@/types';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

function extractTextFromFile(buffer: Buffer, ext: string): string {
  const textExts = ['.txt', '.md', '.srt', '.vtt'];
  if (textExts.includes(ext)) {
    return buffer.toString('utf-8');
  }
  return '';
}

function inferType(ext: string, mime: string): ReferenceSourceType {
  if (['.srt', '.vtt'].includes(ext)) return 'subtitle';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return 'image';
  return 'file';
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || '';
  const tagsJson = (formData.get('tags_json') as string) || '[]';
  const userNote = (formData.get('user_note') as string) || '';

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const folderName = project.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 50);
  const projectDir = path.join(UPLOAD_DIR, folderName, 'references');
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  const ext = path.extname(file.name).toLowerCase() || '.txt';
  const filename = `${nanoid(12)}${ext}`;
  const filepath = path.join(projectDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const publicPath = `/uploads/${folderName}/references/${filename}`;
  const rawText = extractTextFromFile(buffer, ext);
  const type = inferType(ext, file.type);

  const source = referenceSourceRepo.create(id, {
    type,
    title: title || file.name,
    rawText,
    filePath: publicPath,
    tagsJson,
    userNote,
  });

  return NextResponse.json(source, { status: 201 });
}
