import { NextRequest, NextResponse } from 'next/server';
import { storyConceptRepo, storyCharacterRepo, projectRepo, referenceSynthesisRepo, storyInputBridgeRepo, characterizerConfigRepo, characterVisualPromptRepo } from '@/lib/db/repository';
import { generateStoryConcept, reviseStoryConcept, extractCharactersFromConcept } from '@/lib/story';
import { generateCharacterVisualPrompts } from '@/lib/story/character-visual';
import { isAIConfigured } from '@/lib/ai';
import { buildStoryInputMarkdown } from '@/lib/ai/reference-lab';
import type { GenreOverlay, StoryCharacter } from '@/types';

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

async function syncCharacterToCharacterizer(projectId: string) {
  try {
    const chars = storyCharacterRepo.list(projectId);
    if (chars.length === 0) return;

    const mainChar = chars.find(c => c.role?.includes('메인')) || chars[0];

    const existingConfig = characterizerConfigRepo.getByProject(projectId);
    if (existingConfig?.base_image_path) return;

    characterizerConfigRepo.upsert(projectId, {
      character_name: mainChar.name,
      signature_item: mainChar.signature_item || '',
      signature_color: mainChar.signature_color || '',
      tone_keywords: '',
    });

    await generateBasePortraitForCharacters(projectId, chars);
  } catch { /* non-critical */ }
}

async function generateBasePortraitForCharacters(projectId: string, chars: StoryCharacter[]) {
  try {
    const project = projectRepo.get(projectId);
    let genreOverlay: GenreOverlay | undefined;
    try {
      const concept = storyConceptRepo.getByProject(projectId);
      if (concept?.genre_overlay_json) genreOverlay = JSON.parse(concept.genre_overlay_json);
    } catch { /* empty */ }

    for (const char of chars) {
      const existing = characterVisualPromptRepo.getByCharacter(char.id);
      if (existing?.mj_base_prompt) continue;

      const result = await generateCharacterVisualPrompts(char, genreOverlay);
      characterVisualPromptRepo.upsert(projectId, char.id, {
        character_name: char.name,
        visual_brief: result.visualBrief,
        mj_base_prompt: result.mjBasePrompt,
        mj_portrait_prompt: result.mjPortraitPrompt,
        mj_full_body_prompt: result.mjFullBodyPrompt,
        mj_action_prompt: result.mjActionPrompt,
        mj_expression_sheet: result.mjExpressionSheet,
        negative_prompts: result.negativePrompts,
        style_keywords: result.styleKeywords,
      });
    }
  } catch (err) {
    console.error('[AutoVisualPrompt]', (err as Error).message);
  }
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
      syncCharacterToCharacterizer(id).catch(() => {});
      return NextResponse.json(updated);
    }

    if (action === 'extract_characters') {
      const existing = storyConceptRepo.getByProject(id);
      if (!existing?.approved_markdown) return NextResponse.json({ error: 'No concept to extract from' }, { status: 400 });
      await autoExtractCharacters(id, existing.approved_markdown);
      syncCharacterToCharacterizer(id).catch(() => {});
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
    syncCharacterToCharacterizer(id).catch(() => {});

    return NextResponse.json(concept);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
