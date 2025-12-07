# Razorpay Payment Integration Setup

This guide will help you set up Razorpay payment integration for the purchase page.

## Prerequisites

- Razorpay account (sign up at https://razorpay.com)
- Access to Razorpay Dashboard

## Step 1: Get Razorpay API Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to **Settings** → **API Keys**
3. Click **Generate Test Key** (for development) or **Generate Live Key** (for production)
4. Copy the **Key ID** and **Key Secret**

## Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```bash
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

**Important:** 
- Use `rzp_test_` keys for development/testing
- Use `rzp_live_` keys for production
- Never commit `.env.local` to git

## Step 3: Apply Database Migration

Run the stock decrement function migration:

```bash
node scripts/show-migration.mjs 20231207000008_stock_function.sql
```

Then paste the SQL output into Supabase SQL Editor at:
https://your-project.supabase.co/project/your-project-id/sql/new

## Step 4: Test Payment Flow

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to a purchase page:
   ```
   http://localhost:3000/?value=CN001_INC_001
   ```

3. Add products to cart (max 3 items)

4. Click **Pay** button

5. Use Razorpay test card details:
   - **Card Number:** 4111 1111 1111 1111
   - **CVV:** Any 3 digits
   - **Expiry:** Any future date
   - **Name:** Any name

## Features

### 3-Item Purchase Limit
- Maximum 3 products can be added to cart at once
- "Add to Cart" button shows "Cart Full" when limit is reached
- Cart modal displays "X / 3" counter

### Payment Flow
1. User adds products to cart
2. Clicks "Pay ₹X" button
3. Razorpay checkout modal opens
4. User completes payment
5. Payment is verified server-side
6. Transaction is recorded in database
7. Stock is automatically decremented
8. Success message is shown

### Security Features
- Payment signature verification using HMAC-SHA256
- Server-side stock validation
- Transaction atomicity (payment + stock update)
- RLS policies for data protection

## Troubleshooting

### Payment not working
- Verify Razorpay keys are correct in `.env.local`
- Check browser console for errors
- Ensure Razorpay script is loaded (check Network tab)

### Stock not updating
- Verify migration was applied successfully
- Check Supabase logs for errors
- Ensure machine_products table has correct product mappings

### "Cart Full" showing incorrectly
- Clear browser cache
- Check cart state in React DevTools
- Verify getTotalItems() calculation

## Production Checklist

Before deploying to production:

- [ ] Switch to Razorpay live keys
- [ ] Test payment flow with real card
- [ ] Enable webhook for payment notifications
- [ ] Set up proper error logging
- [ ] Configure payment failure handling
- [ ] Add receipt/invoice generation
- [ ] Test stock synchronization
- [ ] Verify RLS policies are active
- [ ] Enable HTTPS (required by Razorpay)
- [ ] Configure proper CORS headers

## Support

For Razorpay-related issues:
- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Support](https://razorpay.com/support/)

For application issues:
- Check `DEVELOPMENT.md` for debugging tips
- Review server logs in production
