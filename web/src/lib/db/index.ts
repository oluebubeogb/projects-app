import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "projects.db");

if (!(globalThis as unknown as { __projectsDbLogged?: boolean }).__projectsDbLogged) {
  console.log(`[db] DATA_DIR=${dataDir} path=${dbPath}`);
  (globalThis as unknown as { __projectsDbLogged?: boolean }).__projectsDbLogged = true;
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
export { sqlite };

/** Run once at startup — creates tables + FTS5 */
export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#2563eb',
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public',
      owner_id TEXT NOT NULL REFERENCES users(id),
      search_text TEXT NOT NULL DEFAULT '',
      latest_snapshot_html TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'editor',
      color TEXT NOT NULL DEFAULT '#eab308',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS join_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      token TEXT NOT NULL UNIQUE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      accepted_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS commits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      message TEXT NOT NULL DEFAULT 'Update',
      snapshot BLOB,
      plain_text TEXT DEFAULT '',
      html TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS documents (
      name TEXT PRIMARY KEY,
      data BLOB NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      path TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      meta TEXT DEFAULT '{}',
      read_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_projects_search ON projects(search_text);
    CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
    CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
    CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_project ON media(project_id);
    CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
  `);

  // Safe column adds for existing DBs
  const tryAlter = (sql: string) => {
    try {
      sqlite.exec(sql);
    } catch {
      /* already exists */
    }
  };
  tryAlter(`ALTER TABLE projects ADD COLUMN latest_snapshot_html TEXT DEFAULT ''`);
  tryAlter(`ALTER TABLE commits ADD COLUMN html TEXT DEFAULT ''`);
  tryAlter(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);

  // FTS5 full-text search over public project content
  try {
    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
        project_id UNINDEXED,
        title,
        description,
        body,
        tokenize = 'porter unicode61'
      );
    `);
  } catch (e) {
    console.warn("[db] FTS5 unavailable:", e);
  }
}

/** Rebuild FTS index for one project */
export function upsertProjectFts(projectId: string, title: string, description: string, body: string) {
  try {
    sqlite.prepare(`DELETE FROM projects_fts WHERE project_id = ?`).run(projectId);
    sqlite
      .prepare(
        `INSERT INTO projects_fts (project_id, title, description, body) VALUES (?, ?, ?, ?)`
      )
      .run(projectId, title, description, body);
  } catch (e) {
    console.warn("[db] FTS upsert failed", e);
  }
}

/** FTS search — returns project_ids ranked by relevance */
export function searchProjectsFts(query: string, limit = 30): { projectId: string; rank: number }[] {
  try {
    const q = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"*`)
      .join(" ");
    if (!q) return [];
    const rows = sqlite
      .prepare(
        `SELECT project_id as projectId, rank
         FROM projects_fts
         WHERE projects_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(q, limit) as { projectId: string; rank: number }[];
    return rows;
  } catch (e) {
    console.warn("[db] FTS search failed, falling back", e);
    return [];
  }
}

if (typeof window === "undefined") {
  try {
    migrate();
  } catch (e) {
    console.error("DB migrate error:", e);
  }
}
