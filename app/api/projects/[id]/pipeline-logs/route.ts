import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { logs, stage } = await req.json();

  const logsDir = path.join(process.cwd(), 'data', 'pipeline-logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pipeline_${id}_${timestamp}.json`;
  const filepath = path.join(logsDir, filename);

  const textLogs = logs.map((l: { timestamp: number; type: string; stage: string; message: string }) => {
    const time = new Date(l.timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const icons: Record<string, string> = { success: '✓', warn: '⚠', error: '✗', score: '★', info: '→' };
    return `${time} ${icons[l.type] || '→'} [${l.stage}] ${l.message}`;
  }).join('\n');

  const output = {
    projectId: id,
    pipelineStage: stage,
    createdAt: new Date().toISOString(),
    totalLogs: logs.length,
    textLog: textLogs,
    rawLogs: logs,
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf-8');

  return NextResponse.json({ saved: true, filename });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const logsDir = path.join(process.cwd(), 'data', 'pipeline-logs');

  if (!fs.existsSync(logsDir)) {
    return NextResponse.json({ logs: [] });
  }

  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith(`pipeline_${id}_`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return NextResponse.json({ logs: [] });
  }

  const latest = JSON.parse(fs.readFileSync(path.join(logsDir, files[0]), 'utf-8'));
  return NextResponse.json(latest);
}
