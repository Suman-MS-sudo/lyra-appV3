# Production Deployment Checklist

Use this checklist before deploying Lyra App v3 to production.

## Pre-Deployment

### Environment Setup
- [ ] Production Supabase project created
- [ ] Database migrations applied to production
- [ ] Environment variables configured in Vercel
- [ ] Domain name configured and DNS updated
- [ ] SSL certificate active (automatic with Vercel)

### Security Review
- [ ] All RLS policies tested with actual users
- [ ] Admin role verification working correctly
- [ ] Rate limiting tested and configured
- [ ] Security headers verified (CSP, XSS protection)
- [ ] No sensitive data in client-side code
- [ ] API keys are in environment variables only
- [ ] HTTPS enforced (no HTTP access)
- [ ] CORS configured correctly

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint shows no errors (`npm run lint`)
- [ ] All tests passing (`npm test`)
- [ ] Code coverage above 80% (`npm run test:coverage`)
- [ ] No console.log statements in production code
- [ ] No TODO/FIXME comments blocking deployment
- [ ] Proper error handling in all routes

### Performance
- [ ] Build completes successfully (`npm run build`)
- [ ] Bundle size analyzed (< 500KB ideal)
- [ ] Images optimized (using Next.js Image)
- [ ] Database queries optimized
- [ ] Indexes added for common queries
- [ ] No N+1 query problems

### Database
- [ ] Production database backed up
- [ ] Migration history clean
- [ ] All tables have RLS enabled
- [ ] Sample data removed (if any)
- [ ] Database connection pooling configured
- [ ] Backup schedule configured

### Monitoring & Analytics
- [ ] Error tracking configured (Sentry/similar)
- [ ] Analytics configured (PostHog/GA)
- [ ] Logging levels set appropriately
- [ ] Uptime monitoring configured
- [ ] Performance monitoring enabled

### Documentation
- [ ] README.md updated with production info
- [ ] Environment variables documented
- [ ] API documentation complete
- [ ] Team has access to docs

## Deployment Process

### 1. Pre-Deploy Verification
```bash
# Run full test suite
npm test

# Lint code
npm run lint

# Build locally
npm run build

# Check for security issues
npm audit

# Verify environment variables
cat .env.local # Should NOT be committed
```

### 2. Database Migration (if needed)
```bash
# Backup production database first!
supabase db dump > backup-$(date +%Y%m%d).sql

# Review migration SQL
cat supabase/migrations/*.sql

# Apply to production
supabase db push --db-url your-production-db-url

# Verify migration success
supabase db status
```

### 3. Deploy to Vercel

#### Option A: Automatic (Recommended)
```bash
# Merge to main branch
git checkout main
git merge develop
git push origin main

# GitHub Actions will:
# 1. Run tests
# 2. Build application
# 3. Deploy to production
```

#### Option B: Manual
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Follow prompts
```

### 4. Post-Deploy Verification
- [ ] Production site loads correctly
- [ ] Login works for admin and customer
- [ ] Database queries executing properly
- [ ] No console errors in browser
- [ ] All critical paths tested manually
- [ ] Error tracking receiving events
- [ ] Analytics tracking events

## Post-Deployment

### Immediate Tasks (First Hour)
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify all integrations working
- [ ] Test critical user flows
- [ ] Monitor database performance

### First Day
- [ ] Review error reports
- [ ] Check analytics data
- [ ] Monitor user feedback
- [ ] Verify backup completed
- [ ] Document any issues

### First Week
- [ ] Analyze usage patterns
- [ ] Review performance metrics
- [ ] Check database growth
- [ ] Optimize slow queries
- [ ] Plan improvements

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# In Vercel Dashboard:
# 1. Go to Deployments
# 2. Find previous working deployment
# 3. Click "Promote to Production"
```

### Code Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or rollback to specific commit
git reset --hard <commit-hash>
git push --force origin main
```

### Database Rollback
```bash
# Restore from backup
supabase db restore backup-YYYYMMDD.sql

# Verify restoration
supabase db status
```

## Environment Variables Checklist

### Required
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL`

### Optional but Recommended
- [ ] `NEXT_PUBLIC_ENABLE_ANALYTICS`
- [ ] `NEXT_PUBLIC_ENABLE_ERROR_TRACKING`
- [ ] `SENTRY_DSN` (if using Sentry)
- [ ] `ANALYTICS_ID` (if using analytics)

## Security Hardening

### Before Production
- [ ] Change all default passwords
- [ ] Remove test accounts
- [ ] Rotate API keys
- [ ] Review all RLS policies
- [ ] Enable 2FA for admin accounts
- [ ] Configure rate limits appropriately
- [ ] Review CORS settings
- [ ] Set up firewall rules (if applicable)

### Ongoing
- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Monitor for CVEs
- [ ] Review access logs
- [ ] Update RLS policies as needed

## Performance Optimization

### Database
- [ ] Add indexes for slow queries
- [ ] Enable connection pooling
- [ ] Configure read replicas (if needed)
- [ ] Set up query caching
- [ ] Monitor query performance

### Application
- [ ] Enable Vercel Analytics
- [ ] Configure ISR where applicable
- [ ] Optimize images
- [ ] Minimize JavaScript bundles
- [ ] Enable compression

### CDN & Caching
- [ ] Static assets on CDN
- [ ] Appropriate cache headers
- [ ] Image optimization enabled
- [ ] Edge caching configured

## Monitoring Setup

### Vercel
- [ ] Analytics enabled
- [ ] Web Vitals tracking
- [ ] Log drains configured
- [ ] Alerts set up

### Supabase
- [ ] Database metrics monitored
- [ ] Query performance tracked
- [ ] Connection pool monitored
- [ ] Storage usage tracked

### Custom
- [ ] Error tracking (Sentry)
- [ ] Analytics (PostHog/GA)
- [ ] Uptime monitoring
- [ ] Performance monitoring

## Compliance & Legal

### Before Launch
- [ ] Privacy policy updated
- [ ] Terms of service current
- [ ] Cookie consent configured
- [ ] GDPR compliance verified
- [ ] Data retention policy set
- [ ] User data export capability

## Team Communication

### Notify Team
- [ ] Deployment schedule communicated
- [ ] Stakeholders informed
- [ ] Support team briefed
- [ ] Documentation updated
- [ ] Training completed (if needed)

## Emergency Contacts

Maintain list of:
- [ ] DevOps on-call
- [ ] Database administrator
- [ ] Security team
- [ ] Product owner
- [ ] Vercel support
- [ ] Supabase support

## Success Metrics

Define and track:
- [ ] Error rate < 1%
- [ ] Response time < 200ms average
- [ ] Uptime > 99.9%
- [ ] Zero security incidents
- [ ] Customer satisfaction score

## Final Sign-Off

Before going live:
- [ ] Technical lead approval
- [ ] QA team sign-off
- [ ] Product owner approval
- [ ] Security review complete
- [ ] All checklist items completed

---

## Quick Reference Commands

```bash
# Deploy to production
git push origin main

# Check build status
npm run build

# Run all tests
npm test

# Apply database migration
supabase db push

# Backup database
supabase db dump > backup.sql

# Monitor logs
vercel logs --follow

# Check deployment status
vercel ls
```

---

**Last Updated**: [Date]  
**Next Review**: [Date + 30 days]  
**Reviewed By**: [Name]
