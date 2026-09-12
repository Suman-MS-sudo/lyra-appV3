import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { UserPlus, Search, Mail, Calendar } from 'lucide-react';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

export default async function CustomersPage() {
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

  const { data: customers } = await serviceSupabase
    .from('profiles')
    .select(`*, organizations (name)`)
    .eq('account_type', 'super_customer')
    .order('created_at', { ascending: false });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Organizations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>Manage organization accounts</p>
        </div>
        <Link
          href="/admin/customers/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#1d1d1f] transition-opacity hover:opacity-90"
          style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          <UserPlus className="w-4 h-4" />
          Add Organization
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#86868b' }} />
        <input
          type="text"
          placeholder="Search customers..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={{ background: '#f5f5f7', border: '1px solid #e5e5e7', color: '#f3f4f6' }}
        />
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
              {['Customer', 'Email', 'Organization', 'Permissions', 'Joined', 'Actions'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2.5 px-5 text-xs font-semibold uppercase tracking-wide ${i === 5 ? 'text-right' : 'text-left'}`}
                  style={{ color: '#86868b' }}
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers && customers.length > 0 ? customers.map((customer: any) => (
              <tr
                key={customer.id}
                className="row-hover"
                style={{ borderBottom: '1px solid #f5f5f7' }}
              >
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#1d1d1f] font-bold shrink-0"
                      style={{ background: '#1d1d1f' }}
                    >
                      {(customer.full_name?.charAt(0) || customer.email.charAt(0)).toUpperCase()}
                    </div>
                    <span className="font-medium text-[#1d1d1f]">{customer.full_name || 'No name'}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-1.5" style={{ color: '#6e6e73' }}>
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {customer.email}
                  </div>
                </td>
                <td className="py-3.5 px-5" style={{ color: customer.organizations ? 'white' : '#86868b' }}>
                  {customer.organizations ? customer.organizations.name : <em>Independent</em>}
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={customer.permissions?.can_edit
                      ? { background: 'rgba(29,122,60,0.12)', color: '#1d7a3c' }
                      : { background: '#f5f5f7', color: '#6e6e73' }
                    }
                  >
                    {customer.permissions?.can_edit ? 'Can Edit' : 'Read Only'}
                  </span>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-1.5" style={{ color: '#6e6e73' }}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {new Date(customer.created_at).toLocaleDateString('en-IN')}
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="text-xs font-medium transition-colors hover:text-[#1d1d1f]"
                    style={{ color: '#0071e3' }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm" style={{ color: '#a1a1a6' }}>No customers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
