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


---

## Forums, messages & calls

- **Forums** at `/forums` — create, post, voice notes; link from project sidebar (owner/admin).
- **Messages** at `/messages` — DMs, optional `?to=username`.
- **WebRTC stubs** — `CallPanel` uses `getUserMedia` / `getDisplayMedia` + HTTP signaling at `/api/calls/:id/signal` (in-memory; use Redis for multi-instance).
- Schema auto-migrates on web start (`ensureMigrated` / `npm run db:migrate -w web`).

---

## Demo / placeholder content

One-line control on deploy / redeploy:

```bash
# Seed on startup (idempotent — skips if demo users already exist)
SEED_DEMO=1

# Wipe only demo rows then re-seed
CLEAR_DEMO=1 SEED_DEMO=1
```

Or via CLI (after Postgres is up):

```bash
npm run db:seed -w web                     # seed
CLEAR_DEMO=1 npm run db:seed -w web        # wipe demo only
CLEAR_DEMO=1 SEED_DEMO=1 npm run db:seed -w web
```

**What gets created**

| Item | Count | Notes |
|------|-------|-------|
| Users | 5 | Nigerian names · `c1@mova.cms` … `c5@mova.cms` |
| Projects | 10 | 8 public · 2 private · each has owner + 2 contributors |
| Forums | 4 | 3 public · 1 private · with discussion threads |
| DMs | 3 conversations | Realistic back-and-forth between accounts |

**Login credentials** — password for each account is its own email:

| Email | Password | Username |
|-------|----------|----------|
| c1@mova.cms | c1@mova.cms | chinedu_ok |
| c2@mova.cms | c2@mova.cms | aisha_bello |
| c3@mova.cms | c3@mova.cms | emeka_nwosu |
| c4@mova.cms | c4@mova.cms | fatima_ibrahim |
| c5@mova.cms | c5@mova.cms | tunde_adebayo |

All demo rows use ids prefixed `demo-` so they can be removed safely without touching real data.
