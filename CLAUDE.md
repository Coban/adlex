# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AdLex is a SaaS application for pharmaceutical law (薬機法) compliance checking and text rewriting. It uses AI to detect violations in Japanese advertising text and suggest safe alternatives. The application supports both text input and image upload with OCR processing.

### Tech Stack
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Server-Sent Events (SSE)
- **Database**: Supabase PostgreSQL with pgvector extension
- **Authentication**: Supabase Auth
- **AI**: OpenAI GPT-4o (production), LM Studio (local development)
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

#### Image Check Processing
1. **Image Upload**: User uploads image through `ImageChecker` component
2. **OCR Processing**: `/api/ocr` processes image and extracts text using Tesseract.js or Vision API
3. **Text Extraction**: Extracted text displayed in editable format
4. **Text Check**: Extracted text processed through normal text checking flow
5. **Results Display**: Same violation highlighting with image context

### Key Components
- `src/components/TextChecker.tsx`: Main UI for text input/analysis
- `src/components/ImageChecker.tsx`: Main UI for image upload/OCR processing (planned)
- `src/lib/ai-client.ts`: AI service abstraction (OpenAI/LM Studio)
- `src/lib/ocr-client.ts`: OCR service abstraction (Tesseract.js/Vision API) (planned)
- `src/app/api/checks/route.ts`: Main check processing API
- `src/app/api/ocr/route.ts`: Image upload and OCR processing API (planned)
- `src/app/api/checks/[id]/stream/route.ts`: SSE streaming endpoint

### Database Schema
- `organizations`: Company/group data with usage limits
- `users`: User accounts with role-based access
- `dictionaries`: NG/ALLOW phrase dictionary with vector embeddings
- `checks`: Text/image analysis records with OCR support
  - `input_type`: 'text' or 'image'
  - `extracted_text`: OCR extracted text (for images)
  - `image_url`: Uploaded image URL
  - `ocr_status`: OCR processing status
  - `ocr_metadata`: OCR processing details
- `violations`: Specific violation details

## AI Configuration

### Environment Variables
```bash
# OpenAI (production)
OPENAI_API_KEY=your-key-here

# LM Studio (local development)
USE_LM_STUDIO=true
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_CHAT_MODEL=google/gemma-3-12b
LM_STUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# OCR Configuration
USE_TESSERACT=true                    # Use Tesseract.js for OCR (MVP)
GOOGLE_VISION_API_KEY=your-key-here  # Google Vision API (production)
GOOGLE_VISION_PROJECT_ID=your-project-id
```

### AI Client Usage
The system automatically selects the appropriate AI client:
- Production: OpenAI with function calling
- Local development: LM Studio with JSON parsing
- Testing: Mock responses

### OCR Client Usage
The system automatically selects the appropriate OCR client:
- MVP: Tesseract.js (client-side processing)
- Production: Google Vision API (server-side processing)
- Testing: Mock OCR responses

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
- Handle both OpenAI and LM Studio responses
- Implement proper error handling for AI failures

### OCR Integration
- Use `extractText()` from `@/lib/ocr-client` for text extraction
- Handle both Tesseract.js and Google Vision API responses
- Implement proper error handling for OCR failures
- Support image preprocessing (resize, rotate, enhance)
- Handle multiple image formats (JPEG, PNG, WebP, PDF)

### Real-time Updates
- Use Server-Sent Events for progress updates
- Implement proper SSE error handling
- Keep connections lightweight and efficient

## Important Notes

- Always run `npm run check` before committing
- Use `npm run seed` to reset test data
- E2E tests require local Supabase instance
- LM Studio requires manual model loading
- Vector embeddings are automatically generated for dictionary entries
- Database schema is managed through Supabase migrations
- Image files are temporarily stored in Supabase Storage (auto-deleted after 1 hour)
- OCR processing may take 5-30 seconds depending on image complexity
- Supported image formats: JPEG, PNG, WebP, PDF (max 10MB)
- For image checks, the same usage limits apply as text checks