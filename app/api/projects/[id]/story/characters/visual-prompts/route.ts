import { NextRequest, NextResponse } from 'next/server';
import { storyCharacterRepo, characterVisualPromptRepo, storyBibleRepo, projectRepo, storyConceptRepo } from '@/lib/db/repository';
import { generateAllCharacterVisuals, generateCharacterVisualPrompts } from '@/lib/story/character-visual';
import type { GenreOverlay } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompts = characterVisualPromptRepo.listByProject(id);
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json();
  const { characterId, mode = 'batch' } = body;

  const bible = storyBibleRepo.getByProject(id);
  const worldContext = bible ? `${bible.title} — ${bible.genre}, ${bible.tone}. ${bible.world_rules}` : '';

  let overlay: GenreOverlay | undefined;
  try {
    const concept = storyConceptRepo.getByProject(id);
    if (concept?.genre_overlay_json) overlay = JSON.parse(concept.genre_overlay_json);
  } catch { /* ignore */ }

  if (mode === 'single' && characterId) {
    const char = storyCharacterRepo.get(characterId);
    if (!char) return NextResponse.json({ error: 'Character not found' }, { status: 404 });

    const result = await generateCharacterVisualPrompts(char, overlay, worldContext);
    const saved = characterVisualPromptRepo.upsert(id, char.id, {
      character_name: result.characterName,
      visual_brief: result.visualBrief,
      mj_base_prompt: result.mjBasePrompt,
      mj_portrait_prompt: result.mjPortraitPrompt,
      mj_full_body_prompt: result.mjFullBodyPrompt,
      mj_action_prompt: result.mjActionPrompt,
      mj_expression_sheet: result.mjExpressionSheet,
      negative_prompts: result.negativePrompts,
      style_keywords: result.styleKeywords,
      raw_json: JSON.stringify(result),
      status: 'generated',
    });
    return NextResponse.json(saved);
  }

  const characters = storyCharacterRepo.list(id);
  if (characters.length === 0) {
    return NextResponse.json({ error: 'No characters found' }, { status: 400 });
  }

  const targetChars = characters.filter(c =>
    c.role?.toLowerCase().includes('main') || c.role?.toLowerCase().includes('메인') ||
    c.role?.toLowerCase().includes('support') || c.role?.toLowerCase().includes('조연') ||
    c.role?.toLowerCase().includes('주인공') || c.role?.toLowerCase().includes('protagonist')
  );
  const charsToProcess = targetChars.length > 0 ? targetChars : characters;

  const results = await generateAllCharacterVisuals(charsToProcess, overlay, worldContext);

  const saved = results.map(r => characterVisualPromptRepo.upsert(id, r.characterId, {
    character_name: r.characterName,
    visual_brief: r.visualBrief,
    mj_base_prompt: r.mjBasePrompt,
    mj_portrait_prompt: r.mjPortraitPrompt,
    mj_full_body_prompt: r.mjFullBodyPrompt,
    mj_action_prompt: r.mjActionPrompt,
    mj_expression_sheet: r.mjExpressionSheet,
    negative_prompts: r.negativePrompts,
    style_keywords: r.styleKeywords,
    raw_json: JSON.stringify(r),
    status: 'generated',
  }));

  return NextResponse.json({ count: saved.length, prompts: saved });
}
