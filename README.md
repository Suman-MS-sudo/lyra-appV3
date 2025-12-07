# Lyra App v3

Enterprise-grade vending machine management system built with Next.js 16, React 19, and Supabase.

## Features

- 🔐 **Role-based Authentication**: Secure admin and customer portals
- 📊 **Real-time Analytics**: Dashboard metrics and reporting
- 🏪 **Inventory Management**: Track products across multiple machines
- 💳 **Transaction Processing**: Complete purchase flow with history
- 🔒 **Enterprise Security**: RLS policies, rate limiting, security headers
- 📱 **Responsive Design**: Mobile-first UI with Tailwind CSS
- 🧪 **Comprehensive Testing**: Unit and integration tests with Vitest
- 🚀 **CI/CD Pipeline**: Automated testing and deployment

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend**: Next.js Server Actions, API Routes
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth with JWT
- **Testing**: Vitest, Testing Library
- **Deployment**: Vercel
- **CI/CD**: GitHub Actions

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lyra-app-v3
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_secure_jwt_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run database migrations:
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
lyra-app-v3/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── actions/           # Server Actions
│   │   ├── admin/             # Admin dashboard routes
│   │   ├── api/               # API routes
│   │   ├── customer/          # Customer portal routes
│   │   └── login/             # Authentication
│   ├── components/            # React components
│   ├── lib/                   # Utilities and helpers
│   │   ├── supabase/         # Supabase clients
│   │   ├── validations.ts    # Zod schemas
│   │   ├── errors.ts         # Custom error classes
│   │   ├── logger.ts         # Logging utility
│   │   └── utils.ts          # Helper functions
│   ├── test/                  # Test files
│   └── types/                 # TypeScript types
├── supabase/
│   └── migrations/            # Database migrations
├── .github/
│   └── workflows/             # CI/CD pipelines
└── public/                    # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Generate coverage report

## Authentication

The application supports two user roles:

- **Admin**: Full access to manage machines, products, and view all transactions
- **Customer**: Access to purchase products and view personal transaction history

Default test accounts (create these in Supabase):
- Admin: `admin@lyra.app`
- Customer: `customer@lyra.app`

## Database Schema

Key tables:
- `profiles` - User profiles with role information
- `vending_machines` - Machine inventory and status
- `products` - Product catalog per machine
- `transactions` - Purchase history
- `inventory_logs` - Audit trail for stock changes

See `supabase/migrations/` for complete schema.

## Security

- Row Level Security (RLS) policies on all tables
- JWT-based authentication
- Rate limiting on API routes
- Security headers (CSP, XSS protection, etc.)
- Input validation with Zod schemas
- HTTPS enforcement in production

## Testing

Run the test suite:
```bash
npm test
```

Generate coverage report:
```bash
npm run test:coverage
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Manual Deployment

```bash
npm run build
npm run start
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - System design and patterns
- [Deployment](./DEPLOYMENT.md) - Deployment guide
- [Copilot Instructions](./.github/copilot-instructions.md) - AI coding guidelines

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

Proprietary - All rights reserved

## Support

For issues and questions, please open a GitHub issue or contact the development team.

