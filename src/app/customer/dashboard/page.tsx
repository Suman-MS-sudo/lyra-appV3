import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShoppingBag, TrendingUp, Heart, Clock, Coins, CreditCard } from 'lucide-react';

export default async function CustomerDashboard() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch user's transactions with product and machine details
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      quantity,
      status,
      payment_method,
      created_at,
      products (
        name,
        sku
      ),
      vending_machines (
        name,
        location
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Calculate stats
  const totalPurchases = transactions?.length || 0;
  
  const totalSpent = transactions?.reduce((sum, tx) => {
    if (tx.status === 'completed' || tx.status === 'paid') {
      return sum + parseFloat(tx.amount || '0');
    }
    return sum;
  }, 0) || 0;

  // Find favorite item (most purchased product)
  const productCounts = transactions?.reduce((acc: any, tx) => {
    // Handle products as array (from join)
    const product = Array.isArray(tx.products) ? tx.products[0] : tx.products;
    if (product?.name) {
      acc[product.name] = (acc[product.name] || 0) + (tx.quantity || 1);
    }
    return acc;
  }, {}) || {};

  const favoriteItem = Object.keys(productCounts).length > 0
    ? Object.entries(productCounts).reduce((a: any, b: any) => a[1] > b[1] ? a : b)
    : null;

  // Calculate coin vs online payments
  const coinTransactions = transactions?.filter(tx => tx.payment_method === 'coin') || [];
  const onlineTransactions = transactions?.filter(tx => tx.payment_method === 'razorpay' || tx.payment_method === 'online') || [];
  
  const coinSpent = coinTransactions.reduce((sum, tx) => {
    if (tx.status === 'completed' || tx.status === 'paid') {
      return sum + parseFloat(tx.amount || '0');
    }
    return sum;
  }, 0);
  
  const onlineSpent = onlineTransactions.reduce((sum, tx) => {
    if (tx.status === 'completed' || tx.status === 'paid') {
      return sum + parseFloat(tx.amount || '0');
    }
    return sum;
  }, 0);

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
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button className="px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 rounded-lg transition-all shadow-sm">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            My Dashboard
          </h2>
          <p className="text-gray-600">Welcome back! Here's your activity</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Total Purchases</div>
              <div className="text-4xl font-bold">{totalPurchases}</div>
              <div className="text-sm opacity-75 mt-2">All time</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Total Spent</div>
              <div className="text-4xl font-bold">₹{totalSpent.toFixed(2)}</div>
              <div className="text-sm opacity-75 mt-2">All transactions</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Coins className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Coin Payments</div>
              <div className="text-4xl font-bold">₹{coinSpent.toFixed(2)}</div>
              <div className="text-sm opacity-75 mt-2">{coinTransactions.length} transactions</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Online Payments</div>
              <div className="text-4xl font-bold">₹{onlineSpent.toFixed(2)}</div>
              <div className="text-sm opacity-75 mt-2">{onlineTransactions.length} transactions</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Heart className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">Favorite Item</div>
              <div className="text-2xl font-bold truncate">
                {favoriteItem ? favoriteItem[0] : 'N/A'}
              </div>
              <div className="text-sm opacity-75 mt-2">
                {favoriteItem ? `${favoriteItem[1]} purchases` : 'No purchases yet'}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Recent Purchases</h3>
          </div>

          {!transactions || transactions.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No purchases yet</p>
              <p className="text-gray-400 text-sm mt-2">Your purchase history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction: any) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 border border-transparent hover:border-gray-200"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {transaction.products?.name || 'Unknown Product'}
                      {transaction.quantity > 1 && (
                        <span className="ml-2 text-sm text-gray-500">x{transaction.quantity}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {transaction.vending_machines?.location || 'Unknown Location'} • {formatTimeAgo(transaction.created_at)}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        transaction.status === 'completed' || transaction.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                  <div className="font-bold text-lg text-gray-900">₹{parseFloat(transaction.amount).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
