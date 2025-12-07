import { requireAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

export default async function AnalyticsPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Fetch analytics data
  const [
    { count: totalTransactions },
    { count: totalMachines },
    { count: totalProducts },
    { count: totalCustomers },
    { data: recentTransactions },
    { data: topProducts },
    { data: machineStats },
  ] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('vending_machines').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase
      .from('transactions')
      .select('id, amount, payment_status, created_at, vending_machines!transactions_vending_machine_id_fkey(name), products(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('transactions')
      .select('product_id, products(name), amount')
      .limit(100),
    supabase
      .from('vending_machines')
      .select('id, name, machine_id, transactions!transactions_vending_machine_id_fkey(amount)')
      .limit(10),
  ]);

  // Calculate total revenue
  const { data: allTransactions } = await supabase
    .from('transactions')
    .select('amount, payment_status')
    .eq('payment_status', 'paid');

  const totalRevenue = allTransactions?.reduce((sum, tx) => sum + (parseFloat(tx.amount?.toString() || '0')), 0) || 0;

  // Calculate product sales
  const productSales = new Map<string, { name: string; count: number; revenue: number }>();
  topProducts?.forEach((tx: any) => {
    const productName = tx.products?.name || 'Unknown';
    const existing = productSales.get(productName);
    if (existing) {
      existing.count++;
      existing.revenue += parseFloat(tx.amount?.toString() || '0');
    } else {
      productSales.set(productName, {
        name: productName,
        count: 1,
        revenue: parseFloat(tx.amount?.toString() || '0'),
      });
    }
  });

  const topProductsList = Array.from(productSales.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate machine revenue
  const machineRevenue = machineStats?.map((machine: any) => ({
    name: machine.name,
    machineId: machine.machine_id,
    revenue: machine.transactions?.reduce((sum: number, tx: any) => 
      sum + (parseFloat(tx.amount?.toString() || '0')), 0) || 0,
    count: machine.transactions?.length || 0,
  })).sort((a: any, b: any) => b.revenue - a.revenue) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-8">
          Analytics Dashboard
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">Total Revenue</div>
            <div className="text-3xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">Total Transactions</div>
            <div className="text-3xl font-bold text-blue-600">{totalTransactions || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">Active Machines</div>
            <div className="text-3xl font-bold text-purple-600">{totalMachines || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">Total Customers</div>
            <div className="text-3xl font-bold text-orange-600">{totalCustomers || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Top Products</h2>
            <div className="space-y-3">
              {topProductsList.length > 0 ? (
                topProductsList.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-600">{product.count} sales</div>
                    </div>
                    <div className="text-lg font-semibold text-green-600">
                      ₹{product.revenue.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">No product data available</div>
              )}
            </div>
          </div>

          {/* Machine Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Machine Performance</h2>
            <div className="space-y-3">
              {machineRevenue.length > 0 ? (
                machineRevenue.slice(0, 5).map((machine: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{machine.name}</div>
                      <div className="text-sm text-gray-600">{machine.count} transactions</div>
                    </div>
                    <div className="text-lg font-semibold text-blue-600">
                      ₹{machine.revenue.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">No machine data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Machine</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{tx.vending_machines?.name || 'N/A'}</td>
                      <td className="py-3 px-4">{tx.products?.name || 'N/A'}</td>
                      <td className="py-3 px-4 font-semibold">₹{parseFloat(tx.amount || 0).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            tx.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {tx.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
