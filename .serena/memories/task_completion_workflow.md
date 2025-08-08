# Task Completion Workflow

When completing any coding task in AdLex, follow this checklist:

## Pre-Implementation
1. **Understand the codebase**: Use symbolic tools to explore existing patterns
2. **Check existing conventions**: Follow established patterns in similar components
3. **Verify dependencies**: Ensure required libraries are already available in package.json

## During Implementation
1. **Follow TypeScript patterns**: Use strict typing and proper interfaces
2. **Implement error handling**: Add proper try/catch blocks and error states
3. **Add loading states**: Implement loading indicators for async operations
4. **Use existing utilities**: Leverage existing functions in `src/lib/`
5. **Follow component patterns**: Match existing component structure and naming

## Post-Implementation Quality Checks
**ALWAYS run these commands after making changes:**

```bash
# 1. Type checking (REQUIRED)
npm run type-check

# 2. Linting (REQUIRED)
npm run lint

# Combined check (recommended)
npm run check
```

## Testing Verification
```bash
# 3. Unit tests (if tests exist)
npm run test

# 4. E2E tests (for UI changes)
npm run test:e2e
```

## Database Changes
If you modified database-related code:
```bash
# Generate fresh types
npm run supabase:types

# Reset test data if needed
npm run seed
```

## Final Verification
1. **Build test**: Run `npm run build` to ensure production build works
2. **Manual testing**: Test the feature manually in the browser
3. **Check logs**: Verify no console errors or warnings
4. **Performance**: Ensure no obvious performance regressions

## Before Committing
- [ ] `npm run check` passes without errors
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Code follows existing patterns
- [ ] Proper error handling implemented
- [ ] Loading states added where needed

## AI Environment Notes
- **Production**: Uses OpenAI GPT-4o with function calling
- **Development**: Can use LM Studio with local models
- **Testing**: Uses mock responses for consistent test results

## Common Pitfalls
- Don't assume libraries are available - check package.json first
- Always handle async operations with proper loading/error states
- Follow the existing component patterns in `src/components/`
- Use the established authentication patterns from Supabase
- Remember to update TypeScript types when modifying database schema