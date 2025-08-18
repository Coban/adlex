# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router (routes, layout, pages).
- `src/components`: UI components; tests live under `__tests__`.
- `src/lib`, `src/contexts`, `src/hooks`: Core logic, providers, and hooks.
- `src/test`: Vitest setup, mocks (MSW), and globals.
- `src/types`: Generated Supabase types.
- `e2e`: Playwright tests and auth state.
- `public`, `docs`, `supabase`, `scripts`: Assets, documentation, local DB, utilities.

## Build, Test, and Development
- `npm run dev`: Start app at `http://localhost:3001`.
- `npm run build` / `npm run start`: Production build and serve.
- `npm run check`: Type-check + lint. Use before commits.
- `npm run lint` / `npm run lint:fix`: Lint and autofix.
- `npm run test` / `npm run test:watch`: Unit tests (Vitest + RTL).
- `npm run test:coverage`: Generate coverage report.
- `npm run test:e2e`: Run Playwright tests (spawns dev server).
- Supabase: `npm run supabase:start`, `...:stop`, `...:types`.

## Coding Style & Naming
- TypeScript + ESLint (Next core-web-vitals). Use `npm run lint:fix`.
- Imports: alias `@` to `src` (e.g., `import { x } from '@/lib/utils'`).
- Components: `PascalCase.tsx`; modules/utilities: `kebab-case.ts` as in repo.
- Tests: `*.{test,spec}.ts(x)` colocated under `src/**`.

## Testing Guidelines
- Unit: Vitest + React Testing Library; setup in `src/test/setup.ts` with MSW.
- E2E: Playwright in `e2e/`; baseURL `http://localhost:3001`.
- Coverage: `npm run test:coverage` (V8). Keep meaningful coverage on changed code.

## Commit & Pull Request Guidelines
- Branch names: lower-case ASCII only (`^[0-9a-z._/-]+$`). Prefix with `feature/`, `bugfix/`, or `docs/` (e.g., `feature/auth-session`); never use non-ASCII.
- Commits: No strict Conventional Commits. Prefer concise, imperative summaries; English or Japanese is acceptable. Reference issues when relevant.
- PRs: Include purpose, scope, screenshots for UI, steps to test, and linked issues. Ensure `npm run check` passes and tests are updated. If DB schema changes, run `npm run supabase:types` and include notes.

## Security & Configuration
- Do not commit secrets. Copy `.env.example` to `.env` for local setup.
- Local dev and E2E assume port `3001`. Start Supabase locally when testing features that depend on it.
