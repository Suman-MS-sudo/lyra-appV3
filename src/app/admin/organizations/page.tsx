import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Plus, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';

export default async function OrganizationsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service role to check admin status
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

  // Fetch organizations with super customer info
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select(`
      *,
      profiles:super_customer_id (
        full_name,
        email
      )
    `)
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
                <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
                <p className="text-sm text-gray-500">Manage partner organizations</p>
              </div>
            </div>
            <Link
              href="/admin/organizations/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Organization
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {organizations && organizations.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org: any) => (
              <div
                key={org.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{org.name}</h3>
                      {org.profiles && (
                        <p className="text-sm text-gray-500">{org.profiles.full_name}</p>
                      )}
                    </div>
                  </div>
                </div>

                {org.contact_email && (
                  <div className="mt-3 text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {org.contact_email}
                  </div>
                )}
                {org.contact_phone && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Phone:</span> {org.contact_phone}
                  </div>
                )}
                {org.address && (
                  <div className="mt-2 text-sm text-gray-600 flex items-start gap-1">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{org.address}</span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/organizations/${org.id}/edit`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit organization"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete organization"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Organizations Yet</h3>
            <p className="text-gray-500 mb-6">
              Start adding partner organizations to track machines by location
            </p>
            <Link
              href="/admin/organizations/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Your First Organization
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
