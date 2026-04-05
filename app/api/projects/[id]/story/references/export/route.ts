import { NextRequest, NextResponse } from 'next/server';
import { referenceSourceRepo, referenceAnalysisRepo, referenceSynthesisRepo } from '@/lib/db/repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') || 'json';
  const section = req.nextUrl.searchParams.get('section') || 'all';

  const sources = referenceSourceRepo.list(id);
  const analyses = referenceAnalysisRepo.listByProject(id);
  const synthesis = referenceSynthesisRepo.getByProject(id);

  if (format === 'json') {
    const data: Record<string, unknown> = {};
    if (section === 'all' || section === 'sources') data.sources = sources;
    if (section === 'all' || section === 'analyses') data.analyses = analyses;
    if (section === 'all' || section === 'synthesis') data.synthesis = synthesis;
    return NextResponse.json(data);
  }

  if (format === 'md') {
    let md = '# Reference Lab Export\n\n';

    if (section === 'all' || section === 'sources') {
      md += '## Sources\n\n';
      for (const s of sources) {
        md += `### ${s.title}\n- Type: ${s.type}\n- Tags: ${s.tags_json}\n- Note: ${s.user_note}\n\n`;
        if (s.raw_text) md += `${s.raw_text.slice(0, 2000)}\n\n---\n\n`;
      }
    }

    if (section === 'all' || section === 'analyses') {
      md += '## Analyses\n\n';
      for (const a of analyses) {
        md += `### Source Analysis (${a.source_id})\n`;
        md += `- Genre: ${a.genre}\n- Tone: ${a.tone}\n- Themes: ${a.themes_json}\n`;
        md += `- Characters: ${a.character_types_json}\n- Relationships: ${a.relationship_dynamics_json}\n`;
        md += `- Mystery: ${a.mystery_elements_json}\n- Visual: ${a.visual_motifs_json}\n`;
        md += `- Pacing: ${a.pacing_notes}\n- Romance: ${a.romance_pattern}\n- Twist: ${a.twist_pattern}\n`;
        md += `- Avoid: ${a.avoid_cliches_json}\n\n---\n\n`;
      }
    }

    if (section === 'all' || section === 'synthesis') {
      md += '## Synthesis\n\n';
      if (synthesis) md += `${synthesis.summary_markdown}\n\n`;
    }

    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="reference-lab-export.md"`,
      },
    });
  }

  if (format === 'txt') {
    let txt = 'Reference Lab Export\n' + '='.repeat(50) + '\n\n';

    if (synthesis) {
      txt += 'SYNTHESIS\n' + '-'.repeat(30) + '\n';
      txt += synthesis.summary_markdown + '\n\n';
      try {
        const s = JSON.parse(synthesis.structured_json);
        for (const [k, v] of Object.entries(s)) {
          txt += `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}\n`;
        }
      } catch { /* empty */ }
    }

    return new NextResponse(txt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="reference-lab-export.txt"`,
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
