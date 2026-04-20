import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import NewCustomerUserForm from '@/components/NewCustomerUserForm';

export default async function NewCustomerUserPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role for queries
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch user profile and verify they're a super customer
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Only super customers can create users
  if (profile?.account_type !== 'super_customer') {
    redirect('/customer/dashboard');
  }

  // Fetch super customer's machines
  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location')
    .eq('customer_id', user.id)
    .order('name');

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <Link
        href="/customer/users"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </Link>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Create New User</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add a new user to your organization with limited access</p>

        <NewCustomerUserForm
          superCustomerId={user.id}
          organizationId={profile.organization_id}
          machines={machines || []}
        />
      </div>
    </main>
  );
}
