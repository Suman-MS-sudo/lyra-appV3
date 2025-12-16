# Production Environment Setup

## Environment Variables

Your production server's `.env` or `.env.production` file should have:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://fjghhrubobqwplvokszz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Application URL - CRITICAL: Must be your actual domain
NEXT_PUBLIC_APP_URL=https://lyra-app.co.in

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Razorpay (if using)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

## ⚠️ Common Mistakes

### ❌ WRONG - Do NOT use these:
```bash
NEXT_PUBLIC_APP_URL=http://0.0.0.0:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://54.151.13.99  # IP address
```

### ✅ CORRECT - Use your actual domain:
```bash
NEXT_PUBLIC_APP_URL=https://lyra-app.co.in
```

## Supabase Configuration

### Site URL
In Supabase Dashboard → Authentication → URL Configuration:

**Site URL:** `https://lyra-app.co.in`

### Redirect URLs
Add these URLs to the allowed list:

1. `https://lyra-app.co.in/auth/callback`
2. `https://lyra-app.co.in/reset-password`
3. `https://lyra-app.co.in/login`

### Email Templates
Make sure your Supabase email templates use:
- `{{ .SiteURL }}` for the site URL
- `{{ .ConfirmationURL }}` for the confirmation link

## After Making Changes

1. **Update environment variables** on your server
2. **Restart your application:**
   ```bash
   pm2 restart all
   # or
   npm run build && pm2 restart lyra-app
   ```
3. **Clear browser cache** and test

## Testing Password Reset

1. Go to `/forgot-password`
2. Enter your email
3. Check email - the link should be: `https://lyra-app.co.in/auth/callback?code=...`
4. NOT: `https://0.0.0.0/...` or `http://localhost/...`

## Troubleshooting

### Issue: Password reset links go to 0.0.0.0
**Cause:** `NEXT_PUBLIC_APP_URL` environment variable is not set correctly in production

**Fix:**
1. SSH into your server
2. Edit `.env` file: `nano /path/to/lyra-app-v3/.env`
3. Set: `NEXT_PUBLIC_APP_URL=https://lyra-app.co.in`
4. Save and restart: `pm2 restart all`

### Issue: Logout redirects to wrong domain
**Cause:** Same as above - incorrect `NEXT_PUBLIC_APP_URL`

**Fix:** Same as above

### Issue: "Email link is invalid or has expired"
**Possible causes:**
1. Link was clicked after expiration (default 1 hour)
2. Wrong redirect URL in Supabase
3. User already reset password using this link

**Fix:**
- Request a new password reset
- Verify redirect URLs in Supabase match your domain
