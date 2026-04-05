import { NextRequest, NextResponse } from 'next/server';
import { storyCharacterRepo, characterVisualPromptRepo, storyConceptRepo } from '@/lib/db/repository';
import { generateCharacterVisualPrompts } from '@/lib/story/character-visual';
import type { GenreOverlay } from '@/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; charId: string }> }) {
  const { id, charId } = await params;
  const body = await req.json();
  const existing = storyCharacterRepo.get(charId);
  if (!existing) return NextResponse.json({ error: 'Character not found' }, { status: 404 });

  const updated = storyCharacterRepo.update(charId, body);

  const nameChanged = body.name && body.name !== existing.name;
  const traitsChanged = body.traits && body.traits !== existing.traits;
  const itemChanged = body.signature_item !== undefined && body.signature_item !== existing.signature_item;

  if (nameChanged || traitsChanged || itemChanged) {
    (async () => {
      try {
        let overlay: GenreOverlay | undefined;
        try {
          const concept = storyConceptRepo.getByProject(id);
          if (concept?.genre_overlay_json) overlay = JSON.parse(concept.genre_overlay_json);
        } catch { /* empty */ }

        const result = await generateCharacterVisualPrompts(updated, overlay);
        characterVisualPromptRepo.upsert(id, charId, {
          character_name: result.characterName,
          visual_brief: result.visualBrief,
          mj_base_prompt: result.mjBasePrompt,
          mj_portrait_prompt: result.mjPortraitPrompt,
          mj_full_body_prompt: result.mjFullBodyPrompt,
          mj_action_prompt: result.mjActionPrompt,
          mj_expression_sheet: result.mjExpressionSheet,
          negative_prompts: result.negativePrompts,
          style_keywords: result.styleKeywords,
        });
      } catch { /* non-critical */ }
    })();
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; charId: string }> }) {
  const { charId } = await params;
  characterVisualPromptRepo.deleteByCharacter(charId);
  storyCharacterRepo.delete(charId);
  return NextResponse.json({ ok: true });
}
