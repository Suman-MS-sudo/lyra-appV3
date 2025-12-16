# Organization Billing System - Setup Instructions

## Overview
This system automatically tracks coin payments from organizations and generates monthly invoices for payment collection via Razorpay.

## Database Setup

### 1. Apply Migration
Run the migration to create necessary tables:

```bash
cd /path/to/lyra-app-v3
node scripts/apply-billing-migration.mjs
```

Or manually run the SQL in Supabase SQL Editor:
- File: `supabase/migrations/20251215000001_organization_billing.sql`

## Monthly Automation Setup

### Option 1: PM2 Cron (Recommended for Production)

Create a cron job file: `billing-cron.config.cjs`

```javascript
module.exports = {
  apps: [{
    name: 'lyra-billing-cron',
    script: 'node',
    args: 'scripts/generate-monthly-invoices.mjs',
    cron_restart: '0 9 * * 1', // Every Monday at 9 AM
    autorestart: false,
    watch: false,
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    }
  }]
};
```

Start the cron job:
```bash
pm2 start billing-cron.config.cjs
pm2 save
```

### Option 2: System Crontab

Edit crontab:
```bash
crontab -e
```

Add this line (runs every 1st Monday at 9 AM):
```bash
0 9 1-7 * 1 cd /path/to/lyra-app-v3 && node scripts/generate-monthly-invoices.mjs >> /var/log/billing-cron.log 2>&1
```

### Option 3: Manual Trigger
Use the "Generate Monthly Invoices" button in the admin billing dashboard:
- Go to: https://lyra-app.co.in/admin/billing
- Click "Generate Monthly Invoices" button

## Features

### 1. Automatic Invoice Generation
- **When**: 1st Monday of every month
- **What**: Creates invoices for all organizations based on previous month's coin payments
- **Status**: Invoices start as "pending"

### 2. Email Notifications
- **Manual Send**: Click "Send" button next to any invoice
- **Automated**: Triggered by cron job (TODO: implement email template)
- **Reminder Tracking**: System tracks email sent count and dates

### 3. Payment Recording

#### Manual Payment
1. Go to admin billing dashboard
2. Click ₹ icon next to invoice
3. Enter amount and notes
4. Click "Record Payment"
5. Invoice status automatically updates

#### Razorpay Payment (TODO)
- Organization receives email with payment link
- Clicks link → redirected to Razorpay checkout
- Payment success → webhook updates invoice automatically

### 4. Invoice Statuses
- **draft**: No coin transactions in period (amount = 0)
- **pending**: Awaiting payment from organization
- **paid**: Fully paid
- **overdue**: Past due date (TODO: implement due date logic)
- **cancelled**: Manually cancelled by admin

## Admin Dashboard Usage

### View All Invoices
Navigate to: `/admin/billing`

**Summary Cards:**
- Pending Amount: Total unpaid invoices
- Collected: All-time paid amount
- Overdue: Past-due invoices
- Total Invoices: Count of all invoices

**Actions:**
- 📧 Send Email: Send invoice to organization
- ₹ Record Payment: Manually mark payment received
- View: See invoice details and payment history

### Generate Invoices
1. Click "Generate Monthly Invoices" button
2. System calculates coin payments for each organization
3. Creates invoices for previous month
4. Sends notification emails (if configured)

## Database Schema

### `organization_invoices`
- Tracks invoices per organization
- Calculates from `coin_payments` table
- Links to `organizations` table

### `organization_payments`
- Records all payments (manual and Razorpay)
- Links to invoices
- Triggers automatic invoice updates

## Email Template (TODO)

Create email template in `src/emails/organization-invoice.tsx`:

```
Subject: Invoice #{invoice_number} - Coin Payment Collection

Dear {organization_name},

Your invoice for coin payments is ready:

Period: {period_start} to {period_end}
Total Transactions: {transaction_count}
Amount Due: ₹{amount}

[Pay Now Button] → Razorpay checkout

Thank you for your business!
```

## Razorpay Integration (TODO)

### 1. Create Payment Links API
File: `src/app/api/billing/create-payment/route.ts`

- Generate Razorpay order
- Link to invoice ID
- Send payment link to organization

### 2. Webhook Handler
File: `src/app/api/billing/razorpay-webhook/route.ts`

- Verify Razorpay signature
- Record payment in `organization_payments`
- Trigger updates invoice automatically (via database trigger)

### 3. Payment Success Page
File: `src/app/billing/payment-success/page.tsx`

- Show success message
- Display invoice details
- Send confirmation email

## Monitoring & Reports

### Check Invoice Generation
```bash
# View recent invoices
node scripts/check-invoices.mjs

# View specific organization
node scripts/check-invoices.mjs --org-id=<uuid>
```

### Payment Reports
```bash
# View payment history
node scripts/payment-report.mjs --month=2024-12
```

## Security Considerations

1. **RLS Policies**: 
   - Admins can manage all invoices
   - Super customers can view their organization's invoices only

2. **Razorpay Webhook**:
   - Verify signature on every webhook
   - Log all webhook calls
   - Idempotent payment processing

3. **Email Security**:
   - Use secure email service (SendGrid/Resend)
   - Rate limit email sending
   - Track bounces and complaints

## Troubleshooting

### Invoices Not Generated
1. Check cron job is running: `pm2 list`
2. Check logs: `pm2 logs lyra-billing-cron`
3. Manually trigger from admin dashboard

### Payment Not Updating Invoice
1. Check `organization_payments` table
2. Verify trigger is enabled: `trigger_update_invoice_on_payment`
3. Check payment status is 'success'

### Email Not Sending
1. Check email service configuration
2. Verify organization has valid email
3. Check email sent tracking in invoice record

## Next Steps

1. ✅ Database schema created
2. ✅ Admin UI for viewing/managing invoices
3. ✅ Manual payment recording
4. ⏳ Email templates and sending
5. ⏳ Razorpay payment integration
6. ⏳ Automated email scheduling
7. ⏳ Payment reminder system
8. ⏳ Due date and overdue logic
9. ⏳ PDF invoice generation
10. ⏳ Payment receipt generation

## Support

For issues or questions:
- Check logs: `/var/log/billing-cron.log`
- Review database: Supabase Dashboard → Table Editor
- Contact: admin@lyra-app.co.in
