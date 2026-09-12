import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { UserPlus, Search, Building2, Mail } from 'lucide-react';

export const revalidate = 0;

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

  const { data: superCustomers } = await serviceSupabase
    .from('profiles')
    .select(`*, organizations (name, contact_email, contact_phone)`)
    .eq('account_type', 'super_customer')
    .order('created_at', { ascending: false });


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Super Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Manage organization accounts</p>
        </div>
        <Link
          href="/admin/super-customers/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
        >
          <UserPlus className="w-4 h-4" />
          Add Super Customer
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
        <input
          type="text"
          placeholder="Search super customers..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
        />
      </div>

      {superCustomers && superCustomers.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {superCustomers.map((customer: any) => (
            <div
              key={customer.id}
              className="card-hover rounded-2xl p-5"
              style={{ border: '1px solid #f1f5f9', borderRadius: 20 }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                >
                  {(customer.full_name?.charAt(0) || customer.email.charAt(0)).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{customer.full_name || 'No name'}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 shrink-0" style={{ color: '#64748b' }} />
                    <p className="text-xs truncate" style={{ color: '#334155' }}>{customer.email}</p>
                  </div>
                </div>
              </div>

              {customer.organizations && customer.organizations.length > 0 && (
                <div className="py-3 space-y-1" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#60A5FA' }} />
                    <span className="font-medium text-slate-900 text-sm">{customer.organizations[0].name}</span>
                  </div>
                  {customer.organizations[0].contact_email && (
                    <p className="text-xs pl-5" style={{ color: '#334155' }}>{customer.organizations[0].contact_email}</p>
                  )}
                </div>
              )}

              <div className="mt-3">
                <Link
                  href={`/admin/super-customers/${customer.id}`}
                  className="block w-full text-center px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.22)', color: '#2563EB' }}
                >
                  Edit Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl py-16 text-center col-span-3" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#94a3b8' }} />
          <p className="text-sm" style={{ color: '#64748b' }}>No super customers yet. Create one to get started.</p>
        </div>
      )}
    </main>
  );
}
