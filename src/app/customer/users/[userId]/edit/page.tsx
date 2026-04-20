import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import EditUserMachines from '@/components/EditUserMachines';

export default async function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch current user profile
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'super_customer') {
    redirect('/customer/dashboard');
  }

  // Fetch user to edit
  const { data: userToEdit } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!userToEdit || userToEdit.organization_id !== profile.organization_id) {
    redirect('/customer/users');
  }

  // Fetch ALL machines: org-owned + already assigned to this sub-user
  // Machines owned by the org use customer_id = organization_id
  // Machines already assigned to sub-user use customer_id = userId
  const orgId = profile.organization_id;
  const { data: allMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location, customer_id')
    .or(`customer_id.eq.${orgId},customer_id.eq.${userId}`)
    .order('name');

  // Separate machines by ownership
  const ownedMachines = allMachines?.filter(m => m.customer_id === orgId) || [];
  const assignedMachines = allMachines?.filter(m => m.customer_id === userId) || [];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <Link href="/customer/users" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Edit User</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Update user information and machine assignments</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6">
        {/* User Info */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">User Information</h3>
          <div className="space-y-3 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{userToEdit.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Full Name</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{userToEdit.full_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{userToEdit.phone || 'Not set'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
              <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                {userToEdit.role}
              </span>
            </div>
          </div>
        </div>

        {/* Machine Assignment */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Machine Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Assign specific machines to this user. Assigned machines will be owned and managed by them.
          </p>
          <EditUserMachines
            userId={userId}
            superCustomerId={orgId}
            ownedMachines={ownedMachines}
            assignedMachines={assignedMachines}
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Access Permissions</h4>
          <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <li>✓ View all machines in the organization</li>
            <li>✓ See revenue and transaction data</li>
            <li>✓ Access customer dashboard</li>
            <li>✗ Cannot create or manage users</li>
            <li>✗ Cannot access admin features</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
