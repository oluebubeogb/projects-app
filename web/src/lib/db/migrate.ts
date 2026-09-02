/**
 * Simple migration runner. Prefer drizzle-kit migrate in CI/prod.
 * This ensures tables exist on first boot for local/dev convenience.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://projects:projects@localhost:5432/projects";

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("[migrate] ensuring schema...");

  // Enums
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('user', 'admin');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE visibility AS ENUM ('public', 'private');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE join_status AS ENUM ('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  // Tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#2563eb',
      role user_role NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility visibility NOT NULL DEFAULT 'public',
      owner_id TEXT NOT NULL REFERENCES users(id),
      search_text TEXT NOT NULL DEFAULT '',
      latest_snapshot_html TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role member_role NOT NULL DEFAULT 'editor',
      color TEXT NOT NULL DEFAULT '#eab308',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(project_id, user_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS join_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status join_status NOT NULL DEFAULT 'pending',
      message TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role member_role NOT NULL DEFAULT 'editor',
      token TEXT NOT NULL UNIQUE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS commits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      message TEXT NOT NULL DEFAULT 'Update',
      snapshot BYTEA,
      plain_text TEXT DEFAULT '',
      html TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS documents (
      name TEXT PRIMARY KEY,
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      meta TEXT DEFAULT '{}',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_media_project ON media(project_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);`);

  // GIN index for full-text search
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_projects_search_fts
    ON projects USING GIN (to_tsvector('english', coalesce(search_text, '')));
  `);

  console.log("[migrate] done");
  await client.end();
}

main().catch((e) => {
  console.error("[migrate] failed", e);
  process.exit(1);
});
