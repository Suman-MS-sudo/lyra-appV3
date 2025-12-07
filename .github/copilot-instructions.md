# Lyra App v3 - AI Coding Agent Instructions

## Project Overview
Enterprise-grade Next.js 16 vending machine management system with role-based access (admin/customer), Supabase backend, comprehensive testing, monitoring, and CI/CD.

## Critical Architecture Patterns

### Supabase Three-Client Pattern
**NEVER mix these contexts** - each has distinct cookie handling:
- **Client Components**: `import { createClient } from '@/lib/supabase/client'` - browser operations
- **Server Components/Actions**: `import { createClient } from '@/lib/supabase/server'` - async with `cookies()`
- **Middleware**: `import { updateSession } from '@/lib/supabase/middleware'` - returns `{ supabaseResponse, user }`

### Authentication Helpers
Use standardized auth helpers instead of repeating logic:
```typescript
import { requireAuth, requireAdmin } from '@/lib/auth-helpers';

// In server actions/components
const user = await requireAuth(); // Throws AuthenticationError if not logged in
const { user, profile } = await requireAdmin(); // Also checks admin role
```

### Server Actions Pattern
All mutations MUST follow this structure:
```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-helpers';
import { schema } from '@/lib/validations';

export async function actionName(formData: FormData) {
  // 1. Auth check
  await requireAdmin();
  
  // 2. Validate with Zod
  const data = schema.parse({ field: formData.get('field') });
  
  // 3. DB operation
  const supabase = await createClient();
  const { data: result, error } = await supabase.from('table').insert(data);
  if (error) throw error;
  
  // 4. Revalidate paths
  revalidatePath('/path');
  
  return { success: true, data: result };
}
```

### Validation Pattern
Always use Zod schemas from `@/lib/validations.ts`:
```typescript
import { createProductSchema, type CreateProduct } from '@/lib/validations';

const validated = createProductSchema.parse(rawData); // Throws on error
// OR
const result = createProductSchema.safeParse(rawData); // Returns { success, data/error }
```

### Error Handling
Use custom error classes for consistent responses:
```typescript
import { ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors';

throw new ValidationError('Invalid input', 'fieldName');
throw new NotFoundError('Product');
throw new AuthorizationError();
```

### API Route Pattern
```typescript
import { createApiHandler, successResponse } from '@/lib/api-helpers';
import { withRateLimit, RateLimiter } from '@/lib/rate-limit';

const limiter = new RateLimiter(60000, 10); // 10 requests per minute

async function handler(request: NextRequest) {
  const data = await fetchData();
  return successResponse(data);
}

export const GET = withRateLimit(createApiHandler(handler), limiter);
```

## Database & Security

### Row Level Security (RLS)
All tables have RLS policies - see `supabase/migrations/20231207000001_rls_policies.sql`:
- **Customers**: Can only access their own data
- **Admins**: Full access via role check
- **Public**: Read-only for active products/machines

### Creating Migrations
1. Create file: `supabase/migrations/YYYYMMDD000000_description.sql`
2. Use UUID primary keys: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
3. Always add timestamps: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
4. Include indexes for query optimization
5. Add RLS policies for new tables

## Testing Requirements

### Test Structure
- Unit tests: `src/test/*.test.ts`
- Place tests next to source or in test directory
- Use Vitest with React Testing Library

### Writing Tests
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './my-module';

describe('myFunction', () => {
  it('should do X', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

Run with: `npm test` or `npm run test:coverage`

## Code Organization

### File Structure
```
src/
├── app/
│   ├── actions/        # Server actions (mutations)
│   ├── admin/          # Admin routes
│   ├── customer/       # Customer routes
│   └── api/            # API routes
├── components/         # Reusable UI components
├── lib/
│   ├── supabase/      # Three Supabase clients
│   ├── validations.ts # Zod schemas
│   ├── errors.ts      # Custom error classes
│   ├── logger.ts      # Logging utility
│   └── utils.ts       # Helper functions
└── types/             # TypeScript types
```

### Import Aliases
Always use `@/` path alias:
```typescript
import { createClient } from '@/lib/supabase/server';
import { ProductSchema } from '@/lib/validations';
import type { Product } from '@/types';
```

## Styling Conventions

- Tailwind CSS 4 with PostCSS
- Design tokens: blue-purple gradient (`from-blue-600 to-purple-600`)
- Cards: `rounded-xl shadow-sm`
- Spacing: `px-6 py-4` for containers
- Geist font loaded in root layout

## Monitoring & Analytics

### Logging
```typescript
import { logger } from '@/lib/logger';

logger.info('Message', { context: 'data' });
logger.error('Error occurred', error, { userId: '123' });
```

### Analytics
```typescript
import { analytics } from '@/lib/analytics';

analytics.track({ name: 'event_name', properties: { key: 'value' } });
analytics.transactionCreated(txId, amount);
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never commit `.env.local` - use `.env.example` as template.

## Common Gotchas

1. **Server vs Client Components**: Default to Server Components, only use `'use client'` when needed (hooks, events, browser APIs)
2. **Async cookies()**: In Next.js 16, `cookies()` must be awaited
3. **React Compiler**: Enabled - don't use `useMemo`/`useCallback` manually
4. **RLS Policies**: Always test with actual user contexts, not service role
5. **Revalidation**: Call `revalidatePath()` after mutations to update caches
6. **Rate Limiting**: Applied in middleware and can be added per-route

## Development Workflow

```bash
npm run dev          # Start dev server
npm test             # Run tests
npm run lint         # Lint code
npm run build        # Build for production
```

## CI/CD

- GitHub Actions on push/PR
- Runs: lint → test → build
- Auto-deploy to staging (develop branch)
- Auto-deploy to production (main branch)
- Database migrations via separate workflow

## Key Files to Reference

- `src/lib/validations.ts` - All Zod schemas
- `src/lib/errors.ts` - Custom error types
- `src/app/actions/*.ts` - Server action examples
- `supabase/migrations/*.sql` - Database schema
- `ARCHITECTURE.md` - System design details
- `DEVELOPMENT.md` - Developer guide

