import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { UserPlus, Users, Shield, User, Building2, Pencil } from 'lucide-react';
import DeleteUserButton from '@/components/DeleteUserButton';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const { data: users } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, organization_id, created_at')
    .in('account_type', ['customer', 'super_customer', 'admin'])
    .order('created_at', { ascending: false });

  const orgIds = users?.map(u => u.organization_id).filter(Boolean) || [];
  let organizations: any[] = [];
  if (orgIds.length > 0) {
    const { data: orgs } = await serviceSupabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);
    organizations = orgs || [];
  }

  const usersWithOrgs = users?.map(u => ({
    ...u,
    organizations: organizations.find(o => o.id === u.organization_id),
  })) || [];

  const normalCount = usersWithOrgs.filter(u => u.account_type === 'customer').length;
  const superCount = usersWithOrgs.filter(u => u.account_type === 'super_customer').length;
  const adminCount = usersWithOrgs.filter(u => u.account_type === 'admin').length;

  const accountTypeBadgeStyle = (accountType: string): React.CSSProperties => {
    if (accountType === 'admin')          return { background: 'rgba(29,122,60,0.12)',  color: '#1d7a3c' };
    if (accountType === 'super_customer') return { background: 'rgba(0,0,0,0.04)', color: '#6e6e73' };
    return { background: 'rgba(0,113,227,0.10)', color: '#0071e3' };
  };

  const avatarStyle = (accountType: string): React.CSSProperties => {
    if (accountType === 'admin')          return { background: 'linear-gradient(135deg, #1d7a3c, #059669)' };
    if (accountType === 'super_customer') return { background: 'linear-gradient(135deg, #6e6e73, #52525b)' };
    return { background: 'linear-gradient(135deg, #0071e3, #3B82F6)' };
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">All Users</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>Manage normal users and super users (organizations)</p>
        </div>
        <Link
          href="/admin/users/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#1d1d1f] transition-opacity hover:opacity-90"
          style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,113,227,0.10)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,113,227,0.10)' }}>
            <User className="w-5 h-5" style={{ color: '#0071e3' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Normal Users</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">{normalCount}</p>
        </div>

        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,0,0,0.04)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <Building2 className="w-5 h-5" style={{ color: '#6e6e73' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Super Users</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">{superCount}</p>
        </div>

        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(29,122,60,0.12)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(29,122,60,0.12)' }}>
            <Shield className="w-5 h-5" style={{ color: '#1d7a3c' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Admin Users</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">{adminCount}</p>
        </div>
      </div>

      {/* Users Table */}
      {usersWithOrgs.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={CARD}>
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#e5e5e7' }} />
          <p className="font-medium" style={{ color: '#6e6e73' }}>No users found</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
                  {['User', 'Type', 'Organization', 'Role', 'Joined', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2.5 px-5 text-xs font-semibold uppercase tracking-wide ${i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#86868b' }}
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersWithOrgs.map((u: any) => (
                  <tr
                    key={u.id}
                    className="row-hover"
                    style={{ borderBottom: '1px solid #f5f5f7' }}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                          style={avatarStyle(u.account_type)}
                        >
                          {u.account_type === 'admin' ? (
                            <Shield className="w-4 h-4" />
                          ) : u.account_type === 'super_customer' ? (
                            <Building2 className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[#1d1d1f]">{u.email}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>{u.id.substring(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={accountTypeBadgeStyle(u.account_type)}
                      >
                        {u.account_type === 'admin' ? (
                          <><Shield className="w-3 h-3" />Admin</>
                        ) : u.account_type === 'super_customer' ? (
                          <><Building2 className="w-3 h-3" />Super User</>
                        ) : (
                          <><User className="w-3 h-3" />Normal User</>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      {u.organizations?.name ? (
                        <span className="font-medium text-[#1d1d1f]">{u.organizations.name}</span>
                      ) : (
                        <span style={{ color: '#86868b' }}>—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 capitalize" style={{ color: '#6e6e73' }}>{u.role}</td>
                    <td className="py-3.5 px-5" style={{ color: '#6e6e73' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/users/${u.id}/edit`}
                          className="p-2 rounded-lg inline-flex transition-colors hover:bg-white/10"
                          title="Edit user"
                          style={{ color: '#0071e3' }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        {u.id !== user.id && (
                          <DeleteUserButton userId={u.id} userEmail={u.email} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
