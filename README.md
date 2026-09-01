# Projects v2

Real-time collaborative workspaces.  
**Stack:** Next.js 15 · TipTap · Yjs · Hocuspocus · SQLite  
**Domain:** `project.collab.name.ng`

## Design

HQ dark-first theme (from design inspo):

- Background `#0f1117`, surface `#1c1f2a`, border `#2a2e3a`
- Accent `#3b82f6`, success `#22c55e`, danger `#ef4444`
- Inter font, 8px radius

## v2 features

| Feature | Status |
|---------|--------|
| Auth (register / login) | ✅ |
| Create public / private projects | ✅ |
| Live collaborative editor (TipTap + Yjs + Hocuspocus) | ✅ |
| Presence + colored cursors | ✅ |
| **WebSocket reliability** (connect / retry / status) | ✅ fixed |
| Public search | ✅ |
| Join requests + approve | ✅ |
| **Invite by email** | ✅ |
| **Commit history UI** (git-like snapshots) | ✅ |
| **Show my inputs** toggle | ✅ |
| **Public read-only** from latest snapshot | ✅ |
| **Media library** | ✅ |
| Dashboard | ✅ |
| Coolify / Docker ready | ✅ |

## v3 (planned)

- Admin dashboard with dynamic nav (HQ patterns)
- Richer toolbar / media insert into editor
- Notifications
- Postgres + FTS upgrade

---

## Local development

```bash
# From repo root
npm install
cd web && npm install
cd ../collab && npm install
cd ..

# Terminal 1 — collab server (MUST be running for live editor)
cd collab && npm run dev
# → ws://localhost:1234

# Terminal 2 — web
cd web && npm run dev
# → http://localhost:3000
```

Or from root:

```bash
npm run install:all
npm run dev   # both via concurrently
```

Env (copy `.env.example`):

```env
JWT_SECRET=your-long-secret
DATA_DIR=./web/data
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
HOCUSPOCUS_PORT=1234
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### WebSocket forever-connecting?

1. Confirm collab process is up: `curl` won’t work — check logs for `Hocuspocus listening on 0.0.0.0:1234`.
2. `NEXT_PUBLIC_HOCUSPOCUS_URL` must match that port (default `ws://localhost:1234`).
3. Browser console should log `[editor] connecting to ws://…` and `[editor] status → connected`.
4. Behind Coolify/nginx, proxy must pass `Upgrade` + `Connection: upgrade` to the collab service.
5. Use the **Retry** button on the editor status bar if it drops.

---

## Deploy on Coolify (VPS)

1. Push this repo to Git.
2. Create a **Docker Compose** resource.
3. Env:
   - `JWT_SECRET` — strong random string
   - `NEXT_PUBLIC_HOCUSPOCUS_URL` — `wss://project.collab.name.ng` **or** a dedicated `wss://ws.…` subdomain
   - `NEXT_PUBLIC_APP_URL` — `https://project.collab.name.ng`
4. Map domain → web `:3000`. For WebSocket either same host with path proxy to collab `:1234`, or subdomain → collab `:1234`.
5. Volume `projects-data` holds SQLite + uploads.

---

## Architecture

```
Browser ──HTTP──► Next.js (web :3000)
   │                  │
   └──WebSocket──────► Hocuspocus (collab :1234)
                           │
                    shared SQLite (/data/projects.db)
                    · users, projects, members
                    · join_requests, invites, commits, media
                    · documents (Yjs state)
```

Public visitors see `projects.latest_snapshot_html` without auth. Editors create commits (snapshots) from the History panel.
