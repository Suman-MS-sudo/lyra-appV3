import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';

async function createCustomer(formData: FormData) {
  'use server';
  
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = formData.get('email') as string;
  const fullName = formData.get('full_name') as string;
  const organizationId = formData.get('organization_id') as string;
  const canEdit = formData.get('can_edit') === 'on';

  // Check if user already exists in auth
  const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(u => u.email === email);
  
  if (existingUser) {
    // User exists in auth, try to recover by creating/updating profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('id', existingUser.id)
      .single();

    if (!existingProfile) {
      // Create the missing profile
      const { error: insertError } = await serviceSupabase
        .from('profiles')
        .insert({
          id: existingUser.id,
          email: existingUser.email,
          full_name: fullName,
          account_type: 'customer',
          role: 'customer',
          organization_id: organizationId || null,
          permissions: {
            can_edit: canEdit,
            can_view: true
          }
        });

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
    } else {
      // Update existing profile
      await serviceSupabase
        .from('profiles')
        .update({
          full_name: fullName,
          account_type: 'customer',
          role: 'customer',
          organization_id: organizationId || null,
          permissions: {
            can_edit: canEdit,
            can_view: true
          }
        })
        .eq('id', existingUser.id);
    }

    // Send password reset email
    await serviceSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
    });

    redirect('/admin/customers');
    return;
  }

  // Generate random secure password
  const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) + 'Aa1!';

  // Create auth user with random password
  const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'customer',
      account_type: 'customer'
    }
  });

  if (authError) {
    throw new Error(authError.message);
  }

  // Wait a bit for trigger to create profile, then verify it exists
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { data: existingProfile } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (!existingProfile) {
    // Profile doesn't exist, create it manually
    const { error: insertError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId || null,
        permissions: {
          can_edit: canEdit,
          can_view: true
        }
      });

    if (insertError) {
      // Clean up auth user if profile creation fails
      await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(insertError.message);
    }
  } else {
    // Update existing profile with organization and permissions
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId || null,
        permissions: {
          can_edit: canEdit,
          can_view: true
        }
      })
      .eq('id', authData.user.id);

    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  // Send password reset email
  const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
  });

  if (resetError) {
    console.error('Password reset email error:', resetError);
    // Don't throw - user is created, they can request reset later
  }

  redirect('/admin/customers');
}

export default async function NewCustomerPage() {
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

  // Fetch organizations for dropdown
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .order('name');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
              <p className="text-sm text-gray-500">Create a new customer account</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> A password reset email will be automatically sent to the customer's email address. 
            They will receive a secure link to set their password.
          </p>
        </div>

        <form action={createCustomer} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
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
              placeholder="customer@example.com"
            />
            <p className="mt-1 text-sm text-gray-500">
              Customer will receive a password reset link at this email
            </p>
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

          <div>
            <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 mb-2">
              Organization (Optional)
            </label>
            <select
              id="organization_id"
              name="organization_id"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No Organization (Independent Customer)</option>
              {organizations?.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Select an organization if this customer belongs to a company
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="can_edit"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Can Edit (Allow customer to make purchases)</span>
            </label>
            <p className="mt-1 ml-6 text-sm text-gray-500">
              If unchecked, customer will have read-only access
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Link
              href="/admin/customers"
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Customer
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
