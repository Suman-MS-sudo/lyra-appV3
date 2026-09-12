import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import EditUserMachines from '@/components/EditUserMachines';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #f1f5f9',
  borderRadius: 20,
};

export default async function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
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

  const { data: userToEdit } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!userToEdit || userToEdit.organization_id !== profile.organization_id) {
    redirect('/customer/users');
  }

  const orgId = profile.organization_id;
  const { data: allMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location, customer_id')
    .or(`customer_id.eq.${orgId},customer_id.eq.${userId}`)
    .order('name');

  const ownedMachines = allMachines?.filter(m => m.customer_id === orgId) || [];
  const assignedMachines = allMachines?.filter(m => m.customer_id === userId) || [];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/customer/users"
          className="text-sm transition-colors hover:text-slate-900 mb-2 inline-block"
          style={{ color: '#334155' }}
        >
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit User</h1>
        <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Update user information and machine assignments</p>
      </div>

      <div className="rounded-2xl p-6 space-y-6" style={CARD}>
        {/* User Info */}
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-4">User Information</h3>
          <div className="space-y-0" style={{ borderTop: '1px solid #f1f5f9' }}>
            {[
              ['Email', userToEdit.email],
              ['Full Name', userToEdit.full_name || 'Not set'],
              ['Phone', userToEdit.phone || 'Not set'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="text-sm" style={{ color: '#334155' }}>{label}</span>
                <span className="text-sm font-medium text-slate-900">{value}</span>
              </div>
            ))}
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <span className="text-sm" style={{ color: '#334155' }}>Role</span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
              >
                {userToEdit.role}
              </span>
            </div>
          </div>
        </div>

        {/* Machine Assignment */}
        <div className="pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Machine Management</h3>
          <p className="text-sm mb-4" style={{ color: '#334155' }}>
            Assign specific machines to this user. Assigned machines will be owned and managed by them.
          </p>
          <EditUserMachines
            userId={userId}
            superCustomerId={orgId}
            ownedMachines={ownedMachines}
            assignedMachines={assignedMachines}
          />
        </div>

        {/* Permissions info */}
        <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Access Permissions</h4>
          <ul className="space-y-1">
            {[
              ['✓', 'View all machines in the organization'],
              ['✓', 'See revenue and transaction data'],
              ['✓', 'Access customer dashboard'],
              ['✗', 'Cannot create or manage users'],
              ['✗', 'Cannot access admin features'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2 text-sm">
                <span style={{ color: icon === '✓' ? '#34D399' : '#2563EB' }}>{icon}</span>
                <span style={{ color: '#334155' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
