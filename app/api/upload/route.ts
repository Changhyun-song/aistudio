import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { projectRepo } from '@/lib/db/repository';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('projectId') as string;
  const category = (formData.get('category') as string) || 'candidates';

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const project = projectId ? projectRepo.get(projectId) : null;
  const folderName = project
    ? project.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 50)
    : (projectId || 'general');

  const projectDir = path.join(UPLOAD_DIR, folderName, category);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const ext = path.extname(file.name) || '.png';
  const filename = `${nanoid(12)}${ext}`;
  const filepath = path.join(projectDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const publicPath = `/uploads/${folderName}/${category}/${filename}`;

  // Also copy to project local export folder
  const localExportDir = path.join(process.cwd(), 'output', folderName, category);
  if (!fs.existsSync(localExportDir)) {
    fs.mkdirSync(localExportDir, { recursive: true });
  }
  fs.copyFileSync(filepath, path.join(localExportDir, filename));

  return NextResponse.json({ path: publicPath, filename, folder: folderName });
}
