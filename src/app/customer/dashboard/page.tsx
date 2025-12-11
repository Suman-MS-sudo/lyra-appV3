import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ShoppingBag, TrendingUp, Heart, Clock, Coins, CreditCard, Building2, Activity, AlertCircle, Package, Settings, Users } from 'lucide-react';
import Link from 'next/link';

export default async function CustomerDashboard() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role for comprehensive queries
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch user profile and verify role
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Redirect admins to admin dashboard
  if (profile?.role === 'admin') {
    redirect('/admin/dashboard');
  }

  // Check if user is super_customer for enhanced permissions
  const isSuperCustomer = profile?.account_type === 'super_customer';

  // Fetch customer's vending machines
  const { data: customerMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location, status, asset_online, stock_level')
    .eq('customer_id', user.id);

  const machineIds = customerMachines?.map(m => m.id) || [];

  // Fetch all transactions and coin payments for customer's machines
  const [
    { data: onlineTransactions },
    { data: coinPayments }
  ] = await Promise.all([
    serviceSupabase
      .from('transactions')
      .select(`
        id,
        amount,
        quantity,
        status,
        payment_status,
        payment_method,
        created_at,
        vending_machine_id,
        products (name, sku),
        vending_machines (name, location)
      `)
      .in('vending_machine_id', machineIds)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('coin_payments')
      .select(`
        id,
        amount_in_paisa,
        quantity,
        dispensed,
        created_at,
        machine_id,
        products (name),
        vending_machines (name, location)
      `)
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
  ]);

  // Calculate comprehensive stats
  const totalMachines = customerMachines?.length || 0;
  const onlineMachines = customerMachines?.filter(m => m.asset_online).length || 0;
  const lowStockMachines = customerMachines?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0;

  // Transaction stats
  const totalOnlineTransactions = onlineTransactions?.length || 0;
  const totalCoinTransactions = coinPayments?.length || 0;
  const totalTransactions = totalOnlineTransactions + totalCoinTransactions;

  // Revenue calculations
  const onlineRevenue = onlineTransactions?.reduce((sum, tx) => {
    if (tx.payment_status === 'paid') {
      return sum + parseFloat(tx.amount || 0);
    }
    return sum;
  }, 0) || 0;

  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;

  // Product analytics
  const productStats = new Map<string, { count: number; revenue: number }>();
  
  onlineTransactions?.forEach(tx => {
    if (tx.payment_status === 'paid') {
      const productName = (tx.products as any)?.name || 'Unknown';
      const current = productStats.get(productName) || { count: 0, revenue: 0 };
      productStats.set(productName, {
        count: current.count + (tx.quantity || 1),
        revenue: current.revenue + parseFloat(tx.amount || 0)
      });
    }
  });

  coinPayments?.forEach(tx => {
    const productName = (tx.products as any)?.name || 'Unknown';
    const current = productStats.get(productName) || { count: 0, revenue: 0 };
    productStats.set(productName, {
      count: current.count + (tx.quantity || 1),
      revenue: current.revenue + (tx.amount_in_paisa / 100)
    });
  });

  const topProducts = Array.from(productStats.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Machine performance
  const machineStats = new Map<string, { count: number; revenue: number }>();
  
  onlineTransactions?.forEach(tx => {
    if (tx.payment_status === 'paid') {
      const machineName = (tx.vending_machines as any)?.name || 'Unknown';
      const current = machineStats.get(machineName) || { count: 0, revenue: 0 };
      machineStats.set(machineName, {
        count: current.count + 1,
        revenue: current.revenue + parseFloat(tx.amount || 0)
      });
    }
  });

  coinPayments?.forEach(tx => {
    const machineName = (tx.vending_machines as any)?.name || 'Unknown';
    const current = machineStats.get(machineName) || { count: 0, revenue: 0 };
    machineStats.set(machineName, {
      count: current.count + 1,
      revenue: current.revenue + (tx.amount_in_paisa / 100)
    });
  });

  const topMachines = Array.from(machineStats.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Daily revenue for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyRevenue = last7Days.map(date => {
    const dayOnline = onlineTransactions?.filter(tx => 
      tx.created_at.startsWith(date) && tx.payment_status === 'paid'
    ) || [];
    const dayCoin = coinPayments?.filter(tx => 
      tx.created_at.startsWith(date)
    ) || [];
    
    const onlineRev = dayOnline.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const coinRev = dayCoin.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    
    return {
      date,
      revenue: onlineRev + coinRev,
      count: dayOnline.length + dayCoin.length
    };
  });

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);

  // Recent transactions (combined)
  const allTransactions = [
    ...(onlineTransactions?.slice(0, 5).map(tx => ({
      id: tx.id,
      type: 'online' as const,
      amount: parseFloat(tx.amount || 0),
      product: (tx.products as any)?.name || 'Unknown',
      machine: (tx.vending_machines as any)?.name || 'Unknown',
      created_at: tx.created_at,
      status: tx.payment_status
    })) || []),
    ...(coinPayments?.slice(0, 5).map(tx => ({
      id: tx.id,
      type: 'coin' as const,
      amount: tx.amount_in_paisa / 100,
      product: (tx.products as any)?.name || 'Unknown',
      machine: (tx.vending_machines as any)?.name || 'Unknown',
      created_at: tx.created_at,
      status: 'paid'
    })) || [])
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg"></div>
            <h1 className="text-xl font-bold text-gray-900">Lyra</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-900 font-medium hidden sm:block">{user.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition-all shadow-sm">
                Logout
              </button>
            </form>
          </div>
        </div>
        
        {/* Navigation for Super Customers */}
        {isSuperCustomer && (
          <div className="px-6 py-3 border-t border-gray-200/50">
            <nav className="flex items-center gap-2 overflow-x-auto">
              <Link href="/customer/dashboard" className="px-4 py-2 rounded-lg font-medium bg-blue-100 text-blue-700">
                Dashboard
              </Link>
              <Link href="/admin/machines" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />Machines</span>
              </Link>
              <Link href="/admin/products" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Package className="w-4 h-4" />Products</span>
              </Link>
              <Link href="/admin/transactions" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Activity className="w-4 h-4" />Transactions</span>
              </Link>
              <Link href="/admin/users" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Users className="w-4 h-4" />Users</span>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            My Dashboard
          </h2>
          <p className="text-gray-600">Monitor your vending machine performance</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Machines</div>
            <div className="text-2xl font-bold text-gray-900">{totalMachines}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Online</div>
            <div className="text-2xl font-bold text-green-600">{onlineMachines}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Low Stock</div>
            <div className="text-2xl font-bold text-orange-600">{lowStockMachines}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingBag className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Transactions</div>
            <div className="text-2xl font-bold text-gray-900">{totalTransactions}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">₹{totalRevenue.toFixed(2)}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Coins className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Coin Sales</div>
            <div className="text-2xl font-bold text-amber-600">₹{coinRevenue.toFixed(2)}</div>
          </div>
        </div>

        {/* Revenue Chart & Top Products */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Daily Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-6 text-gray-900">Daily Revenue (Last 7 Days)</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {dailyRevenue.map((day, index) => {
                const heightPercent = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg hover:from-blue-600 hover:to-purple-600 transition-all relative group"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}>
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        ₹{day.revenue.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-4 text-sm text-gray-500">
              Total: ₹{dailyRevenue.reduce((sum, d) => sum + d.revenue, 0).toFixed(2)} • {dailyRevenue.reduce((sum, d) => sum + d.count, 0)} transactions
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-6 text-gray-900">Top Products by Revenue</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map(([product, stats], index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{product}</div>
                        <div className="text-xs text-gray-500">{stats.count} units sold</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">₹{stats.revenue.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No product data available</div>
            )}
          </div>
        </div>

        {/* Top Machines & Recent Transactions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Top Machines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-6 text-gray-900">Top Machines by Revenue</h3>
            {topMachines.length > 0 ? (
              <div className="space-y-4">
                {topMachines.map(([machine, stats], index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{machine}</div>
                        <div className="text-xs text-gray-500">{stats.count} transactions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">₹{stats.revenue.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No machine data available</div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-6 text-gray-900">Recent Transactions</h3>
            {allTransactions.length > 0 ? (
              <div className="space-y-4">
                {allTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${tx.type === 'coin' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        {tx.type === 'coin' ? (
                          <Coins className="w-4 h-4 text-amber-600" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{tx.product}</div>
                        <div className="text-xs text-gray-500">{tx.machine} • {formatTimeAgo(tx.created_at)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">₹{tx.amount.toFixed(2)}</div>
                      <div className={`text-xs ${tx.type === 'coin' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {tx.type === 'coin' ? 'Coin' : 'Online'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No transactions yet</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
