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

  if (profile?.account_type !== 'super_customer') redirect('/customer/dashboard');

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/customer/dashboard#customers"
          className="text-sm transition-colors hover:text-white mb-2 inline-block"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-white">Add New User</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Create a new customer account in your organization</p>
      </div>

      <div className="rounded-2xl p-6 space-y-6" style={CARD}>
        <form action="/api/customers/create" method="POST" className="space-y-6">
          <input type="hidden" name="organization_id" value={user.id} />

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium mb-2" style={LABEL}>
              Full Name <span style={{ color: '#F472B6' }}>*</span>
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={INPUT}
              placeholder="e.g., John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2" style={LABEL}>
              Email Address <span style={{ color: '#F472B6' }}>*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={INPUT}
              placeholder="e.g., john@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2" style={LABEL}>
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={INPUT}
              placeholder="e.g., +91 98765 43210"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2" style={LABEL}>
              Temporary Password <span style={{ color: '#F472B6' }}>*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={6}
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={INPUT}
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>User will be asked to change password on first login</p>
          </div>

          {/* Permissions */}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-sm font-semibold text-white mb-4">Permissions</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="can_view"
                  defaultChecked
                  className="mt-0.5 w-4 h-4 rounded accent-pink-500"
                />
                <span className="text-sm" style={LABEL}>
                  Can view data
                  <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Allow user to view transactions and devices</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="can_edit"
                  className="mt-0.5 w-4 h-4 rounded accent-pink-500"
                />
                <span className="text-sm" style={LABEL}>
                  Can edit data
                  <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Allow user to modify transactions and devices</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              href="/customer/dashboard#customers"
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
              Create User
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
