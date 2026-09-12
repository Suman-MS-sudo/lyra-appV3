import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { FileText, Coins, ArrowUpRight, Nfc } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

export default async function CustomerBillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, organization_id, organizations!organization_id(id, name)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  const { data: invoices } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name)')
    .eq('organization_id', profile?.organization_id)
    .in('status', ['pending', 'paid'])
    .order('created_at', { ascending: false });

  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location')
    .eq('customer_id', user.id);

  const machineIds = machines?.map(m => m.id) || [];

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

  const { data: rfidPayments } = await serviceSupabase
    .from('rfid_payments')
    .select('*, vending_machines(name, location)')
    .in('machine_id', machineIds)
    .gte('created_at', startOfMonth.toISOString())
    .eq('dispensed', true)
    .order('created_at', { ascending: false })
    .limit(100);

  const totalCoinRevenue = coinPayments?.reduce((sum, payment) => sum + (payment.amount_in_paisa || 0), 0) || 0;
  const totalRfidRevenue = rfidPayments?.reduce((sum, payment) => sum + (payment.amount_in_paisa || 0), 0) || 0;
  const pendingAmount = invoices
    ?.filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">Billing</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>Invoices and payment history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Amount */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,0,0,0.04)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <FileText className="w-5 h-5" style={{ color: '#0071e3' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Pending Amount</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">₹{(pendingAmount / 100).toFixed(2)}</p>
        </div>

        {/* Coin Revenue */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(154,100,0,0.12)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(154,100,0,0.12)' }}>
            <Coins className="w-5 h-5" style={{ color: '#9a6400' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Coin Revenue (Month)</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">₹{(totalCoinRevenue / 100).toFixed(2)}</p>
        </div>

        {/* RFID Revenue */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,0,0,0.04)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <Nfc className="w-5 h-5" style={{ color: '#6e6e73' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>RFID Revenue (Month)</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">₹{(totalRfidRevenue / 100).toFixed(2)}</p>
        </div>

        {/* Total Invoices */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,113,227,0.10)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,113,227,0.10)' }}>
            <FileText className="w-5 h-5" style={{ color: '#0071e3' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Total Invoices</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">{invoices?.length || 0}</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f7' }}>
          <h2 className="font-semibold text-[#1d1d1f] flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: '#0071e3' }} />
            Invoices
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Invoice #</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: '#86868b' }}>Period</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Amount</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: '#86868b' }}>Due Date</th>
                <th className="py-2.5 px-5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Status</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices && invoices.length > 0 ? invoices.map((invoice) => {
                const dueDate = new Date(invoice.created_at);
                dueDate.setDate(dueDate.getDate() + 30);
                const isOverdue = dueDate < new Date() && invoice.status !== 'paid';
                const isPaid = invoice.status === 'paid' || invoice.total_amount_paisa === 0;
                return (
                  <tr
                    key={invoice.id}
                    className="row-hover"
                    style={{ borderBottom: '1px solid #f5f5f7' }}
                  >
                    <td className="py-3.5 px-5 font-medium text-[#1d1d1f]">{invoice.invoice_number}</td>
                    <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: '#6e6e73' }}>
                      {invoice.period_start && invoice.period_end
                        ? `${new Date(invoice.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(invoice.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-semibold text-[#1d1d1f]">
                      ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 hidden md:table-cell" style={{ color: isOverdue ? '#0071e3' : '#6e6e73' }}>
                      {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          isPaid
                            ? { background: 'rgba(29,122,60,0.12)', color: '#1d7a3c' }
                            : invoice.status === 'pending'
                            ? { background: 'rgba(154,100,0,0.12)', color: '#9a6400' }
                            : { background: '#f5f5f7', color: '#6e6e73' }
                        }
                      >
                        {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/customer/billing/${invoice.id}`}
                          className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[#1d1d1f]"
                          style={{ color: '#0071e3' }}
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        {invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.total_amount_paisa > 0 && (
                          <Link
                            href={`/customer/billing/${invoice.id}/pay`}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg text-[#1d1d1f] transition-opacity hover:opacity-90"
                            style={{ background: '#1d1d1f' }}
                          >
                            Pay Now
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm" style={{ color: '#a1a1a6' }}>No invoices found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coin Payments */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f7' }}>
          <h2 className="font-semibold text-[#1d1d1f] flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: '#9a6400' }} />
            Recent Coin Payments
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>This month&apos;s dispensed coin transactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Date</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Machine</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: '#86868b' }}>Location</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {coinPayments && coinPayments.length > 0 ? coinPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid #f5f5f7' }}
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="text-[#1d1d1f]">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {' '}
                    <span style={{ color: '#86868b' }}>
                      {new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-[#1d1d1f]">{payment.vending_machines?.name || 'N/A'}</td>
                  <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: '#6e6e73' }}>{payment.vending_machines?.location || 'N/A'}</td>
                  <td className="py-3.5 px-5 text-right font-semibold text-[#1d1d1f]">
                    ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm" style={{ color: '#a1a1a6' }}>No coin payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RFID Payments */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f7' }}>
          <h2 className="font-semibold text-[#1d1d1f] flex items-center gap-2">
            <Nfc className="w-4 h-4" style={{ color: '#6e6e73' }} />
            Recent RFID Payments
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>This month&apos;s dispensed RFID card taps</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Date</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Machine</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: '#86868b' }}>Location</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#86868b' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rfidPayments && rfidPayments.length > 0 ? rfidPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid #f5f5f7' }}
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="text-[#1d1d1f]">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {' '}
                    <span style={{ color: '#86868b' }}>
                      {new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-[#1d1d1f]">{payment.vending_machines?.name || 'N/A'}</td>
                  <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: '#6e6e73' }}>{payment.vending_machines?.location || 'N/A'}</td>
                  <td className="py-3.5 px-5 text-right font-semibold text-[#1d1d1f]">
                    ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm" style={{ color: '#a1a1a6' }}>No RFID payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
