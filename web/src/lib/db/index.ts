import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://projects:projects@localhost:5433/projects";

const globalForDb = globalThis as unknown as {
  __projectsPgPool?: Pool;
  __projectsDbLogged?: boolean;
};

const pool =
  globalForDb.__projectsPgPool ??
  new Pool({
    connectionString: DATABASE_URL,
    max: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__projectsPgPool = pool;
}

if (!globalForDb.__projectsDbLogged) {
  console.log(`[db] DATABASE_URL=${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")} DATA_DIR=${dataDir}`);
  globalForDb.__projectsDbLogged = true;
}

export const db = drizzle(pool, { schema });
export { pool };

/** Run once at startup — creates tables + GIN full-text index */
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_color TEXT NOT NULL DEFAULT '#2563eb',
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
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
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int),
        updated_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'editor',
        color TEXT NOT NULL DEFAULT '#eab308',
        joined_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int),
        UNIQUE(project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS join_requests (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        message TEXT DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );

      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT NOT NULL REFERENCES users(id),
        accepted_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );

      CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id),
        message TEXT NOT NULL DEFAULT 'Update',
        snapshot BYTEA,
        plain_text TEXT DEFAULT '',
        html TEXT DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );

      CREATE TABLE IF NOT EXISTS documents (
        name TEXT PRIMARY KEY,
        data BYTEA NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
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
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
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
        created_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
      CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
      CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);
      CREATE INDEX IF NOT EXISTS idx_media_project ON media(project_id);
      CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

      -- Full-text search vector on public project content
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector;
      CREATE INDEX IF NOT EXISTS idx_projects_search_vector ON projects USING GIN (search_vector);
    `);
  } finally {
    client.release();
  }
}

/** Rebuild FTS index for one project (PostgreSQL tsvector) */
export async function upsertProjectFts(
  projectId: string,
  title: string,
  description: string,
  body: string
) {
  try {
    await pool.query(
      `UPDATE projects
       SET search_vector =
         setweight(to_tsvector('english', coalesce($2, '')), 'A') ||
         setweight(to_tsvector('english', coalesce($3, '')), 'B') ||
         setweight(to_tsvector('english', coalesce($4, '')), 'C'),
         search_text = $5
       WHERE id = $1`,
      [projectId, title, description, body, `${title} ${description} ${body}`.slice(0, 8000)]
    );
  } catch (e) {
    console.warn("[db] FTS upsert failed", e);
  }
}

/** FTS search — returns project_ids ranked by relevance */
export async function searchProjectsFts(
  query: string,
  limit = 30
): Promise<{ projectId: string; rank: number }[]> {
  try {
    const q = query.trim();
    if (!q) return [];
    const result = await pool.query(
      `SELECT id as "projectId",
              ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM projects
       WHERE visibility = 'public'
         AND search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [q, limit]
    );
    return result.rows.map((r: { projectId: string; rank: number }) => ({
      projectId: r.projectId,
      rank: Number(r.rank),
    }));
  } catch (e) {
    console.warn("[db] FTS search failed, falling back", e);
    return [];
  }
}

let migratePromise: Promise<void> | null = null;

export function ensureMigrated() {
  if (!migratePromise) {
    migratePromise = migrate().catch((e) => {
      console.error("DB migrate error:", e);
      migratePromise = null;
    });
  }
  return migratePromise;
}

if (typeof window === "undefined") {
  // Non-blocking: server can start even if Postgres is still coming up
  ensureMigrated().catch((e) => console.error("[db] background migrate failed", e));
}
