import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { FileText, Coins, ArrowUpRight, Nfc } from 'lucide-react';
import Link from 'next/link';

import { StatTile, PageHeader } from '@/components/ui/kit';
export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
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
      <PageHeader title="Billing" subtitle="Invoices and payment history" />

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 ui-statrow">
        {/* Pending Amount */}
        <StatTile tone="sky" icon={FileText} label={`Pending Amount`} value={`₹${(pendingAmount / 100).toFixed(2)}`} />

        {/* Coin Revenue */}
        <StatTile tone="mint" icon={Coins} label={`Coin Revenue (Month)`} value={`₹${(totalCoinRevenue / 100).toFixed(2)}`} />

        {/* RFID Revenue */}
        <StatTile tone="butter" icon={Nfc} label={`RFID Revenue (Month)`} value={`₹${(totalRfidRevenue / 100).toFixed(2)}`} />

        {/* Total Invoices */}
        <StatTile tone="peach" icon={FileText} label={`Total Invoices`} value={String(invoices?.length || 0)} />
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: 'var(--accent-ink)' }} />
            Invoices
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Invoice #</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: 'var(--subtle)' }}>Period</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Amount</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--subtle)' }}>Due Date</th>
                <th className="py-2.5 px-5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Status</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Actions</th>
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
                    style={{ borderBottom: '1px solid var(--surface-2)' }}
                  >
                    <td className="py-3.5 px-5 font-medium text-[var(--fg)]">{invoice.invoice_number}</td>
                    <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: 'var(--muted)' }}>
                      {invoice.period_start && invoice.period_end
                        ? `${new Date(invoice.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(invoice.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-semibold text-[var(--fg)]">
                      ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 hidden md:table-cell" style={{ color: isOverdue ? 'var(--accent)' : 'var(--muted)' }}>
                      {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          isPaid
                            ? { background: 'rgba(29,122,60,0.12)', color: 'var(--success)' }
                            : invoice.status === 'pending'
                            ? { background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' }
                            : { background: 'var(--surface-2)', color: 'var(--muted)' }
                        }
                      >
                        {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/customer/billing/${invoice.id}`}
                          className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--fg)]"
                          style={{ color: 'var(--accent-ink)' }}
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        {invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.total_amount_paisa > 0 && (
                          <Link
                            href={`/customer/billing/${invoice.id}/pay`}
                            className="px-2.5 py-1 text-xs font-medium lyra-chamfer text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--accent)' }}
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
                  <td colSpan={6} className="py-16 text-center text-sm" style={{ color: 'var(--subtle)' }}>No invoices found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coin Payments */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            Recent Coin Payments
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>This month&apos;s dispensed coin transactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Date</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Machine</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: 'var(--subtle)' }}>Location</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {coinPayments && coinPayments.length > 0 ? coinPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid var(--surface-2)' }}
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="text-[var(--fg)]">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {' '}
                    <span style={{ color: 'var(--subtle)' }}>
                      {new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-[var(--fg)]">{payment.vending_machines?.name || 'N/A'}</td>
                  <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: 'var(--muted)' }}>{payment.vending_machines?.location || 'N/A'}</td>
                  <td className="py-3.5 px-5 text-right font-semibold text-[var(--fg)]">
                    ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm" style={{ color: 'var(--subtle)' }}>No coin payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RFID Payments */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
            <Nfc className="w-4 h-4" style={{ color: 'var(--muted)' }} />
            Recent RFID Payments
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>This month&apos;s dispensed RFID card taps</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Date</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Machine</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: 'var(--subtle)' }}>Location</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rfidPayments && rfidPayments.length > 0 ? rfidPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid var(--surface-2)' }}
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="text-[var(--fg)]">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {' '}
                    <span style={{ color: 'var(--subtle)' }}>
                      {new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-[var(--fg)]">{payment.vending_machines?.name || 'N/A'}</td>
                  <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: 'var(--muted)' }}>{payment.vending_machines?.location || 'N/A'}</td>
                  <td className="py-3.5 px-5 text-right font-semibold text-[var(--fg)]">
                    ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm" style={{ color: 'var(--subtle)' }}>No RFID payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
