import { NextRequest, NextResponse } from 'next/server';
import {
  projectRepo, storyBibleRepo, storyEpisodeArcRepo,
  storyEpisodeScriptRepo, storyClipPacketRepo, storyCharacterRepo,
} from '@/lib/db/repository';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const epParam = req.nextUrl.searchParams.get('episode');
  const format = req.nextUrl.searchParams.get('format') || 'zip';

  const bible = storyBibleRepo.getByProject(id);
  const arcs = storyEpisodeArcRepo.listByProject(id);
  const characters = storyCharacterRepo.list(id);

  // Single-episode export
  if (epParam && format !== 'zip') {
    const epNum = parseInt(epParam, 10);
    const clips = storyClipPacketRepo.listByEpisode(id, epNum);
    const packets = clips.map(c => { try { return JSON.parse(c.packet_json); } catch { return c; } });

    if (format === 'json') {
      return NextResponse.json(packets);
    }
    if (format === 'txt') {
      const txt = packets.map((p: Record<string, unknown>, i: number) =>
        `[Clip ${i + 1}] ${p.startTime}-${p.endTime} (${p.durationSec}s)\nShot: ${p.shotType} | Camera: ${p.cameraMovement} | Speed: ${p.speedRamp}\nCharacters: ${(p.characterIds as string[])?.join(', ')}\nBlocking: ${p.characterBlocking}\nExpression: ${p.expressionDirection}\nDialogue: ${p.dialogue || '(none)'}\nPrompt: ${p.higgsfieldPrompt}\n`
      ).join('\n---\n\n');
      return new NextResponse(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (format === 'md') {
      const md = `# Episode ${epNum} — Clip Packets\n\n` + packets.map((p: Record<string, unknown>, i: number) =>
        `## Clip ${i + 1} (${p.startTime}–${p.endTime}, ${p.durationSec}s)\n\n| Field | Value |\n|---|---|\n| Shot Type | ${p.shotType} |\n| Camera | ${p.cameraMovement} |\n| Speed | ${p.speedRamp} |\n| Characters | ${(p.characterIds as string[])?.join(', ')} |\n| Blocking | ${p.characterBlocking} |\n| Expression | ${p.expressionDirection} |\n| Dialogue | ${p.dialogue || '—'} |\n\n**Higgsfield Prompt:**\n> ${p.higgsfieldPrompt}\n`
      ).join('\n---\n\n');
      return new NextResponse(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
    }
  }

  // Full ZIP export
  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(passthrough);

  // metadata
  archive.append(JSON.stringify({
    project: project.name,
    mode: 'story_studio',
    exportedAt: new Date().toISOString(),
    episodeCount: arcs.length,
    characterCount: characters.length,
  }, null, 2), { name: 'metadata.json' });

  // characters
  archive.append(JSON.stringify(characters, null, 2), { name: 'characters.json' });

  // bible
  if (bible) {
    let parsed: unknown = {};
    try { parsed = JSON.parse(bible.raw_json); } catch { /* empty */ }
    archive.append(JSON.stringify(parsed, null, 2), { name: 'series_bible.json' });
  }

  // season plan
  archive.append(JSON.stringify(arcs.map(a => { try { return JSON.parse(a.raw_json); } catch { return a; } }), null, 2), { name: 'season_plan.json' });

  // per-episode
  for (const arc of arcs) {
    const ep = arc.episode_number;
    const prefix = `episodes/ep${String(ep).padStart(2, '0')}`;

    archive.append(JSON.stringify({ ...arc }, null, 2), { name: `${prefix}/arc.json` });

    const script = storyEpisodeScriptRepo.getByEpisode(id, ep);
    if (script) {
      archive.append(script.markdown || '', { name: `${prefix}/script.md` });
      archive.append(script.scenes_json || '[]', { name: `${prefix}/scenes.json` });
    }

    const clips = storyClipPacketRepo.listByEpisode(id, ep);
    if (clips.length) {
      const packets = clips.map(c => { try { return JSON.parse(c.packet_json); } catch { return c; } });
      archive.append(JSON.stringify(packets, null, 2), { name: `${prefix}/clips.json` });

      const promptsTxt = packets.map((p: Record<string, unknown>, i: number) =>
        `[Clip ${i + 1}] ${p.startTime}-${p.endTime} (${p.durationSec}s)\n${p.higgsfieldPrompt}`
      ).join('\n\n');
      archive.append(promptsTxt, { name: `${prefix}/prompts.txt` });
    }
  }

  await archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  const safeName = (project.name || 'story').replace(/[^a-zA-Z0-9]/g, '_');
  const encodedName = encodeURIComponent(`${project.name || 'story'}_story_studio.zip`);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}_story_studio.zip"; filename*=UTF-8''${encodedName}`,
    },
  });
}
