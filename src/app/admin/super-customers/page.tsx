import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, UserPlus, Search, Building2 } from 'lucide-react';

export default async function SuperCustomersPage() {
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

  if (profile?.account_type !== 'admin') redirect('/customer/dashboard');

  // Fetch super customers with their organizations
  const { data: superCustomers } = await serviceSupabase
    .from('profiles')
    .select(`
      *,
      organizations (
        name,
        contact_email,
        contact_phone
      )
    `)
    .eq('account_type', 'super_customer')
    .order('created_at', { ascending: false });

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
                <h1 className="text-2xl font-bold text-gray-900">Super Customers</h1>
                <p className="text-sm text-gray-500">Manage organization accounts</p>
              </div>
            </div>
            <Link
              href="/admin/super-customers/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Super Customer
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search super customers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {superCustomers && superCustomers.length > 0 ? (
            superCustomers.map((customer: any) => (
              <div
                key={customer.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {customer.full_name?.charAt(0) || customer.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.full_name || 'No name'}</h3>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                  </div>
                </div>

                {customer.organizations && customer.organizations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{customer.organizations[0].name}</span>
                    </div>
                    {customer.organizations[0].contact_email && (
                      <p className="text-xs text-gray-500">{customer.organizations[0].contact_email}</p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/admin/super-customers/${customer.id}`}
                    className="flex-1 text-center px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Edit Details
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12 text-gray-500">
              No super customers yet. Create one to get started.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
