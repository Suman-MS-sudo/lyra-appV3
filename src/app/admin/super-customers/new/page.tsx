import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createSuperCustomer } from '@/app/actions/super-customer';

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

export default async function NewSuperCustomerPage() {
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

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add Super Customer</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Create a new organization account</p>
      </div>

      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
        <p className="text-sm" style={{ color: '#93C5FD' }}>
          A password reset email will be automatically sent to the super customer's email address. They will set their own password using the secure link.
        </p>
      </div>

      <form action={createSuperCustomer} className="rounded-2xl p-6 space-y-6" style={CARD}>
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="super@company.com"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Super customer will receive a password reset link at this email</p>
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="ACME Corporation"
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="contact@company.com"
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="+91 98765 43210"
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="123 Business St, City, State, ZIP"
          />
        </div>

        <div className="flex gap-4 pt-2">
          <Link
            href="/admin/super-customers"
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
            Create Super Customer
          </button>
        </div>
      </form>
    </main>
  );
}
