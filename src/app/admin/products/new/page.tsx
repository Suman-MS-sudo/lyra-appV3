import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createProduct } from '@/app/actions/admin';

import { PageHeader } from '@/components/ui/kit';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

const INPUT: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'var(--fg)' };

export default async function NewProductPage() {
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
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader title="Add Product" subtitle="Create a new product" />

      <form action={createProduct} className="rounded-2xl p-6 space-y-6" style={CARD}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2" style={LABEL}>
            Product Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="e.g., Coca Cola"
          />
        </div>

        <div>
          <label htmlFor="sku" className="block text-sm font-medium mb-2" style={LABEL}>
            SKU
          </label>
          <input
            type="text"
            id="sku"
            name="sku"
            required
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="e.g., SKU-001"
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-2" style={LABEL}>
            Price
          </label>
          <input
            type="number"
            id="price"
            name="price"
            step="0.01"
            min="0"
            required
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="0.00"
          />
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)' }}>
          <p className="text-sm" style={{ color: 'var(--accent-ink)' }}>
            After creating the product, you can assign it to vending machines from the machine management page.
          </p>
        </div>

        <div className="flex gap-4 pt-2">
          <Link
            href="/admin/products"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 lyra-chamfer text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            Create Product
          </button>
        </div>
      </form>
    </main>
  );
}
