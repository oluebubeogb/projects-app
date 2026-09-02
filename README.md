# Projects v3

Real-time collaborative workspaces.  
**Stack:** Next.js 15 · TipTap · Yjs · Hocuspocus · **PostgreSQL** · **Redis**  
**Domain:** `project.collab.name.ng`

## Architecture (same-origin)

```
Browser ──HTTP──► Next.js (web :3000)
   │
   └──WebSocket──► /collab  ──proxy──► Hocuspocus (collab :1235)
                           │
                    ┌──────┴──────┐
                    │             │
               PostgreSQL      Redis
           (users, projects,  (Yjs docs,
            commits, FTS…)     presence,
                               multi-instance)
```

One public domain. WebSocket lives at `wss://your-domain/collab`.

### Why PostgreSQL + Redis?

| Concern | SQLite (old) | Postgres + Redis (now) |
|---------|--------------|------------------------|
| Concurrent writes | Limited (WAL) | Excellent |
| Horizontal scaling | Single file | Multiple web/collab replicas |
| Full-text search | FTS5 | Built-in `tsvector` + GIN |
| Real-time docs | Shared SQLite file | Redis (low latency) + optional durable Postgres dual-write |
| Backups / ops | File copy | Standard Postgres tooling + Redis AOF |

---

## Local development

```bash
# Start Postgres + Redis (Docker)
docker compose up -d postgres redis

# From repo root
cp .env.example .env
# edit DATABASE_URL / REDIS_URL if needed

npm run install:all

# Migrate schema
cd web && npm run db:migrate && cd ..

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

Env (see `.env.example`):

```env
JWT_SECRET=your-long-secret
DATABASE_URL=postgres://projects:projects@localhost:5432/projects
REDIS_URL=redis://localhost:6379
DATA_DIR=./web/data
HOCUSPOCUS_PORT=1235
# leave NEXT_PUBLIC_* empty for same-origin
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
POSTGRES_USER=projects
POSTGRES_PASSWORD=<strong-db-password>
POSTGRES_DB=projects
# Leave these empty for same-origin (recommended)
NEXT_PUBLIC_HOCUSPOCUS_URL=
NEXT_PUBLIC_APP_URL=
```

`DATABASE_URL` and `REDIS_URL` are constructed automatically inside the compose file.

### 4. Domains (critical)

In Coolify, after the first parse of the compose file you will see services: **web**, **collab**, **postgres**, **redis**.

**web service**
```
https://project.collab.name.ng
```

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

### 6. Cloudflare (if used)

- Proxy: Proxied (orange cloud) is fine
- Network → **WebSockets = On**
- SSL/TLS → **Full**

### 7. Deploy

Click Deploy. After it finishes:

- Open `https://project.collab.name.ng`
- Open an editor
- Browser console should show connected status

On first boot the web process uses the Postgres schema (run `npm run db:migrate` inside the web container if tables are missing, or add an entrypoint).

---

## Migration notes (from SQLite)

1. Export data from old `projects.db` if you need it.
2. New installs start clean on Postgres.
3. Yjs documents live primarily in **Redis** (AOF persistence enabled). Collab also dual-writes to the `documents` table in Postgres when `DATABASE_URL` is set — best of both worlds for durability + multi-instance.
4. Media files remain on the `uploads-data` volume (`DATA_DIR`).

---

## Features

| Feature | Status |
|---------|--------|
| Auth (register / login) | ✅ |
| Create public / private projects | ✅ |
| Live collaborative editor (TipTap + Yjs + Hocuspocus) | ✅ |
| Presence + colored cursors | ✅ |
| Same-origin WebSocket | ✅ |
| Public search (Postgres FTS) | ✅ |
| Join requests + approve | ✅ |
| Invite by email | ✅ |
| Commit history UI | ✅ |
| Public read-only from latest snapshot | ✅ |
| Media library | ✅ |
| Dashboard | ✅ |
| Coolify / Docker ready | ✅ |
| PostgreSQL + Redis | ✅ |
