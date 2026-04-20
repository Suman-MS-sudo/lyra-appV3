import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

// Ensure dynamic rendering to show real-time machine status
export const revalidate = 0;

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
  // Machines are assigned to organizations (customer_id stores the org UUID)
  // All users in an organization see all machines assigned to that org
  if (profile?.organization_id) {
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('*, last_ping')
      .eq('customer_id', profile.organization_id)
      .order('created_at', { ascending: false });

    customerMachines = machines;
  } else {
    // Fallback: no org assigned, show no machines
    customerMachines = [];
  }

  // Recalculate online status based on last_ping (10 minute timeout)
  // This ensures customer machines page shows accurate real-time status
  const machinesWithUpdatedStatus = customerMachines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      const now = new Date().getTime();
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      machine.asset_online = (now - lastPingTime) < tenMinutes;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

  // Get transaction counts for each machine
  const machineIds = machinesWithUpdatedStatus?.map(m => m.id) || [];
  
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
  const machinesWithStats = machinesWithUpdatedStatus?.map(machine => {
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Machines</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">View and monitor all your vending machines</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Machines</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{machinesWithUpdatedStatus?.length || 0}</div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Online</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {machinesWithUpdatedStatus?.filter(m => m.asset_online).length || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Low Stock</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {machinesWithUpdatedStatus?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0}
          </div>
        </div>

        {isSuperCustomer && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ₹{formatAmount(machinesWithStats.reduce((sum, m) => sum + m.totalRevenue, 0))}
            </div>
          </div>
        )}
      </div>

      {/* Machines Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">All Machines</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machine</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Location</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stock</th>
                {isSuperCustomer && (
                  <>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Transactions</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenue</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {machinesWithStats.length > 0 ? (
                machinesWithStats.map((machine) => (
                  <tr key={machine.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3.5 px-4 text-sm font-medium text-gray-900 dark:text-white">{machine.name}</td>
                    <td className="py-3.5 px-4 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {machine.location}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        machine.asset_online
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${machine.asset_online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {machine.asset_online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 text-sm text-right font-medium ${
                      machine.stock_level !== null && machine.stock_level < 5
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {machine.stock_level !== null ? `${machine.stock_level} units` : 'N/A'}
                    </td>
                    {isSuperCustomer && (
                      <>
                        <td className="py-3.5 px-4 text-sm text-right hidden md:table-cell">
                          <div className="font-semibold text-gray-900 dark:text-white">{machine.totalTransactions}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="text-indigo-600 dark:text-indigo-400">{machine.onlineTransactions}</span>
                            {' / '}
                            <span className="text-amber-600 dark:text-amber-400">{machine.coinTransactions}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ₹{formatAmount(machine.totalRevenue)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No machines found</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Contact admin to add machines to your account</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
