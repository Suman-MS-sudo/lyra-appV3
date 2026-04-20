import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { FileText, Coins, Calendar } from 'lucide-react';
import Link from 'next/link';

export default async function CustomerBillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user profile
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, organization_id, organizations!organization_id(id, name)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  // Check if user is super_customer
  const isSuperCustomer = profile?.account_type === 'super_customer';

  // Get invoices for customer's organization (show pending and paid only)
  const { data: invoices } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name)')
    .eq('organization_id', profile?.organization_id)
    .in('status', ['pending', 'paid'])
    .order('created_at', { ascending: false });

  // Get customer's machines for coin payment history
  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location')
    .eq('customer_id', user.id);

  const machineIds = machines?.map(m => m.id) || [];

  // Get coin payments for this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: coinPayments } = await serviceSupabase
    .from('coin_payments')
    .select('*, vending_machines(name, location)')
    .in('machine_id', machineIds)
    .gte('created_at', startOfMonth.toISOString())
    .eq('dispensed', true)
    .order('created_at', { ascending: false })
    .limit(100);

  // Calculate total coin revenue this month
  const totalCoinRevenue = coinPayments?.reduce((sum, payment) => sum + (payment.amount_in_paisa || 0), 0) || 0;

  // Calculate pending invoice amount
  const pendingAmount = invoices
    ?.filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Invoices and payment history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending Amount</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ₹{(pendingAmount / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coin Revenue (Month)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ₹{(totalCoinRevenue / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{invoices?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Invoice #</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Period</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Due Date</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices && invoices.length > 0 ? (
                invoices.map((invoice) => {
                  const dueDate = new Date(invoice.created_at);
                  dueDate.setDate(dueDate.getDate() + 30);
                  const isOverdue = dueDate < new Date() && invoice.status !== 'paid';
                  return (
                    <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {invoice.period_start && invoice.period_end
                          ? `${new Date(invoice.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(invoice.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white text-right">
                        ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                      </td>
                      <td className={`px-5 py-3.5 text-sm hidden md:table-cell ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'paid' || invoice.total_amount_paisa === 0
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                            : invoice.status === 'pending'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                        }`}>
                          {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/customer/billing/${invoice.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-xs">View</Link>
                          {invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.total_amount_paisa > 0 && (
                            <Link
                              href={`/customer/billing/${invoice.id}/pay`}
                              className="px-2.5 py-1 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 font-medium"
                            >
                              Pay Now
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400 dark:text-gray-500">No invoices found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coin Payments */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Coin Payments</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This month's dispensed coin transactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machine</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Location</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody>
              {coinPayments && coinPayments.length > 0 ? (
                coinPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                      <span className="text-gray-400 dark:text-gray-500">{new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{payment.vending_machines?.name || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{payment.vending_machines?.location || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white text-right">
                      ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-gray-400 dark:text-gray-500">No coin payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
