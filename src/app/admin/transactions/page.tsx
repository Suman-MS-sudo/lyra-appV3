import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Search, IndianRupee, Calendar, User, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';

export default async function TransactionsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service role to check admin status and fetch data
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  // Allow both admins and super_customers
  const isAdmin = profile?.account_type === 'admin';
  const isSuperCustomer = profile?.role === 'customer' && profile?.account_type === 'super_customer';
  
  if (!isAdmin && !isSuperCustomer) {
    redirect('/customer/dashboard');
  }

  // For super_customers, get their machine IDs first
  let machineIds: string[] = [];
  if (isSuperCustomer) {
    const { data: userMachines } = await serviceSupabase
      .from('vending_machines')
      .select('id')
      .eq('customer_id', user.id);
    machineIds = userMachines?.map(m => m.id) || [];
  }

  // Fetch both online transactions and coin payments - filter for super_customers
  const transactionsQuery = serviceSupabase
    .from('transactions')
    .select(`
      *,
      profiles!transactions_customer_id_fkey (email),
      vending_machines!transactions_machine_id_fkey (name, location)
    `);
  
  const coinPaymentsQuery = serviceSupabase
    .from('coin_payments')
    .select(`
      *,
      products (name),
      vending_machines (name, location)
    `);

  const [
    { data: transactions },
    { data: coinPayments }
  ] = await Promise.all([
    isSuperCustomer && machineIds.length > 0
      ? transactionsQuery.in('machine_id', machineIds).order('created_at', { ascending: false }).limit(50)
      : transactionsQuery.order('created_at', { ascending: false }).limit(50),
    isSuperCustomer && machineIds.length > 0
      ? coinPaymentsQuery.in('machine_id', machineIds).order('created_at', { ascending: false }).limit(50)
      : coinPaymentsQuery.order('created_at', { ascending: false }).limit(50)
  ]);

  // Calculate analytics from both sources
  const onlineRevenue = transactions?.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;
  
  const totalTransactionCount = (transactions?.length || 0) + (coinPayments?.length || 0);
  const paidTransactions = transactions?.filter(tx => tx.payment_status === 'paid') || [];
  const pendingTransactions = transactions?.filter(tx => tx.payment_status === 'pending') || [];
  const failedTransactions = transactions?.filter(tx => tx.payment_status === 'failed') || [];

  // Revenue by product (combine both sources)
  const productRevenue = new Map<string, number>();
  transactions?.forEach(tx => {
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
    items.forEach((item: any) => {
      const productName = item.name || 'Unknown';
      productRevenue.set(productName, (productRevenue.get(productName) || 0) + parseFloat(tx.total_amount || 0));
    });
  });
  coinPayments?.forEach(tx => {
    const productName = tx.products?.name || 'Unknown';
    productRevenue.set(productName, (productRevenue.get(productName) || 0) + (tx.amount_in_paisa / 100));
  });
  const topProducts = Array.from(productRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Revenue by machine (combine both sources)
  const machineRevenue = new Map<string, number>();
  transactions?.forEach(tx => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    machineRevenue.set(machineName, (machineRevenue.get(machineName) || 0) + parseFloat(tx.total_amount || 0));
  });
  coinPayments?.forEach(tx => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    machineRevenue.set(machineName, (machineRevenue.get(machineName) || 0) + (tx.amount_in_paisa / 100));
  });
  const topMachines = Array.from(machineRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Daily revenue for last 7 days (combine both sources)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyRevenue = last7Days.map(date => {
    const dayOnlineTransactions = transactions?.filter(tx => 
      tx.created_at.startsWith(date) && tx.payment_status === 'paid'
    ) || [];
    const dayCoinPayments = coinPayments?.filter(tx => 
      tx.created_at.startsWith(date)
    ) || [];
    
    const onlineRev = dayOnlineTransactions.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0);
    const coinRev = dayCoinPayments.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    
    return {
      date,
      revenue: onlineRev + coinRev,
      count: dayOnlineTransactions.length + dayCoinPayments.length
    };
  });

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <header className="bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Transactions Analytics
                </h1>
                <p className="text-sm text-gray-600">Comprehensive transaction insights and trends</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Revenue</span>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">{paidTransactions.length} online + {coinPayments?.length || 0} coin</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Transactions</span>
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalTransactionCount}</div>
            <div className="text-xs text-gray-500 mt-1">Last 50 transactions</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Pending</span>
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-yellow-600">{pendingTransactions.length}</div>
            <div className="text-xs text-gray-500 mt-1">Awaiting payment</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Failed</span>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-600">{failedTransactions.length}</div>
            <div className="text-xs text-gray-500 mt-1">Failed payments</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Daily Revenue (Last 7 Days)</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {dailyRevenue.map((day, index) => {
                const heightPercent = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end h-48 relative group">
                      {/* Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
                        <div className="font-semibold">₹{day.revenue.toFixed(2)}</div>
                        <div className="text-gray-300">{day.count} transactions</div>
                      </div>
                      {/* Bar */}
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 via-blue-500 to-purple-500 rounded-t-lg transition-all duration-500 hover:from-blue-700 hover:via-blue-600 hover:to-purple-600 cursor-pointer shadow-lg"
                        style={{ height: `${heightPercent}%`, minHeight: day.revenue > 0 ? '8px' : '0' }}
                      />
                    </div>
                    {/* Date label */}
                    <div className="text-xs text-gray-600 font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Total: ₹{dailyRevenue.reduce((sum, d) => sum + d.revenue, 0).toFixed(2)}</span>
              <span>{dailyRevenue.reduce((sum, d) => sum + d.count, 0)} transactions</span>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Top Products by Revenue</h3>
            <div className="space-y-4">
              {topProducts.map(([product, revenue], index) => {
                const maxRevenue = topProducts[0]?.[1] || 1;
                const widthPercent = (revenue / maxRevenue) * 100;
                const colors = [
                  'from-emerald-500 to-green-600',
                  'from-blue-500 to-cyan-600',
                  'from-purple-500 to-pink-600',
                  'from-orange-500 to-red-600',
                  'from-yellow-500 to-amber-600',
                ];
                return (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 truncate flex-1">{product}</span>
                      <span className="text-sm font-bold text-gray-900 ml-4">₹{revenue.toFixed(2)}</span>
                    </div>
                    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors[index % colors.length]} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-3 group-hover:scale-105 shadow-md`}
                        style={{ width: `${widthPercent}%`, minWidth: revenue > 0 ? '60px' : '0' }}
                      >
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {((revenue / topProducts.reduce((sum, [, r]) => sum + r, 0)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <div className="text-center text-gray-500 py-8">No product data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Top Machines */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold mb-4">Top Machines by Revenue</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topMachines.map(([machine, revenue], index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                <div className="text-sm text-gray-600 mb-1">#{index + 1}</div>
                <div className="font-semibold text-gray-900 mb-2 truncate">{machine}</div>
                <div className="text-xl font-bold text-blue-600">₹{revenue.toFixed(2)}</div>
              </div>
            ))}
            {topMachines.length === 0 && (
              <div className="col-span-5 text-center text-gray-500 py-4">No machine data available</div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions by product, machine, or customer..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Coin Payments */}
                {coinPayments && coinPayments.map((txn: any) => (
                  <tr key={`coin-${txn.id}`} className="hover:bg-blue-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {new Date(txn.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        <div className="font-medium text-gray-900">Coin Payment</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {txn.products?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{txn.vending_machines?.name || 'Unknown'}</div>
                      <div className="text-xs">{txn.vending_machines?.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <IndianRupee className="h-4 w-4 mr-1" />
                        {(txn.amount_in_paisa / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Coin
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Dispensed
                      </span>
                    </td>
                  </tr>
                ))}
                
                {/* Online Transactions */}
                {transactions && transactions.length > 0 ? (
                  transactions.map((txn: any) => {
                    const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items || [];
                    const productNames = items.map((item: any) => item.name).join(', ') || 'N/A';
                    return (
                    <tr key={`online-${txn.id}`} className="hover:bg-blue-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(txn.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          <div className="font-medium text-gray-900">
                            {txn.profiles?.email || 'Guest'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{productNames}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {txn.vending_machines?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <IndianRupee className="h-4 w-4 mr-1" />
                          {parseFloat(txn.total_amount || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Online
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(txn.payment_status || 'pending')}`}>
                          {txn.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  )})
                ) : null}
                
                {!transactions?.length && !coinPayments?.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
