import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Building2, MapPin, Pencil } from 'lucide-react';

export const revalidate = 0;

export default async function OrganizationsPage() {
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

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select(`*, profiles:super_customer_id (full_name, email)`)
    .order('created_at', { ascending: false });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Manage partner organizations</p>
        </div>
        <Link
          href="/admin/organizations/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Add Organization
        </Link>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {organizations.map((org: any) => (
            <div
              key={org.id}
              className="card-hover rounded-2xl p-5"
              style={{ border: '1px solid rgba(255,255,255,0.10)', borderRadius: 20 }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{org.name}</h3>
                  {org.profiles && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{org.profiles.full_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {org.contact_email && (
                  <p style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <span className="font-medium text-white">Email: </span>{org.contact_email}
                  </p>
                )}
                {org.contact_phone && (
                  <p style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <span className="font-medium text-white">Phone: </span>{org.contact_phone}
                  </p>
                )}
                {org.address && (
                  <div className="flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{org.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Created {new Date(org.created_at).toLocaleDateString('en-IN')}
                </span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/organizations/${org.id}/edit`}
                    className="p-2 rounded-lg transition-colors hover:bg-white/10"
                    title="Edit organization"
                    style={{ color: '#F472B6' }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl py-20 text-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <Building2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <h3 className="font-semibold text-white mb-2">No Organizations Yet</h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>Add partner organizations to track machines by location</p>
          <Link
            href="/admin/organizations/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
          >
            <Plus className="w-4 h-4" />
            Add Your First Organization
          </Link>
        </div>
      )}
    </main>
  );
}
