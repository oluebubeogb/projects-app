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

// Ensure documents table exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    name TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const server = Server.configure({
  port: PORT,
  extensions: [
    new Logger(),
    new Database({
      fetch: async ({ documentName }) => {
        const row = sqlite
          .prepare("SELECT data FROM documents WHERE name = ?")
          .get(documentName) as { data: Buffer } | undefined;
        return row?.data ?? null;
      },
      store: async ({ documentName, state }) => {
        sqlite
          .prepare(
            `INSERT INTO documents (name, data, updated_at)
             VALUES (?, ?, unixepoch())
             ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = unixepoch()`
          )
          .run(documentName, state);
      },
    }),
  ],

  async onAuthenticate({ token, documentName }) {
    // token is JWT from the web app; for v1 we accept any non-empty token
    // and decode name/color from query params passed by the client
    if (!token) {
      throw new Error("Unauthorized");
    }
    // Client sends: token + name + color as awareness later
    return {
      user: {
        id: token.slice(0, 36), // best-effort
      },
    };
  },

  async onConnect({ documentName, requestParameters }) {
    console.log(`[collab] connect → ${documentName}`);
  },

  async onDisconnect({ documentName }) {
    console.log(`[collab] disconnect ← ${documentName}`);
  },
});

server.listen().then(() => {
  console.log(`[collab] Hocuspocus listening on :${PORT}`);
  console.log(`[collab] DB: ${dbPath}`);
});
