# Deployment Configuration

This document outlines the deployment process and configuration for Lyra App v3.

## Environments

### Development
- Branch: `develop`
- URL: http://localhost:3000
- Database: Local Supabase instance

### Staging
- Branch: `develop`
- URL: https://lyra-staging.vercel.app
- Database: Supabase staging project
- Auto-deploys on push to `develop`

### Production
- Branch: `main`
- URL: https://lyra.app
- Database: Supabase production project
- Auto-deploys on push to `main`

## Required Secrets

Configure these in GitHub repository settings and Vercel:

### GitHub Secrets
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `CODECOV_TOKEN`: Codecov upload token (optional)
- `SUPABASE_ACCESS_TOKEN`: Supabase CLI access token
- `SUPABASE_DB_PASSWORD`: Database password
- `SUPABASE_PROJECT_ID`: Supabase project ID

### Vercel Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (production only)
- `JWT_SECRET`: JWT signing secret
- `NEXT_PUBLIC_APP_URL`: Application URL

## Deployment Process

1. **Development**
   ```bash
   git checkout develop
   git pull origin develop
   # Make changes
   git add .
   git commit -m "feat: description"
   git push origin develop
   ```

2. **Staging Deployment**
   - Push to `develop` branch triggers automatic deployment
   - CI/CD pipeline runs tests and builds
   - Deploys to staging environment

3. **Production Deployment**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   - Push to `main` triggers production deployment
   - All checks must pass before deployment

## Database Migrations

1. Create migration file in `supabase/migrations/`
2. Test locally with Supabase CLI
3. Push to repository
4. GitHub Actions will apply migrations to production

## Monitoring

- **Error Tracking**: Configure Sentry or similar
- **Analytics**: Configure PostHog or Google Analytics
- **Uptime Monitoring**: Use Vercel Analytics or UptimeRobot
- **Performance**: Vercel Web Vitals

## Rollback Process

If issues occur in production:

1. Revert the deployment in Vercel dashboard
2. Or redeploy previous working commit:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

## Pre-deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] Error boundaries working
- [ ] Analytics tracking configured
