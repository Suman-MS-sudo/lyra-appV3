import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import { createSuperCustomer } from '@/app/actions/super-customer';

export default async function NewSuperCustomerPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/super-customers" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Super Customer</h1>
              <p className="text-sm text-gray-500">Create a new organization account</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-blue-700">
            ℹ️ A password reset email will be automatically sent to the super customer's email address. They will set their own password using the secure link.
          </p>
        </div>

        <form action={createSuperCustomer} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="super@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">Super customer will receive a password reset link at this email</p>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ACME Corporation"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="contact@company.com"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 000-0000"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123 Business St, City, State, ZIP"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Link
              href="/admin/super-customers"
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Super Customer
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
