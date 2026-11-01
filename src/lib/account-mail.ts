import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { generatePasswordResetLink } from '@/lib/password-reset-link';
import { passwordChangedEmail, passwordResetEmail, welcomeEmail } from '@/lib/auth-emails';

type Result = { ok: true } | { ok: false; error: string };

/** Welcome + set-password email for an account an admin / super customer just created. */
export async function sendWelcomeEmail(
  admin: SupabaseClient,
  email: string,
  opts: { name?: string | null; invitedBy?: string | null } = {},
): Promise<Result> {
  const link = await generatePasswordResetLink(admin, email, 'invite');
  if (!link) return { ok: false, error: 'Could not generate a set-password link' };
  const mail = welcomeEmail(link, opts);
  const r = await sendEmail({ to: email, ...mail });
  return r.success ? { ok: true } : { ok: false, error: r.error || 'Email failed' };
}

/** "Forgot password" email. */
export async function sendPasswordResetEmail(admin: SupabaseClient, email: string): Promise<Result> {
  const link = await generatePasswordResetLink(admin, email);
  if (!link) return { ok: false, error: 'Could not generate a reset link' };
  const r = await sendEmail({ to: email, ...passwordResetEmail(link) });
  return r.success ? { ok: true } : { ok: false, error: r.error || 'Email failed' };
}

/** Security notice after a password change. Never throws. */
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
  const r = await sendEmail({ to: email, ...passwordChangedEmail({ when }) });
  if (!r.success) console.error('[password-changed] email failed:', r.error);
}
