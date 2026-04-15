import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, generatePasswordResetEmailHTML } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const adminClient = createAdminClient();

    // Generate a password recovery link via the admin API
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (error) {
      console.error('[send-reset-email] generateLink error:', error);
      // Return a generic success response to avoid user enumeration
      return NextResponse.json({ success: true });
    }

    const resetLink = data.properties?.action_link;
    if (!resetLink) {
      console.error('[send-reset-email] No action_link in response');
      return NextResponse.json({ success: true });
    }

    // Send via our own SMTP (from address comes from SMTP_FROM_NAME / SMTP_FROM_EMAIL env vars)
    const result = await sendEmail({
      to: email,
      subject: 'Reset Your Lyra Enterprises Password',
      html: generatePasswordResetEmailHTML(resetLink),
      text: `Reset your password by visiting this link: ${resetLink}\n\nThis link expires in 1 hour.`,
    });

    if (!result.success) {
      console.error('[send-reset-email] Email send failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-reset-email] Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
