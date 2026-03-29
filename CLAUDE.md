# kllapp — AI Assistant Guide

## Project

kllapp is a self-hosted resource planning, time tracking, and project profitability platform built with Next.js 16 (App Router), TypeScript, Drizzle ORM, PostgreSQL, Liveblocks, and Tailwind CSS v4.

## Quick Setup (for AI agents)

```bash
# 1. Prerequisites: Node.js >= 20, Docker
# 2. Clone and install
git clone https://github.com/oxynum/kllapp.git
cd kllapp
npm ci

# 3. Start database + Redis
docker compose up -d

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local — minimum required:
#   AUTH_SECRET=<run: openssl rand -hex 32>
#   POSTGRES_URL=postgresql://kllapp:kllapp_dev@localhost:5433/kllapp  (from docker-compose)
#   LIVEBLOCKS_SECRET_KEY=<from liveblocks.io>
#   NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=<from liveblocks.io>

# 5. Create database schema
npm run db:push

# 6. Seed sample data (optional)
npm run db:seed

# 7. Run
npm run dev
# → http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Production start (runs migrations first) |
| `npm run lint` | ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run db:push` | Sync Drizzle schema to database |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Drizzle Studio (visual DB viewer) |

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, onboarding, verify
│   ├── (dashboard)/        # Main app (sheet, team, settings, workplace)
│   ├── (legal)/            # Privacy, terms
│   ├── admin/              # Super-admin dashboard
│   └── api/                # API routes (ai, auth, liveblocks, upload)
├── components/
│   ├── sheet/              # Main spreadsheet grid (glide-data-grid canvas)
│   ├── floor-plan/         # Floor plan editor (Konva canvas)
│   ├── desk-booking/       # Desk booking canvas
│   ├── admin/              # Admin dashboard components
│   ├── ai/                 # AI chat components
│   ├── workplace/          # Workplace config
│   ├── team/               # Team management
│   └── ui/                 # Shared UI (avatar, logo, sidebar, agent-icon)
├── lib/
│   ├── db/                 # Drizzle schema, queries, seed
│   ├── ai/                 # AI agent, tools, permissions, context
│   ├── calendar/           # iCal service (fetch, parse, cache)
│   └── utils/              # Date helpers, avatars
├── hooks/                  # Custom React hooks
├── messages/               # i18n translations (fr.json, en.json)
├── i18n/                   # next-intl config
└── types/                  # TypeScript type definitions
```

## Key Conventions

- **Server Components by default** — use `"use client"` only when needed
- **Server Actions** for all data mutations (`"use server"`)
- **Drizzle ORM** for all database access — never raw SQL except in admin aggregation queries
- **Zod** for input validation in all server actions
- **Tailwind CSS v4** — config is in `src/app/globals.css` (CSS-based), no `tailwind.config.js`
- **Icons** from `@phosphor-icons/react` and `iconoir-react` — do not add new icon libraries
- **i18n** via `next-intl` — all user-facing strings must be in `src/messages/{locale}.json`
- **Auth** via NextAuth v5 beta — use `auth()` from `src/auth.ts`, NOT `getServerSession`
- **Organization-scoped** — all queries MUST filter by `organizationId`
- **DOMPurify** via `isomorphic-dompurify` for any user-provided HTML

## Database

- **ORM**: Drizzle with PostgreSQL driver (`postgres`)
- **Schema**: `src/lib/db/schema.ts` — single file with all tables
- **Production migrations**: `scripts/migrate-prod.ts` — runs on `npm start`
- **Key tables**: users, organizations, organizationMembers, projects, projectAssignments, timeEntries, clients, workplaces, userWorkplaces, floorPlans, desks, deskBookings, calendarIntegrations, projectForecasts, emailLogs

## Environment

- **Node.js**: >= 20
- **PostgreSQL**: >= 16
- **Redis**: optional (improves calendar caching and rate limiting)
- **Liveblocks**: required for real-time collaboration
- **Anthropic API**: optional (enables AI assistant "Corinne")

## Testing

- **Runner**: Vitest 4.x with jsdom environment
- **Location**: `src/__tests__/`
- **Coverage**: `npm run test:coverage` (v8 provider, lcov + html reporters)

## Gotchas

- `next-auth` is v5 beta — API differs from v4
- The grid is canvas-based (`@glideapps/glide-data-grid`) — DOM inspection doesn't work on cells
- `cellsSnapshot` keys follow the format `userId:projectId:YYYY-MM-DD`
- Forecast cells use the prefix `forecast:projectId:YYYY-MM-DD`
- Liveblocks rooms are scoped per org+year: `kllapp:{orgId}:sheet-{year}`
- The email system auto-detects provider: Resend → SMTP → Console (dev fallback)
