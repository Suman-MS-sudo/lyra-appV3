import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { SendInvoiceEmailButton } from '@/components/SendInvoiceEmailButton';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

export default async function InvoiceDetailPage({
  params
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select(`
      *,
      organizations (
        id,
        name,
        contact_email,
        contact_phone,
        address,
        city,
        state,
        zip_code,
        gstin,
        pan
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (!invoice) redirect('/admin/billing');

  const formatCurrency = (paisa: number) => `₹${(paisa / 100).toFixed(2)}`;

  const getStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'paid': return { background: 'rgba(29,122,60,0.12)', color: 'var(--success)' };
      case 'pending': return { background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' };
      case 'overdue': return { background: 'rgba(0,0,0,0.04)', color: 'var(--danger)' };
      default: return { background: 'var(--surface-2)', color: 'var(--muted)' };
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/billing"
            className="text-sm transition-colors hover:text-[var(--fg)] mb-2 inline-block"
            style={{ color: 'var(--muted)' }}
          >
            ← Back to Billing
          </Link>
          <h1 className="ui-title">Invoice {invoice.invoice_number}</h1>
          <p className="ui-subtitle">
            {format(new Date(invoice.created_at), 'MMMM dd, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <SendInvoiceEmailButton invoiceId={invoice.id} />
        </div>
      </div>

      {/* Invoice Card */}
      <div className="rounded-2xl p-6 sm:p-8 space-y-8" style={CARD}>
        {/* Status badge */}
        <div className="flex justify-end">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
            style={getStatusStyle(invoice.status)}
          >
            {invoice.status}
          </span>
        </div>

        {/* FROM / BILL TO */}
        <div className="grid md:grid-cols-2 gap-8 pb-8" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>From</p>
            <p className="font-bold text-[var(--fg)]">Lyra Enterprises</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>10/21, Vasuki Street, Cholapuram</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Ambattur, Chennai - 600053</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>+91 81223 78860</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>lyraenterprisessales@gmail.com</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>Bill To</p>
            <p className="font-bold text-[var(--fg)]">{invoice.organizations.name}</p>
            {invoice.organizations.address && (
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{invoice.organizations.address}</p>
            )}
            {invoice.organizations.city && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {invoice.organizations.city}
                {invoice.organizations.state ? `, ${invoice.organizations.state}` : ''}
                {invoice.organizations.zip_code ? ` ${invoice.organizations.zip_code}` : ''}
              </p>
            )}
            {invoice.organizations.contact_email && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{invoice.organizations.contact_email}</p>
            )}
            {invoice.organizations.gstin && (
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>GSTIN: {invoice.organizations.gstin}</p>
            )}
          </div>
        </div>

        {/* Invoice meta grid */}
        <div className="grid grid-cols-3 gap-6 pb-8" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          {[
            ['Invoice Number', invoice.invoice_number],
            ['Billing Period', `${format(new Date(invoice.period_start), 'MMM dd')} – ${format(new Date(invoice.period_end), 'MMM dd, yyyy')}`],
            ['Due Date', invoice.status === 'paid' && invoice.paid_at
              ? format(new Date(invoice.paid_at), 'MMM dd, yyyy')
              : 'Upon Receipt'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
              <p className="font-semibold text-[var(--fg)] text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* Line Items */}
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
              <th className="text-left pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Description</th>
              <th className="text-right pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Quantity</th>
              <th className="text-right pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-4">
                <p className="font-medium text-[var(--fg)]">Coin Payment Transactions</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                  Vending machine coin payments for the period {format(new Date(invoice.period_start), 'MMM dd')} – {format(new Date(invoice.period_end), 'MMM dd, yyyy')}
                </p>
              </td>
              <td className="py-4 text-right text-[var(--fg)]">{invoice.total_coin_transactions}</td>
              <td className="py-4 text-right font-semibold text-[var(--fg)]">{formatCurrency(invoice.total_amount_paisa)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72">
            <div className="flex justify-between py-3" style={{ borderTop: '1px solid var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Subtotal</span>
              <span className="text-sm font-medium text-[var(--fg)]">{formatCurrency(invoice.total_amount_paisa)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Tax (0%)</span>
              <span className="text-sm font-medium text-[var(--fg)]">₹0.00</span>
            </div>
            <div className="flex justify-between py-4" style={{ borderTop: '1px solid var(--subtle)' }}>
              <span className="font-bold text-[var(--fg)]">Total Amount</span>
              <span className="text-xl font-bold" style={{ color: 'var(--accent-ink)' }}>{formatCurrency(invoice.total_amount_paisa)}</span>
            </div>
            {invoice.amount_paid_paisa > 0 && (
              <>
                <div className="flex justify-between py-3" style={{ borderTop: '1px solid var(--surface-2)', color: 'var(--success)' }}>
                  <span className="text-sm">Amount Paid</span>
                  <span className="text-sm font-semibold">-{formatCurrency(invoice.amount_paid_paisa)}</span>
                </div>
                <div className="flex justify-between py-3" style={{ borderTop: '1px solid var(--subtle)' }}>
                  <span className="font-bold text-[var(--fg)]">Balance Due</span>
                  <span className="font-bold" style={{ color: 'var(--danger)' }}>{formatCurrency(invoice.amount_due_paisa)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment status banners */}
        {invoice.status === 'paid' && invoice.paid_at ? (
          <div className="rounded-xl p-4" style={{ background: 'rgba(29,122,60,0.12)', border: '1px solid rgba(29,122,60,0.12)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              ✓ Paid on {format(new Date(invoice.paid_at), 'MMMM dd, yyyy')}
            </p>
            {invoice.razorpay_payment_id && (
              <p className="text-xs mt-1" style={{ color: 'rgba(110,231,183,0.70)' }}>
                Payment ID: {invoice.razorpay_payment_id}
              </p>
            )}
          </div>
        ) : invoice.status === 'pending' || invoice.status === 'overdue' ? (
          <div
            className="rounded-xl p-4 flex items-center justify-between gap-4"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--accent-ink)' }}>Payment Required</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(147,197,253,0.70)' }}>
                Amount Due: {formatCurrency(invoice.amount_due_paisa)}
              </p>
            </div>
            <Link
              href={`/admin/billing/${invoice.id}/pay`}
              className="px-4 py-2 lyra-chamfer text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
              style={{ background: 'var(--accent)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              Pay Now
            </Link>
          </div>
        ) : null}

        {/* Notes */}
        <div className="pt-6" style={{ borderTop: '1px solid var(--surface-2)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>Notes</p>
          {invoice.notes && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(154,100,0,0.12)', border: '1px solid rgba(154,100,0,0.12)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>Consolidated Invoice</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(253,230,138,0.80)' }}>{invoice.notes}</p>
            </div>
          )}
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Thank you for your business. Payment is due upon receipt. For any questions regarding this invoice, please contact our billing department.
          </p>
        </div>
      </div>
    </main>
  );
}
