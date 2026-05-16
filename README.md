# CyberPersona

CyberPersona is a Next.js application for running an immersive AI companion chat experience. It includes a mobile-first chat UI, persona cards, album/media views, admin settings, provider testing tools, call logs, PostgreSQL persistence, and a Docker Compose deployment path for a VPS.

The project is designed around a zero-env default deployment: a fresh checkout can be started with Docker Compose without creating a local `.env` file. Runtime provider credentials are configured from the admin UI and stored in the database.

## Features

- Immersive persona chat with structured turn output and dynamic persona state updates.
- Character card fields for identity, preferences, memories, habits, inner world, and short-term state.
- LLM, image, TTS, and sticker provider settings managed from the admin UI.
- Provider test endpoints and call logs for troubleshooting generation failures.
- PostgreSQL persistence through Prisma migrations.
- Local generated media storage with a configurable default directory.
- Docker Compose stack for Ubuntu VPS deployment.

## Tech stack

- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- **Backend**: Next.js Route Handlers and server-side service modules.
- **Database**: PostgreSQL 16 with Prisma ORM.
- **Runtime**: Node.js 20.
- **Deployment**: Docker, Docker Compose, named Docker volumes.

## Architecture

```text
Browser UI
  -> Next.js App Router pages and client components
  -> API route handlers under src/app/api
  -> CyberPersona service layer under src/lib/cyberpersona
  -> Prisma Client
  -> PostgreSQL

Generated media
  -> runtime media directory setting
  -> default .cyberpersona-media locally
  -> cyberpersona_media Docker volume in Compose
```

Important modules:

- `src/lib/cyberpersona/turn.ts` - chat turn orchestration, state update, and persona card persistence.
- `src/lib/cyberpersona/llm.ts` - LLM prompt contract and structured JSON output parsing.
- `src/lib/cyberpersona/provider-settings.ts` - default provider settings and database-backed admin configuration.
- `src/lib/cyberpersona/db.ts` - Prisma client bootstrap.
- `prisma/schema.prisma` - database schema.
- `docker-compose.yml` - production-like local/VPS stack.

## Requirements

For Docker deployment:

- Docker Engine
- Docker Compose plugin

For local development without Docker:

- Node.js 20+
- npm
- PostgreSQL 16+

## Quick start with Docker

```bash
git clone <your-repo-url> cyberpersona
cd cyberpersona
docker compose up -d --build
```

Then open:

```text
http://localhost:3000
```

Follow logs:

```bash
docker compose logs -f web
```

Stop the stack:

```bash
docker compose down
```

The Compose stack starts PostgreSQL and the web service. The web container runs Prisma migrations before starting Next.js.

## Local development

If you run the app directly on the host, PostgreSQL must be available at the default local URL used by the app:

```text
postgresql://cyberpersona:cyberpersona@localhost:5432/cyberpersona?schema=public
```

Install dependencies and initialize Prisma:

```bash
npm install
npm run db:generate
npm run db:migrate
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Initialization

On first deployment:

1. Start the app with Docker Compose or the local dev command.
2. Open the web UI.
3. Register the first user account.
4. Open the admin area.
5. Configure provider settings for LLM, image generation, TTS, and stickers as needed.
6. Use the admin provider test tools before normal chat testing.

No repository-level `.env` file is required for the default Docker path. Real provider API keys should be entered in the admin UI, not committed to source control.

## Data and media storage

Database data is stored in PostgreSQL.

Generated media is stored under the runtime media directory setting. The default local path is:

```text
.cyberpersona-media
```

In Docker Compose, media is persisted in the named volume:

```text
cyberpersona_media
```

PostgreSQL data is persisted in:

```text
postgres_data
```

These runtime data locations are intentionally ignored by Git.

## Migrating existing local data to a VPS

Recommended migration path:

1. Backup local PostgreSQL data with `pg_dump`.
2. Copy the dump file to the VPS.
3. Restore it into the Compose PostgreSQL container with `psql`.
4. Copy `.cyberpersona-media` to the Docker media volume or to the configured media directory.
5. Start the app and verify login, persona state, provider settings, and media URLs.

Example commands, adjust paths and container names for your environment:

```bash
pg_dump "postgresql://cyberpersona:cyberpersona@localhost:5432/cyberpersona?schema=public" > cyberpersona.dump.sql
scp cyberpersona.dump.sql root@your-vps:/opt/cyberpersona/
scp -r .cyberpersona-media root@your-vps:/opt/cyberpersona/

ssh root@your-vps
cd /opt/cyberpersona
docker compose exec -T db psql -U cyberpersona -d cyberpersona < cyberpersona.dump.sql
```

For large media libraries, use `rsync` instead of `scp`.

## VPS deployment checklist

A typical Ubuntu VPS deployment:

```bash
mkdir -p /opt/cyberpersona
cd /opt/cyberpersona
git clone <your-repo-url> .
docker compose up -d --build
docker compose logs -f web
```

If a reverse proxy is already installed, point it to the web service on port `3000`. If this app is exposed directly, make sure the VPS firewall allows the intended inbound ports.

For the planned domain `cp.itxgp.com`, create an `A` record pointing to the VPS public IPv4 address, then configure the reverse proxy to route that hostname to `127.0.0.1:3000`.

## Useful commands

```bash
npm run build
npm run db:generate
npm run db:migrate
npm run smoke

docker compose ps
docker compose logs -f web
docker compose exec web npm run db:migrate
docker compose exec db psql -U cyberpersona -d cyberpersona
docker compose down
```

## Security notes

- Do not commit `.env`, `.env.local`, provider API keys, database dumps, generated media, or logs.
- Runtime provider secrets are stored in the database and masked in the admin UI.
- `.gitignore` excludes `.env`, `.env*.local`, `.cyberpersona-media/`, `data/`, and log files.
- Review `docker-compose.yml` before public production use and rotate default database credentials if the database is exposed outside the internal Compose network.

## License

MIT License. See `LICENSE` for details.
