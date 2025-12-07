# Quick Start Guide

Get Lyra App v3 running in under 10 minutes.

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Git
- Supabase account (free tier works)

## Step-by-Step Setup

### 1. Clone and Install (2 minutes)

```bash
# Clone the repository
git clone <repository-url>
cd lyra-app-v3

# Install dependencies
npm install
```

### 2. Supabase Setup (3 minutes)

#### Option A: Use Supabase Cloud (Recommended)

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to initialize (~2 minutes)
4. Go to Project Settings → API
5. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

#### Option B: Use Local Supabase (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local instance
supabase start

# Note the URLs and keys displayed
```

### 3. Environment Configuration (1 minute)

```bash
# Copy example environment file
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=generate_random_32_char_string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate JWT_SECRET:
```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 4. Database Migrations (2 minutes)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

Your database now has:
- ✅ Tables (profiles, vending_machines, products, transactions)
- ✅ Row Level Security policies
- ✅ Indexes for performance
- ✅ Triggers for automation

### 5. Create Test Users (2 minutes)

Go to Supabase Dashboard → Authentication → Users:

**Admin User:**
- Email: `admin@lyra.app`
- Password: `password123` (change in production!)
- After creation, update the `profiles` table to set `role = 'admin'`

**Customer User:**
- Email: `customer@lyra.app`
- Password: `password123`
- Role will be `customer` by default

### 6. Start Development Server (1 second)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Verify Installation

### 1. Check Homepage
- Should see Lyra landing page
- No errors in console

### 2. Test Login
- Navigate to `/login`
- Login as admin: `admin@lyra.app` / `password123`
- Should redirect to `/admin/dashboard`
- See dashboard with metrics

### 3. Test Customer Flow
- Logout
- Login as customer: `customer@lyra.app` / `password123`
- Should redirect to `/customer/dashboard`
- See customer dashboard

### 4. Run Tests
```bash
npm test
```
All tests should pass ✅

## Common Issues

### Issue: "Invalid Supabase URL"
**Solution**: Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL`

### Issue: "Failed to fetch"
**Solution**: 
1. Verify Supabase project is running
2. Check API keys are correct
3. Ensure no firewall blocking requests

### Issue: "Unauthorized"
**Solution**:
1. Check user exists in Supabase Auth
2. Verify RLS policies are applied
3. Check user role in `profiles` table

### Issue: Tests failing
**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm test
```

### Issue: Build errors
**Solution**:
1. Ensure all environment variables are set
2. Run `npm run build` to see detailed errors
3. Check TypeScript errors: `npx tsc --noEmit`

## Next Steps

Once running:

1. **Explore the Admin Dashboard**
   - View metrics
   - Check navigation

2. **Explore the Customer Portal**
   - View dashboard
   - Check purchase history

3. **Read Documentation**
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
   - [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

4. **Try Development Tasks**
   - Create a new component
   - Add a server action
   - Write a test

5. **Set Up Your IDE**
   - Install ESLint extension
   - Install TypeScript extension
   - Configure auto-format on save

## Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint -- --fix    # Auto-fix linting issues

# Testing
npm test                 # Run tests in watch mode
npm run test:ui          # Run tests with UI
npm run test:coverage    # Generate coverage report

# Database
supabase db reset        # Reset local database
supabase db push         # Apply migrations
supabase migration new   # Create new migration
```

## Project Structure Overview

```
lyra-app-v3/
├── src/
│   ├── app/              # Next.js pages and routes
│   │   ├── actions/      # Server actions (mutations)
│   │   ├── admin/        # Admin dashboard
│   │   ├── customer/     # Customer portal
│   │   └── api/          # API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities and helpers
│   │   ├── supabase/    # Database clients
│   │   ├── validations.ts
│   │   └── errors.ts
│   └── types/            # TypeScript types
├── supabase/
│   └── migrations/       # Database migrations
└── .github/
    └── workflows/        # CI/CD pipelines
```

## Getting Help

- 📖 Check [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed guides
- 🐛 Search existing [GitHub Issues](../../issues)
- 💬 Open a new issue for bugs
- 📧 Contact the team for urgent issues

## What's Next?

You're all set! Here are some suggested next steps:

1. ✅ Application is running
2. → Add sample data (vending machines, products)
3. → Explore admin functionality
4. → Test customer flows
5. → Read architecture documentation
6. → Make your first contribution

Happy coding! 🚀
