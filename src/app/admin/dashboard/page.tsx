import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export default async function AdminDashboard() {

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Use service role for all queries
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch dashboard stats and products
  const [
    { count: totalMachines },
    { count: totalUsers },
    { count: totalTransactions },
    { data: recentMachines },
    { data: recentTransactions },
    { data: paidTx },
    { data: products }
  ] = await Promise.all([
    serviceSupabase.from('vending_machines').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('vending_machines').select('name, location').order('created_at', { ascending: false }).limit(3),
    serviceSupabase.from('transactions').select('amount, created_at, products(name)').order('created_at', { ascending: false }).limit(3),
    serviceSupabase.from('transactions').select('amount').eq('payment_status', 'paid'),
    serviceSupabase.from('products').select('id, name, sku, price').order('created_at', { ascending: false }),
  ]);

  // Calculate revenue
  const totalRevenue = paidTx?.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 pt-4">
          <nav className="flex space-x-2 mb-6">
            <a href="/admin/machines" className="px-4 py-2 rounded-t-lg font-semibold text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition">Machines</a>
            <a href="/admin/products" className="px-4 py-2 rounded-t-lg font-semibold text-gray-600 hover:text-purple-600 border-b-2 border-transparent hover:border-purple-600 transition">Products</a>
            <a href="/admin/customers" className="px-4 py-2 rounded-t-lg font-semibold text-gray-600 hover:text-green-600 border-b-2 border-transparent hover:border-green-600 transition">Customers</a>
            <a href="/admin/transactions" className="px-4 py-2 rounded-t-lg font-semibold text-gray-600 hover:text-orange-600 border-b-2 border-transparent hover:border-orange-600 transition">Transactions</a>
            <a href="/admin/analytics" className="px-4 py-2 rounded-t-lg font-semibold text-gray-600 hover:text-purple-600 border-b-2 border-transparent hover:border-purple-600 transition">Analytics</a>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">Admin overview and stats</p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Machines</div>
            <div className="text-3xl font-bold text-gray-900">{totalMachines || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm text-gray-600 mb-1">Active Users</div>
            <div className="text-3xl font-bold text-gray-900">{totalUsers || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm text-gray-600 mb-1">Revenue</div>
            <div className="text-3xl font-bold text-gray-900">₹{totalRevenue.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm text-gray-600 mb-1">Transactions</div>
            <div className="text-3xl font-bold text-gray-900">{totalTransactions || 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Machines</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentMachines?.length > 0 ? (
                recentMachines.map((machine: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{machine.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{machine.location}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Online</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">No machines found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Transactions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentTransactions?.length > 0 ? (
                recentTransactions.map((tx: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {Array.isArray(tx.products)
                          ? tx.products.map((p: any) => p.name).join(', ')
                          : tx.products?.name || 'Product'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{new Date(tx.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">₹{parseFloat(tx.amount || 0).toFixed(2)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
