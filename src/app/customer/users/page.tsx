import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Users, Plus, UserCircle } from 'lucide-react';
import Link from 'next/link';
import DeleteUserButton from '@/components/DeleteUserButton';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #f1f5f9',
  borderRadius: 20,
};

export default async function CustomerUsersPage() {
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

  const { data: managedUsers } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, created_at')
    .eq('organization_id', profile.organization_id)
    .neq('id', user.id)
    .order('created_at', { ascending: false });

  const totalUsers = managedUsers?.length || 0;
  const memberCount = managedUsers?.filter(u => u.role === 'customer').length || 0;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-sm mt-0.5" style={{ color: '#334155' }}>User accounts in your organization</p>
        </div>
        <Link
          href="/customer/users/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Add User
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(96,165,250,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(96,165,250,0.18)' }}>
            <Users className="w-5 h-5" style={{ color: '#60A5FA' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#334155' }}>Total Users</p>
          <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
        </div>

        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(96,165,250,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(96,165,250,0.18)' }}>
            <UserCircle className="w-5 h-5" style={{ color: '#60A5FA' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#334155' }}>Members</p>
          <p className="text-2xl font-bold" style={{ color: '#60A5FA' }}>{memberCount}</p>
        </div>

        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(37,99,235,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(37,99,235,0.18)' }}>
            <UserCircle className="w-5 h-5" style={{ color: '#2563EB' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#334155' }}>Your Role</p>
          <p className="text-lg font-bold" style={{ color: '#2563EB' }}>Admin</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#60A5FA' }} />
            All Users
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>Email</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748b' }}>Role</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: '#64748b' }}>Type</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: '#64748b' }}>Created</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managedUsers && managedUsers.length > 0 ? managedUsers.map((u) => (
                <tr
                  key={u.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <td className="px-5 py-3.5 font-medium text-slate-900">{u.email}</td>
                  <td className="px-5 py-3.5 hidden sm:table-cell" style={{ color: '#334155' }}>{u.role}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
                    >
                      {u.account_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell" style={{ color: '#334155' }}>
                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/customer/users/${u.id}/edit`}
                        className="text-xs font-medium transition-colors hover:text-slate-900"
                        style={{ color: '#2563EB' }}
                      >
                        Edit
                      </Link>
                      <DeleteUserButton userId={u.id} userEmail={u.email} />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <UserCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#94a3b8' }} />
                    <p className="font-medium mb-1" style={{ color: '#334155' }}>No users yet</p>
                    <p className="text-xs mb-5" style={{ color: '#64748b' }}>Add users to give them access to your organization</p>
                    <Link
                      href="/customer/users/new"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                    >
                      <Plus className="w-4 h-4" />Add User
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
