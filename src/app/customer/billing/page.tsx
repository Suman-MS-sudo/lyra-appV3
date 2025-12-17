import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { DollarSign, FileText, Coins, Calendar, Building2, CreditCard } from 'lucide-react';
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
    .select('*, organizations(id, name)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  // Get invoices for customer's organization
  const { data: invoices } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations(id, name)')
    .eq('organization_id', profile?.organization_id)
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
              <p className="text-sm text-gray-500">
                {profile?.organizations?.name || 'My Account'}
              </p>
            </div>
            <Link
              href="/customer/dashboard"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Invoices</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{(pendingAmount / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Coins className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Coin Revenue (This Month)</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{(totalCoinRevenue / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoices?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices Section */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices && invoices.length > 0 ? (
                  invoices.map((invoice) => {
                    const dueDate = new Date(invoice.created_at);
                    dueDate.setDate(dueDate.getDate() + 30);
                    
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {invoice.period_start && invoice.period_end
                            ? `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {dueDate.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'draft'
                                ? 'bg-gray-100 text-gray-800'
                                : invoice.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/customer/billing/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </Link>
                            {invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.total_amount_paisa > 0 && (
                              <Link
                                href={`/customer/billing/${invoice.id}/pay`}
                                className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
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
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coin Payments Section */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Coin Payments</h2>
            <p className="text-sm text-gray-500 mt-1">Showing payments from this month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Machine
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {coinPayments && coinPayments.length > 0 ? (
                  coinPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {payment.vending_machines?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {payment.vending_machines?.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No coin payments found this month
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
