# AdLex Project Overview

## Purpose
AdLex is a SaaS application for pharmaceutical law (薬機法) compliance checking and text rewriting. It uses AI to detect violations in Japanese advertising text and suggest safe alternatives. The application supports both text input and image upload with OCR processing.

## Key Features
- **AI-powered compliance checking**: Uses OpenAI GPT-4o (production) or LM Studio (local development)
- **Text analysis**: Real-time violation detection with modification suggestions
- **Image OCR support**: Tesseract.js (MVP) or Google Vision API (production)
- **Multi-tenant architecture**: Organization-based user management with role-based access
- **Dictionary management**: Customizable NG/ALLOW phrase dictionaries with vector embeddings
- **Real-time updates**: Server-Sent Events (SSE) for progress tracking
- **Usage tracking**: Per-organization usage limits and monitoring

## Core Architecture
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **Backend**: Next.js API Routes with Server-Sent Events
- **Database**: Supabase PostgreSQL with pgvector extension for semantic search
- **Authentication**: Supabase Auth with role-based access control
- **AI Services**: OpenAI GPT-4o (production), LM Studio (development)
- **OCR Services**: Tesseract.js (client-side), Google Vision API (server-side)
- **Testing**: Vitest (unit tests), Playwright (E2E tests), MSW (API mocking)

## Processing Flow
1. **Text/Image Input**: User submits content through TextChecker/ImageChecker components
2. **OCR Processing**: For images, extract text using Tesseract.js or Vision API
3. **AI Analysis**: 
   - Pre-filter using pg_trgm similarity (≥0.3)
   - Semantic filtering using pgvector (similarity >0.75)
   - LLM processing with OpenAI function calling or LM Studio
4. **Real-time Updates**: SSE streaming for progress updates
5. **Results Display**: Violations highlighted with modification suggestions