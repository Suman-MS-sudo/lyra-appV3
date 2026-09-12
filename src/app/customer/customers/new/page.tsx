import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #f1f5f9',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: '#0f172a' };

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
          className="text-sm transition-colors hover:text-slate-900 mb-2 inline-block"
          style={{ color: '#334155' }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add New User</h1>
        <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Create a new customer account in your organization</p>
      </div>

      <div className="rounded-2xl p-6 space-y-6" style={CARD}>
        <form action="/api/customers/create" method="POST" className="space-y-6">
          <input type="hidden" name="organization_id" value={user.id} />

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium mb-2" style={LABEL}>
              Full Name <span style={{ color: '#2563EB' }}>*</span>
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={INPUT}
              placeholder="e.g., John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2" style={LABEL}>
              Email Address <span style={{ color: '#2563EB' }}>*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={INPUT}
              placeholder="e.g., +91 98765 43210"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2" style={LABEL}>
              Temporary Password <span style={{ color: '#2563EB' }}>*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={6}
              className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={INPUT}
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>User will be asked to change password on first login</p>
          </div>

          {/* Permissions */}
          <div className="pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Permissions</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="can_view"
                  defaultChecked
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm" style={LABEL}>
                  Can view data
                  <span className="block text-xs mt-0.5" style={{ color: '#334155' }}>Allow user to view transactions and devices</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="can_edit"
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm" style={LABEL}>
                  Can edit data
                  <span className="block text-xs mt-0.5" style={{ color: '#334155' }}>Allow user to modify transactions and devices</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              href="/customer/dashboard#customers"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
