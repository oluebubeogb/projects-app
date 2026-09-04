import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import { Redis } from "@hocuspocus/extension-redis";
import { Pool } from "pg";

const PORT = Number(process.env.HOCUSPOCUS_PORT || 1236);
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://projects:projects@localhost:5433/projects";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "localhost",
      port: Number(u.port) || 6380,
      password: u.password || process.env.REDIS_PASSWORD || undefined,
    };
  } catch {
    return { host: "localhost", port: 6380 };
  }
}

const redisCfg = parseRedisUrl(REDIS_URL);

async function ensureDocumentsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        name TEXT PRIMARY KEY,
        data BYTEA NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (extract(epoch from now())::int)
      );
    `);
  } finally {
    client.release();
  }
}

const server = Server.configure({
  port: PORT,
  address: "0.0.0.0",
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  quiet: false,
  name: process.env.HOCUSPOCUS_NAME || `collab-${process.pid}`,

  extensions: [
    new Logger(),
    new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      options: redisCfg.password ? { password: redisCfg.password } : {},
    }),
    new Database({
      fetch: async ({ documentName }) => {
        try {
          const result = await pool.query(
            "SELECT data FROM documents WHERE name = $1",
            [documentName]
          );
          const row = result.rows[0] as { data: Buffer } | undefined;
          return row?.data ?? null;
        } catch (e) {
          console.error("[collab] fetch error", documentName, e);
          return null;
        }
      },
      store: async ({ documentName, state }) => {
        try {
          await pool.query(
            `INSERT INTO documents (name, data, updated_at)
             VALUES ($1, $2, extract(epoch from now())::int)
             ON CONFLICT (name) DO UPDATE
             SET data = EXCLUDED.data,
                 updated_at = extract(epoch from now())::int`,
            [documentName, state]
          );
        } catch (e) {
          console.error("[collab] store error", documentName, e);
        }
      },
    }),
  ],

  async onAuthenticate({ token, documentName, requestHeaders }) {
    if (!token || typeof token !== "string" || token.length < 8) {
      console.warn("[collab] auth rejected – missing/invalid token", {
        documentName,
        tokenLen: token ? String(token).length : 0,
        origin: requestHeaders?.origin || requestHeaders?.Origin,
      });
      throw new Error("Unauthorized: missing or invalid token");
    }
    console.log("[collab] auth ok", {
      documentName,
      tokenPrefix: token.slice(0, 12) + "…",
      origin: requestHeaders?.origin || requestHeaders?.Origin,
    });
    return {
      user: {
        id: token.slice(0, 36),
      },
    };
  },

  async onConnect({ documentName, requestHeaders }) {
    console.log(`[collab] ✓ connect → ${documentName}`, {
      origin: requestHeaders?.origin || requestHeaders?.Origin,
      host: requestHeaders?.host || requestHeaders?.Host,
    });
  },

  async onDisconnect({ documentName }) {
    console.log(`[collab] ✗ disconnect ← ${documentName}`);
  },

  async onLoadDocument({ documentName }) {
    console.log(`[collab] load document ${documentName}`);
  },
});

ensureDocumentsTable()
  .then(() => server.listen())
  .then(() => {
    console.log(`[collab] Hocuspocus listening on 0.0.0.0:${PORT}`);
    console.log(
      `[collab] PostgreSQL: ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`
    );
    console.log(
      `[collab] Redis: ${REDIS_URL.replace(/:[^:@/]+@/, ":***@")}`
    );
    console.log(`[collab] Ready for WebSocket connections`);
  })
  .catch((e) => {
    console.error("[collab] failed to start", e);
    process.exit(1);
  });
