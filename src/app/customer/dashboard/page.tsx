import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ShoppingBag, TrendingUp, Heart, Clock, Coins, CreditCard, Building2, Activity, AlertCircle, Package, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import MachineAssignmentPopup from '@/components/MachineAssignmentPopup';

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
  // Super customers see all machines in their organization, regular users see only their assigned machines
  let customerMachines;
  let orgUsersWithMachines = [];
  
  if (isSuperCustomer && profile?.organization_id) {
    // Get all machines owned by super customer AND machines owned by users in this organization
    const { data: orgUsers } = await serviceSupabase
      .from('profiles')
      .select('id, email, full_name, account_type')
      .eq('organization_id', profile.organization_id);
    
    const userIds = orgUsers?.map(u => u.id) || [user.id];
    
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('id, name, location, status, asset_online, stock_level, customer_id')
      .in('customer_id', userIds);
    
    customerMachines = machines;

    // Group machines by user for display
    orgUsersWithMachines = orgUsers?.map(orgUser => {
      const userMachines = machines?.filter(m => m.customer_id === orgUser.id) || [];
      return {
        ...orgUser,
        machines: userMachines,
        machineCount: userMachines.length
      };
    }).filter(u => u.machineCount > 0) || [];
  } else {
    // Regular users only see their own machines
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('id, name, location, status, asset_online, stock_level')
      .eq('customer_id', user.id);
    
    customerMachines = machines;
  }

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
        total_amount,
        items,
        quantity,
        status,
        payment_status,
        payment_method,
        created_at,
        machine_id,
        vending_machines!transactions_machine_id_fkey (name, location)
      `)
      .in('machine_id', machineIds)
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
  const onlineMachines = customerMachines?.filter(m => m.status === 'online' || m.status === 'active').length || 0;
  const lowStockMachines = customerMachines?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0;

  // Transaction stats
  const totalOnlineTransactions = onlineTransactions?.length || 0;
  const totalCoinTransactions = coinPayments?.length || 0;
  const totalTransactions = totalOnlineTransactions + totalCoinTransactions;

  // Revenue calculations
  const onlineRevenue = onlineTransactions?.reduce((sum, tx) => {
    if (tx.payment_status === 'paid') {
      return sum + parseFloat(tx.total_amount || 0);
    }
    return sum;
  }, 0) || 0;

  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;

  // Machine health analysis
  const healthyMachines = customerMachines?.filter(m => (m.status === 'online' || m.status === 'active') && (m.stock_level || 0) >= 5) || [];
  const needsAttentionMachines = customerMachines?.filter(m => {
    const isOffline = m.status !== 'online' && m.status !== 'active';
    const isLowStock = m.stock_level !== null && m.stock_level < 5;
    return isOffline || isLowStock;
  }).map(m => ({
    ...m,
    issues: [
      m.status !== 'online' && m.status !== 'active' ? 'Offline' : null,
      m.stock_level !== null && m.stock_level < 5 ? 'Low Stock' : null
    ].filter(Boolean)
  })) || [];

  // Breakdown by payment method
  const onlineTransactionCount = onlineTransactions?.filter(tx => tx.payment_status === 'paid').length || 0;
  const coinTransactionCount = coinPayments?.length || 0;

  // Calculate coin payments to be paid to Lyra (customer owes for coin transactions)
  const coinPaymentOwed = coinRevenue;

  // Machine-wise breakdown
  const machineHealthDetails = customerMachines?.map(machine => {
    const machineOnlineTx = onlineTransactions?.filter(tx => 
      tx.machine_id === machine.id && tx.payment_status === 'paid'
    ) || [];
    const machineCoinTx = coinPayments?.filter(tx => 
      tx.machine_id === machine.id
    ) || [];

    const machineOnlineRev = machineOnlineTx.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0);
    const machineCoinRev = machineCoinTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);

    return {
      ...machine,
      onlineTransactions: machineOnlineTx.length,
      coinTransactions: machineCoinTx.length,
      onlineRevenue: machineOnlineRev,
      coinRevenue: machineCoinRev,
      totalRevenue: machineOnlineRev + machineCoinRev,
      totalTransactions: machineOnlineTx.length + machineCoinTx.length,
      healthStatus: (machine.status === 'online' || machine.status === 'active') && (machine.stock_level || 0) >= 5 ? 'healthy' : 'needs_attention'
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue) || [];

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

  // Format currency for display
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
              <Link href="/customer/machines" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />My Machines</span>
              </Link>
              <Link href="/customer/users" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <span className="flex items-center gap-2"><Users className="w-4 h-4" />Manage Users</span>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Dashboard Overview</h2>
          <p className="text-sm text-gray-600">Monitor your vending machine operations</p>
        </div>

        {/* Summary Stats */}
        <div className={`grid gap-4 mb-6 ${isSuperCustomer ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Healthy Machines</div>
            <div className="text-2xl font-bold text-gray-900">{healthyMachines.length} / {totalMachines}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Need Attention</div>
            <div className="text-2xl font-bold text-red-600">{needsAttentionMachines.length}</div>
          </div>

          {isSuperCustomer && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Online Revenue</div>
                <div className="text-2xl font-bold text-gray-900">₹{formatAmount(onlineRevenue)}</div>
                <div className="text-xs text-gray-500 mt-1">{onlineTransactionCount} transactions</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Coin Owed to Lyra</div>
                <div className="text-2xl font-bold text-gray-900">₹{formatAmount(coinPaymentOwed)}</div>
                <div className="text-xs text-gray-500 mt-1">{coinTransactionCount} transactions</div>
              </div>
            </>
          )}
        </div>

        {/* Machine Assignments by User - Only for super customers */}
        {isSuperCustomer && orgUsersWithMachines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Machine Assignments</h3>
              <p className="text-sm text-gray-600 mt-1">View which users have machines assigned</p>
            </div>
            <Link href="/customer/users" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition-all shadow-sm">
              Manage Users
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Machines</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assigned Devices</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgUsersWithMachines.map((orgUser) => (
                  <tr key={orgUser.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {(orgUser.full_name || orgUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-gray-900">{orgUser.full_name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{orgUser.email}</td>
                    <td className="py-4 px-4 text-center">
                      {orgUser.account_type === 'super_customer' ? (
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                          Super Customer
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">
                          Customer
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {orgUser.machineCount}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <MachineAssignmentPopup 
                        machines={orgUser.machines}
                        userName={orgUser.full_name || orgUser.email}
                      />
                    </td>
                    <td className="py-4 px-4 text-right">
                      {orgUser.account_type !== 'super_customer' && (
                        <Link 
                          href={`/customer/users/${orgUser.id}/edit`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Transaction Breakdown - Only for super customers */}
        {isSuperCustomer && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Payment Method</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Count</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Revenue</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-3 text-sm text-gray-900">Online Payments</td>
                  <td className="py-3 px-3 text-sm text-right text-gray-900">{onlineTransactionCount}</td>
                  <td className="py-3 px-3 text-sm text-right font-medium text-gray-900">₹{formatAmount(onlineRevenue)}</td>
                  <td className="py-3 px-3 text-sm text-right text-gray-900">{totalTransactions > 0 ? ((onlineTransactionCount / totalTransactions) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-3 text-sm text-gray-900">Coin Payments</td>
                  <td className="py-3 px-3 text-sm text-right text-gray-900">{coinTransactionCount}</td>
                  <td className="py-3 px-3 text-sm text-right font-medium text-gray-900">₹{formatAmount(coinRevenue)}</td>
                  <td className="py-3 px-3 text-sm text-right text-gray-900">{totalTransactions > 0 ? ((coinTransactionCount / totalTransactions) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-3 px-3 text-sm font-semibold text-gray-900">Total</td>
                  <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900">{totalTransactions}</td>
                  <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900">₹{formatAmount(totalRevenue)}</td>
                  <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        )}\n\n        {/* Machines Requiring Attention */}
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Machines Requiring Attention
              {needsAttentionMachines.length > 0 && (
                <span className="ml-2 inline-block bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                  {needsAttentionMachines.length}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Machines with low stock or offline status</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Offline/Powered Off Machines */}
            <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-200">
                <h4 className="text-base font-semibold text-red-900">
                  Offline / Powered Off
                  <span className="ml-2 inline-block bg-red-600 text-white px-2 py-0.5 rounded-full text-xs">
                    {customerMachines?.filter(m => m.status !== 'online' && m.status !== 'active').length || 0}
                  </span>
                </h4>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Machine</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Location</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerMachines?.filter(m => m.status !== 'online' && m.status !== 'active').length > 0 ? (
                      customerMachines
                        ?.filter(m => m.status !== 'online' && m.status !== 'active')
                        .map((machine) => (
                          <tr key={machine.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 px-3 text-sm font-medium text-gray-900">{machine.name}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{machine.location}</td>
                            <td className="py-3 px-3 text-sm text-center">
                              <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                {machine.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          <div className="text-gray-400 text-2xl mb-1">✓</div>
                          <p className="text-sm text-gray-500">All machines online</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Machines */}
            <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-orange-50 border-b border-orange-200">
                <h4 className="text-base font-semibold text-orange-900">
                  Low Stock Alert
                  <span className="ml-2 inline-block bg-orange-600 text-white px-2 py-0.5 rounded-full text-xs">
                    {customerMachines?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0}
                  </span>
                </h4>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Machine</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Location</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700 border-b border-gray-300">Stock Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerMachines?.filter(m => m.stock_level !== null && m.stock_level < 5).length > 0 ? (
                      customerMachines
                        ?.filter(m => m.stock_level !== null && m.stock_level < 5)
                        .sort((a, b) => (a.stock_level || 0) - (b.stock_level || 0))
                        .map((machine) => (
                          <tr key={machine.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 px-3 text-sm font-medium text-gray-900">{machine.name}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{machine.location}</td>
                            <td className="py-3 px-3 text-sm text-right">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                (machine.stock_level || 0) === 0
                                  ? 'bg-red-100 text-red-700'
                                  : (machine.stock_level || 0) < 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {machine.stock_level} units
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          <div className="text-gray-400 text-2xl mb-1">✓</div>
                          <p className="text-sm text-gray-500">All machines have adequate stock</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
