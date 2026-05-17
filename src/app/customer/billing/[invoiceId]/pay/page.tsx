import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PaymentForm from './PaymentForm';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

export default async function PaymentPage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, organization_id, organizations!organization_id(id, name, contact_email, address, phone)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name, contact_email, address, phone)')
    .eq('id', params.invoiceId)
    .eq('organization_id', profile?.organization_id)
    .neq('status', 'draft')
    .single();

  if (!invoice) redirect('/customer/billing');
  if (invoice.status === 'paid') redirect(`/customer/billing/${invoice.id}`);
  if (invoice.total_amount_paisa <= 0) redirect(`/customer/billing/${invoice.id}`);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pay Invoice</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.42)' }}>Invoice {invoice.invoice_number}</p>
      </div>

      <div className="rounded-2xl p-6" style={CARD}>
        <h2 className="font-semibold text-white mb-4">Payment Details</h2>
        <div className="space-y-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            ['Organization', invoice.organizations?.name],
            ['Invoice Number', invoice.invoice_number],
            ['Billing Period', invoice.period_start && invoice.period_end
              ? `${new Date(invoice.period_start).toLocaleDateString('en-IN')} — ${new Date(invoice.period_end).toLocaleDateString('en-IN')}`
              : 'N/A'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>{label}</span>
              <span className="text-sm font-medium text-white">{value}</span>
            </div>
          ))}
          <div className="flex justify-between py-3">
            <span className="text-base font-semibold text-white">Total Amount</span>
            <span className="text-2xl font-bold" style={{ color: '#F472B6' }}>
              ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <PaymentForm
            invoiceId={invoice.id}
            amount={invoice.total_amount_paisa}
            organizationName={invoice.organizations?.name || 'Unknown'}
            invoiceNumber={invoice.invoice_number}
            customerName={user.user_metadata?.full_name || user.email || 'Customer'}
            customerEmail={profile?.email || user.email || ''}
            customerPhone={invoice.organizations?.phone || ''}
          />
        </div>
      </div>
    </main>
  );
}
