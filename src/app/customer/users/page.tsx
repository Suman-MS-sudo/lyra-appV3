import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Users, Plus, UserCircle } from 'lucide-react';
import Link from 'next/link';
import DeleteUserButton from '@/components/DeleteUserButton';

export default async function CustomerUsersPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role for comprehensive queries
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch user profile and verify role
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Only super customers can manage users
  if (profile?.account_type !== 'super_customer') {
    redirect('/customer/dashboard');
  }

  // Fetch users created by this super customer
  const { data: managedUsers } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, created_at')
    .eq('organization_id', profile.organization_id)
    .neq('id', user.id)
    .order('created_at', { ascending: false });

  // Get stats
  const totalUsers = managedUsers?.length || 0;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">User accounts in your organization</p>
        </div>
        <Link
          href="/customer/users/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add User
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Users</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Members</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {managedUsers?.filter(u => u.role === 'customer').length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Your Role</div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">Admin</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Created</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managedUsers && managedUsers.length > 0 ? (
                managedUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{u.email}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{u.role}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                        {u.account_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/customer/users/${u.id}/edit`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-xs">Edit</Link>
                        <DeleteUserButton userId={u.id} userEmail={u.email} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <UserCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No users yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Add users to give them access to your organization</p>
                    <Link href="/customer/users/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
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
