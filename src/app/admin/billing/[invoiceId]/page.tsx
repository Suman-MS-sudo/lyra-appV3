import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { SendInvoiceEmailButton } from '@/components/SendInvoiceEmailButton';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
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
      case 'paid': return { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' };
      case 'pending': return { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' };
      case 'overdue': return { background: 'rgba(244,63,94,0.15)', color: '#FCA5A5' };
      default: return { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)' };
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/billing"
            className="text-sm transition-colors hover:text-white mb-2 inline-block"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            ← Back to Billing
          </Link>
          <h1 className="text-2xl font-bold text-white">Invoice {invoice.invoice_number}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
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
        <div className="grid md:grid-cols-2 gap-8 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>From</p>
            <p className="font-bold text-white">Lyra Enterprises</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>10/21, Vasuki Street, Cholapuram</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Ambattur, Chennai - 600053</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>+91 81223 78860</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>lyraenterprisessales@gmail.com</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>Bill To</p>
            <p className="font-bold text-white">{invoice.organizations.name}</p>
            {invoice.organizations.address && (
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{invoice.organizations.address}</p>
            )}
            {invoice.organizations.city && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {invoice.organizations.city}
                {invoice.organizations.state ? `, ${invoice.organizations.state}` : ''}
                {invoice.organizations.zip_code ? ` ${invoice.organizations.zip_code}` : ''}
              </p>
            )}
            {invoice.organizations.contact_email && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{invoice.organizations.contact_email}</p>
            )}
            {invoice.organizations.gstin && (
              <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>GSTIN: {invoice.organizations.gstin}</p>
            )}
          </div>
        </div>

        {/* Invoice meta grid */}
        <div className="grid grid-cols-3 gap-6 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            ['Invoice Number', invoice.invoice_number],
            ['Billing Period', `${format(new Date(invoice.period_start), 'MMM dd')} – ${format(new Date(invoice.period_end), 'MMM dd, yyyy')}`],
            ['Due Date', invoice.status === 'paid' && invoice.paid_at
              ? format(new Date(invoice.paid_at), 'MMM dd, yyyy')
              : 'Upon Receipt'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.42)' }}>{label}</p>
              <p className="font-semibold text-white text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* Line Items */}
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Description</th>
              <th className="text-right pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Quantity</th>
              <th className="text-right pb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-4">
                <p className="font-medium text-white">Coin Payment Transactions</p>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
                  Vending machine coin payments for the period {format(new Date(invoice.period_start), 'MMM dd')} – {format(new Date(invoice.period_end), 'MMM dd, yyyy')}
                </p>
              </td>
              <td className="py-4 text-right text-white">{invoice.total_coin_transactions}</td>
              <td className="py-4 text-right font-semibold text-white">{formatCurrency(invoice.total_amount_paisa)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72">
            <div className="flex justify-between py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Subtotal</span>
              <span className="text-sm font-medium text-white">{formatCurrency(invoice.total_amount_paisa)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Tax (0%)</span>
              <span className="text-sm font-medium text-white">₹0.00</span>
            </div>
            <div className="flex justify-between py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>
              <span className="font-bold text-white">Total Amount</span>
              <span className="text-xl font-bold" style={{ color: '#F472B6' }}>{formatCurrency(invoice.total_amount_paisa)}</span>
            </div>
            {invoice.amount_paid_paisa > 0 && (
              <>
                <div className="flex justify-between py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: '#34D399' }}>
                  <span className="text-sm">Amount Paid</span>
                  <span className="text-sm font-semibold">-{formatCurrency(invoice.amount_paid_paisa)}</span>
                </div>
                <div className="flex justify-between py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>
                  <span className="font-bold text-white">Balance Due</span>
                  <span className="font-bold" style={{ color: '#FCA5A5' }}>{formatCurrency(invoice.amount_due_paisa)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment status banners */}
        {invoice.status === 'paid' && invoice.paid_at ? (
          <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <p className="text-sm font-medium" style={{ color: '#6EE7B7' }}>
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
            style={{ background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.25)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: '#93C5FD' }}>Payment Required</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(147,197,253,0.70)' }}>
                Amount Due: {formatCurrency(invoice.amount_due_paisa)}
              </p>
            </div>
            <Link
              href={`/admin/billing/${invoice.id}/pay`}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
              style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
            >
              Pay Now
            </Link>
          </div>
        ) : null}

        {/* Notes */}
        <div className="pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>Notes</p>
          {invoice.notes && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
              <p className="text-sm font-medium" style={{ color: '#FDE68A' }}>Consolidated Invoice</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(253,230,138,0.80)' }}>{invoice.notes}</p>
            </div>
          )}
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Thank you for your business. Payment is due upon receipt. For any questions regarding this invoice, please contact our billing department.
          </p>
        </div>
      </div>
    </main>
  );
}
