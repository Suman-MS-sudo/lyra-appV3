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
  Activity
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Modern Header with Glassmorphism */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="px-6 pt-4">
          <nav className="flex space-x-1 mb-6">
            <a href="/admin/machines" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />Machines</span>
            </a>
            <a href="/admin/products" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200">
              <span className="flex items-center gap-2"><Receipt className="w-4 h-4" />Products</span>
            </a>
            <a href="/admin/customers" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 transition-all duration-200">
              <span className="flex items-center gap-2"><Users className="w-4 h-4" />Customers</span>
            </a>
            <a href="/admin/transactions" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4" />Transactions</span>
            </a>
            <a href="/admin/analytics" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200">
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Analytics</span>
            </a>
          </nav>
          <div className="flex items-center justify-between pb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 rounded-lg transition-all duration-200 shadow-sm hover:shadow border border-gray-200">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid with Gradients */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Machines Card */}
          <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Total Machines</div>
              <div className="text-4xl font-bold">{totalMachines || 0}</div>
            </div>
          </div>

          {/* Active Users Card */}
          <div className="group relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Users className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Active Users</div>
              <div className="text-4xl font-bold">{totalUsers || 0}</div>
            </div>
          </div>

          {/* Revenue Card */}
          <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Total Revenue</div>
              <div className="text-4xl font-bold">₹{totalRevenue.toFixed(2)}</div>
            </div>
          </div>

          {/* Transactions Card */}
          <div className="group relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Receipt className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Transactions</div>
              <div className="text-4xl font-bold">{totalTransactions || 0}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Machines */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Recent Machines
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentMachines && recentMachines.length > 0 ? (
                recentMachines.map((machine: any, i: number) => (
                  <div key={i} className="px-6 py-4 hover:bg-blue-50/50 transition-colors duration-200 group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Recent Transactions
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map((tx: any, i: number) => (
                  <div key={i} className="px-6 py-4 hover:bg-purple-50/50 transition-colors duration-200 group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {Array.isArray(tx.products)
                            ? tx.products.map((p: any) => p.name).join(', ')
                            : tx.products?.name || 'Product'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          ₹{parseFloat(tx.amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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
