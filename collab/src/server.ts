import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import DatabaseSQLite from "better-sqlite3";
import path from "path";
import fs from "fs";

const PORT = Number(process.env.HOCUSPOCUS_PORT || 1234);
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "..", "web", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "projects.db");
const sqlite = new DatabaseSQLite(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

// Ensure documents table exists (shared with web app)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    name TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const server = Server.configure({
  port: PORT,
  // Allow connections from any origin (Coolify / reverse proxy handles TLS)
  address: "0.0.0.0",
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  quiet: false,

  extensions: [
    new Logger(),
    new Database({
      fetch: async ({ documentName }) => {
        try {
          const row = sqlite
            .prepare("SELECT data FROM documents WHERE name = ?")
            .get(documentName) as { data: Buffer } | undefined;
          return row?.data ?? null;
        } catch (e) {
          console.error("[collab] fetch error", documentName, e);
          return null;
        }
      },
      store: async ({ documentName, state }) => {
        try {
          sqlite
            .prepare(
              `INSERT INTO documents (name, data, updated_at)
               VALUES (?, ?, unixepoch())
               ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = unixepoch()`
            )
            .run(documentName, state);
        } catch (e) {
          console.error("[collab] store error", documentName, e);
        }
      },
    }),
  ],

  async onAuthenticate({ token, documentName }) {
    // Accept any non-empty token (JWT from web). Full verification can be added later.
    if (!token || typeof token !== "string" || token.length < 8) {
      throw new Error("Unauthorized: missing or invalid token");
    }
    return {
      user: {
        id: token.slice(0, 36),
      },
    };
  },

  async onConnect({ documentName }) {
    console.log(`[collab] ✓ connect → ${documentName}`);
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
  console.log(`[collab] DB: ${dbPath}`);
  console.log(`[collab] Ready for WebSocket connections`);
});
