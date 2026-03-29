# Contributing to kllapp

Thanks for your interest in contributing to kllapp! This guide will help you get started.

## Code of Conduct

Be respectful, constructive, and inclusive. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **Docker** (for PostgreSQL + Redis)
- **Git**

### Setup

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/kllapp.git
cd kllapp

# 2. Install dependencies
npm ci

# 3. Start PostgreSQL + Redis
docker compose up -d

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local — see .env.example for documentation
# Minimum: AUTH_SECRET (run: openssl rand -hex 32)

# 5. Create the database schema
npm run db:push

# 6. (Optional) Seed sample data
npm run db:seed

# 7. Start the dev server
npm run dev
```

Open http://localhost:3000

## Development Workflow

### Branch naming

```
feat/budget-alerts
fix/calendar-cache
refactor/email-provider
docs/deployment-guide
```

### Making changes

1. Create a branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   npm run lint        # No errors
   npm run build       # Compiles
   npm run test        # Tests pass
   ```
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add weekly summary email
   fix: calendar events not showing on weekends
   ```
5. Push and open a Pull Request

## Pull Request Checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run test` passes
- [ ] New features include translations (FR + EN)
- [ ] Database queries are scoped by `organizationId`
- [ ] No secrets or sensitive data in code

## Code Standards

- **TypeScript strict** — no `any` types
- **Zod** for all server action input validation
- **Server Components** by default, `"use client"` only when needed
- **Tailwind CSS v4** — config in CSS, no JS config file
- **Icons**: `@phosphor-icons/react` or `iconoir-react` only
- **i18n**: all user-facing strings in `src/messages/{locale}.json`
- **Auth**: use `auth()` from `src/auth.ts`, call `requireOrgContext()` in every server action
- **Email**: use `sendEmail()` from `src/lib/email.ts`

## Common Tasks

### Add a new database table
1. Define in `src/lib/db/schema.ts`
2. Add migration SQL in `scripts/migrate-prod.ts`
3. Run `npm run db:push`

### Add a new panel
1. Add type to `PanelMode` in `src/types/index.ts`
2. Create component in `src/components/sheet/panel/`
3. Add opener in `src/components/sheet/use-sheet-panel.ts`
4. Render in `src/components/sheet/sheet-panel.tsx`

### Add a new AI tool
1. Create tool file in `src/lib/ai/tools/`
2. Register in `src/lib/ai/tools/index.ts`
3. Add permissions in `src/lib/ai/permissions.ts`

### Add a translation
1. Add key to both `src/messages/fr.json` and `src/messages/en.json`
2. Use `useTranslations("namespace")` + `t("key")`

## Testing

```bash
npm run test              # Single run
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
```

Tests in `src/__tests__/` — Vitest + @testing-library/react.

---

Thank you for contributing!
