import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Search, Package as PackageIcon, IndianRupee } from 'lucide-react';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
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
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Products</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>Manage product inventory</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#1d1d1f] transition-opacity hover:opacity-90"
          style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#86868b' }} />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={{
            background: '#f5f5f7',
            border: '1px solid #e5e5e7',
            color: '#f3f4f6',
          }}
        />
      </div>

      {/* Products Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Product</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>SKU</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Price</th>
              <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products && products.length > 0 ? products.map((product: any) => (
              <tr
                key={product.id}
                className="row-hover"
                style={{ borderBottom: '1px solid #f5f5f7' }}
              >
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: '#1d1d1f' }}
                    >
                      <PackageIcon className="w-5 h-5 text-[#1d1d1f]" />
                    </div>
                    <span className="font-medium text-[#1d1d1f]">{product.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#f5f5f7', color: '#3a3a3c' }}
                  >
                    {product.sku}
                  </span>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-0.5 font-semibold text-[#1d1d1f]">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {product.price.toFixed(2)}
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="text-xs font-medium transition-colors hover:text-[#1d1d1f]"
                    style={{ color: '#0071e3' }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <PackageIcon className="w-10 h-10 mx-auto mb-3" style={{ color: '#e5e5e7' }} />
                  <p className="text-sm" style={{ color: '#a1a1a6' }}>No products found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
