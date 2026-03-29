<p align="center">
  <img src="public/kllapp-logo.svg" alt="KLLAPP" height="40" />
</p>

<p align="center">
  <strong>The self-hosted alternative to Float, Harvest, and Productive.io</strong><br/>
  Resource planning, time tracking, and project profitability — all in one real-time collaborative spreadsheet.
</p>

<p align="center">
  <a href="https://github.com/oxynum/kllapp/actions/workflows/ci.yml"><img src="https://github.com/oxynum/kllapp/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Sustainable%20Use-blue" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/next.js-16-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="Docker" />
</p>

<p align="center">
  <img src="public/screenshots/kllapp-preview.png" alt="KLLAPP — Spreadsheet view with project detail panel" width="900" />
</p>

---

## Why kllapp?

Most resource planning tools like **Float** ($7/user/mo), **Harvest** ($9/user/mo), **Runn** ($11/user/mo), or **Productive.io** ($24/user/mo) charge per seat and lock your data in their cloud.

kllapp gives you the same capabilities — **on your own infrastructure, with no per-seat fees**.

| Feature | Float | Harvest | Runn | kllapp |
|---------|-------|---------|------|--------|
| Resource scheduling | Yes | No | Yes | **Yes** |
| Time tracking | Yes | Yes | Yes | **Yes** |
| Budget monitoring | No | Yes | Yes | **Yes** |
| Profitability reports | No | Basic | Yes | **Yes** |
| AI assistant | No | No | No | **Yes** |
| Real-time collaboration | No | No | No | **Yes** |
| Desk booking / Floor plans | No | No | No | **Yes** |
| Self-hosted | No | No | No | **Yes** |
| Per-seat pricing | $7+ | $9+ | $11+ | **Free** |

## Features

- **Spreadsheet-based planning** — Canvas-rendered grid with real-time collaboration via Liveblocks
- **Time tracking** — Log hours or days per user, per project, per day
- **Budget monitoring** — Visual gauges showing budget consumption per project with color-coded alerts
- **Revenue forecasting** — Editable project rows for projections (CA prévisionnel)
- **Profitability analysis** — Revenue, costs, margin per project with donut charts and collaborator breakdown
- **Workplace management** — Configure offices, remote work, client sites + interactive floor plan editor
- **Desk booking** — Reserve desks on visual floor plans with team visibility
- **Calendar integration** — Google Calendar, Outlook, Apple Calendar via iCal
- **AI assistant (Corinne)** — Claude-powered chat for querying data, checking availability, and performing actions via voice or text
- **Availability indicators** — Per-user fill bars in column headers showing daily workload
- **Overallocation alerts** — Automatic warnings when team members are overbooked
- **Multi-organization** — Support multiple organizations with role-based access (admin, manager, collaborator)
- **Super-admin dashboard** — Cross-organization metrics for platform administrators
- **Multi-language** — French and English (i18n ready for more)

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/oxynum/kllapp.git
cd kllapp
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET (run: openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up -d
```

Open http://localhost:3000

### Manual Setup

**Prerequisites:** Node.js >= 20, PostgreSQL >= 16, Redis (optional)

```bash
git clone https://github.com/oxynum/kllapp.git
cd kllapp
npm ci
docker compose up -d              # Start PostgreSQL + Redis
cp .env.example .env.local        # Configure environment
npm run db:push                   # Create database schema
npm run db:seed                   # Sample data (optional)
npm run dev                       # http://localhost:3000
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Signing key — `openssl rand -hex 32` |
| `AUTH_URL` | Yes (prod) | Your production URL |
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `LIVEBLOCKS_SECRET_KEY` | Yes | Real-time collaboration |
| `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` | Yes | Liveblocks public key |
| `ANTHROPIC_API_KEY` | No | Claude AI features (bring your own key) |
| `SMTP_HOST` | No | Email via SMTP (or use `AUTH_RESEND_KEY` for Resend) |
| `S3_ENDPOINT` | No | S3-compatible storage for file uploads |
| `REDIS_URL` | No | Caching and rate limiting |

## Deployment

### Docker (self-hosted VPS)

```bash
git clone https://github.com/oxynum/kllapp.git && cd kllapp
cp .env.example .env  # edit with your values
docker compose -f docker-compose.prod.yml up -d
```

### Railway

1. Fork this repo
2. Create a new Railway project → Deploy from GitHub
3. Add PostgreSQL and Redis plugins
4. Set environment variables → Deploy

### Vercel + Supabase

1. Create a [Supabase](https://supabase.com) project
2. Deploy to [Vercel](https://vercel.com) from GitHub
3. Set `POSTGRES_URL` from Supabase, configure other env vars
4. Run `npx tsx scripts/migrate-prod.ts` for initial migration

### Coolify / Caprover

Use `docker-compose.prod.yml` as your Docker Compose configuration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components) |
| Database | [PostgreSQL 16](https://postgresql.org) via [Drizzle ORM](https://orm.drizzle.team) |
| Real-time | [Liveblocks](https://liveblocks.io) |
| Grid | [@glideapps/glide-data-grid](https://grid.glideapps.com) (canvas-based) |
| AI | [Anthropic Claude](https://anthropic.com) via `@anthropic-ai/sdk` |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Auth | [NextAuth v5](https://authjs.dev) (Google OAuth + Magic Link) |
| Email | Resend or any SMTP provider (configurable) |
| i18n | [next-intl](https://next-intl.dev) |
| Canvas | [Konva](https://konvajs.org) (floor plan editor & desk booking) |

## Development

```bash
npm run dev           # Dev server
npm run build         # Production build
npm run lint          # Lint
npm run test          # Tests
npm run test:coverage # Tests with coverage
npm run db:studio     # Database viewer
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

[Sustainable Use License](LICENSE) — Free for self-hosted use. Commercial redistribution as a hosted service requires written permission. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://oxynum.fr">Oxynum</a>
</p>
