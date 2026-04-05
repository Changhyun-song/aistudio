import { getDb } from './index';
import { nanoid } from 'nanoid';
import type {
  Project, CharacterBrief, PromptRevision, CandidateImage,
  BaseCharacter, VariantPrompt, ProjectMode,
  CharacterizerConfig, CharacterizerAnchor, CharacterizerShot,
  CharacterizerShotStatus, SelectionState,
  StoryCharacter, StorySeriesBible, StoryEpisodeArc,
  StoryEpisodeScript, StoryClipPacket,
  StoryConcept, StoryBoundaryFrame,
  ReferenceSource, ReferenceAnalysis, ReferenceSynthesis,
  ReferenceSourceType, StoryInputBridge,
  CharacterVisualPrompt,
  PipelineRun, PipelineStage, PipelineRunStatus, PipelineRunSummary,
} from '@/types';

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ── Projects ──────────────────────────────────────────
export const projectRepo = {
  list(): Project[] {
    return getDb().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
  },
  get(id: string): Project | undefined {
    return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  },
  create(name: string, description = '', mode: ProjectMode = 'midjourney_manual'): Project {
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      'INSERT INTO projects (id, name, description, mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, description, mode, 'draft', ts, ts);
    return this.get(id)!;
  },
  update(id: string, data: Partial<Pick<Project, 'name' | 'description' | 'status'>>): Project {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    sets.push('updated_at = ?'); vals.push(now());
    vals.push(id);
    getDb().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  delete(id: string): void {
    getDb().prepare('DELETE FROM prompt_supplements WHERE project_id = ?').run(id);
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};

// ── Character Briefs ──────────────────────────────────
export const briefRepo = {
  getByProject(projectId: string): CharacterBrief | undefined {
    return getDb().prepare('SELECT * FROM character_briefs WHERE project_id = ?').get(projectId) as CharacterBrief | undefined;
  },
  upsert(projectId: string, data: Partial<Omit<CharacterBrief, 'id' | 'project_id' | 'created_at' | 'updated_at'>>): CharacterBrief {
    const existing = this.getByProject(projectId);
    const fields = [
      'natural_input', 'name', 'gender', 'age_group', 'face_keywords', 'hairstyle', 'hair_color',
      'body_type', 'mood', 'personality', 'signature_item', 'signature_color',
      'uniform_style', 'casual_style', 'negative_prompts', 'prompt_strength',
    ] as const;
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
      }
      sets.push('updated_at = ?'); vals.push(now());
      vals.push(existing.id);
      getDb().prepare(`UPDATE character_briefs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getByProject(projectId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO character_briefs (id, project_id, natural_input, name, gender, age_group, face_keywords, hairstyle, hair_color, body_type, mood, personality, signature_item, signature_color, uniform_style, casual_style, negative_prompts, prompt_strength, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, projectId,
      data.natural_input ?? '', data.name ?? '', data.gender ?? 'female',
      data.age_group ?? 'Korean high school student, age 17-18',
      data.face_keywords ?? '', data.hairstyle ?? '', data.hair_color ?? '',
      data.body_type ?? '', data.mood ?? '', data.personality ?? '',
      data.signature_item ?? '', data.signature_color ?? '',
      data.uniform_style ?? 'modest Korean school uniform, blazer, white shirt, tie',
      data.casual_style ?? '',
      data.negative_prompts ?? 'nsfw, nude, deformed, ugly, blurry, low quality, extra limbs, extra fingers, watermark, text, logo, signature, multiple people, extra people',
      data.prompt_strength ?? 'medium', ts, ts,
    );
    return this.getByProject(projectId)!;
  },
};

// ── Prompt Revisions ──────────────────────────────────
export const revisionRepo = {
  listByProject(projectId: string): PromptRevision[] {
    return getDb().prepare('SELECT * FROM prompt_revisions WHERE project_id = ? ORDER BY version ASC').all(projectId) as PromptRevision[];
  },
  getLatest(projectId: string): PromptRevision | undefined {
    return getDb().prepare('SELECT * FROM prompt_revisions WHERE project_id = ? ORDER BY version DESC LIMIT 1').get(projectId) as PromptRevision | undefined;
  },
  create(projectId: string, prompt: string, userFeedback = '', aiNote = ''): PromptRevision {
    const id = nanoid(12);
    const latest = this.getLatest(projectId);
    const version = (latest?.version ?? 0) + 1;
    getDb().prepare(
      'INSERT INTO prompt_revisions (id, project_id, version, prompt, user_feedback, ai_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, version, prompt, userFeedback, aiNote, now());
    return getDb().prepare('SELECT * FROM prompt_revisions WHERE id = ?').get(id) as PromptRevision;
  },
};

// ── Candidates ────────────────────────────────────────
export const candidateRepo = {
  listByProject(projectId: string): CandidateImage[] {
    const rows = getDb().prepare('SELECT * FROM candidate_images WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[];
    return rows.map(r => ({ ...(r as unknown as CandidateImage), is_base: !!(r.is_base) }));
  },
  get(id: string): CandidateImage | undefined {
    const r = getDb().prepare('SELECT * FROM candidate_images WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return { ...(r as unknown as CandidateImage), is_base: !!(r.is_base) };
  },
  create(projectId: string, revisionId: string): CandidateImage {
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO candidate_images (id, project_id, revision_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, projectId, revisionId, now());
    return this.get(id)!;
  },
  update(id: string, data: Partial<Pick<CandidateImage, 'image_url' | 'image_path' | 'status' | 'is_base' | 'memo'>>): CandidateImage {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.image_url !== undefined) { sets.push('image_url = ?'); vals.push(data.image_url); }
    if (data.image_path !== undefined) { sets.push('image_path = ?'); vals.push(data.image_path); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (data.is_base !== undefined) { sets.push('is_base = ?'); vals.push(data.is_base ? 1 : 0); }
    if (data.memo !== undefined) { sets.push('memo = ?'); vals.push(data.memo); }
    vals.push(id);
    if (sets.length) getDb().prepare(`UPDATE candidate_images SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  delete(id: string): void {
    getDb().prepare('DELETE FROM candidate_images WHERE id = ?').run(id);
  },
  clearBase(projectId: string): void {
    getDb().prepare('UPDATE candidate_images SET is_base = 0 WHERE project_id = ?').run(projectId);
  },
};

// ── Base Characters ───────────────────────────────────
export const baseCharacterRepo = {
  getByProject(projectId: string): BaseCharacter | undefined {
    return getDb().prepare('SELECT * FROM base_characters WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId) as BaseCharacter | undefined;
  },
  create(projectId: string, candidateId: string, summary: string, basePrompt: string): BaseCharacter {
    getDb().prepare('DELETE FROM base_characters WHERE project_id = ?').run(projectId);
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO base_characters (id, project_id, candidate_id, summary, base_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, candidateId, summary, basePrompt, now());
    return getDb().prepare('SELECT * FROM base_characters WHERE id = ?').get(id) as BaseCharacter;
  },
};

// ── Variant Prompts ───────────────────────────────────
export const variantRepo = {
  listByProject(projectId: string): VariantPrompt[] {
    return getDb().prepare(
      'SELECT * FROM variant_prompts WHERE project_id = ? ORDER BY slot ASC'
    ).all(projectId) as VariantPrompt[];
  },
  get(id: string): VariantPrompt | undefined {
    return getDb().prepare('SELECT * FROM variant_prompts WHERE id = ?').get(id) as VariantPrompt | undefined;
  },
  createBatch(items: Omit<VariantPrompt, 'id' | 'created_at' | 'updated_at'>[]): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO variant_prompts (id, project_id, base_character_id, slot, shot_key, label, prompt, status, image_url, image_path, quality_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ts = now();
    db.transaction(() => {
      for (const item of items) {
        stmt.run(nanoid(12), item.project_id, item.base_character_id, item.slot, item.shot_key, item.label, item.prompt, 'pending', '', '', '', ts, ts);
      }
    })();
  },
  update(id: string, data: Partial<Pick<VariantPrompt, 'prompt' | 'status' | 'image_url' | 'image_path' | 'quality_notes'>>): VariantPrompt {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.prompt !== undefined) { sets.push('prompt = ?'); vals.push(data.prompt); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (data.image_url !== undefined) { sets.push('image_url = ?'); vals.push(data.image_url); }
    if (data.image_path !== undefined) { sets.push('image_path = ?'); vals.push(data.image_path); }
    if (data.quality_notes !== undefined) { sets.push('quality_notes = ?'); vals.push(data.quality_notes); }
    sets.push('updated_at = ?'); vals.push(now());
    vals.push(id);
    getDb().prepare(`UPDATE variant_prompts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM variant_prompts WHERE project_id = ?').run(projectId);
  },
};

// ── Characterizer Config ──────────────────────────────
export const characterizerConfigRepo = {
  getByProject(projectId: string): CharacterizerConfig | undefined {
    return getDb().prepare('SELECT * FROM characterizer_configs WHERE project_id = ?').get(projectId) as CharacterizerConfig | undefined;
  },
  upsert(projectId: string, data: Partial<Omit<CharacterizerConfig, 'id' | 'project_id' | 'created_at' | 'updated_at'>>): CharacterizerConfig {
    const existing = this.getByProject(projectId);
    const fields = ['base_image_path', 'character_name', 'signature_item', 'signature_color', 'school_style', 'after_school_style', 'tone_keywords'] as const;
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
      }
      sets.push('updated_at = ?'); vals.push(now());
      vals.push(existing.id);
      getDb().prepare(`UPDATE characterizer_configs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getByProject(projectId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO characterizer_configs (id, project_id, base_image_path, character_name, signature_item, signature_color, school_style, after_school_style, tone_keywords, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, projectId,
      data.base_image_path ?? '', data.character_name ?? '',
      data.signature_item ?? '', data.signature_color ?? '',
      data.school_style ?? 'modest Korean school uniform, blazer, white shirt, tie',
      data.after_school_style ?? '', data.tone_keywords ?? '', ts, ts,
    );
    return this.getByProject(projectId)!;
  },
};

// ── Characterizer Anchors ─────────────────────────────
export const characterizerAnchorRepo = {
  listByProject(projectId: string): CharacterizerAnchor[] {
    return getDb().prepare('SELECT * FROM characterizer_anchors WHERE project_id = ? ORDER BY anchor_key ASC').all(projectId) as CharacterizerAnchor[];
  },
  get(id: string): CharacterizerAnchor | undefined {
    return getDb().prepare('SELECT * FROM characterizer_anchors WHERE id = ?').get(id) as CharacterizerAnchor | undefined;
  },
  create(projectId: string, anchorKey: string, label: string, promptUsed: string): CharacterizerAnchor {
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO characterizer_anchors (id, project_id, anchor_key, label, prompt_used, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, anchorKey, label, promptUsed, 'pending', now());
    return this.get(id)!;
  },
  update(id: string, data: Partial<Pick<CharacterizerAnchor, 'file_path' | 'status' | 'prompt_used'>>): CharacterizerAnchor {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.file_path !== undefined) { sets.push('file_path = ?'); vals.push(data.file_path); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (data.prompt_used !== undefined) { sets.push('prompt_used = ?'); vals.push(data.prompt_used); }
    vals.push(id);
    if (sets.length) getDb().prepare(`UPDATE characterizer_anchors SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM characterizer_anchors WHERE project_id = ?').run(projectId);
  },
};

// ── Characterizer Shots ───────────────────────────────
export const characterizerShotRepo = {
  listByProject(projectId: string): CharacterizerShot[] {
    return getDb().prepare('SELECT * FROM characterizer_shots WHERE project_id = ? ORDER BY shot_index ASC').all(projectId) as CharacterizerShot[];
  },
  get(id: string): CharacterizerShot | undefined {
    return getDb().prepare('SELECT * FROM characterizer_shots WHERE id = ?').get(id) as CharacterizerShot | undefined;
  },
  createBatch(items: { projectId: string; shotKey: string; shotIndex: number; label: string; promptUsed: string }[]): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO characterizer_shots (id, project_id, shot_key, shot_index, label, prompt_used, status, selection_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'unreviewed', ?, ?)`
    );
    const ts = now();
    db.transaction(() => {
      for (const item of items) {
        stmt.run(nanoid(12), item.projectId, item.shotKey, item.shotIndex, item.label, item.promptUsed, ts, ts);
      }
    })();
  },
  update(id: string, data: Partial<Pick<CharacterizerShot, 'file_path' | 'status' | 'selection_state' | 'error_message' | 'prompt_used'>>): CharacterizerShot {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.file_path !== undefined) { sets.push('file_path = ?'); vals.push(data.file_path); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (data.selection_state !== undefined) { sets.push('selection_state = ?'); vals.push(data.selection_state); }
    if (data.error_message !== undefined) { sets.push('error_message = ?'); vals.push(data.error_message); }
    if (data.prompt_used !== undefined) { sets.push('prompt_used = ?'); vals.push(data.prompt_used); }
    sets.push('updated_at = ?'); vals.push(now());
    vals.push(id);
    getDb().prepare(`UPDATE characterizer_shots SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM characterizer_shots WHERE project_id = ?').run(projectId);
  },
};

// ══════════════════════════════════════════════════════
// Story Studio Repositories
// ══════════════════════════════════════════════════════

// ── Story Characters ──────────────────────────────────
export const storyCharacterRepo = {
  list(projectId: string): StoryCharacter[] {
    return getDb().prepare('SELECT * FROM story_characters WHERE project_id = ? ORDER BY sort_order ASC').all(projectId) as StoryCharacter[];
  },
  get(id: string): StoryCharacter | undefined {
    return getDb().prepare('SELECT * FROM story_characters WHERE id = ?').get(id) as StoryCharacter | undefined;
  },
  create(projectId: string, data: Partial<Omit<StoryCharacter, 'id' | 'project_id' | 'created_at' | 'updated_at'>>): StoryCharacter {
    const id = nanoid(12);
    const ts = now();
    const maxOrder = (getDb().prepare('SELECT MAX(sort_order) as m FROM story_characters WHERE project_id = ?').get(projectId) as { m: number | null })?.m ?? -1;
    getDb().prepare(
      `INSERT INTO story_characters (id, project_id, name, role, traits, signature_item, signature_color, speech_style, emotional_weakness, power_or_specialty, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, projectId, data.name ?? '', data.role ?? '', data.traits ?? '', data.signature_item ?? '', data.signature_color ?? '', data.speech_style ?? '', data.emotional_weakness ?? '', data.power_or_specialty ?? '', maxOrder + 1, ts, ts);
    return this.get(id)!;
  },
  update(id: string, data: Partial<Omit<StoryCharacter, 'id' | 'project_id' | 'created_at'>>): StoryCharacter {
    const fields = ['name', 'role', 'traits', 'signature_item', 'signature_color', 'speech_style', 'emotional_weakness', 'power_or_specialty', 'sort_order'] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); }
    }
    sets.push('updated_at = ?'); vals.push(now());
    vals.push(id);
    if (sets.length > 1) getDb().prepare(`UPDATE story_characters SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  delete(id: string): void {
    getDb().prepare('DELETE FROM story_characters WHERE id = ?').run(id);
  },
  deleteAll(projectId: string): void {
    getDb().prepare('DELETE FROM story_characters WHERE project_id = ?').run(projectId);
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_characters WHERE project_id = ?').run(projectId);
  },
  replaceBatch(projectId: string, items: Partial<Omit<StoryCharacter, 'id' | 'project_id' | 'created_at' | 'updated_at'>>[]): StoryCharacter[] {
    const db = getDb();
    db.prepare('DELETE FROM story_characters WHERE project_id = ?').run(projectId);
    const stmt = db.prepare(
      `INSERT INTO story_characters (id, project_id, name, role, traits, signature_item, signature_color, speech_style, emotional_weakness, power_or_specialty, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ts = now();
    db.transaction(() => {
      items.forEach((item, i) => {
        stmt.run(nanoid(12), projectId, item.name ?? '', item.role ?? '', item.traits ?? '', item.signature_item ?? '', item.signature_color ?? '', item.speech_style ?? '', item.emotional_weakness ?? '', item.power_or_specialty ?? '', i, ts, ts);
      });
    })();
    return this.list(projectId);
  },
};

// ── Character Visual Prompts ──────────────────────────
export const characterVisualPromptRepo = {
  listByProject(projectId: string): CharacterVisualPrompt[] {
    return getDb().prepare('SELECT * FROM character_visual_prompts WHERE project_id = ? ORDER BY character_name ASC').all(projectId) as CharacterVisualPrompt[];
  },
  getByCharacter(characterId: string): CharacterVisualPrompt | undefined {
    return getDb().prepare('SELECT * FROM character_visual_prompts WHERE character_id = ?').get(characterId) as CharacterVisualPrompt | undefined;
  },
  upsert(projectId: string, characterId: string, data: Partial<Omit<CharacterVisualPrompt, 'id' | 'project_id' | 'character_id' | 'created_at' | 'updated_at'>>): CharacterVisualPrompt {
    const existing = this.getByCharacter(characterId);
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (k === 'id' || k === 'project_id' || k === 'character_id' || k === 'created_at') continue;
        sets.push(`${k} = ?`);
        vals.push(v);
      }
      sets.push('updated_at = ?');
      vals.push(now());
      vals.push(existing.id);
      if (sets.length > 1) getDb().prepare(`UPDATE character_visual_prompts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getByCharacter(characterId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO character_visual_prompts (id, project_id, character_id, character_name, visual_brief, mj_base_prompt, mj_portrait_prompt, mj_full_body_prompt, mj_action_prompt, mj_expression_sheet, negative_prompts, style_keywords, raw_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, projectId, characterId,
      data.character_name ?? '', data.visual_brief ?? '',
      data.mj_base_prompt ?? '', data.mj_portrait_prompt ?? '',
      data.mj_full_body_prompt ?? '', data.mj_action_prompt ?? '',
      data.mj_expression_sheet ?? '', data.negative_prompts ?? '',
      data.style_keywords ?? '', data.raw_json ?? '{}',
      data.status ?? 'generated', ts, ts,
    );
    return this.getByCharacter(characterId)!;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM character_visual_prompts WHERE project_id = ?').run(projectId);
  },
  deleteByCharacter(characterId: string): void {
    getDb().prepare('DELETE FROM character_visual_prompts WHERE character_id = ?').run(characterId);
  },
};

// ── Story Bible ───────────────────────────────────────
export const storyBibleRepo = {
  getByProject(projectId: string): StorySeriesBible | undefined {
    return getDb().prepare('SELECT * FROM story_bibles WHERE project_id = ?').get(projectId) as StorySeriesBible | undefined;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_bibles WHERE project_id = ?').run(projectId);
  },
  upsert(projectId: string, data: Partial<Omit<StorySeriesBible, 'id' | 'project_id' | 'created_at' | 'updated_at'>>): StorySeriesBible {
    const existing = this.getByProject(projectId);
    const fields = ['title', 'genre', 'tone', 'world_rules', 'season_goal', 'core_conflict', 'ending_direction', 'audience', 'reference_mood', 'raw_json'] as const;
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); } }
      sets.push('updated_at = ?'); vals.push(now());
      vals.push(existing.id);
      getDb().prepare(`UPDATE story_bibles SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getByProject(projectId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO story_bibles (id, project_id, title, genre, tone, world_rules, season_goal, core_conflict, ending_direction, audience, reference_mood, raw_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, projectId, data.title ?? '', data.genre ?? '', data.tone ?? '', data.world_rules ?? '', data.season_goal ?? '', data.core_conflict ?? '', data.ending_direction ?? '', data.audience ?? '', data.reference_mood ?? '', data.raw_json ?? '{}', ts, ts);
    return this.getByProject(projectId)!;
  },
};

// ── Story Episode Arcs ────────────────────────────────
export const storyEpisodeArcRepo = {
  listByProject(projectId: string): StoryEpisodeArc[] {
    return getDb().prepare('SELECT * FROM story_episode_arcs WHERE project_id = ? ORDER BY episode_number ASC').all(projectId) as StoryEpisodeArc[];
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_episode_arcs WHERE project_id = ?').run(projectId);
  },
  get(id: string): StoryEpisodeArc | undefined {
    return getDb().prepare('SELECT * FROM story_episode_arcs WHERE id = ?').get(id) as StoryEpisodeArc | undefined;
  },
  getByEpisode(projectId: string, epNum: number): StoryEpisodeArc | undefined {
    return getDb().prepare('SELECT * FROM story_episode_arcs WHERE project_id = ? AND episode_number = ?').get(projectId, epNum) as StoryEpisodeArc | undefined;
  },
  replaceBatch(projectId: string, items: Omit<StoryEpisodeArc, 'id' | 'created_at'>[]): void {
    const db = getDb();
    db.prepare('DELETE FROM story_episode_arcs WHERE project_id = ?').run(projectId);
    const stmt = db.prepare(
      `INSERT INTO story_episode_arcs (id, project_id, episode_number, title, purpose, summary, beginning, middle, climax, ending_hook, key_characters, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ts = now();
    db.transaction(() => {
      for (const item of items) {
        stmt.run(nanoid(12), projectId, item.episode_number, item.title, item.purpose, item.summary, item.beginning, item.middle, item.climax, item.ending_hook, item.key_characters, item.raw_json, ts);
      }
    })();
  },
  update(id: string, data: Partial<Pick<StoryEpisodeArc, 'title' | 'purpose' | 'summary' | 'beginning' | 'middle' | 'climax' | 'ending_hook' | 'key_characters' | 'raw_json'>>): StoryEpisodeArc {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); } }
    vals.push(id);
    if (sets.length) getDb().prepare(`UPDATE story_episode_arcs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
};

// ── Story Episode Scripts ─────────────────────────────
export const storyEpisodeScriptRepo = {
  getByEpisode(projectId: string, epNum: number): StoryEpisodeScript | undefined {
    return getDb().prepare('SELECT * FROM story_episode_scripts WHERE project_id = ? AND episode_number = ?').get(projectId, epNum) as StoryEpisodeScript | undefined;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_episode_scripts WHERE project_id = ?').run(projectId);
  },
  upsert(projectId: string, epNum: number, markdown: string, scenesJson: string): StoryEpisodeScript {
    const existing = this.getByEpisode(projectId, epNum);
    if (existing) {
      getDb().prepare('UPDATE story_episode_scripts SET markdown = ?, scenes_json = ? WHERE id = ?').run(markdown, scenesJson, existing.id);
      return this.getByEpisode(projectId, epNum)!;
    }
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO story_episode_scripts (id, project_id, episode_number, markdown, scenes_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, epNum, markdown, scenesJson, now());
    return this.getByEpisode(projectId, epNum)!;
  },
};

// ── Story Clip Packets ────────────────────────────────
export const storyClipPacketRepo = {
  listByEpisode(projectId: string, epNum: number): StoryClipPacket[] {
    return getDb().prepare('SELECT * FROM story_clip_packets WHERE project_id = ? AND episode_number = ? ORDER BY clip_number ASC').all(projectId, epNum) as StoryClipPacket[];
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_clip_packets WHERE project_id = ?').run(projectId);
  },
  get(id: string): StoryClipPacket | undefined {
    return getDb().prepare('SELECT * FROM story_clip_packets WHERE id = ?').get(id) as StoryClipPacket | undefined;
  },
  replaceBatch(projectId: string, epNum: number, items: { clipNumber: number; startTime: string; endTime: string; durationSec: number; packetJson: string }[]): void {
    const db = getDb();
    db.prepare('DELETE FROM story_clip_packets WHERE project_id = ? AND episode_number = ?').run(projectId, epNum);
    const stmt = db.prepare(
      'INSERT INTO story_clip_packets (id, project_id, episode_number, clip_number, start_time, end_time, duration_sec, packet_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const ts = now();
    db.transaction(() => {
      for (const item of items) {
        stmt.run(nanoid(12), projectId, epNum, item.clipNumber, item.startTime, item.endTime, item.durationSec, item.packetJson, ts);
      }
    })();
  },
  update(id: string, packetJson: string): StoryClipPacket {
    getDb().prepare('UPDATE story_clip_packets SET packet_json = ? WHERE id = ?').run(packetJson, id);
    return this.get(id)!;
  },
};

// ── Story Concept ─────────────────────────────────────
export const storyConceptRepo = {
  getByProject(projectId: string): StoryConcept | undefined {
    return getDb().prepare('SELECT * FROM story_concepts WHERE project_id = ?').get(projectId) as StoryConcept | undefined;
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_concepts WHERE project_id = ?').run(projectId);
  },
  upsert(projectId: string, data: Partial<Omit<StoryConcept, 'id' | 'project_id' | 'created_at'>>): StoryConcept {
    const existing = this.getByProject(projectId);
    const fields = ['raw_input', 'genre', 'tone', 'world_keywords', 'romance_level', 'mystery_level', 'action_level', 'ending_mood', 'target_audience', 'genre_overlay_json', 'approved_markdown', 'approved_json', 'version'] as const;
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (data[f] !== undefined) { sets.push(`${f} = ?`); vals.push(data[f]); } }
      sets.push('updated_at = ?'); vals.push(now());
      vals.push(existing.id);
      if (sets.length > 1) getDb().prepare(`UPDATE story_concepts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getByProject(projectId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO story_concepts (id, project_id, raw_input, genre, tone, world_keywords, romance_level, mystery_level, action_level, ending_mood, target_audience, genre_overlay_json, approved_markdown, approved_json, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, projectId, data.raw_input ?? '', data.genre ?? '', data.tone ?? '', data.world_keywords ?? '', data.romance_level ?? 'medium', data.mystery_level ?? 'medium', data.action_level ?? 'medium', data.ending_mood ?? '', data.target_audience ?? '', data.genre_overlay_json ?? '{}', data.approved_markdown ?? '', data.approved_json ?? '{}', data.version ?? 1, ts, ts);
    return this.getByProject(projectId)!;
  },
};

// ── Story Boundary Frames ─────────────────────────────
export const storyBoundaryFrameRepo = {
  listByEpisode(projectId: string, epNum: number): StoryBoundaryFrame[] {
    return getDb().prepare('SELECT * FROM story_boundary_frames WHERE project_id = ? AND episode_number = ? ORDER BY frame_id ASC').all(projectId, epNum) as StoryBoundaryFrame[];
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM story_boundary_frames WHERE project_id = ?').run(projectId);
  },
  get(id: string): StoryBoundaryFrame | undefined {
    return getDb().prepare('SELECT * FROM story_boundary_frames WHERE id = ?').get(id) as StoryBoundaryFrame | undefined;
  },
  replaceBatch(projectId: string, epNum: number, items: { frameId: string; timecode: string; description: string; imagePrompt: string; rawJson: string }[]): void {
    const db = getDb();
    db.prepare('DELETE FROM story_boundary_frames WHERE project_id = ? AND episode_number = ?').run(projectId, epNum);
    const stmt = db.prepare(
      'INSERT INTO story_boundary_frames (id, project_id, episode_number, frame_id, timecode, description, image_prompt, raw_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const ts = now();
    db.transaction(() => {
      for (const item of items) {
        stmt.run(nanoid(12), projectId, epNum, item.frameId, item.timecode, item.description, item.imagePrompt, item.rawJson, ts);
      }
    })();
  },
  update(id: string, data: Partial<Pick<StoryBoundaryFrame, 'description' | 'image_prompt' | 'raw_json'>>): StoryBoundaryFrame {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); } }
    vals.push(id);
    if (sets.length) getDb().prepare(`UPDATE story_boundary_frames SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
};

// ══════════════════════════════════════════════════════
// Reference Lab Repositories
// ══════════════════════════════════════════════════════

export const referenceSourceRepo = {
  list(projectId: string): ReferenceSource[] {
    return getDb().prepare('SELECT * FROM reference_sources WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as ReferenceSource[];
  },
  get(id: string): ReferenceSource | undefined {
    return getDb().prepare('SELECT * FROM reference_sources WHERE id = ?').get(id) as ReferenceSource | undefined;
  },
  create(projectId: string, data: { type: ReferenceSourceType; title: string; rawText?: string; filePath?: string; sourceUrl?: string; tagsJson?: string; userNote?: string }): ReferenceSource {
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO reference_sources (id, project_id, type, title, raw_text, file_path, source_url, tags_json, user_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, data.type, data.title, data.rawText ?? '', data.filePath ?? '', data.sourceUrl ?? '', data.tagsJson ?? '[]', data.userNote ?? '', now());
    return this.get(id)!;
  },
  update(id: string, data: Partial<Pick<ReferenceSource, 'title' | 'raw_text' | 'tags_json' | 'user_note' | 'source_url'>>): ReferenceSource {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); } }
    vals.push(id);
    if (sets.length) getDb().prepare(`UPDATE reference_sources SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.get(id)!;
  },
  delete(id: string): void {
    getDb().prepare('DELETE FROM reference_analyses WHERE source_id = ?').run(id);
    getDb().prepare('DELETE FROM reference_sources WHERE id = ?').run(id);
  },
};

export const referenceAnalysisRepo = {
  getBySource(sourceId: string): ReferenceAnalysis | undefined {
    return getDb().prepare('SELECT * FROM reference_analyses WHERE source_id = ?').get(sourceId) as ReferenceAnalysis | undefined;
  },
  listByProject(projectId: string): ReferenceAnalysis[] {
    return getDb().prepare('SELECT * FROM reference_analyses WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as ReferenceAnalysis[];
  },
  upsert(sourceId: string, projectId: string, data: Omit<ReferenceAnalysis, 'id' | 'source_id' | 'project_id' | 'created_at'>): ReferenceAnalysis {
    const existing = this.getBySource(sourceId);
    if (existing) {
      const fields = ['genre', 'tone', 'themes_json', 'character_types_json', 'relationship_dynamics_json', 'mystery_elements_json', 'visual_motifs_json', 'pacing_notes', 'romance_pattern', 'twist_pattern', 'avoid_cliches_json', 'raw_json'] as const;
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if ((data as Record<string, unknown>)[f] !== undefined) { sets.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
      vals.push(existing.id);
      if (sets.length) getDb().prepare(`UPDATE reference_analyses SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.getBySource(sourceId)!;
    }
    const id = nanoid(12);
    getDb().prepare(
      `INSERT INTO reference_analyses (id, source_id, project_id, genre, tone, themes_json, character_types_json, relationship_dynamics_json, mystery_elements_json, visual_motifs_json, pacing_notes, romance_pattern, twist_pattern, avoid_cliches_json, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, sourceId, projectId, data.genre, data.tone, data.themes_json, data.character_types_json, data.relationship_dynamics_json, data.mystery_elements_json, data.visual_motifs_json, data.pacing_notes, data.romance_pattern, data.twist_pattern, data.avoid_cliches_json, data.raw_json, now());
    return this.getBySource(sourceId)!;
  },
};

export const referenceSynthesisRepo = {
  getByProject(projectId: string): ReferenceSynthesis | undefined {
    return getDb().prepare('SELECT * FROM reference_syntheses WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1').get(projectId) as ReferenceSynthesis | undefined;
  },
  upsert(projectId: string, data: { selectedSourceIdsJson: string; summaryMarkdown: string; structuredJson: string }): ReferenceSynthesis {
    const existing = this.getByProject(projectId);
    if (existing) {
      getDb().prepare('UPDATE reference_syntheses SET selected_source_ids_json = ?, summary_markdown = ?, structured_json = ?, updated_at = ? WHERE id = ?')
        .run(data.selectedSourceIdsJson, data.summaryMarkdown, data.structuredJson, now(), existing.id);
      return this.getByProject(projectId)!;
    }
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      'INSERT INTO reference_syntheses (id, project_id, selected_source_ids_json, summary_markdown, structured_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, data.selectedSourceIdsJson, data.summaryMarkdown, data.structuredJson, ts, ts);
    return this.getByProject(projectId)!;
  },
};

export const storyInputBridgeRepo = {
  getByProject(projectId: string): StoryInputBridge | undefined {
    return getDb().prepare('SELECT * FROM story_input_bridges WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId) as StoryInputBridge | undefined;
  },
  create(projectId: string, data: { referenceSynthesisId: string; promptReadySummary: string; structuredJson: string }): StoryInputBridge {
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO story_input_bridges (id, project_id, reference_synthesis_id, prompt_ready_summary, structured_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, data.referenceSynthesisId, data.promptReadySummary, data.structuredJson, now());
    return this.getByProject(projectId)!;
  },
};

export interface PromptSupplement {
  id: string;
  project_id: string;
  stage: string;
  supplement_text: string;
  diagnosis_json: string;
  version: number;
  created_at: string;
}

const GLOBAL_PROJECT_ID = '__global__';

export const promptSupplementRepo = {
  get(projectId: string, stage: string): PromptSupplement | undefined {
    return getDb().prepare('SELECT * FROM prompt_supplements WHERE project_id = ? AND stage = ?').get(projectId, stage) as PromptSupplement | undefined;
  },
  getGlobal(stage: string): PromptSupplement | undefined {
    return this.get(GLOBAL_PROJECT_ID, stage);
  },
  getEffective(projectId: string, stage: string): string {
    const global = this.getGlobal(stage);
    const project = this.get(projectId, stage);
    const parts: string[] = [];
    if (global?.supplement_text) parts.push(`[글로벌 보충 규칙]\n${global.supplement_text}`);
    if (project?.supplement_text) parts.push(`[프로젝트 보충 규칙]\n${project.supplement_text}`);
    return parts.join('\n\n');
  },
  listByProject(projectId: string): PromptSupplement[] {
    return getDb().prepare('SELECT * FROM prompt_supplements WHERE project_id = ? ORDER BY stage').all(projectId) as PromptSupplement[];
  },
  listGlobal(): PromptSupplement[] {
    return this.listByProject(GLOBAL_PROJECT_ID);
  },
  upsert(projectId: string, stage: string, supplementText: string, diagnosisJson: string): PromptSupplement {
    const existing = this.get(projectId, stage);
    if (existing) {
      getDb().prepare('UPDATE prompt_supplements SET supplement_text = ?, diagnosis_json = ?, version = version + 1 WHERE id = ?')
        .run(supplementText, diagnosisJson, existing.id);
      return this.get(projectId, stage)!;
    }
    const id = nanoid(12);
    getDb().prepare(
      'INSERT INTO prompt_supplements (id, project_id, stage, supplement_text, diagnosis_json, version, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, projectId, stage, supplementText, diagnosisJson, now());
    return this.get(projectId, stage)!;
  },
  upsertGlobal(stage: string, supplementText: string, diagnosisJson: string): PromptSupplement {
    return this.upsert(GLOBAL_PROJECT_ID, stage, supplementText, diagnosisJson);
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM prompt_supplements WHERE project_id = ?').run(projectId);
  },
  resetGlobal(): void {
    getDb().prepare('DELETE FROM prompt_supplements WHERE project_id = ?').run(GLOBAL_PROJECT_ID);
  },
};

// ── Prompt Supplement Rules ────────────────────────────

export interface PromptSupplementRule {
  id: string;
  project_id: string;
  stage: string;
  rule_text: string;
  source: string;
  status: string;
  score_before: number | null;
  score_after: number | null;
  effectiveness: number | null;
  apply_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export const promptSupplementRuleRepo = {
  listByStage(projectId: string, stage: string): PromptSupplementRule[] {
    return getDb().prepare(
      'SELECT * FROM prompt_supplement_rules WHERE project_id = ? AND stage = ? ORDER BY created_at DESC'
    ).all(projectId, stage) as PromptSupplementRule[];
  },
  listActive(projectId: string, stage: string): PromptSupplementRule[] {
    return getDb().prepare(
      `SELECT * FROM prompt_supplement_rules WHERE project_id = ? AND stage = ? AND status = 'active' ORDER BY effectiveness DESC NULLS LAST`
    ).all(projectId, stage) as PromptSupplementRule[];
  },
  create(entry: {
    projectId: string;
    stage: string;
    ruleText: string;
    source?: string;
    scoreBefore?: number;
  }): PromptSupplementRule {
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO prompt_supplement_rules (id, project_id, stage, rule_text, source, status, score_before, apply_count, success_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'candidate', ?, 0, 0, ?, ?)`
    ).run(id, entry.projectId, entry.stage, entry.ruleText, entry.source || 'optimizer', entry.scoreBefore ?? null, ts, ts);
    return getDb().prepare('SELECT * FROM prompt_supplement_rules WHERE id = ?').get(id) as PromptSupplementRule;
  },
  recordApplication(id: string, scoreAfter: number): void {
    const rule = getDb().prepare('SELECT * FROM prompt_supplement_rules WHERE id = ?').get(id) as PromptSupplementRule | undefined;
    if (!rule) return;
    const newApplyCount = (rule.apply_count || 0) + 1;
    const scoreBefore = rule.score_before ?? 0;
    const improved = scoreAfter > scoreBefore;
    const newSuccessCount = improved ? (rule.success_count || 0) + 1 : (rule.success_count || 0);
    const effectiveness = newApplyCount > 0 ? newSuccessCount / newApplyCount : null;
    const newStatus = newApplyCount >= 3
      ? ((effectiveness ?? 0) >= 0.5 ? 'active' : 'retired')
      : 'candidate';
    getDb().prepare(
      `UPDATE prompt_supplement_rules SET score_after = ?, apply_count = ?, success_count = ?, effectiveness = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(scoreAfter, newApplyCount, newSuccessCount, effectiveness, newStatus, now(), id);
  },
  retire(id: string): void {
    getDb().prepare(`UPDATE prompt_supplement_rules SET status = 'retired', updated_at = ? WHERE id = ?`).run(now(), id);
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM prompt_supplement_rules WHERE project_id = ?').run(projectId);
  },
};

// ── Story Warehouse ───────────────────────────────────

export interface StoryWarehouseItem {
  id: string;
  title: string;
  logline: string;
  genre: string;
  tone: string;
  hook: string;
  target_audience: string;
  tags: string;
  source: string;
  status: string;
  project_id: string | null;
  raw_json: string;
  seed_json: string;
  synopsis: string;
  inner_conflict: string;
  outer_obstacle: string;
  expected_episodes: string;
  eval_freshness: number;
  eval_conflict: number;
  eval_empathy: number;
  eval_visual: number;
  eval_expandability: number;
  eval_overall: number;
  eval_verdict: string;
  eval_summary: string;
  pick_count: number;
  created_at: string;
  updated_at: string;
}

export const storyWarehouseRepo = {
  list(limit = 50, offset = 0): StoryWarehouseItem[] {
    return getDb().prepare('SELECT * FROM story_warehouse ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as StoryWarehouseItem[];
  },
  get(id: string): StoryWarehouseItem | undefined {
    return getDb().prepare('SELECT * FROM story_warehouse WHERE id = ?').get(id) as StoryWarehouseItem | undefined;
  },
  create(item: Partial<Omit<StoryWarehouseItem, 'id' | 'created_at' | 'updated_at'>>): StoryWarehouseItem {
    const id = nanoid(12);
    const ts = now();
    getDb().prepare(
      `INSERT INTO story_warehouse (id, title, logline, genre, tone, hook, target_audience, tags, source, status, project_id, raw_json, seed_json, synopsis, inner_conflict, outer_obstacle, expected_episodes, eval_freshness, eval_conflict, eval_empathy, eval_visual, eval_expandability, eval_overall, eval_verdict, eval_summary, pick_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, item.title ?? '', item.logline ?? '', item.genre ?? '', item.tone ?? '',
      item.hook ?? '', item.target_audience ?? '', item.tags ?? '[]',
      item.source ?? 'ai_generated', item.status ?? 'idea', item.project_id ?? null,
      item.raw_json ?? '{}', item.seed_json ?? '{}',
      item.synopsis ?? '', item.inner_conflict ?? '', item.outer_obstacle ?? '',
      item.expected_episodes ?? '',
      item.eval_freshness ?? 0, item.eval_conflict ?? 0, item.eval_empathy ?? 0,
      item.eval_visual ?? 0, item.eval_expandability ?? 0, item.eval_overall ?? 0,
      item.eval_verdict ?? '', item.eval_summary ?? '', item.pick_count ?? 0,
      ts, ts,
    );
    return this.get(id)!;
  },
  update(id: string, fields: Partial<StoryWarehouseItem>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'id' || k === 'created_at') continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push('updated_at = ?');
    vals.push(now());
    vals.push(id);
    getDb().prepare(`UPDATE story_warehouse SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id: string): void {
    getDb().prepare('DELETE FROM story_warehouse WHERE id = ?').run(id);
  },
  search(query: string): StoryWarehouseItem[] {
    const like = `%${query}%`;
    return getDb().prepare(
      `SELECT * FROM story_warehouse WHERE title LIKE ? OR logline LIKE ? OR genre LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT 50`
    ).all(like, like, like, like) as StoryWarehouseItem[];
  },
};

// ── AI Usage Logs ─────────────────────────────────────

export interface AIUsageLog {
  id: number;
  project_id: string;
  pipeline_run_id: string | null;
  stage: string;
  role: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-5.4':       { input: 0.01,  output: 0.03 },
  'gpt-5.4-mini':  { input: 0.0004, output: 0.0016 },
  'gpt-4o':        { input: 0.005, output: 0.015 },
  'gpt-4o-mini':   { input: 0.00015, output: 0.0006 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const key = Object.keys(COST_PER_1K).find(k => model.startsWith(k)) || 'gpt-5.4-mini';
  const rate = COST_PER_1K[key] || COST_PER_1K['gpt-5.4-mini'];
  return (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output;
}

export const aiUsageLogRepo = {
  insert(entry: {
    projectId: string;
    pipelineRunId?: string;
    stage: string;
    role: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }): void {
    const cost = estimateCost(entry.model, entry.promptTokens, entry.completionTokens);
    getDb().prepare(
      `INSERT INTO ai_usage_logs (project_id, pipeline_run_id, stage, role, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.projectId, entry.pipelineRunId || null,
      entry.stage, entry.role, entry.model,
      entry.promptTokens, entry.completionTokens, entry.totalTokens,
      Math.round(cost * 1000000) / 1000000,
      now(),
    );
  },
  getProjectTotal(projectId: string): { totalTokens: number; totalCostUsd: number; callCount: number } {
    const row = getDb().prepare(
      `SELECT COALESCE(SUM(total_tokens),0) as totalTokens, COALESCE(SUM(estimated_cost_usd),0) as totalCostUsd, COUNT(*) as callCount
       FROM ai_usage_logs WHERE project_id = ?`
    ).get(projectId) as any;
    return { totalTokens: row.totalTokens, totalCostUsd: row.totalCostUsd, callCount: row.callCount };
  },
  getPipelineTotal(pipelineRunId: string): { totalTokens: number; totalCostUsd: number; callCount: number } {
    const row = getDb().prepare(
      `SELECT COALESCE(SUM(total_tokens),0) as totalTokens, COALESCE(SUM(estimated_cost_usd),0) as totalCostUsd, COUNT(*) as callCount
       FROM ai_usage_logs WHERE pipeline_run_id = ?`
    ).get(pipelineRunId) as any;
    return { totalTokens: row.totalTokens, totalCostUsd: row.totalCostUsd, callCount: row.callCount };
  },
  getByProject(projectId: string, limit = 100): AIUsageLog[] {
    return getDb().prepare(
      'SELECT * FROM ai_usage_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(projectId, limit) as AIUsageLog[];
  },
  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM ai_usage_logs WHERE project_id = ?').run(projectId);
  },
};

// ══════════════════════════════════════════════════════
// ── Pipeline Runs ────────────────────────────────────
// ══════════════════════════════════════════════════════

export const pipelineRunRepo = {
  create(projectId: string, opts: {
    pipelineType?: string;
    targetScore?: number;
    maxRetries?: number;
    currentStage?: string;
    currentStageLabel?: string;
  } = {}): PipelineRun {
    const id = nanoid(16);
    const ts = now();
    getDb().prepare(
      `INSERT INTO pipeline_runs (id, project_id, pipeline_type, status, current_stage, current_stage_label, progress_pct, target_score, max_retries, summary_json, started_at, updated_at)
       VALUES (?, ?, ?, 'running', ?, ?, 0, ?, ?, '{}', ?, ?)`
    ).run(
      id, projectId,
      opts.pipelineType ?? 'story_full',
      opts.currentStage ?? 'idle',
      opts.currentStageLabel ?? '',
      opts.targetScore ?? 4.0,
      opts.maxRetries ?? 3,
      ts, ts,
    );
    return this.get(id)!;
  },

  get(id: string): PipelineRun | undefined {
    return getDb().prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRun | undefined;
  },

  getActiveByProject(projectId: string): PipelineRun | undefined {
    return getDb().prepare(
      `SELECT * FROM pipeline_runs WHERE project_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1`
    ).get(projectId) as PipelineRun | undefined;
  },

  listByProject(projectId: string, limit = 20): PipelineRun[] {
    return getDb().prepare(
      'SELECT * FROM pipeline_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?'
    ).all(projectId, limit) as PipelineRun[];
  },

  listActive(): PipelineRun[] {
    return getDb().prepare(
      `SELECT * FROM pipeline_runs WHERE status = 'running' ORDER BY started_at DESC`
    ).all() as PipelineRun[];
  },

  listAllLatest(): PipelineRunSummary[] {
    return getDb().prepare(
      `SELECT r.id, r.project_id, r.pipeline_type, r.status, r.current_stage, r.current_stage_label, r.progress_pct, r.started_at, r.updated_at
       FROM pipeline_runs r
       INNER JOIN (
         SELECT project_id, MAX(started_at) as max_started
         FROM pipeline_runs
         GROUP BY project_id
       ) latest ON r.project_id = latest.project_id AND r.started_at = latest.max_started
       ORDER BY r.started_at DESC`
    ).all() as PipelineRunSummary[];
  },

  updateStage(id: string, stage: string, stageLabel: string, progressPct: number): void {
    getDb().prepare(
      `UPDATE pipeline_runs SET current_stage = ?, current_stage_label = ?, progress_pct = ?, updated_at = ? WHERE id = ?`
    ).run(stage, stageLabel, progressPct, now(), id);
  },

  updateStatus(id: string, status: PipelineRunStatus, errorMessage?: string): void {
    const sets = ['status = ?', 'updated_at = ?'];
    const vals: unknown[] = [status, now()];
    if (errorMessage !== undefined) {
      sets.push('error_message = ?');
      vals.push(errorMessage);
    }
    if (status === 'completed' || status === 'failed' || status === 'aborted') {
      sets.push('completed_at = ?');
      vals.push(now());
    }
    vals.push(id);
    getDb().prepare(`UPDATE pipeline_runs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },

  updateSummary(id: string, summary: Record<string, unknown>): void {
    getDb().prepare(
      `UPDATE pipeline_runs SET summary_json = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(summary), now(), id);
  },

  deleteByProject(projectId: string): void {
    getDb().prepare('DELETE FROM pipeline_stages WHERE project_id = ?').run(projectId);
    getDb().prepare('DELETE FROM pipeline_runs WHERE project_id = ?').run(projectId);
  },
};

export const pipelineStageRepo = {
  create(runId: string, projectId: string, stage: string, stageLabel: string, maxAttempts = 3): PipelineStage {
    const result = getDb().prepare(
      `INSERT INTO pipeline_stages (run_id, project_id, stage, stage_label, status, attempt, max_attempts, detail_json)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, '{}')`
    ).run(runId, projectId, stage, stageLabel, maxAttempts);
    return getDb().prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(result.lastInsertRowid) as PipelineStage;
  },

  listByRun(runId: string): PipelineStage[] {
    return getDb().prepare('SELECT * FROM pipeline_stages WHERE run_id = ? ORDER BY id ASC').all(runId) as PipelineStage[];
  },

  updateStatus(id: number, status: string, opts?: { attempt?: number; score?: number; detailJson?: string }): void {
    const sets = ['status = ?'];
    const vals: unknown[] = [status];
    if (status === 'running' && !opts?.attempt) {
      sets.push('started_at = ?');
      vals.push(now());
    }
    if (opts?.attempt !== undefined) { sets.push('attempt = ?'); vals.push(opts.attempt); }
    if (opts?.score !== undefined) { sets.push('score = ?'); vals.push(opts.score); }
    if (opts?.detailJson !== undefined) { sets.push('detail_json = ?'); vals.push(opts.detailJson); }
    if (status === 'completed' || status === 'failed') {
      sets.push('completed_at = ?');
      vals.push(now());
    }
    vals.push(id);
    getDb().prepare(`UPDATE pipeline_stages SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
};
