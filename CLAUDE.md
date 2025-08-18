# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AdLex is a SaaS application for pharmaceutical law (薬機法) compliance checking and text rewriting. It uses AI to detect violations in Japanese advertising text and suggest safe alternatives. The application supports both text input and image upload with OCR processing.

### Tech Stack
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Server-Sent Events (SSE)
- **Database**: Supabase PostgreSQL with pgvector extension
- **Authentication**: Supabase Auth
- **AI**: Multi-provider support (OpenAI, OpenRouter, LM Studio) with unified configuration
- **OCR**: Tesseract.js (MVP), Google Vision API (production)
- **Testing**: Vitest (unit), Playwright (E2E), MSW (mocking)

## Development Commands

### Core Development
```bash
# Start development server (uses Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Code Quality
```bash
# Type checking
npm run type-check
npm run type-check:watch

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Run both type-check and lint
npm run check
npm run check:fix
```

### Database (Supabase)
```bash
# Start local Supabase
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Reset database
npm run supabase:reset

# Generate TypeScript types
npm run supabase:types

# Reset database and regenerate types
npm run db:reset

# Seed test data
npm run seed
```

### Testing
```bash
# Unit tests with Vitest
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:ui       # UI mode
npm run test:coverage # With coverage

# E2E tests with Playwright
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # UI mode
npm run test:e2e:headed  # Headed mode
npm run test:e2e:debug   # Debug mode

# Run all tests
npm run test:all
```

## Architecture

### Background Processing System
AdLex uses a sophisticated background processing system for handling AI analysis:

- **Queue Management**: `CheckQueueManager` in `src/lib/queue-manager.ts` handles concurrent processing
- **Check Processing**: `src/lib/check-processor.ts` orchestrates the full AI analysis pipeline
- **Real-time Updates**: Server-Sent Events provide live progress updates to the UI
- **Embedding Pipeline**: `src/lib/embedding-queue.ts` manages vector embedding generation for dictionary entries

### Core Processing Flow

#### Text Check Processing
1. **Text Input**: User submits text through `TextChecker` component
2. **API Processing**: `/api/checks` creates check record and starts background processing
3. **AI Analysis**: 
   - Pre-filter using pg_trgm similarity (≥0.3)
   - Semantic filtering using pgvector (similarity >0.75)
   - LLM processing with OpenAI function calling or LM Studio
4. **Real-time Updates**: `/api/checks/[id]/stream` provides SSE updates
5. **Results Display**: Violations highlighted with modification suggestions



### Key Components
- `src/components/TextChecker.tsx`: Main UI for text input/analysis
- `src/lib/ai-client.ts`: Multi-provider AI service abstraction
- `src/lib/check-processor.ts`: Core AI analysis pipeline orchestration
- `src/lib/queue-manager.ts`: Background processing queue management
- `src/app/api/checks/route.ts`: Main check processing API
- `src/app/api/checks/[id]/stream/route.ts`: SSE streaming endpoint

### Database Schema
- `organizations`: Company/group data with usage limits
- `users`: User accounts with role-based access
- `dictionaries`: NG/ALLOW phrase dictionary with vector embeddings
- `checks`: Text analysis records and processing status
- `violations`: Specific violation details with position and reasoning

## AI Configuration

### Environment Variables
```bash
# AI Configuration (Unified)
AI_PROVIDER=openai                    # openai | openrouter | lmstudio
AI_API_KEY=your-api-key              # API key for the selected provider
AI_CHAT_MODEL=gpt-4o                 # Chat model name
AI_EMBEDDING_MODEL=text-embedding-3-small  # Embedding model name

# Embedding provider selection (when AI_PROVIDER=openrouter)
AI_EMBEDDING_PROVIDER=openai  # openai | lmstudio | auto

# LM Studio specific settings (when AI_PROVIDER=lmstudio or AI_EMBEDDING_PROVIDER=lmstudio)
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Provider-specific API keys (when needed for embeddings)
# OPENAI_API_KEY=your-openai-key  # Required when AI_EMBEDDING_PROVIDER=openai

# Legacy environment variables (backward compatibility - deprecated)
# OPENAI_API_KEY=your-openai-key       # Use AI_API_KEY with AI_PROVIDER=openai instead
# OPENROUTER_API_KEY=your-openrouter-key # Use AI_API_KEY with AI_PROVIDER=openrouter instead
# LM_STUDIO_CHAT_MODEL=model-name      # Use AI_CHAT_MODEL instead  
# LM_STUDIO_EMBEDDING_MODEL=model-name # Use AI_EMBEDDING_MODEL instead


```

### AI Client Usage
The system automatically selects the appropriate AI client based on `AI_PROVIDER`:
- **OpenAI**: Function calling with GPT models (production default)
- **OpenRouter**: Access to various models through unified API
- **LM Studio**: Local development with JSON parsing fallback
- **Mock**: Automated testing with predictable responses

Provider selection logic in `src/lib/ai-client.ts`:
- Uses `AI_PROVIDER` environment variable
- Falls back to provider-specific legacy environment variables
- Defaults to `openai` in production, `lmstudio` in development

### Embedding Provider Selection (OpenRouter)
Since OpenRouter does not support embeddings API, when using `AI_PROVIDER=openrouter`, you can choose the embedding provider:

- **`AI_EMBEDDING_PROVIDER=openai`**: Use OpenAI embeddings ($0.02/1M tokens)
- **`AI_EMBEDDING_PROVIDER=lmstudio`**: Use local LM Studio embeddings (free, offline)
- **`AI_EMBEDDING_PROVIDER=auto`**: Try OpenAI first, fallback to LM Studio if failed

**Configuration Examples:**
```bash
# Cost-effective: OpenRouter chat + OpenAI embeddings
AI_PROVIDER=openrouter
AI_EMBEDDING_PROVIDER=openai
AI_API_KEY=sk-or-v1-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Fully offline: OpenRouter chat + LM Studio embeddings
AI_PROVIDER=openrouter
AI_EMBEDDING_PROVIDER=lmstudio
AI_API_KEY=sk-or-v1-xxxxx
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Reliable: Auto-fallback from OpenAI to LM Studio
AI_PROVIDER=openrouter
AI_EMBEDDING_PROVIDER=auto
AI_API_KEY=sk-or-v1-xxxxx
OPENAI_API_KEY=sk-xxxxx
LM_STUDIO_BASE_URL=http://localhost:1234/v1
```



## Testing Setup

### Unit Tests (Vitest)
- Configuration: `vitest.config.ts`
- Setup: `src/test/setup.ts`
- Mocking: MSW handlers in `src/test/mocks/`
- Location: `src/**/*.{test,spec}.{ts,tsx}`

### E2E Tests (Playwright)
- Configuration: `playwright.config.ts`
- Tests: `e2e/*.spec.ts`
- Base URL: `http://localhost:3001`
- Runs against actual Supabase local instance

### Test Data
Use `npm run seed` to create test accounts:
- Admin: `admin@test.com` / `password123`
- User: `user1@test.com` / `password123`

## Development Guidelines

### Code Style
- Follow existing TypeScript patterns
- Use Next.js 15 App Router conventions
- Implement proper error handling and loading states
- Use Supabase client for database operations
- Follow the established ESLint configuration

### Authentication
- Use `createClient()` from `@/lib/supabase/server` for API routes
- Check `user.role` for admin operations
- Implement proper RLS policies for data access

### AI Integration
- Use `createChatCompletion()` and `createEmbedding()` from `@/lib/ai-client`
- Support for multiple AI providers through unified interface
- Provider-specific error handling with clear error messages
- Function calling for OpenAI/OpenRouter, JSON parsing fallback for LM Studio
- Automatic model validation and configuration suggestions



### Real-time Updates
- Use Server-Sent Events for progress updates
- Implement proper SSE error handling
- Keep connections lightweight and efficient

## Important Notes

- Always run `npm run check` before committing
- Use `npm run seed` to reset test data
- E2E tests require local Supabase instance
- LM Studio requires manual model loading for local development
- Vector embeddings are automatically generated for dictionary entries using pgvector
- Database schema is managed through Supabase migrations

- AI provider can be switched without code changes using environment variables
- Background processing uses queue system to handle concurrent checks efficiently
- Real-time progress updates are delivered via Server-Sent Events

## Task Management

- After completing an implementation, update `TODO.md` to reflect the changes  
- Keep tasks up to date to maintain accurate project tracking