# Lyra App v3 - Architecture Documentation

## System Overview

Lyra is an enterprise-grade vending machine management system built with Next.js 16, React 19, and Supabase. The application provides role-based access for administrators and customers with real-time data synchronization.

## Architecture Layers

### 1. Presentation Layer
- **Framework**: Next.js 16 App Router with React 19
- **UI Components**: React Server Components + Client Components
- **Styling**: Tailwind CSS 4
- **State Management**: React hooks (with React Compiler optimization)

### 2. Application Layer
- **Server Actions**: Type-safe mutations with revalidation
- **API Routes**: RESTful endpoints for external integrations
- **Middleware**: Authentication, security headers, rate limiting
- **Validation**: Zod schemas for runtime type safety

### 3. Data Layer
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Supabase JavaScript client
- **Real-time**: Supabase Realtime subscriptions
- **Security**: Row Level Security (RLS) policies

### 4. Infrastructure Layer
- **Hosting**: Vercel (serverless)
- **Database**: Supabase (managed PostgreSQL)
- **CDN**: Vercel Edge Network
- **CI/CD**: GitHub Actions

## Key Design Patterns

### Three-Client Supabase Pattern
```typescript
// Client Components (browser)
import { createClient } from '@/lib/supabase/client';

// Server Components/Actions
import { createClient } from '@/lib/supabase/server';

// Middleware
import { updateSession } from '@/lib/supabase/middleware';
```

### Server Actions Pattern
- All mutations use server actions
- Automatic revalidation with `revalidatePath()`
- Type-safe with Zod validation
- Error handling with custom error classes

### Authentication Flow
1. User logs in via `/login` page
2. Client-side role selection (admin/customer)
3. Middleware validates session on protected routes
4. Server components verify auth + role via RLS policies

### Error Handling Strategy
- Custom error classes with HTTP status codes
- Global error boundaries for React errors
- API error handler for consistent responses
- Structured logging with context

## Security Architecture

### Defense in Depth
1. **Network**: HTTPS, security headers, CORS
2. **Application**: Rate limiting, input validation, CSRF protection
3. **Database**: RLS policies, prepared statements, encryption at rest
4. **Auth**: JWT tokens, secure session management

### Row Level Security (RLS)
- Customers: Can only view/modify their own data
- Admins: Full access to all resources
- Public: Read-only access to active products/machines

## Data Flow

### Read Operations
```
User Request → Server Component → Supabase Client → RLS Check → PostgreSQL → Response
```

### Write Operations
```
User Action → Server Action → Validation → Supabase Client → RLS Check → PostgreSQL → Revalidation → Response
```

### Real-time Updates (Future)
```
Database Change → Supabase Realtime → WebSocket → Client Update
```

## Performance Optimizations

1. **React Compiler**: Automatic memoization (no manual `useMemo`/`useCallback`)
2. **Server Components**: Zero JS shipped for static content
3. **Streaming**: Progressive page rendering with Suspense
4. **Edge Runtime**: Middleware runs on edge for low latency
5. **Database Indexing**: Strategic indexes on high-query columns

## Scalability Considerations

### Horizontal Scaling
- Stateless architecture (serverless functions)
- Database connection pooling via Supabase
- CDN for static assets

### Vertical Scaling
- Database read replicas (Supabase Pro)
- Connection pooler for high concurrency
- Query optimization with indexes

## Monitoring & Observability

### Metrics
- Application: Vercel Analytics, Web Vitals
- Database: Supabase dashboard metrics
- Errors: Custom logger (ready for Sentry integration)
- Business: Custom analytics tracking

### Logging Levels
- `debug`: Development-only detailed logs
- `info`: General application flow
- `warn`: Recoverable issues
- `error`: Failures requiring attention

## Testing Strategy

### Unit Tests
- Validation schemas (Zod)
- Utility functions
- Business logic helpers

### Integration Tests
- Server actions
- API routes
- Database operations

### E2E Tests (Future)
- Critical user flows
- Authentication flows
- Transaction processing

## Deployment Architecture

### Environments
- **Development**: Local (localhost:3000)
- **Staging**: Vercel Preview (auto-deploy on PR)
- **Production**: Vercel Production (deploy on merge to main)

### Database Migrations
- Version-controlled SQL files in `supabase/migrations/`
- Applied via Supabase CLI in GitHub Actions
- Rollback support with migration history

## Future Enhancements

1. **Real-time Features**: WebSocket for live inventory updates
2. **Payment Integration**: Stripe/PayPal for transactions
3. **Mobile App**: React Native with shared types
4. **Admin Analytics**: Advanced reporting dashboard
5. **Notification System**: Email/SMS alerts for low stock
6. **Multi-tenancy**: Support for multiple organizations
7. **Offline Mode**: PWA with service workers
8. **Audit Logging**: Complete trail of all actions
