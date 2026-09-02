# Projects v2

Real-time collaborative workspaces.  
**Stack:** Next.js 15 · TipTap · Yjs · Hocuspocus · SQLite  
**Domain:** `project.collab.name.ng`

## Architecture (same-origin)

```
Browser ──HTTP──► Next.js (web :3000)
   │
   └──WebSocket──► /collab  ──proxy──► Hocuspocus (collab :1235)
                           │
                    shared SQLite (/data/projects.db)
```

One public domain. WebSocket lives at `wss://your-domain/collab`.

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
# → ws://localhost:1235

# Terminal 2 — web
cd web && npm run dev
# → http://localhost:3000
```

Or from root:

```bash
npm run install:all
npm run dev
```

Env (copy `.env.example`):

```env
JWT_SECRET=your-long-secret
DATA_DIR=./web/data
HOCUSPOCUS_PORT=1235
# leave NEXT_PUBLIC_* empty for same-origin, or set for local:
# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1235
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deploy on Coolify (fresh)

### 1. Push this repo to GitHub

### 2. Create a **Docker Compose** resource in Coolify

- Connect the repo
- Build pack: Docker Compose
- Compose file: `docker-compose.yml`

### 3. Environment variables

```env
JWT_SECRET=<strong-random-string>
# Leave these empty for same-origin (recommended)
NEXT_PUBLIC_HOCUSPOCUS_URL=
NEXT_PUBLIC_APP_URL=
```

### 4. Domains (critical)

In Coolify, after the first parse of the compose file you will see two services: **web** and **collab**.

**web service**
```
https://project.collab.name.ng
```
(or your real domain — no port needed, Coolify maps to container 3000)

**collab service**
```
https://project.collab.name.ng/collab:1235
```

The `:1235` tells Coolify “proxy this path to container port 1235”.  
The path `/collab` matches what the client connects to.

### 5. DNS

Only one record needed:

| Type | Name | Target |
|------|------|--------|
| A or CNAME | `project` (or `@`) | your VPS / Coolify IP |

No `ws.` subdomain required.

### 6. Cloudflare (if used)

- Proxy: Proxied (orange cloud) is fine
- Network → **WebSockets = On**
- SSL/TLS → **Full**

### 7. Deploy

Click Deploy. After it finishes:

- Open `https://project.collab.name.ng`
- Open an editor
- Browser console should show:
  ```
  [editor] using same-origin WS wss://project.collab.name.ng/collab
  [editor] status → connected
  ```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Forever “Connecting…” | Coolify domain on **collab** must include `/collab:1235` |
| TLS / handshake errors | Only one domain; no separate `ws.` needed |
| Invite link shows localhost | `NEXT_PUBLIC_APP_URL` empty + invite route uses request host (already fixed) |
| Build fails | Expand the Coolify build log under `npm run build` and look for TypeScript / module errors |

---

## Features

| Feature | Status |
|---------|--------|
| Auth (register / login) | ✅ |
| Create public / private projects | ✅ |
| Live collaborative editor (TipTap + Yjs + Hocuspocus) | ✅ |
| Presence + colored cursors | ✅ |
| Same-origin WebSocket | ✅ |
| Public search | ✅ |
| Join requests + approve | ✅ |
| Invite by email | ✅ |
| Commit history UI | ✅ |
| Show my inputs toggle | ✅ |
| Public read-only from latest snapshot | ✅ |
| Media library | ✅ |
| Dashboard | ✅ |
| Coolify / Docker ready | ✅ |
