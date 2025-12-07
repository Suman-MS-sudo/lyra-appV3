# Development Guide

## Getting Started

### Local Development Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Set up Supabase locally** (optional but recommended):
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase instance
supabase start
```

3. **Configure environment**:
```bash
cp .env.example .env.local
```

4. **Run database migrations**:
```bash
supabase db push
```

5. **Start development server**:
```bash
npm run dev
```

## Code Style and Conventions

### TypeScript

- Use strict mode (enabled in `tsconfig.json`)
- Define explicit return types for functions
- Prefer `interface` over `type` for object shapes
- Use `const` over `let` when possible

### React Components

- Use Server Components by default
- Mark Client Components with `'use client'` directive
- Prefer functional components over class components
- Use React Compiler (no manual memoization needed)

### Naming Conventions

- **Files**: `kebab-case.tsx` for components, `camelCase.ts` for utilities
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Server Actions

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { someSchema } from '@/lib/validations';

export async function someAction(formData: FormData) {
  // 1. Authentication
  await requireAdmin();

  // 2. Validation
  const validated = someSchema.parse({
    field: formData.get('field'),
  });

  // 3. Database operation
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('table')
    .insert(validated);

  if (error) throw error;

  // 4. Revalidation
  revalidatePath('/path');

  return { success: true, data };
}
```

### API Routes

```typescript
import { NextRequest } from 'next/server';
import { createApiHandler, successResponse } from '@/lib/api-helpers';
import { withRateLimit } from '@/lib/rate-limit';

async function handler(request: NextRequest) {
  // Your logic here
  return successResponse(data);
}

export const GET = withRateLimit(createApiHandler(handler));
```

## Database

### Creating Migrations

1. Create a new migration file:
```bash
supabase migration new migration_name
```

2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_migration_name.sql`

3. Test locally:
```bash
supabase db reset  # Resets and applies all migrations
```

4. Apply to remote:
```bash
supabase db push
```

### Writing RLS Policies

```sql
-- Example: Users can only view their own data
CREATE POLICY "users_select_own"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Admins can do anything
CREATE POLICY "admins_all"
  ON table_name FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Testing

### Unit Tests

Create test files next to source files or in `src/test/`:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './my-module';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage

# UI mode
npm run test:ui
```

## Error Handling

### Custom Errors

```typescript
import { ValidationError, NotFoundError } from '@/lib/errors';

// Throw custom errors
throw new ValidationError('Invalid input', 'fieldName');
throw new NotFoundError('Resource');
```

### Error Boundaries

Wrap components that might error:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary fallback={<CustomError />}>
  <MyComponent />
</ErrorBoundary>
```

## Validation

### Creating Schemas

```typescript
import { z } from 'zod';

export const mySchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
  name: z.string().min(2).max(100),
});

export type MyType = z.infer<typeof mySchema>;
```

### Using Schemas

```typescript
// Parse and throw on error
const data = mySchema.parse(input);

// Safe parse (returns result object)
const result = mySchema.safeParse(input);
if (!result.success) {
  console.error(result.error);
}
```

## Logging

```typescript
import { logger } from '@/lib/logger';

logger.debug('Debug message', { context: 'value' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error occurred', error, { userId: '123' });
```

## Analytics

```typescript
import { analytics } from '@/lib/analytics';

// Track events
analytics.track({
  name: 'button_clicked',
  properties: { buttonId: 'submit' },
});

// Common events
analytics.pageView('/dashboard');
analytics.userLogin(userId, role);
analytics.transactionCreated(txId, amount);
```

## Common Tasks

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/my-feature`
2. Create types in `src/types/index.ts`
3. Create validation schemas in `src/lib/validations.ts`
4. Create server actions in `src/app/actions/`
5. Create UI components
6. Write tests
7. Update documentation
8. Submit PR

### Adding a New Page

1. Create route folder: `src/app/my-route/`
2. Create `page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

export default async function MyPage() {
  const user = await requireAuth();
  // Your component
}
```

### Adding a New API Endpoint

1. Create route: `src/app/api/my-endpoint/route.ts`
2. Implement handler:
```typescript
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/lib/api-helpers';

async function handler(request: NextRequest) {
  // Implementation
}

export const GET = createApiHandler(handler);
```

## Debugging

### Server Components

- Use `console.log` - output appears in terminal
- Check server logs in Vercel dashboard
- Use React DevTools

### Client Components

- Use browser DevTools
- React DevTools for component inspection
- Network tab for API calls

### Database Queries

- Check Supabase dashboard for query logs
- Use `explain analyze` in SQL editor
- Monitor slow queries

## Performance Tips

1. **Use Server Components** - Default to Server Components
2. **Minimize Client JS** - Only use 'use client' when needed
3. **Optimize Images** - Use Next.js `<Image>` component
4. **Database Indexes** - Add indexes for frequently queried columns
5. **Pagination** - Always paginate large datasets
6. **React Compiler** - Enabled by default, no manual optimization needed

## Security Checklist

- [ ] Input validation with Zod schemas
- [ ] RLS policies on all tables
- [ ] Authentication checks in server actions
- [ ] Rate limiting on public endpoints
- [ ] Environment variables never exposed to client
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (React handles by default)
- [ ] CSRF protection (enabled by default in Next.js)

## Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Error tracking configured
- [ ] Analytics configured
- [ ] Performance monitoring enabled
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] Backup strategy in place

## Troubleshooting

### Common Issues

**"Module not found" errors**
- Check import paths use `@/` alias
- Verify file exists
- Restart dev server

**Supabase client errors**
- Check you're using correct client (server/client/middleware)
- Verify environment variables
- Check RLS policies

**Type errors**
- Run `npm run build` to see all type errors
- Check TypeScript version matches project
- Verify type definitions are up to date

**Tests failing**
- Check test setup in `src/test/setup.ts`
- Verify mocks are correct
- Run tests individually to isolate issues

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev)
- [Zod Documentation](https://zod.dev)
