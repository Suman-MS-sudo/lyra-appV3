import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Building2, Mail, Phone, MapPin, User } from 'lucide-react';
import { updateSuperCustomer } from '@/app/actions/super-customer';

export default async function EditSuperCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'admin') redirect('/customer/dashboard');

  // Fetch super customer with organization
  const { data: superCustomer } = await serviceSupabase
    .from('profiles')
    .select(`
      *,
      organizations (
        id,
        name,
        contact_email,
        contact_phone,
        address
      )
    `)
    .eq('id', id)
    .single();

  if (!superCustomer || superCustomer.account_type !== 'super_customer') {
    redirect('/admin/super-customers');
  }

  const organization = superCustomer.organizations?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/super-customers" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Super Customer</h1>
              <p className="text-sm text-gray-500">Update account and organization details</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <form action={updateSuperCustomer} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <input type="hidden" name="user_id" value={id} />
          <input type="hidden" name="org_id" value={organization?.id || ''} />

          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Account Information</h3>
            <p className="text-sm text-gray-500">Login credentials for the super customer</p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              defaultValue={superCustomer.email}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed after creation</p>
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              defaultValue={superCustomer.full_name || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="border-b pb-4 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Organization Details</h3>
            <p className="text-sm text-gray-500">Information about the organization</p>
          </div>

          <div>
            <label htmlFor="org_name" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              id="org_name"
              name="org_name"
              required
              defaultValue={organization?.name || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="org_email" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Email
            </label>
            <input
              type="email"
              id="org_email"
              name="org_email"
              defaultValue={organization?.contact_email || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="org_phone" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Phone
            </label>
            <input
              type="tel"
              id="org_phone"
              name="org_phone"
              defaultValue={organization?.contact_phone || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="org_address" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Address
            </label>
            <textarea
              id="org_address"
              name="org_address"
              rows={3}
              defaultValue={organization?.address || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Update Super Customer
            </button>
            <Link
              href="/admin/super-customers"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
