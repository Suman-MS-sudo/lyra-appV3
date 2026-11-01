import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds a password reset / set-password link that points at this app
 * (`/reset-password?token_hash=…`) instead of Supabase's `/auth/v1/verify`.
 *
 * `generateLink` returns both a Supabase-hosted `action_link` and the raw
 * `hashed_token`; we mail our own URL built from the hash. The reset page only
 * redeems it (verifyOtp) when the user submits a new password, so email
 * link-scanners that "click" links in advance can't burn the one-time token.
 *
 * Returns null when the link can't be generated (unknown email, Supabase
 * error) — callers decide whether that's worth surfacing.
 */
export async function generatePasswordResetLink(
  admin: SupabaseClient,
  email: string,
  /** 'invite' makes the page say "Set your password" instead of "Reset" */
  intent: 'reset' | 'invite' = 'reset',
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('[password-reset-link] generateLink failed:', error ?? 'no hashed_token');
    return null;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://lyra-app.co.in').replace(/\/+$/, '');
  const params = new URLSearchParams({ token_hash: tokenHash, type: 'recovery' });
  if (intent === 'invite') params.set('intent', 'invite');
  return `${appUrl}/reset-password?${params.toString()}`;
}
