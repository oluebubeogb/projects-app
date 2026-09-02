import { Server } from "@hocuspocus/server";
import { Redis } from "@hocuspocus/extension-redis";
import { Logger } from "@hocuspocus/extension-logger";
import { Database } from "@hocuspocus/extension-database";

const PORT = Number(process.env.HOCUSPOCUS_PORT || 1235);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL;

// Parse redis URL for host/port
function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "127.0.0.1",
      port: Number(u.port || 6379),
      password: u.password || undefined,
      db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

const redisOpts = parseRedisUrl(REDIS_URL);

let pgClient: any = null;
async function getPg() {
  if (!DATABASE_URL) return null;
  if (pgClient) return pgClient;
  try {
    const postgres = (await import("postgres")).default;
    pgClient = postgres(DATABASE_URL, { max: 5, prepare: false });
    await pgClient`
      CREATE TABLE IF NOT EXISTS documents (
        name TEXT PRIMARY KEY,
        data BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    console.log("[collab] Postgres document store ready");
    return pgClient;
  } catch (e) {
    console.warn("[collab] Postgres document store unavailable", e);
    return null;
  }
}

const extensions: any[] = [
  new Logger(),
  // Redis: multi-instance sync + in-memory speed
  new Redis({
    host: redisOpts.host,
    port: redisOpts.port,
    ...(redisOpts.password ? { options: { password: redisOpts.password } } : {}),
  }),
];

// Durable dual-write to Postgres when available
if (DATABASE_URL) {
  extensions.push(
    new Database({
      fetch: async ({ documentName }) => {
        try {
          const pg = await getPg();
          if (!pg) return null;
          const rows = await pg`
            SELECT data FROM documents WHERE name = ${documentName} LIMIT 1
          `;
          if (!rows[0]?.data) return null;
          return Buffer.from(rows[0].data);
        } catch (e) {
          console.error("[collab] pg fetch error", documentName, e);
          return null;
        }
      },
      store: async ({ documentName, state }) => {
        try {
          const pg = await getPg();
          if (!pg) return;
          await pg`
            INSERT INTO documents (name, data, updated_at)
            VALUES (${documentName}, ${state}, now())
            ON CONFLICT (name) DO UPDATE
            SET data = EXCLUDED.data, updated_at = now()
          `;
        } catch (e) {
          console.error("[collab] pg store error", documentName, e);
        }
      },
    })
  );
}

const server = Server.configure({
  name: process.env.HOCUSPOCUS_NAME || `collab-${PORT}`,
  port: PORT,
  address: "0.0.0.0",
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  quiet: false,

  extensions,

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

server.listen().then(() => {
  console.log(`[collab] Hocuspocus listening on 0.0.0.0:${PORT}`);
  console.log(`[collab] Redis: ${redisOpts.host}:${redisOpts.port}`);
  if (DATABASE_URL) {
    console.log(`[collab] Durable store: PostgreSQL (dual-write)`);
  } else {
    console.log(`[collab] Durable store: Redis only (set DATABASE_URL for Postgres dual-write)`);
  }
  console.log(`[collab] Ready for WebSocket connections`);
});
