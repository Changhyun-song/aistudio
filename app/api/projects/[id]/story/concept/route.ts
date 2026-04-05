import { NextRequest, NextResponse } from 'next/server';
import { storyConceptRepo, storyCharacterRepo, projectRepo, referenceSynthesisRepo, storyInputBridgeRepo } from '@/lib/db/repository';
import { generateStoryConcept, reviseStoryConcept, extractCharactersFromConcept } from '@/lib/story';
import { isAIConfigured } from '@/lib/ai';
import { buildStoryInputMarkdown } from '@/lib/ai/reference-lab';
import type { GenreOverlay } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const concept = storyConceptRepo.getByProject(id);
  return NextResponse.json(concept ?? null);
}

function parseOverlay(raw: unknown): GenreOverlay | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.genre_stack) || o.genre_stack.length === 0) return undefined;
  return raw as GenreOverlay;
}

async function autoExtractCharacters(projectId: string, conceptMarkdown: string) {
  try {
    const extracted = await extractCharactersFromConcept(conceptMarkdown);
    if (extracted.length > 0) {
      storyCharacterRepo.replaceBatch(
        projectId,
        extracted.map(c => {
          const roleLabel = c.is_main
            ? `메인 (${c.archetype || c.team_role || c.role_type || ''})`
            : `조연 (${c.axis || c.role_type || c.role || ''})`;

          const traitParts = [
            c.first_impression ? `첫인상: ${c.first_impression}` : '',
            c.real_personality ? `실제: ${c.real_personality}` : '',
            c.traits,
            c.desire ? `욕망: ${c.desire}` : '',
            c.secret ? `비밀: ${c.secret}` : '',
            c.emotion_arc ? `감정아크: ${c.emotion_arc}` : '',
            c.relationship_conflict ? `갈등: ${c.relationship_conflict}` : '',
            c.narrative_function ? `서사기능: ${c.narrative_function}` : '',
            c.relationship_to_main ? `관계: ${c.relationship_to_main}` : '',
            c.romance ? `로맨스: ${c.romance}` : '',
            c.hidden_role ? `숨겨진 역할: ${c.hidden_role}` : '',
            c.gender_presentation ? `성별: ${c.gender_presentation}` : '',
            c.age_range ? `나이: ${c.age_range}` : '',
          ].filter(Boolean).join(' | ');

          const powerParts = [
            c.power_or_specialty,
            c.power_activation ? `발동: ${c.power_activation}` : '',
            c.power_cost ? `대가: ${c.power_cost}` : '',
            c.power_visual ? `연출: ${c.power_visual}` : '',
            c.appearance_power_link ? `외형연결: ${c.appearance_power_link}` : '',
          ].filter(Boolean).join(' | ');

          return {
            name: c.name,
            role: roleLabel,
            traits: traitParts,
            signature_item: c.visual_symbol || c.signature_item || '',
            signature_color: c.signature_color || '',
            speech_style: c.speech_style || '',
            emotional_weakness: c.emotional_weakness || '',
            power_or_specialty: powerParts,
          };
        })
      );
    }
  } catch { /* non-critical */ }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!isAIConfigured()) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const body = await req.json();
  const action = body.action || 'generate';
  const genreOverlay = parseOverlay(body.genre_overlay);

  const characters = storyCharacterRepo.list(id);

  try {
    if (action === 'revise') {
      const existing = storyConceptRepo.getByProject(id);
      const existingMarkdown = existing?.approved_markdown || '';
      if (!existingMarkdown) return NextResponse.json({ error: 'No existing concept to revise' }, { status: 400 });

      let existingOverlay: GenreOverlay | undefined;
      try { existingOverlay = JSON.parse(existing?.genre_overlay_json || '{}'); } catch { /* empty */ }

      const revised = await reviseStoryConcept(existingMarkdown, body.feedback || '', genreOverlay || existingOverlay, id);

      // Never overwrite with empty content
      const finalMarkdown = (revised && revised.trim().length > 100) ? revised : existingMarkdown;

      const updated = storyConceptRepo.upsert(id, {
        approved_markdown: finalMarkdown,
        version: (existing?.version || 0) + 1,
      });

      await autoExtractCharacters(id, finalMarkdown);
      return NextResponse.json(updated);
    }

    if (action === 'extract_characters') {
      const existing = storyConceptRepo.getByProject(id);
      if (!existing?.approved_markdown) return NextResponse.json({ error: 'No concept to extract from' }, { status: 400 });
      await autoExtractCharacters(id, existing.approved_markdown);
      const chars = storyCharacterRepo.list(id);
      return NextResponse.json({ characters: chars });
    }

    let referenceSynthesisText = '';
    const bridge = storyInputBridgeRepo.getByProject(id);
    if (bridge?.structured_json) {
      try {
        const storyInput = JSON.parse(bridge.structured_json);
        referenceSynthesisText = buildStoryInputMarkdown(storyInput, 'full');
      } catch { /* empty */ }
    } else {
      const synthesis = referenceSynthesisRepo.getByProject(id);
      if (synthesis?.structured_json) {
        try {
          const structured = JSON.parse(synthesis.structured_json);
          referenceSynthesisText = buildStoryInputMarkdown(structured, 'full');
        } catch { /* empty */ }
      }
    }

    const rawIdea = body.raw_input || body.rawIdea || '';
    const enrichedIdea = referenceSynthesisText
      ? `${rawIdea}\n\n${referenceSynthesisText}`
      : rawIdea;

    const result = await generateStoryConcept({
      rawIdea: enrichedIdea,
      genre: body.genre || '',
      tone: body.tone || '',
      worldKeywords: body.world_keywords || '',
      romanceLevel: body.romance_level || 'medium',
      mysteryLevel: body.mystery_level || 'medium',
      actionLevel: body.action_level || 'medium',
      endingMood: body.ending_mood || '',
      targetAudience: body.target_audience || '',
      characters,
      genreOverlay,
    }, id);

    if (!result || result.trim().length < 100) {
      return NextResponse.json({ error: 'AI returned empty or too short result. Please retry.' }, { status: 500 });
    }

    const concept = storyConceptRepo.upsert(id, {
      raw_input: body.raw_input || body.rawIdea || '',
      genre: body.genre || '',
      tone: body.tone || '',
      world_keywords: body.world_keywords || '',
      romance_level: body.romance_level || 'medium',
      mystery_level: body.mystery_level || 'medium',
      action_level: body.action_level || 'medium',
      ending_mood: body.ending_mood || '',
      target_audience: body.target_audience || '',
      genre_overlay_json: genreOverlay ? JSON.stringify(genreOverlay) : '{}',
      approved_markdown: result,
      approved_json: '{}',
      version: 1,
    });

    await autoExtractCharacters(id, result);

    return NextResponse.json(concept);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
