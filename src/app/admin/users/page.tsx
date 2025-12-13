import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { UserPlus, Users, Shield, User, Building2, ArrowLeft, Pencil, Trash2 } from 'lucide-react';

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role to fetch all data including profile check
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if user is admin using service role to bypass RLS
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  // Only allow admins
  if (profile?.role !== 'admin') {
    redirect('/customer/dashboard');
  }

  // Fetch all users
  const { data: users, error } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, organization_id, created_at')
    .in('account_type', ['customer', 'super_customer', 'admin'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
  }

  // Fetch organization names separately if needed
  const orgIds = users?.map(u => u.organization_id).filter(Boolean) || [];
  let organizations: any[] = [];
  if (orgIds.length > 0) {
    const { data: orgs } = await serviceSupabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);
    organizations = orgs || [];
  }

  // Map organization names to users
  const usersWithOrgs = users?.map(u => ({
    ...u,
    organizations: organizations.find(o => o.id === u.organization_id)
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
                <p className="text-sm text-gray-500">Manage normal users and super users (organizations)</p>
              </div>
            </div>
            <Link
              href="/admin/users/new"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-gray-200">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Normal Users</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {usersWithOrgs?.filter(u => u.account_type === 'customer').length || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-6 border border-purple-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Super Users (Organizations)</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {usersWithOrgs?.filter(u => u.account_type === 'super_customer').length || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-6 border border-green-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Admin Users</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {usersWithOrgs?.filter(u => u.account_type === 'admin').length || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="p-6">
            {!usersWithOrgs || usersWithOrgs.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usersWithOrgs.map((user: any) => (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                              user.account_type === 'admin'
                                ? 'bg-gradient-to-br from-green-500 to-green-600'
                                : user.account_type === 'super_customer' 
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                                : 'bg-gradient-to-br from-blue-500 to-blue-600'
                            }`}>
                              {user.account_type === 'admin' ? (
                                <Shield className="h-5 w-5" />
                              ) : user.account_type === 'super_customer' ? (
                                <Building2 className="h-5 w-5" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.email}</div>
                              <div className="text-xs text-gray-500">{user.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            user.account_type === 'admin'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : user.account_type === 'super_customer'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {user.account_type === 'admin' ? (
                              <>
                                <Shield className="h-3 w-3" />
                                Admin
                              </>
                            ) : user.account_type === 'super_customer' ? (
                              <>
                                <Building2 className="h-3 w-3" />
                                Super User
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3" />
                                Normal User
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.organizations?.name ? (
                            <span className="text-sm font-medium text-gray-900">
                              {user.organizations.name}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 capitalize">{user.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/users/${user.id}/edit`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
