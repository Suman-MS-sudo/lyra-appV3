import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: '#f5f5f7',
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, organization_id, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', params.invoiceId)
    .eq('organization_id', profile?.organization_id)
    .in('status', ['pending', 'paid'])
    .single();

  if (!invoice) redirect('/customer/billing');

  const dueDate = new Date(invoice.created_at);
  dueDate.setDate(dueDate.getDate() + 30);

  const isPaid = invoice.status === 'paid' || invoice.total_amount_paisa === 0;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/customer/billing"
          className="text-sm transition-colors hover:text-[#1d1d1f]"
          style={{ color: '#6e6e73' }}
        >
          ← Back to Billing
        </Link>
        {invoice.status !== 'paid' && invoice.total_amount_paisa > 0 && (
          <Link
            href={`/customer/billing/${invoice.id}/pay`}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#1d1d1f] transition-opacity hover:opacity-90"
            style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            Pay Now
          </Link>
        )}
      </div>

      <div className="rounded-2xl p-6 sm:p-8" style={CARD}>
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f] mb-1">Lyra Enterprises</h1>
            <p className="text-sm" style={{ color: '#6e6e73' }}>Chennai, Tamil Nadu, India</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#86868b' }}>Invoice</p>
            <p className="text-lg font-bold text-[#1d1d1f]">{invoice.invoice_number}</p>
            <div className="mt-2">
              <span
                className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full"
                style={isPaid
                  ? { background: 'rgba(29,122,60,0.12)', color: '#1d7a3c' }
                  : { background: 'rgba(154,100,0,0.12)', color: '#9a6400' }
                }
              >
                {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Details */}
        <div className="grid md:grid-cols-2 gap-8 pb-8 mb-8" style={{ borderBottom: '1px solid #f5f5f7' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#86868b' }}>Bill To</p>
            <p className="font-semibold text-[#1d1d1f]">{invoice.organizations?.name}</p>
            {invoice.organizations?.address && <p className="text-sm mt-1" style={{ color: '#6e6e73' }}>{invoice.organizations.address}</p>}
            {invoice.organizations?.contact_email && <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>{invoice.organizations.contact_email}</p>}
          </div>
          <div className="space-y-2.5">
            {[
              ['Invoice Date', new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
              ['Due Date', dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
              ['Billing Period', invoice.period_start && invoice.period_end
                ? `${new Date(invoice.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(invoice.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-sm" style={{ color: '#6e6e73' }}>{label}</span>
                <span className="text-sm font-medium text-[#1d1d1f] text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#86868b' }}>Description</p>
          <div className="rounded-xl p-4" style={{ background: '#f5f5f7', border: '1px solid #f5f5f7' }}>
            <p className="text-sm" style={{ color: '#3a3a3c' }}>
              Coin payment collection service for vending machines during the billing period.
            </p>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm" style={{ color: '#6e6e73' }}>
            <span>Subtotal</span>
            <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-[#1d1d1f] pt-3" style={{ borderTop: '1px solid #f5f5f7' }}>
            <span>Total</span>
            <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Status messages */}
        {invoice.total_amount_paisa === 0 && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(29,122,60,0.12)', border: '1px solid rgba(29,122,60,0.12)' }}>
            <p className="text-sm font-medium" style={{ color: '#1d7a3c' }}>
              ✓ No payment required for this period. No vending machine transactions were recorded during this billing cycle.
            </p>
          </div>
        )}
        {invoice.status === 'paid' && invoice.total_amount_paisa > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(29,122,60,0.12)', border: '1px solid rgba(29,122,60,0.12)' }}>
            <p className="text-sm font-medium" style={{ color: '#1d7a3c' }}>✓ This invoice has been paid. Thank you!</p>
          </div>
        )}
        {invoice.status !== 'paid' && invoice.total_amount_paisa > 0 && (
          <Link
            href={`/customer/billing/${invoice.id}/pay`}
            className="block w-full py-3 rounded-xl font-medium text-center text-[#1d1d1f] transition-opacity hover:opacity-90"
            style={{ background: '#1d1d1f', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}
          >
            Pay Now with Razorpay
          </Link>
        )}
      </div>
    </main>
  );
}
