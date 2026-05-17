import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import NewCustomerUserForm from '@/components/NewCustomerUserForm';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

export default async function NewCustomerUserPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'super_customer') redirect('/customer/dashboard');

  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location')
    .eq('customer_id', user.id)
    .order('name');

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/customer/users"
          className="text-sm transition-colors hover:text-white mb-2 inline-block"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-white">Create New User</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Add a new user to your organization with limited access</p>
      </div>

      <div className="rounded-2xl p-6 sm:p-8" style={CARD}>
        <NewCustomerUserForm
          superCustomerId={user.id}
          organizationId={profile.organization_id}
          machines={machines || []}
        />
      </div>
    </main>
  );
}
