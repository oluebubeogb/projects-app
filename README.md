# Projects (PostgreSQL + Redis)

Real-time collaborative workspaces.  
**Stack:** Next.js 15 · TipTap · Yjs · Hocuspocus · **PostgreSQL** · **Redis**  
**Domain example:** `project.collab.name.ng`

## Architecture (same-origin)

```
Browser ──HTTP──► Next.js (web :3010)
   │
   └──WebSocket──► /collab  ──proxy──► Hocuspocus (collab :1236)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         PostgreSQL                  Redis
      (app data + Yjs docs)     (multi-instance pub/sub)
```

One public domain. WebSocket lives at `wss://your-domain/collab`.

Media files still live on a shared volume under `DATA_DIR` (default `/data`).

---

## Local development

### 1. Start Postgres + Redis

```bash
docker compose up -d postgres redis
```

Or use your own instances and set `DATABASE_URL` / `REDIS_URL`.

### 2. Install & run

```bash
cp .env.example .env
# edit JWT_SECRET, DATABASE_URL, REDIS_URL if needed

npm run install:all

# Terminal — both web + collab
npm run dev
```

- App: http://localhost:3010  
- Collab WS: ws://localhost:1236  

Tables are created automatically on first start (web + collab).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5433/db` |
| `REDIS_URL` | `redis://host:6380` (Hocuspocus scaling) |
| `JWT_SECRET` | Long random secret for auth cookies |
| `DATA_DIR` | Media uploads directory (default `./web/data` or `/data` in Docker) |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | Leave empty for same-origin `/collab` |
| `NEXT_PUBLIC_APP_URL` | Leave empty in production (uses request host) |

---

## Deploy with Docker Compose

```bash
docker compose up -d --build
```

Services: **postgres**, **redis**, **web** (3010), **collab** (internal 1236).

### Coolify / reverse proxy

- **web**: map domain → port 3010  
- **collab**: map `https://your-domain/collab` → container port **1236**  
- Enable WebSockets on the proxy  
- Set `JWT_SECRET`, leave `NEXT_PUBLIC_*` empty for same-origin

---

## Features

| Feature | Status |
|---------|--------|
| Auth (register / login) | ✅ |
| Create public / private projects | ✅ |
| Live collaborative editor (TipTap + Yjs + Hocuspocus) | ✅ |
| Presence + colored cursors | ✅ |
| Same-origin WebSocket | ✅ |
| PostgreSQL persistence + full-text search | ✅ |
| Redis for multi-instance collab | ✅ |
| Public search | ✅ |
| Join requests + approve | ✅ |
| Invite by email | ✅ |
| Commit history UI | ✅ |
| Public read-only from latest snapshot | ✅ |
| Media library | ✅ |
| Dashboard + admin | ✅ |
| Coolify / Docker ready | ✅ |

---

## Promote an admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Forever “Connecting…” | Proxy path `/collab` → collab:1236; WebSockets on |
| DB errors on boot | `DATABASE_URL`, Postgres healthy, user/db exist |
| Collab not syncing across instances | `REDIS_URL` reachable from all collab containers |
| Invite shows localhost | Leave `NEXT_PUBLIC_APP_URL` empty |
