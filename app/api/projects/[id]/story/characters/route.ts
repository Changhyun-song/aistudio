import { NextRequest, NextResponse } from 'next/server';
import { storyCharacterRepo, projectRepo, characterVisualPromptRepo, storyConceptRepo } from '@/lib/db/repository';
import { generateCharacterVisualPrompts } from '@/lib/story/character-visual';
import type { GenreOverlay, StoryCharacter } from '@/types';

async function autoGenerateVisualPrompt(projectId: string, char: StoryCharacter) {
  try {
    const existing = characterVisualPromptRepo.getByCharacter(char.id);
    if (existing?.mj_base_prompt) return;

    let genreOverlay: GenreOverlay | undefined;
    try {
      const concept = storyConceptRepo.getByProject(projectId);
      if (concept?.genre_overlay_json) genreOverlay = JSON.parse(concept.genre_overlay_json);
    } catch { /* empty */ }

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
  } catch { /* non-critical background task */ }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chars = storyCharacterRepo.list(id);
  return NextResponse.json(chars);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepo.get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json();
  const char = storyCharacterRepo.create(id, {
    name: body.name || '',
    role: body.role || '',
    traits: body.traits || '',
    signature_item: body.signature_item || '',
    signature_color: body.signature_color || '',
    speech_style: body.speech_style || '',
    emotional_weakness: body.emotional_weakness || '',
    power_or_specialty: body.power_or_specialty || '',
  });

  autoGenerateVisualPrompt(id, char).catch(() => {});

  return NextResponse.json(char, { status: 201 });
}
