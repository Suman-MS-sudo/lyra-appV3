import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { FileText, Coins, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
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

  const totalCoinRevenue = coinPayments?.reduce((sum, payment) => sum + (payment.amount_in_paisa || 0), 0) || 0;
  const pendingAmount = invoices
    ?.filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Invoices and payment history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Pending Amount */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(244,63,94,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(244,63,94,0.18)' }}>
            <FileText className="w-5 h-5" style={{ color: '#F43F5E' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Pending Amount</p>
          <p className="text-2xl font-bold text-white">₹{(pendingAmount / 100).toFixed(2)}</p>
        </div>

        {/* Coin Revenue */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(251,191,36,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(251,191,36,0.18)' }}>
            <Coins className="w-5 h-5" style={{ color: '#FBBF24' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Coin Revenue (Month)</p>
          <p className="text-2xl font-bold text-white">₹{(totalCoinRevenue / 100).toFixed(2)}</p>
        </div>

        {/* Total Invoices */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(96,165,250,0.18)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(96,165,250,0.18)' }}>
            <FileText className="w-5 h-5" style={{ color: '#60A5FA' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Total Invoices</p>
          <p className="text-2xl font-bold text-white">{invoices?.length || 0}</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: '#F472B6' }} />
            Invoices
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Invoice #</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Period</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Amount</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Due Date</th>
                <th className="py-2.5 px-5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Status</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Actions</th>
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
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <td className="py-3.5 px-5 font-medium text-white">{invoice.invoice_number}</td>
                    <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {invoice.period_start && invoice.period_end
                        ? `${new Date(invoice.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(invoice.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-semibold text-white">
                      ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 hidden md:table-cell" style={{ color: isOverdue ? '#FDA4AF' : 'rgba(255,255,255,0.45)' }}>
                      {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          isPaid
                            ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                            : invoice.status === 'pending'
                            ? { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }
                            : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
                        }
                      >
                        {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/customer/billing/${invoice.id}`}
                          className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-white"
                          style={{ color: '#F472B6' }}
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        {invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.total_amount_paisa > 0 && (
                          <Link
                            href={`/customer/billing/${invoice.id}/pay`}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg text-white transition-opacity hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
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
                  <td colSpan={6} className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No invoices found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coin Payments */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: '#FBBF24' }} />
            Recent Coin Payments
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>This month&apos;s dispensed coin transactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Date</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Machine</th>
                <th className="py-2.5 px-5 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Location</th>
                <th className="py-2.5 px-5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {coinPayments && coinPayments.length > 0 ? coinPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="row-hover"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="text-white">
                      {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {' '}
                    <span style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {new Date(payment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-white">{payment.vending_machines?.name || 'N/A'}</td>
                  <td className="py-3.5 px-5 hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.45)' }}>{payment.vending_machines?.location || 'N/A'}</td>
                  <td className="py-3.5 px-5 text-right font-semibold text-white">
                    ₹{((payment.amount_in_paisa || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No coin payments found this month</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
