# Code Style & Conventions

## TypeScript Configuration
- **Target**: ES2017 with DOM libraries
- **Strict mode**: Enabled with strict type checking
- **Path mapping**: `@/*` maps to `./src/*`
- **JSX**: Preserve mode for Next.js

## ESLint Rules
- **TypeScript specific**:
  - Unused vars: Error (ignore args starting with `_`)
  - No explicit any: Warning
  - No inferrable types: Error
  - Prefer optional chain: Error
  - No unnecessary condition: Off (development)

- **Code quality**:
  - Prefer const over let: Error
  - No var: Error
  - Equal equality (===): Error
  - No duplicate imports: Error

- **React specific**:
  - Rules of hooks: Error
  - Exhaustive deps: Warning
  - No useless fragments: Error
  - JSX curly braces: Never for props/children when unnecessary

- **Import organization**:
  - Groups: builtin, external, internal, parent, sibling, index
  - Newlines between groups: Always
  - Alphabetize: Ascending order

## File Structure Patterns
- **Components**: `src/components/` with corresponding tests in `__tests__/`
- **Pages**: Next.js App Router in `src/app/`
- **API Routes**: `src/app/api/` with `__tests__/` subdirectories
- **Libraries**: `src/lib/` for shared utilities
- **Types**: `src/types/` for TypeScript definitions
- **Tests**: Co-located `__tests__/` directories or `.test.ts` files

## Naming Conventions
- **Files**: kebab-case for pages, PascalCase for components
- **Components**: PascalCase function exports
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase

## Code Organization
- **Imports**: Organized by ESLint rules with newlines between groups
- **Components**: Export default function with TypeScript
- **API Routes**: Named exports (GET, POST, etc.)
- **Error handling**: Proper try/catch with meaningful error messages
- **Loading states**: Implement proper loading and error states for async operations

## Japanese Comments
- Comments and documentation may be in Japanese
- Test account descriptions and console outputs in Japanese
- Error messages for user-facing content in Japanese