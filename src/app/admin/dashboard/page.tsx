import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Receipt, 
  MapPin, 
  Clock, 
  CheckCircle2,
  ArrowUpRight,
  Activity,
  Coins,
  CreditCard
} from 'lucide-react';

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

  // Fetch user profile and verify role
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  // Redirect customers to customer dashboard
  if (profile?.role === 'customer') {
    redirect('/customer/dashboard');
  }

  // Determine if user is super_customer (should only see their machines)
  const isSuperCustomer = profile?.account_type === 'super_customer';
  
  // Get machine IDs for super customers
  let machineIds: string[] = [];
  if (isSuperCustomer) {
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('id')
      .eq('customer_id', user.id);
    machineIds = machines?.map((m: any) => m.id) || [];
  }
  
  // Build query filters based on account type
  const machinesQuery = serviceSupabase.from('vending_machines');
  const machinesSelect = isSuperCustomer 
    ? machinesQuery.select('*', { count: 'exact', head: true }).eq('customer_id', user.id)
    : machinesQuery.select('*', { count: 'exact', head: true });

  // Fetch dashboard stats and products
  const [
    { count: totalMachines },
    { count: totalUsers },
    { count: totalTransactions },
    { count: totalCoinPayments },
    { data: recentMachines },
    { data: recentTransactions },
    { data: paidTx },
    { data: coinPayments },
    { data: products }
  ] = await Promise.all([
    machinesSelect,
    serviceSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }).in('machine_id', machineIds)
      : serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }).in('machine_id', machineIds)
      : serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }),
    isSuperCustomer
      ? serviceSupabase.from('vending_machines').select('name, location').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(3)
      : serviceSupabase.from('vending_machines').select('name, location').order('created_at', { ascending: false }).limit(3),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('total_amount, created_at, items').in('machine_id', machineIds).order('created_at', { ascending: false }).limit(3)
      : serviceSupabase.from('transactions').select('total_amount, created_at, items').order('created_at', { ascending: false }).limit(3),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('total_amount').eq('payment_status', 'paid').in('machine_id', machineIds)
      : serviceSupabase.from('transactions').select('total_amount').eq('payment_status', 'paid'),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('coin_payments').select('amount_in_paisa, dispensed').in('machine_id', machineIds)
      : serviceSupabase.from('coin_payments').select('amount_in_paisa, dispensed'),
    serviceSupabase.from('products').select('id, name, sku, price').order('created_at', { ascending: false }),
  ]);

  // Calculate revenue by payment method
  const onlineRevenue = paidTx?.reduce((sum: number, tx: any) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum: number, tx: any) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100; // Convert paisa to rupees
  
  const totalRevenue = onlineRevenue + coinRevenue;
  const onlineCount = totalTransactions || 0;
  const coinCount = totalCoinPayments || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <nav className="flex space-x-1 mb-4">
            <a href="/admin/machines" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />Machines</span>
            </a>
            <a href="/admin/products" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><Receipt className="w-4 h-4" />Products</span>
            </a>
            <a href="/admin/organizations" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />Organizations</span>
            </a>
            <a href="/admin/users" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><Users className="w-4 h-4" />Users</span>
            </a>
            <a href="/admin/transactions" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4" />Transactions</span>
            </a>
            <a href="/admin/billing" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Org Billing</span>
            </a>
            <a href="/admin/analytics" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Analytics</span>
            </a>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition-all shadow-sm">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Machines Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Machines</div>
                <div className="text-3xl font-bold text-gray-900">{totalMachines || 0}</div>
              </div>
            </div>
          </div>

          {/* Active Users Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Active Users</div>
                <div className="text-3xl font-bold text-gray-900">{totalUsers || 0}</div>
              </div>
            </div>
          </div>

          {/* Revenue Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-gray-900">₹{totalRevenue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Transactions Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Receipt className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Transactions</div>
                <div className="text-3xl font-bold text-gray-900">{(totalTransactions || 0) + (totalCoinPayments || 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Coin Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Coins className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Coin Transactions</div>
                <div className="text-2xl font-bold text-gray-900">{coinCount}</div>
                <div className="text-xs text-gray-500 mt-1">₹{coinRevenue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Online Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Online Transactions</div>
                <div className="text-2xl font-bold text-gray-900">{onlineCount}</div>
                <div className="text-xs text-gray-500 mt-1">₹{onlineRevenue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Coin Revenue % */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Coin Revenue %</div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalRevenue > 0 ? ((coinRevenue / totalRevenue) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-gray-500 mt-1">of total revenue</div>
              </div>
            </div>
          </div>

          {/* Online Revenue % */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Online Revenue %</div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalRevenue > 0 ? ((onlineRevenue / totalRevenue) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-gray-500 mt-1">of total revenue</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Machines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Recent Machines
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentMachines && recentMachines.length > 0 ? (
                recentMachines.map((machine: any, i: number) => (
                  <div key={i} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {machine.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {machine.location}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Online
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No machines found</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                Recent Transactions
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map((tx: any, i: number) => {
                  const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
                  const productNames = items.map((item: any) => item.name).join(', ') || 'Product';
                  return (
                  <div key={i} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {productNames}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          ₹{parseFloat(tx.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )})
              ) : (
                <div className="px-6 py-12 text-center text-gray-400">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No transactions found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
