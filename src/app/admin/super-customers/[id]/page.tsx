import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { updateSuperCustomer } from '@/app/actions/super-customer';

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

export default async function EditSuperCustomerPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: superCustomer } = await serviceSupabase
    .from('profiles')
    .select('*, organizations (id, name, contact_email, contact_phone, address)')
    .eq('id', id)
    .single();

  if (!superCustomer || superCustomer.account_type !== 'super_customer') {
    redirect('/admin/super-customers');
  }

  const organization = superCustomer.organizations?.[0];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Edit Super Customer</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Update account and organization details</p>
      </div>

      <form action={updateSuperCustomer} className="rounded-2xl p-6 space-y-6" style={CARD}>
        <input type="hidden" name="user_id" value={id} />
        <input type="hidden" name="org_id" value={organization?.id || ''} />

        {/* Account section */}
        <div className="pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-base font-semibold text-white mb-0.5">Account Information</h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Login credentials for the super customer</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2" style={LABEL}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            defaultValue={superCustomer.email}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Email cannot be changed after creation</p>
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
            defaultValue={superCustomer.full_name || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        {/* Organization section */}
        <div className="pb-4 pt-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-base font-semibold text-white mb-0.5">Organization Details</h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Information about the organization</p>
        </div>

        <div>
          <label htmlFor="org_name" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization Name
          </label>
          <input
            type="text"
            id="org_name"
            name="org_name"
            required
            defaultValue={organization?.name || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        <div>
          <label htmlFor="org_email" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization Email
          </label>
          <input
            type="email"
            id="org_email"
            name="org_email"
            defaultValue={organization?.contact_email || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        <div>
          <label htmlFor="org_phone" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization Phone
          </label>
          <input
            type="tel"
            id="org_phone"
            name="org_phone"
            defaultValue={organization?.contact_phone || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        <div>
          <label htmlFor="org_address" className="block text-sm font-medium mb-2" style={LABEL}>
            Organization Address
          </label>
          <textarea
            id="org_address"
            name="org_address"
            rows={3}
            defaultValue={organization?.address || ''}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
          />
        </div>

        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
          >
            Update Super Customer
          </button>
          <Link
            href="/admin/super-customers"
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
