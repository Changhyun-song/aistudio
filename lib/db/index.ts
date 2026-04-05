import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA } from './schema';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'character.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA);

  // Migrate: add mode column to projects if missing
  const cols = _db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!cols.find(c => c.name === 'mode')) {
    _db.exec("ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'midjourney_manual'");
  }

  // Migrate: add genre_overlay_json column to story_concepts if missing
  const conceptCols = _db.prepare("PRAGMA table_info(story_concepts)").all() as { name: string }[];
  if (!conceptCols.find(c => c.name === 'genre_overlay_json')) {
    _db.exec("ALTER TABLE story_concepts ADD COLUMN genre_overlay_json TEXT DEFAULT '{}'");
  }

  // Migrate: recreate prompt_supplements without FK so __global__ project_id works
  try {
    const hasFk = _db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='prompt_supplements'").get() as { sql: string } | undefined;
    if (hasFk?.sql?.includes('REFERENCES')) {
      _db.exec(`
        CREATE TABLE IF NOT EXISTS prompt_supplements_new (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          stage TEXT NOT NULL DEFAULT 'ai1',
          supplement_text TEXT DEFAULT '',
          diagnosis_json TEXT DEFAULT '[]',
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(project_id, stage)
        );
        INSERT OR IGNORE INTO prompt_supplements_new SELECT * FROM prompt_supplements;
        DROP TABLE prompt_supplements;
        ALTER TABLE prompt_supplements_new RENAME TO prompt_supplements;
      `);
    }
  } catch { /* table might not exist yet, schema will create it */ }

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
