# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router (routes, layout, pages).
- `src/components`: UI components; tests in `__tests__` alongside components.
- `src/lib`, `src/contexts`, `src/hooks`: Core utils, providers, and hooks.
- `src/test`: Vitest setup (`setup.ts`), MSW handlers, globals.
- `src/types`: Generated Supabase types.
- `e2e`: Playwright tests and stored auth state.
- `public`, `docs`, `supabase`, `scripts`: Assets, docs, local DB, utilities.

## Build, Test, and Development Commands
- `npm run dev`: Start app at `http://localhost:3001`.
- `npm run build` / `npm run start`: Production build and serve.
- `npm run check`: Type-check + lint. Run before commits/PRs.
- `npm run lint` / `npm run lint:fix`: Lint and autofix.
- `npm run test` / `npm run test:watch`: Unit tests (Vitest + RTL).
- `npm run test:coverage`: Generate V8 coverage report.
- `npm run test:e2e`: Playwright E2E (spawns dev server on `3001`).
- Supabase: `npm run supabase:start`, `...:stop`, `...:types`.

## Coding Style & Naming Conventions
- Language: TypeScript; ESLint (Next core-web-vitals). Use `npm run lint:fix`.
- Imports: alias `@` → `src` (e.g., `import { x } from '@/lib/utils'`).
- Components: `PascalCase.tsx`.
- Modules/utilities: `kebab-case.ts` consistent with repo.
- Tests: `*.{test,spec}.ts(x)` colocated under `src/**`.

## Testing Guidelines
- Unit: Vitest + React Testing Library; setup in `src/test/setup.ts` with MSW.
- E2E: Playwright in `e2e/`; baseURL `http://localhost:3001`.
- Coverage: keep meaningful coverage on changed code. Use `npm run test:coverage`.
- Example: run all unit tests `npm run test`, a single file `vitest run path/to/file.test.ts`.

## Commit & Pull Request Guidelines
- Branches: lower-case ASCII only (`^[0-9a-z._/-]+$`); prefix `feature/`, `bugfix/`, or `docs/` (e.g., `feature/auth-session`).
- Commits: concise, imperative; English or Japanese; reference issues when relevant.
- PRs: include purpose, scope, screenshots for UI, steps to test, and linked issues. Ensure `npm run check` passes and tests are updated. If DB schema changes, run `npm run supabase:types` and note it.

## Security & Configuration
- Never commit secrets. Copy `.env.example` → `.env` for local setup.
- Local dev and E2E assume port `3001`. Start Supabase locally when testing features that depend on it.

