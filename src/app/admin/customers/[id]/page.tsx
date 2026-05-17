import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { updateCustomer } from '@/app/actions/admin';

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

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const { data: customer } = await serviceSupabase
    .from('profiles')
    .select('*, organizations (id, name)')
    .eq('id', id)
    .single();

  if (!customer || customer.account_type !== 'customer') redirect('/admin/customers');

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .order('name');

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Edit Customer</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Update customer details and permissions</p>
      </div>

      <form action={updateCustomer} className="rounded-2xl p-6 space-y-6" style={CARD}>
        <input type="hidden" name="user_id" value={id} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2" style={LABEL}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            disabled
            defaultValue={customer.email}
            className="w-full px-4 py-2.5 cursor-not-allowed"
            style={{ ...INPUT, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.40)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Email cannot be changed</p>
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
            defaultValue={customer.full_name || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        <div>
          <label htmlFor="organization_id" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization
          </label>
          <select
            id="organization_id"
            name="organization_id"
            defaultValue={customer.organization_id || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          >
            <option value="" style={{ background: '#1E0A3C' }}>Independent (No Organization)</option>
            {organizations?.map((org: any) => (
              <option key={org.id} value={org.id} style={{ background: '#1E0A3C' }}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="can_edit"
              defaultChecked={customer.permissions?.can_edit || false}
              className="w-4 h-4 rounded accent-pink-500"
            />
            <span className="text-sm font-medium" style={LABEL}>
              Can Edit (allow customer to make purchases and transactions)
            </span>
          </label>
        </div>

        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
          >
            Update Customer
          </button>
          <Link
            href="/admin/customers"
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
