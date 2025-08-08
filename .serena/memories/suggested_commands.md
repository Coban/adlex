# Suggested Development Commands

## Core Development
```bash
# Start development server (uses Turbopack on port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Code Quality (Run before committing)
```bash
# Combined type-check and lint
npm run check
npm run check:fix

# Individual commands
npm run type-check          # TypeScript type checking
npm run type-check:watch    # Watch mode
npm run lint                # ESLint checking
npm run lint:fix            # Auto-fix ESLint issues
npm run format              # Format code (alias for lint:fix)
npm run format:check        # Check formatting only
```

## Database Management (Supabase)
```bash
# Start local Supabase stack
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Reset database with fresh schema
npm run supabase:reset

# Generate TypeScript types from database
npm run supabase:types

# Full reset with type generation
npm run db:reset

# Seed test data (creates test accounts)
npm run seed
```

## Testing
```bash
# Unit tests (Vitest)
npm run test                # Run once
npm run test:watch          # Watch mode
npm run test:ui             # Open Vitest UI
npm run test:coverage       # Run with coverage report

# E2E tests (Playwright)
npm run test:e2e            # Run E2E tests
npm run test:e2e:ui         # Open Playwright UI
npm run test:e2e:headed     # Run with browser UI visible
npm run test:e2e:debug      # Debug mode

# Run all tests
npm run test:all            # Unit + E2E tests
```

## System Utilities (macOS/Darwin)
```bash
# File operations
ls -la                      # List files with details
find . -name "*.ts"         # Find TypeScript files
grep -r "pattern" src/      # Search in source code

# Git operations
git status                  # Check repository status
git log --oneline -10       # Recent commits
git diff                    # Show changes

# Process management
lsof -i :3001              # Check what's using port 3001
pkill -f "next"            # Kill Next.js processes
```

## Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Install dependencies
npm install

# First-time setup
npm run supabase:start     # Start Supabase
npm run seed              # Create test accounts
npm run dev               # Start development
```