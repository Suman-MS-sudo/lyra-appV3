import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createProduct } from '@/app/actions/admin';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: '#f5f5f7',
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: '#f5f5f7',
  border: '1px solid #e5e5e7',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: '#1d1d1f' };

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
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">Add Product</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>Create a new product</p>
      </div>

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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
            style={INPUT}
            placeholder="0.00"
          />
        </div>

        <div className="rounded-xl p-4" style={{ background: 'rgba(0,113,227,0.10)', border: '1px solid rgba(0,113,227,0.10)' }}>
          <p className="text-sm" style={{ color: '#93C5FD' }}>
            After creating the product, you can assign it to vending machines from the machine management page.
          </p>
        </div>

        <div className="flex gap-4 pt-2">
          <Link
            href="/admin/products"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
            style={{ background: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            Create Product
          </button>
        </div>
      </form>
    </main>
  );
}
