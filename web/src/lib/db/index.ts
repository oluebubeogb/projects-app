import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://projects:projects@localhost:5432/projects";

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
  __db?: Db;
  __dbLogged?: boolean;
};

function getClient() {
  if (!globalForDb.__pgClient) {
    globalForDb.__pgClient = postgres(connectionString, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalForDb.__pgClient;
}

function getDb(): Db {
  if (!globalForDb.__db) {
    globalForDb.__db = drizzle(getClient(), { schema });
    if (!globalForDb.__dbLogged) {
      console.log(
        `[db] using PostgreSQL (${connectionString.replace(/:[^:@]+@/, ":****@")})`
      );
      globalForDb.__dbLogged = true;
    }
  }
  return globalForDb.__db;
}

/** Lazy proxy so importing this module during `next build` does not open a connection */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Full-text search helper using Postgres tsvector */
export async function upsertProjectFts(
  projectId: string,
  title: string,
  description: string,
  body: string
) {
  try {
    const searchText = [title, description, body].filter(Boolean).join(" ");
    await db.execute(
      sql`UPDATE projects SET search_text = ${searchText}, updated_at = now() WHERE id = ${projectId}`
    );
  } catch (e) {
    console.warn("[db] FTS upsert failed", e);
  }
}

/** Full-text search via Postgres. Returns ranked project IDs. */
export async function searchProjectsFts(
  query: string,
  limit = 30
): Promise<{ projectId: string; rank: number }[]> {
  try {
    const q = query.trim();
    if (!q) return [];

    const rows = await db.execute<{ project_id: string; rank: number }>(sql`
      SELECT id AS project_id,
             ts_rank(
               to_tsvector('english', coalesce(search_text, '')),
               plainto_tsquery('english', ${q})
             ) AS rank
      FROM projects
      WHERE visibility = 'public'
        AND to_tsvector('english', coalesce(search_text, ''))
            @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);

    return (rows as unknown as { project_id: string; rank: number }[]).map(
      (r) => ({
        projectId: r.project_id,
        rank: Number(r.rank) || 0,
      })
    );
  } catch (e) {
    console.warn("[db] FTS search failed, falling back", e);
    return [];
  }
}

/** Lightweight health check */
export async function dbHealth() {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
