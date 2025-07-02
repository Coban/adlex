# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is a Next.js project with Supabase and PostgreSQL integration. The project uses:

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Supabase** for backend-as-a-service
- **PostgreSQL** database via Supabase

## Development Guidelines

### Code Style

- Use TypeScript for all new files
- Follow Next.js 15 App Router conventions
- Use Tailwind CSS for styling
- Implement proper error handling and loading states
- Use Supabase client for database operations

### Project Structure

- Place page components in `src/app/`
- Store reusable components in `src/components/`
- Keep utility functions in `src/lib/`
- Database operations should use Supabase client
- Environment variables should be properly typed

### Supabase Integration

- Use `@supabase/supabase-js` for client-side operations
- Use `@supabase/ssr` for server-side rendering
- Implement proper authentication flows
- Follow Supabase best practices for security

### Best Practices

- Implement proper loading and error states
- Use React Server Components where appropriate
- Optimize for performance and SEO
- Follow accessibility guidelines
- Write clean, maintainable code
