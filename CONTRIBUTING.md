# Contributing to KLLAPP

Thank you for your interest in contributing to KLLAPP!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/kllapp.git`
3. Install dependencies: `npm ci`
4. Start the dev environment:
   ```bash
   docker compose up -d    # PostgreSQL + Redis
   cp .env.example .env.local
   # Edit .env.local with your values
   npm run db:push          # Create database schema
   npm run db:seed           # Add sample data
   npm run dev               # Start dev server
   ```
5. Open http://localhost:3000

## Development

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Run linter
- `npm run test` — Run tests
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage
- `npm run db:studio` — Open Drizzle Studio (DB viewer)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `npm run build` passes
4. Ensure `npm run lint` passes
5. Ensure `npm run test` passes
6. Submit a PR with a clear description

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- Server Components by default, Client Components when needed
- Server Actions for data mutations
- next-intl for internationalization (FR + EN)

## License

By contributing, you agree that your contributions will be licensed under the project's [Sustainable Use License](LICENSE).
