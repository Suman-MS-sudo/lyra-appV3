import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Building2, Activity, Package, MapPin, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

export default async function CustomerMachinesPage() {
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

  // Fetch customer's vending machines with transaction stats
  // Super customers see all machines in their organization, regular users see only their assigned machines
  let customerMachines;
  if (isSuperCustomer && profile?.organization_id) {
    // Get all machines owned by super customer AND machines owned by users in this organization
    const { data: orgUsers } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('organization_id', profile.organization_id);
    
    const userIds = orgUsers?.map(u => u.id) || [user.id];
    
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('*')
      .in('customer_id', userIds)
      .order('created_at', { ascending: false });
    
    customerMachines = machines;
  } else {
    // Regular users only see their own machines
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    
    customerMachines = machines;
  }

  // Get transaction counts for each machine
  const machineIds = customerMachines?.map(m => m.id) || [];
  
  const [
    { data: onlineTransactions },
    { data: coinPayments }
  ] = await Promise.all([
    serviceSupabase
      .from('transactions')
      .select('machine_id, total_amount, payment_status')
      .in('machine_id', machineIds),
    serviceSupabase
      .from('coin_payments')
      .select('machine_id, amount_in_paisa')
      .in('machine_id', machineIds)
  ]);

  // Calculate stats per machine
  const machinesWithStats = customerMachines?.map(machine => {
    const machineOnlineTx = onlineTransactions?.filter(tx => 
      tx.machine_id === machine.id && tx.payment_status === 'paid'
    ) || [];
    const machineCoinTx = coinPayments?.filter(tx => 
      tx.machine_id === machine.id
    ) || [];

    const onlineRevenue = machineOnlineTx.reduce((sum, tx) => sum + parseFloat(tx.total_amount || '0'), 0);
    const coinRevenue = machineCoinTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);

    return {
      ...machine,
      onlineTransactions: machineOnlineTx.length,
      coinTransactions: machineCoinTx.length,
      totalTransactions: machineOnlineTx.length + machineCoinTx.length,
      totalRevenue: onlineRevenue + coinRevenue
    };
  }) || [];

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
              <Link href="/customer/dashboard" className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                Dashboard
              </Link>
              <Link href="/customer/machines" className="px-4 py-2 rounded-lg font-medium bg-blue-100 text-blue-700">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-1">My Machines</h2>
          <p className="text-sm text-gray-600">View and monitor all your vending machines</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total Machines</div>
            <div className="text-2xl font-bold text-gray-900">{customerMachines?.length || 0}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Online</div>
            <div className="text-2xl font-bold text-green-600">
              {customerMachines?.filter(m => m.status === 'online' || m.status === 'active').length || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Low Stock</div>
            <div className="text-2xl font-bold text-orange-600">
              {customerMachines?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0}
            </div>
          </div>

          {isSuperCustomer && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                ₹{formatAmount(machinesWithStats.reduce((sum, m) => sum + m.totalRevenue, 0))}
              </div>
            </div>
          )}
        </div>

        {/* Machines Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Machines</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Machine Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Stock Level</th>
                  {isSuperCustomer && (
                    <>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {machinesWithStats.length > 0 ? (
                  machinesWithStats.map((machine) => (
                    <tr key={machine.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">{machine.name}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {machine.location}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          machine.status === 'online' || machine.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : machine.status === 'maintenance'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {machine.status}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-sm text-right font-medium ${
                        machine.stock_level !== null && machine.stock_level < 5
                          ? 'text-orange-600'
                          : 'text-gray-900'
                      }`}>
                        {machine.stock_level !== null ? `${machine.stock_level} units` : 'N/A'}
                      </td>
                      {isSuperCustomer && (
                        <>
                          <td className="py-4 px-4 text-sm text-right text-gray-900">
                            {machine.totalTransactions}
                          </td>
                          <td className="py-4 px-4 text-sm text-right font-semibold text-gray-900">
                            ₹{formatAmount(machine.totalRevenue)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-gray-400 text-4xl mb-2">🏪</div>
                      <p className="text-gray-500 font-medium">No machines found</p>
                      <p className="text-sm text-gray-400 mt-1">Contact admin to add machines to your account</p>
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
