# Projects

Real-time collaborative workspaces.  
**Stack:** Next.js 15 · TipTap · Yjs · Hocuspocus · SQLite  
**Domain:** `project.collab.name.ng`

## v1 (this release)

| Feature | Status |
|---------|--------|
| Auth (register / login) | ✅ |
| Create public / private projects | ✅ |
| Live collaborative editor (TipTap + Yjs + Hocuspocus) | ✅ |
| Presence + colored cursors | ✅ |
| Public search (title, description, content) | ✅ |
| Private projects (not in search; view via link) | ✅ |
| Join requests + owner/admin approve | ✅ |
| Dashboard | ✅ |
| Coolify / Docker ready | ✅ |

## v2 (next)

- Invite by email
- Commit history UI (git-like)
- Per-user attribution underlines (green for self, unique colors for others)
- “Show my inputs” toggle
- Public read-only content from latest snapshot (no login required to *read*)
- Media library

## v3

- Admin dashboard with dynamic nav (port HQ patterns)
- Richer toolbar / media insert
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

# Terminal 1 — collab server
cd collab && npm run dev
# → ws://localhost:1234

# Terminal 2 — web
cd web && npm run dev
# → http://localhost:3000
```

Env (optional):

```env
JWT_SECRET=your-long-secret
DATA_DIR=./web/data
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
```

## Deploy on Coolify (VPS)

1. Push this repo to Git.
2. In Coolify, create a **Docker Compose** resource pointing at this repo.
3. Set env:
   - `JWT_SECRET` — strong random string
   - `NEXT_PUBLIC_HOCUSPOCUS_URL` — `wss://project.collab.name.ng` (or a subdomain like `ws.project.collab.name.ng` if you split)
4. Map domain `project.collab.name.ng` → web service port `3000`.
5. For WebSocket: either
   - same domain with path proxy to collab `:1234`, or
   - subdomain `ws.project.collab.name.ng` → collab `:1234` (easier).

Persistent volume is already defined (`projects-data`) for the SQLite DB shared by web + collab.

### WebSocket behind reverse proxy

Nginx / Traefik must pass:

```
Upgrade: $http_upgrade
Connection: upgrade
```

Coolify’s proxy supports this for the collab service if you expose it.

---

## Architecture

```
Browser ──HTTP──► Next.js (web :3000)
   │                  │
   └──WebSocket──────► Hocuspocus (collab :1234)
                           │
                    shared SQLite (/data/projects.db)
                    · users, projects, members
                    · join_requests, invites
                    · documents (Yjs binary state)
                    · commits (v2)
```

Each project maps to one Yjs document named by `projectId`.  
Hocuspocus persists document state; TipTap Collaboration + CollaborationCursor handle concurrent edits and presence.

---

## License

Private — for project.collab.name.ng
