import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Search, Package as PackageIcon, IndianRupee, Package, TrendingUp, TrendingDown } from 'lucide-react';

import { BarList, PageHeader, Panel, StatGrid, StatTile } from '@/components/ui/kit';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
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

  const productList = products || [];
  const prices = productList.map((p) => Number(p.price) || 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const priceBands = productList
    .map((p) => ({ label: p.name as string, value: Number(p.price) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <PageHeader title="Products" subtitle="Manage product inventory" actions={
          <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2 lyra-chamfer text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
        } />

      {productList.length > 0 && (
        <>
          <StatGrid>
            <StatTile tone="sky"    icon={Package}     label="Products"   value={String(productList.length)} sub="in the catalogue" />
            <StatTile tone="mint"   icon={IndianRupee} label="Avg. price" value={`₹${avgPrice.toFixed(2)}`} sub="across products" />
            <StatTile tone="butter" icon={TrendingUp}  label="Highest"    value={`₹${Math.max(...prices).toFixed(2)}`} sub={priceBands[0]?.label} />
            <StatTile tone="peach"  icon={TrendingDown} label="Lowest"    value={`₹${Math.min(...prices).toFixed(2)}`} sub="entry price" />
          </StatGrid>
          <Panel title="Price by product" className="mb-6">
            <BarList items={priceBands} format={(n) => `₹${n.toFixed(2)}`} />
          </Panel>
        </>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--subtle)' }} />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            color: '#f3f4f6',
          }}
        />
      </div>

      {/* Products Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Product</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>SKU</th>
              <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Price</th>
              <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products && products.length > 0 ? products.map((product: any) => (
              <tr
                key={product.id}
                className="row-hover"
                style={{ borderBottom: '1px solid var(--surface-2)' }}
              >
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--accent)' }}
                    >
                      <PackageIcon className="w-5 h-5 text-[var(--fg)]" />
                    </div>
                    <span className="font-medium text-[var(--fg)]">{product.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}
                  >
                    {product.sku}
                  </span>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-0.5 font-semibold text-[var(--fg)]">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {product.price.toFixed(2)}
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="text-xs font-medium transition-colors hover:text-[var(--fg)]"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <PackageIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--line)' }} />
                  <p className="text-sm" style={{ color: 'var(--subtle)' }}>No products found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
