# AdLex Codebase Structure

## Root Directory
```
/
├── src/                    # Source code
├── e2e/                    # Playwright E2E tests
├── database/               # Database migrations/schema
├── supabase/               # Supabase configuration
├── scripts/                # Utility scripts
├── public/                 # Static assets
├── docs/                   # Documentation
└── playwright/             # Playwright test artifacts
```

## Source Code Structure (`src/`)

### Core Application
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── admin/             # Admin dashboard
│   ├── checker/           # Main checking interface
│   ├── history/           # Check history
│   ├── dictionaries/      # Dictionary management
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── TextChecker.tsx   # Main text checking component
│   ├── CheckHistoryList.tsx
│   └── GlobalNavigation.tsx
├── lib/                   # Shared utilities
│   ├── supabase/         # Supabase clients
│   ├── ai-client.ts      # AI service abstraction
│   ├── check-processor.ts # Core processing logic
│   └── utils.ts          # General utilities
├── hooks/                 # Custom React hooks
├── contexts/              # React contexts
├── types/                 # TypeScript type definitions
└── test/                  # Test utilities and mocks
```

## Key API Routes
```
/api/
├── checks/                # Text/image checking
│   ├── route.ts          # Create new checks
│   ├── [id]/route.ts     # Get specific check
│   └── [id]/stream/      # SSE progress updates
├── users/                 # User management
├── dictionaries/          # Dictionary CRUD
└── check-history/         # Check history
```

## Component Architecture
- **TextChecker**: Main UI for text input and analysis
- **CheckHistoryList**: Display previous checks
- **GlobalNavigation**: Site-wide navigation with auth
- **UI Components**: shadcn/ui based reusable components

## Library Architecture
- **ai-client.ts**: Abstracts OpenAI/LM Studio differences
- **check-processor.ts**: Core text processing logic
- **supabase/**: Database client management (server/client)
- **queue-manager.ts**: Background job processing

## Database Integration
- **Types**: Auto-generated from Supabase schema in `types/database.types.ts`
- **Migrations**: Managed through Supabase CLI
- **RLS**: Row Level Security policies for multi-tenant data

## Testing Structure
- **Unit**: `src/**/*.{test,spec}.{ts,tsx}` with Vitest
- **E2E**: `e2e/*.spec.ts` with Playwright
- **Mocks**: `src/test/mocks/` for API mocking with MSW
- **Setup**: `src/test/setup.ts` for test environment configuration

## Key Features by Directory
- **Authentication**: `src/app/auth/` - Login, signup, invitations
- **Main Feature**: `src/app/checker/` - Text checking interface  
- **Admin Panel**: `src/app/admin/` - User and organization management
- **History**: `src/app/history/` - Check results and history
- **Dictionary**: `src/app/dictionaries/` - NG/ALLOW phrase management