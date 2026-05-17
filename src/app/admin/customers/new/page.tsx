import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.70)' };

async function createCustomer(formData: FormData) {
  'use server';

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = formData.get('email') as string;
  const fullName = formData.get('full_name') as string;
  const organizationId = formData.get('organization_id') as string;
  const canEdit = formData.get('can_edit') === 'on';

  const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(u => u.email === email);

  if (existingUser) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('id', existingUser.id)
      .single();

    if (!existingProfile) {
      const { error: insertError } = await serviceSupabase
        .from('profiles')
        .insert({
          id: existingUser.id,
          email: existingUser.email,
          full_name: fullName,
          account_type: 'customer',
          role: 'customer',
          organization_id: organizationId || null,
          permissions: { can_edit: canEdit, can_view: true }
        });
      if (insertError) throw new Error(`Failed to create profile: ${insertError.message}`);
    } else {
      await serviceSupabase
        .from('profiles')
        .update({
          full_name: fullName,
          account_type: 'customer',
          role: 'customer',
          organization_id: organizationId || null,
          permissions: { can_edit: canEdit, can_view: true }
        })
        .eq('id', existingUser.id);
    }

    await serviceSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
    });
    redirect('/admin/customers');
    return;
  }

  const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) + 'Aa1!';

  const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'customer', account_type: 'customer' }
  });

  if (authError) throw new Error(authError.message);

  await new Promise(resolve => setTimeout(resolve, 500));

  const { data: existingProfile } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (!existingProfile) {
    const { error: insertError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId || null,
        permissions: { can_edit: canEdit, can_view: true }
      });
    if (insertError) {
      await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(insertError.message);
    }
  } else {
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId || null,
        permissions: { can_edit: canEdit, can_view: true }
      })
      .eq('id', authData.user.id);
    if (profileError) throw new Error(profileError.message);
  }

  await serviceSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
  });

  redirect('/admin/customers');
}

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'admin') redirect('/customer/dashboard');

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .order('name');

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add Customer</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Create a new customer account</p>
      </div>

      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
        <p className="text-sm" style={{ color: '#93C5FD' }}>
          A password reset email will be automatically sent to the customer's email address. They will receive a secure link to set their password.
        </p>
      </div>

      <form action={createCustomer} className="rounded-2xl p-6 space-y-6" style={CARD}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2" style={LABEL}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="customer@example.com"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Customer will receive a password reset link at this email</p>
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium mb-2" style={LABEL}>
            Full Name
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            required
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="organization_id" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization (Optional)
          </label>
          <select
            id="organization_id"
            name="organization_id"
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          >
            <option value="" style={{ background: '#1E0A3C' }}>No Organization (Independent Customer)</option>
            {organizations?.map((org) => (
              <option key={org.id} value={org.id} style={{ background: '#1E0A3C' }}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Select an organization if this customer belongs to a company</p>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="can_edit"
              className="w-4 h-4 rounded accent-pink-500"
            />
            <span className="text-sm font-medium" style={LABEL}>Can Edit (Allow customer to make purchases)</span>
          </label>
          <p className="text-xs mt-1 ml-7" style={{ color: 'rgba(255,255,255,0.35)' }}>If unchecked, customer will have read-only access</p>
        </div>

        <div className="flex gap-4 pt-2">
          <Link
            href="/admin/customers"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
          >
            Create Customer
          </button>
        </div>
      </form>
    </main>
  );
}
