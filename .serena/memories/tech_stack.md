# AdLex Tech Stack

## Frontend
- **Next.js 15**: App Router, TypeScript, Turbopack for development
- **React 19**: Latest React features
- **UI Framework**: shadcn/ui components based on Radix UI
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

## Backend
- **API**: Next.js API Routes
- **Real-time**: Server-Sent Events (SSE) for progress updates
- **Authentication**: Supabase Auth with JWT
- **Database**: Supabase PostgreSQL with pgvector extension

## AI & ML
- **Production AI**: OpenAI GPT-4o with function calling
- **Development AI**: LM Studio with local models (Gemma-3-12b)
- **Embeddings**: OpenAI text-embedding-ada-002 (prod) or Nomic Embed (dev)
- **Vector Search**: pgvector for semantic similarity

## OCR
- **MVP**: Tesseract.js (client-side processing)
- **Production**: Google Vision API (server-side processing)
- **Supported formats**: JPEG, PNG, WebP, PDF (max 10MB)

## Testing
- **Unit Tests**: Vitest with jsdom environment
- **E2E Tests**: Playwright with multi-browser support
- **API Mocking**: MSW (Mock Service Worker)
- **Test Data**: Automated seeding with test accounts

## Development Tools
- **TypeScript**: Strict mode with path mapping (@/*)
- **Linting**: ESLint with Next.js and TypeScript rules
- **Formatting**: ESLint-based formatting
- **Package Manager**: npm with package-lock.json

## Database Schema
- **organizations**: Multi-tenant organization data with usage limits
- **users**: User accounts with role-based access (admin/user)
- **dictionaries**: NG/ALLOW phrase dictionary with vector embeddings
- **checks**: Text/image analysis records with OCR support
- **violations**: Specific violation details with suggestions