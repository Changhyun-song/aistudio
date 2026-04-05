import { promptSupplementRepo } from '@/lib/db/repository';
import type { GenreOverlay } from '@/types';

export function getSupplementForStage(projectId: string, stage: string): string {
  try {
    return promptSupplementRepo.getEffective(projectId, stage);
  } catch { return ''; }
}

export function isContentAgnostic(text: string): boolean {
  const koreanNamePattern = /[가-힣]{2,4}(?:는|은|이|가|를|을|의|에게|한테|와|과)\s/g;
  const matches = text.match(koreanNamePattern) || [];
  if (matches.length >= 3) return false;
  if (/[가-힣]{2,4}=[가-힣]/g.test(text)) return false;
  return true;
}

const _GEN = process.env.OPENAI_MODEL_GENERATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
export const MODEL_GENERATOR = _GEN;
export const MODEL_AI1_CONCEPT = process.env.OPENAI_MODEL_AI1_CONCEPT || _GEN;
export const MODEL_AI2_BIBLE   = process.env.OPENAI_MODEL_AI2_BIBLE   || _GEN;
export const MODEL_AI2_SEASON  = process.env.OPENAI_MODEL_AI2_SEASON  || _GEN;
export const MODEL_AI2_SCRIPT  = process.env.OPENAI_MODEL_AI2_SCRIPT  || _GEN;
export const MODEL_AI3_CLIPS   = process.env.OPENAI_MODEL_AI3_CLIPS   || _GEN;
export const MODEL_EVALUATOR = process.env.OPENAI_MODEL_EVALUATOR || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
export const MODEL_PLANNER   = process.env.OPENAI_MODEL_PLANNER   || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
export const MODEL_OPTIMIZER = process.env.OPENAI_MODEL_OPTIMIZER  || process.env.OPENAI_MODEL || 'gpt-5.4-mini';

export function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) return raw.slice(firstBracket, lastBracket + 1);
  return raw.trim();
}

export function formatOverlayBlock(overlay?: GenreOverlay): string {
  if (!overlay) return '';
  const lines = [
    `## 프로젝트 장르/조건 (Genre Overlay)`,
    `- genre_stack: ${overlay.genre_stack?.join(', ') || 'unspecified'}`,
    `- tone: ${overlay.tone || 'unspecified'}`,
    `- world_mode: ${overlay.world_mode || 'unspecified'}`,
    `- setting_region: ${overlay.setting_region || 'unspecified'}`,
    `- age_group: ${overlay.age_group || 'unspecified'}`,
    `- target_audience: ${overlay.target_audience || 'unspecified'}`,
    `- protagonist_count: ${overlay.protagonist_count || 0}`,
    `- protagonist_composition: ${overlay.protagonist_composition || 'unspecified'}`,
    `- supporting_cast_min: ${overlay.supporting_cast_min ?? 3}`,
    `- supporting_cast_max: ${overlay.supporting_cast_max ?? 8}`,
    `- cast_total_limit: ${overlay.cast_total_limit || 15}`,
    `- creature_usage: ${overlay.creature_usage || 'none'}`,
    `- power_system_usage: ${overlay.power_system_usage || 'none'}`,
    `- death_event: ${overlay.death_event || 'none'}`,
    `- romance_level: ${overlay.romance_level || 'none'}`,
    `- mystery_level: ${overlay.mystery_level || 'none'}`,
    `- action_level: ${overlay.action_level || 'medium'}`,
    `- tragedy_level: ${overlay.tragedy_level || 'low'}`,
    `- twist_level: ${overlay.twist_level || 'medium'}`,
    `- ending_type: ${overlay.ending_type || 'unspecified'}`,
    `- story_central_axis: ${overlay.story_central_axis || 'unspecified'}`,
    `- episode_count: ${overlay.episode_count || 10}`,
    `- runtime_per_episode: ${overlay.runtime_per_episode || 5}분`,
  ];

  if (overlay.must_have_elements?.length) lines.push(``, `### 필수 요소`, ...overlay.must_have_elements.map(e => `- ${e}`));
  if (overlay.nice_to_have_elements?.length) lines.push(``, `### 있으면 좋은 요소`, ...overlay.nice_to_have_elements.map(e => `- ${e}`));
  if (overlay.forbidden_elements?.length) lines.push(``, `### 금지 요소 (절대 포함 금지)`, ...overlay.forbidden_elements.map(e => `- ❌ ${e}`));
  if (overlay.required_character_types?.length) lines.push(``, `### 필수 캐릭터 유형 (반드시 포함)`, ...overlay.required_character_types.map(e => `- ✅ ${e}`));
  if (overlay.optional_character_types?.length) lines.push(``, `### 선택 캐릭터 유형 (있으면 좋음)`, ...overlay.optional_character_types.map(e => `- 💡 ${e}`));

  lines.push(``, `**규칙:**`,
    `- none인 항목은 넣지 마라`,
    `- required인 항목만 반드시 넣어라`,
    `- forbidden_elements에 있는 것은 절대 넣지 마라`,
    `- protagonist_count가 0이거나 비어있으면 AI가 작품에 맞게 결정`,
    `- protagonist_composition이 unspecified면 AI가 작품에 맞게 결정`,
    `- protagonist_composition이 female_lead/male_lead면 해당 성별이 주인공 중 다수이되, 다른 성별도 메인 캐스트에 1~2명 허용`,
    `- 조연은 반드시 supporting_cast_min~supporting_cast_max 범위 내에서 개별 이름+설정 부여`,
    `- story_central_axis가 unspecified 아니면, 해당 축이 스토리의 주된 동력이 되도록 구성`,
  );

  return lines.join('\n');
}
