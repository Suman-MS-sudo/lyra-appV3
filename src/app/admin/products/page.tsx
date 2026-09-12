import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Search, Package as PackageIcon, IndianRupee } from 'lucide-react';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #f1f5f9',
  borderRadius: 20,
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type, role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.account_type === 'admin';
  const isSuperCustomer = profile?.role === 'customer' && profile?.account_type === 'super_customer';

  if (!isAdmin && !isSuperCustomer) redirect('/customer/dashboard');

  let machineIds: string[] = [];
  if (isSuperCustomer) {
    const { data: userMachines } = await serviceSupabase
      .from('vending_machines')
      .select('id')
      .eq('customer_id', user.id);
    machineIds = userMachines?.map(m => m.id) || [];
  }

  const productsQuery = serviceSupabase.from('products').select('*');
  const { data: products } = isSuperCustomer && machineIds.length > 0
    ? await productsQuery.in('vending_machine_id', machineIds).order('created_at', { ascending: false })
    : await productsQuery.order('created_at', { ascending: false });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Manage product inventory</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
          }}
        />
      </div>

      {/* Products Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>Product</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>SKU</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>Price</th>
              <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products && products.length > 0 ? products.map((product: any) => (
              <tr
                key={product.id}
                className="row-hover"
                style={{ borderBottom: '1px solid #f1f5f9' }}
              >
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                    >
                      <PackageIcon className="w-5 h-5 text-slate-900" />
                    </div>
                    <span className="font-medium text-slate-900">{product.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#f8fafc', color: '#0f172a' }}
                  >
                    {product.sku}
                  </span>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-0.5 font-semibold text-slate-900">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {product.price.toFixed(2)}
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="text-xs font-medium transition-colors hover:text-slate-900"
                    style={{ color: '#2563EB' }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <PackageIcon className="w-10 h-10 mx-auto mb-3" style={{ color: '#94a3b8' }} />
                  <p className="text-sm" style={{ color: '#64748b' }}>No products found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
