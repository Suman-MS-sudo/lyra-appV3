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

  // Fetch ALL machines (both owned by super customer and assigned to this user)
  const { data: allMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location, customer_id')
    .or(`customer_id.eq.${user.id},customer_id.eq.${userId}`)
    .order('name');

  // Separate machines by ownership
  const ownedMachines = allMachines?.filter(m => m.customer_id === user.id) || [];
  const assignedMachines = allMachines?.filter(m => m.customer_id === userId) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg"></div>
            <h1 className="text-xl font-bold text-gray-900">Lyra</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/customer/users" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← Back to Users
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">Edit User</h2>
          <p className="text-sm text-gray-600">Update user information and machine assignments</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          {/* User Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <div className="text-gray-900 mt-1">{userToEdit.email}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <div className="text-gray-900 mt-1">{userToEdit.full_name || 'Not set'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <div className="text-gray-900 mt-1">{userToEdit.phone || 'Not set'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <div className="text-gray-900 mt-1">
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {userToEdit.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Assignment */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Machine Management</h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign specific machines to this user. Assigned machines will be owned and managed by them.
            </p>
            
            <EditUserMachines 
              userId={userId}
              superCustomerId={user.id}
              ownedMachines={ownedMachines}
              assignedMachines={assignedMachines}
            />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Access Permissions</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ View all machines in the organization</li>
              <li>✓ See revenue and transaction data</li>
              <li>✓ Access customer dashboard</li>
              <li>✗ Cannot create or manage users</li>
              <li>✗ Cannot access admin features</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
