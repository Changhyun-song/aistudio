import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'docs', 'ai-prompts');

const cache = new Map<string, string>();

export function loadSystemPrompt(filename: string): string {
  if (cache.has(filename)) return cache.get(filename)!;
  const filePath = path.join(PROMPTS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  cache.set(filename, content);
  return content;
}

function withSupplement(base: string, supplement?: string): string {
  if (!supplement?.trim()) return base;
  return `${base}\n\n---\n\n# ★ 프로젝트별 보충 규칙 (Prompt Optimizer가 학습하여 추가한 규칙)\n\n${supplement}`;
}

// ── Generators ────────────────────────────────────────
export function getStoryArchitectPrompt(supplement?: string): string {
  return withSupplement(loadSystemPrompt('AI_1_Story_Architect.md'), supplement);
}

export function getScreenplayDirectorPrompt(supplement?: string): string {
  return withSupplement(loadSystemPrompt('AI_2_Screenplay_Director.md'), supplement);
}

export function getFrameVideoPromptDesignerPrompt(supplement?: string): string {
  return withSupplement(loadSystemPrompt('AI_3_Frame_Video_Prompt_Designer.md'), supplement);
}

// ── Stage-specific Evaluators ─────────────────────────
export function getEvaluatorPrompt(stage?: string): string {
  switch (stage) {
    case 'story_architect':
    case 'concept':
      return loadSystemPrompt('AI_Evaluator_Story.md');
    case 'screenplay_director':
    case 'season':
    case 'script':
      return loadSystemPrompt('AI_Evaluator_Screenplay.md');
    case 'frame_video_designer':
    case 'clips':
      return loadSystemPrompt('AI_Evaluator_FrameVideo.md');
    default:
      return loadSystemPrompt('AI_Evaluator_Story.md');
  }
}

// ── Stage-specific Planners ───────────────────────────
export function getPlannerPrompt(stage?: string): string {
  switch (stage) {
    case 'story_architect':
    case 'concept':
      return loadSystemPrompt('AI_Planner_Story.md');
    case 'screenplay_director':
    case 'season':
    case 'script':
      return loadSystemPrompt('AI_Planner_Screenplay.md');
    case 'frame_video_designer':
    case 'clips':
      return loadSystemPrompt('AI_Planner_FrameVideo.md');
    default:
      return loadSystemPrompt('AI_Planner_Story.md');
  }
}

// ── Other ─────────────────────────────────────────────
export function getReferenceLabPrompt(): string {
  return loadSystemPrompt('Reference_Lab_System_Prompt.md');
}

export function getPromptOptimizerPrompt(): string {
  return loadSystemPrompt('AI_Prompt_Optimizer.md');
}
