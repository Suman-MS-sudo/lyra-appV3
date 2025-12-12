import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, TrendingUp, ShoppingCart, Package, Users, DollarSign, Activity } from 'lucide-react';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role to fetch all data and check admin status
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if user is admin
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/customer/dashboard');
  }

  // Fetch analytics data using service role
  const [
    { count: totalTransactions },
    { count: totalCoinPayments },
    { count: totalMachines },
    { count: totalProducts },
    { count: totalCustomers },
    { data: recentTransactions },
    { data: topProducts },
    { data: machineStats },
    { data: coinPayments },
  ] = await Promise.all([
    serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('vending_machines').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('products').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    serviceSupabase
      .from('transactions')
      .select('id, total_amount, items, payment_status, created_at, vending_machines!transactions_machine_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    serviceSupabase
      .from('transactions')
      .select('items, total_amount')
      .limit(100),
    serviceSupabase
      .from('vending_machines')
      .select('id, name, machine_id, transactions!transactions_machine_id_fkey(total_amount)')
      .limit(10),
    serviceSupabase
      .from('coin_payments')
      .select('amount_in_paisa, product_id, machine_id, products(name), vending_machines(name)')
      .limit(100),
  ]);

  // Calculate total revenue from both sources
  const { data: allTransactions } = await serviceSupabase
    .from('transactions')
    .select('total_amount, payment_status')
    .eq('payment_status', 'paid');

  const onlineRevenue = allTransactions?.reduce((sum, tx) => sum + (parseFloat(tx.total_amount?.toString() || '0')), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;

  // Calculate product sales from both online and coin payments
  const productSales = new Map<string, { name: string; count: number; revenue: number }>();
  
  // Add online transactions
  topProducts?.forEach((tx: any) => {
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
    const revenue = parseFloat(tx.total_amount?.toString() || '0');
    items.forEach((item: any) => {
      const productName = item.name || 'Unknown';
      const existing = productSales.get(productName);
      if (existing) {
        existing.count++;
        existing.revenue += revenue;
      } else {
        productSales.set(productName, {
          name: productName,
          count: 1,
          revenue: revenue,
        });
      }
    });
  });

  // Add coin payments
  coinPayments?.forEach((tx: any) => {
    const productName = tx.products?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = productSales.get(productName);
    if (existing) {
      existing.count++;
      existing.revenue += revenue;
    } else {
      productSales.set(productName, {
        name: productName,
        count: 1,
        revenue: revenue,
      });
    }
  });

  const topProductsList = Array.from(productSales.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate machine revenue from both online and coin payments
  const machineRevenueMap = new Map<string, { name: string; revenue: number; count: number }>();
  
  // Add online transactions
  machineStats?.forEach((machine: any) => {
    const revenue = machine.transactions?.reduce((sum: number, tx: any) => 
      sum + (parseFloat(tx.total_amount?.toString() || '0')), 0) || 0;
    machineRevenueMap.set(machine.name, {
      name: machine.name,
      revenue: revenue,
      count: machine.transactions?.length || 0,
    });
  });

  // Add coin payments
  coinPayments?.forEach((tx: any) => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = machineRevenueMap.get(machineName);
    if (existing) {
      existing.revenue += revenue;
      existing.count++;
    } else {
      machineRevenueMap.set(machineName, {
        name: machineName,
        revenue: revenue,
        count: 1,
      });
    }
  });

  const machineRevenue = Array.from(machineRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Analytics Dashboard
                </h1>
                <p className="text-sm text-gray-500">Comprehensive business insights and trends</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Revenue</span>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">From all transactions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Transactions</span>
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{(totalTransactions || 0) + (totalCoinPayments || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">All time</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active Machines</span>
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalMachines || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Deployed machines</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Customers</span>
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalCustomers || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Registered users</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Top Products
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {topProductsList.length > 0 ? (
                  topProductsList.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.count} sales</div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        ₹{product.revenue.toFixed(2)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-8">No product data available</div>
              )}
            </div>
          </div>
        </div>

          {/* Machine Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Machine Performance
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {machineRevenue.length > 0 ? (
                  machineRevenue.slice(0, 5).map((machine: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <div className="font-medium text-gray-900">{machine.name}</div>
                        <div className="text-sm text-gray-600">{machine.count} transactions</div>
                      </div>
                      <div className="text-lg font-bold text-blue-600">
                        ₹{machine.revenue.toFixed(2)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-8">No machine data available</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Recent Transactions
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Machine</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((tx: any) => {
                    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
                    const productNames = items.map((item: any) => item.name).join(', ') || 'N/A';
                    return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 text-sm text-gray-900">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">{tx.vending_machines?.name || 'N/A'}</td>
                      <td className="py-4 px-6 text-sm text-gray-900">{productNames}</td>
                      <td className="py-4 px-6 text-sm font-semibold text-gray-900">₹{parseFloat(tx.total_amount || 0).toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            tx.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : tx.payment_status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {tx.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
