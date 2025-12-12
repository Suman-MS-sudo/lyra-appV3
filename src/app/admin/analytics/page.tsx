import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, TrendingUp, ShoppingCart, Package, Users, DollarSign, Activity, Building2 } from 'lucide-react';

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
    { data: allMachines },
  ] = await Promise.all([
    serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('vending_machines').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('products').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('organizations').select('*', { count: 'exact', head: true }),
    serviceSupabase
      .from('transactions')
      .select('id, total_amount, items, payment_status, created_at, vending_machines!transactions_machine_id_fkey(name, customer_name)')
      .order('created_at', { ascending: false })
      .limit(10),
    serviceSupabase
      .from('transactions')
      .select('items, total_amount, vending_machines!transactions_machine_id_fkey(customer_name)')
      .limit(100),
    serviceSupabase
      .from('vending_machines')
      .select('id, name, machine_id, customer_name, transactions!transactions_machine_id_fkey(total_amount)')
      .limit(10),
    serviceSupabase
      .from('coin_payments')
      .select('amount_in_paisa, product_id, machine_id, products(name), vending_machines(name, customer_name)')
      .limit(100),
    serviceSupabase
      .from('vending_machines')
      .select('customer_name, name'),
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

  // Calculate organization/customer statistics
  const organizationStats = new Map<string, { 
    name: string; 
    onlineCount: number; 
    coinCount: number; 
    onlineRevenue: number; 
    coinRevenue: number;
  }>();

  // Group transactions by organization (via machine's customer_id)
  topProducts?.forEach((tx: any) => {
    const customerName = tx.vending_machines?.customer_name || 'Unknown';
    const revenue = parseFloat(tx.total_amount || 0);
    const existing = organizationStats.get(customerName);
    if (existing) {
      existing.onlineCount++;
      existing.onlineRevenue += revenue;
    } else {
      organizationStats.set(customerName, {
        name: customerName,
        onlineCount: 1,
        coinCount: 0,
        onlineRevenue: revenue,
        coinRevenue: 0,
      });
    }
  });

  // Group coin payments by organization
  coinPayments?.forEach((tx: any) => {
    const customerName = tx.vending_machines?.customer_name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = organizationStats.get(customerName);
    if (existing) {
      existing.coinCount++;
      existing.coinRevenue += revenue;
    } else {
      organizationStats.set(customerName, {
        name: customerName,
        onlineCount: 0,
        coinCount: 1,
        onlineRevenue: 0,
        coinRevenue: revenue,
      });
    }
  });

  const organizationList = Array.from(organizationStats.values())
    .sort((a, b) => (b.onlineRevenue + b.coinRevenue) - (a.onlineRevenue + a.coinRevenue));

  // Calculate organization-wise machine counts
  const organizationMachines = new Map<string, number>();
  allMachines?.forEach((machine: any) => {
    const customerName = machine.customer_name || 'Unknown';
    organizationMachines.set(customerName, (organizationMachines.get(customerName) || 0) + 1);
  });

  const organizationMachineList = Array.from(organizationMachines.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

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
              <span className="text-sm text-gray-600">Total Machines</span>
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalMachines || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Across {organizationMachineList.length} organizations</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Organizations</span>
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalCustomers || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Customer organizations</div>
          </div>
        </div>

        {/* Machines by Organization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Machines by Organization
            </h2>
            <p className="text-sm text-gray-600 mt-1">Machine distribution across customer organizations</p>
          </div>
          <div className="p-6">
            {organizationMachineList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {organizationMachineList.map((org, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{org.name}</div>
                      <div className="text-xs text-gray-600 mt-1">Customer organization</div>
                    </div>
                    <div className="ml-4 flex items-center justify-center h-12 w-12 rounded-full bg-purple-600 text-white font-bold text-lg">
                      {org.count}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">No machine data available</div>
            )}
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
                Machine Transaction Chart
              </h2>
              <p className="text-sm text-gray-600 mt-1">Visual comparison of machine activity</p>
            </div>
            <div className="p-6">
              {machineRevenue.length > 0 ? (
                <div className="space-y-4">
                  {machineRevenue.slice(0, 10).map((machine: any, index: number) => {
                    const maxCount = Math.max(...machineRevenue.map((m: any) => m.count), 1);
                    const percentage = (machine.count / maxCount) * 100;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 truncate max-w-[200px]">{machine.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-600">{machine.count} txn</span>
                            <span className="font-semibold text-purple-600 min-w-[70px] text-right">₹{machine.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          >
                            {percentage > 15 && (
                              <span className="text-xs font-semibold text-white">{machine.count}</span>
                            )}
                          </div>
                          {percentage <= 15 && (
                            <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-gray-600">
                              {machine.count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">No machine data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Organization/Customer Purchase Statistics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Purchase by Organization
            </h2>
            <p className="text-sm text-gray-600 mt-1">Revenue breakdown by customer organization</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Organization</th>
                  <th className="text-center py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Online Purchases</th>
                  <th className="text-center py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Coin Purchases</th>
                  <th className="text-center py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Purchases</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Online Revenue</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Coin Revenue</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizationList.length > 0 ? (
                  organizationList.map((org, index) => {
                    const totalRevenue = org.onlineRevenue + org.coinRevenue;
                    const totalPurchases = org.onlineCount + org.coinCount;
                    return (
                      <tr key={index} className="hover:bg-blue-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-medium text-gray-900">{org.name}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {org.onlineCount}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                            {org.coinCount}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            {totalPurchases}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right text-blue-600 font-semibold">
                          ₹{org.onlineRevenue.toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right text-amber-600 font-semibold">
                          ₹{org.coinRevenue.toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right text-green-600 font-bold">
                          ₹{totalRevenue.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No organization data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
