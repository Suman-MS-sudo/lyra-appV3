import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PaymentForm from '@/components/PaymentForm';
import Link from 'next/link';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

export default async function PaymentPage({
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

  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations(name, contact_email)')
    .eq('id', invoiceId)
    .single();

  if (!invoice) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl p-8 text-center space-y-4" style={CARD}>
          <h1 className="text-2xl font-bold text-white">Invoice Not Found</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>The invoice you're looking for doesn't exist.</p>
          <Link
            href="/admin/billing"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
          >
            ← Back to Billing
          </Link>
        </div>
      </main>
    );
  }

  if (invoice.status === 'paid' && invoice.amount_due_paisa === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl p-8" style={CARD}>
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: 'rgba(52,211,153,0.15)' }}
            >
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Complete</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>This invoice has been fully paid.</p>
          </div>

          <div className="space-y-0 mb-8" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              ['Invoice Number', invoice.invoice_number],
              ['Organization', invoice.organizations.name],
              ['Total Amount', `₹${(invoice.total_amount_paisa / 100).toFixed(2)}`],
              ['Paid On', invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-IN') : 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
          </div>

          <Link
            href="/admin/billing"
            className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
          >
            ← Back to Billing
          </Link>
        </div>
      </main>
    );
  }

  const createdAt = new Date(invoice.created_at);
  const expiryDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiryDate;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/billing"
          className="text-sm transition-colors hover:text-white mb-2 inline-block"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          ← Back to Billing
        </Link>
        <h1 className="text-2xl font-bold text-white">Pay Invoice</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{invoice.invoice_number}</p>
      </div>

      <div className="rounded-2xl p-6" style={CARD}>
        <h2 className="font-semibold text-white mb-4">Payment Details</h2>
        <div className="space-y-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            ['Invoice Number', invoice.invoice_number],
            ['Organization', invoice.organizations.name],
            ['Period', `${new Date(invoice.period_start).toLocaleDateString('en-IN')} – ${new Date(invoice.period_end).toLocaleDateString('en-IN')}`],
            ['Total Amount', `₹${(invoice.total_amount_paisa / 100).toFixed(2)}`],
            ...(invoice.amount_paid_paisa > 0
              ? [['Amount Paid', `₹${(invoice.amount_paid_paisa / 100).toFixed(2)}`]]
              : []),
            ['Link Valid Until', expiryDate.toLocaleDateString('en-IN')],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>{label}</span>
              <span
                className="text-sm font-medium"
                style={{
                  color: label === 'Link Valid Until'
                    ? (isExpired ? '#FCA5A5' : '#6EE7B7')
                    : '#f3f4f6'
                }}
              >
                {value}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-4">
            <span className="font-semibold text-white">Amount Due</span>
            <span className="text-xl font-bold" style={{ color: '#F472B6' }}>
              ₹{(invoice.amount_due_paisa / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {isExpired ? (
          <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>Payment Link Expired</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(252,165,165,0.70)' }}>
              This payment link expired on {expiryDate.toLocaleDateString('en-IN')}. Please contact admin for a new payment link.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <PaymentForm
              invoiceId={invoice.id}
              amount={invoice.amount_due_paisa}
              invoiceNumber={invoice.invoice_number}
              organizationName={invoice.organizations.name}
            />
          </div>
        )}
      </div>
    </main>
  );
}
