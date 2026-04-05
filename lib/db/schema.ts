export const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  mode TEXT DEFAULT 'midjourney_manual',
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS character_briefs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  natural_input TEXT DEFAULT '',
  name TEXT DEFAULT '',
  gender TEXT DEFAULT 'female',
  age_group TEXT DEFAULT 'Korean high school student, age 17-18',
  face_keywords TEXT DEFAULT '',
  hairstyle TEXT DEFAULT '',
  hair_color TEXT DEFAULT '',
  body_type TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  signature_item TEXT DEFAULT '',
  signature_color TEXT DEFAULT '',
  uniform_style TEXT DEFAULT 'modest Korean school uniform, blazer, white shirt, tie',
  casual_style TEXT DEFAULT '',
  negative_prompts TEXT DEFAULT 'nsfw, nude, deformed, ugly, blurry, low quality, extra limbs, extra fingers, watermark, text, logo, signature, multiple people, extra people',
  prompt_strength TEXT DEFAULT 'medium',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS prompt_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL DEFAULT '',
  user_feedback TEXT DEFAULT '',
  ai_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS candidate_images (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_id TEXT DEFAULT '' REFERENCES prompt_revisions(id),
  image_url TEXT DEFAULT '',
  image_path TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  is_base INTEGER DEFAULT 0,
  memo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS base_characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidate_images(id),
  summary TEXT DEFAULT '',
  base_prompt TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS variant_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_character_id TEXT NOT NULL REFERENCES base_characters(id),
  slot INTEGER NOT NULL,
  shot_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'pending',
  image_url TEXT DEFAULT '',
  image_path TEXT DEFAULT '',
  quality_notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS characterizer_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  base_image_path TEXT DEFAULT '',
  character_name TEXT DEFAULT '',
  signature_item TEXT DEFAULT '',
  signature_color TEXT DEFAULT '',
  school_style TEXT DEFAULT 'modest Korean school uniform, blazer, white shirt, tie',
  after_school_style TEXT DEFAULT '',
  tone_keywords TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS characterizer_anchors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  anchor_key TEXT NOT NULL,
  label TEXT DEFAULT '',
  prompt_used TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS characterizer_shots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_key TEXT NOT NULL,
  shot_index INTEGER NOT NULL,
  label TEXT DEFAULT '',
  prompt_used TEXT DEFAULT '',
  provider TEXT DEFAULT 'nano_banana_2',
  provider_model TEXT DEFAULT 'gemini-3.1-flash-image-preview',
  file_path TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  selection_state TEXT DEFAULT 'unreviewed',
  error_message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  traits TEXT DEFAULT '',
  signature_item TEXT DEFAULT '',
  signature_color TEXT DEFAULT '',
  speech_style TEXT DEFAULT '',
  emotional_weakness TEXT DEFAULT '',
  power_or_specialty TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_bibles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  world_rules TEXT DEFAULT '',
  season_goal TEXT DEFAULT '',
  core_conflict TEXT DEFAULT '',
  ending_direction TEXT DEFAULT '',
  audience TEXT DEFAULT '',
  reference_mood TEXT DEFAULT '',
  raw_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_episode_arcs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT DEFAULT '',
  purpose TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  beginning TEXT DEFAULT '',
  middle TEXT DEFAULT '',
  climax TEXT DEFAULT '',
  ending_hook TEXT DEFAULT '',
  key_characters TEXT DEFAULT '',
  raw_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(project_id, episode_number)
);

CREATE TABLE IF NOT EXISTS story_episode_scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  markdown TEXT DEFAULT '',
  scenes_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(project_id, episode_number)
);

CREATE TABLE IF NOT EXISTS story_clip_packets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  clip_number INTEGER NOT NULL,
  start_time TEXT DEFAULT '00:00',
  end_time TEXT DEFAULT '00:00',
  duration_sec REAL DEFAULT 0,
  packet_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_concepts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  raw_input TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  world_keywords TEXT DEFAULT '',
  romance_level TEXT DEFAULT 'medium',
  mystery_level TEXT DEFAULT 'medium',
  action_level TEXT DEFAULT 'medium',
  ending_mood TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  genre_overlay_json TEXT DEFAULT '{}',
  approved_markdown TEXT DEFAULT '',
  approved_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_boundary_frames (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  frame_id TEXT NOT NULL DEFAULT '',
  timecode TEXT DEFAULT '00:00',
  description TEXT DEFAULT '',
  image_prompt TEXT DEFAULT '',
  raw_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reference_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  title TEXT DEFAULT '',
  raw_text TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  tags_json TEXT DEFAULT '[]',
  user_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reference_analyses (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES reference_sources(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  genre TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  themes_json TEXT DEFAULT '[]',
  character_types_json TEXT DEFAULT '[]',
  relationship_dynamics_json TEXT DEFAULT '[]',
  mystery_elements_json TEXT DEFAULT '[]',
  visual_motifs_json TEXT DEFAULT '[]',
  pacing_notes TEXT DEFAULT '',
  romance_pattern TEXT DEFAULT '',
  twist_pattern TEXT DEFAULT '',
  avoid_cliches_json TEXT DEFAULT '[]',
  raw_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reference_syntheses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  selected_source_ids_json TEXT DEFAULT '[]',
  summary_markdown TEXT DEFAULT '',
  structured_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS story_input_bridges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_synthesis_id TEXT DEFAULT '',
  prompt_ready_summary TEXT DEFAULT '',
  structured_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS prompt_supplements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'ai1',
  supplement_text TEXT DEFAULT '',
  diagnosis_json TEXT DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(project_id, stage)
);

CREATE TABLE IF NOT EXISTS prompt_supplement_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'ai1',
  rule_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'optimizer',
  status TEXT NOT NULL DEFAULT 'candidate',
  score_before REAL,
  score_after REAL,
  effectiveness REAL,
  apply_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
`;
