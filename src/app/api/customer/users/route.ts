import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { visibleOwnerIds } from '@/lib/machine-scope';
import { sendWelcomeEmail } from '@/lib/account-mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a team member. Callers: super customers (into their own organization)
 * and admins. The new account is always a plain customer.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await createServerClient();
    const { data: { user: caller } } = await auth.auth.getUser();
    if (!caller) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: callerProfile } = await supabase
      .from('profiles').select('role, account_type, organization_id, full_name').eq('id', caller.id).maybeSingle();
    const isAdmin = callerProfile?.role === 'admin';
    const isSuper = callerProfile?.account_type === 'super_customer' && !!callerProfile.organization_id;
    if (!isAdmin && !isSuper) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = body.full_name ? String(body.full_name).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const machine_ids: string[] = Array.isArray(body.machine_ids) ? body.machine_ids.map(String) : [];
    // Super customers can only add people to their own organization
    const organization_id = isSuper ? callerProfile!.organization_id : (body.organization_id || null);

    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });

    // Temporary password nobody ever sees; the user sets their own via the welcome email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: randomBytes(32).toString('hex'),
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (authError || !authData.user) {
      const exists = /already (been )?registered|already exists/i.test(authError?.message || '');
      return NextResponse.json(
        { error: exists ? 'A user with this email already exists' : authError?.message || 'Could not create user' },
        { status: exists ? 409 : 400 },
      );
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email,
      full_name,
      phone,
      role: 'customer',
      account_type: 'customer',
      organization_id,
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile error:', profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Failed to create user profile: ${profileError.message}` }, { status: 500 });
    }

    // Only machines the caller can already see may be handed to the new user
    if (machine_ids.length > 0) {
      let query = supabase.from('vending_machines').update({ customer_id: authData.user.id }).in('id', machine_ids);
      if (!isAdmin) query = query.in('customer_id', await visibleOwnerIds(supabase, caller.id, callerProfile));
      const { error: machineError } = await query;
      if (machineError) console.error('Machine assignment error:', machineError);
    }

    let invitedBy: string | null = callerProfile?.full_name || null;
    if (organization_id) {
      const { data: org } = await supabase.from('organizations').select('name').eq('id', organization_id).maybeSingle();
      if (org?.name) invitedBy = invitedBy ? `${invitedBy} (${org.name})` : org.name;
    }
    const mail = await sendWelcomeEmail(supabase, email, { name: full_name, invitedBy });
    if (!mail.ok) console.error('Welcome email error:', mail.error);

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email: authData.user.email },
      emailSent: mail.ok,
      message: mail.ok
        ? 'User created. A welcome email with a set-password link is on its way.'
        : 'User created, but the welcome email could not be sent. They can use "Forgot password" to set one.',
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
