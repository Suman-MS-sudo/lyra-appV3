import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PaymentForm from './PaymentForm';

export default async function PaymentPage({ params }: { params: { invoiceId: string } }) {
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
    .select('*, organizations(id, name, contact_email, address, phone)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  // Get invoice
  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations(id, name, contact_email, address, phone)')
    .eq('id', params.invoiceId)
    .eq('organization_id', profile?.organization_id)
    .single();

  if (!invoice) {
    redirect('/customer/billing');
  }

  if (invoice.status === 'paid' || invoice.status === 'draft') {
    redirect(`/customer/billing/${invoice.id}`);
  }

  if (invoice.total_amount_paisa <= 0) {
    redirect(`/customer/billing/${invoice.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Pay Invoice</h1>
          <p className="text-sm text-gray-500 mt-1">Invoice {invoice.invoice_number}</p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Organization:</span>
                <span className="font-medium text-gray-900">{invoice.organizations?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Billing Period:</span>
                <span className="font-medium text-gray-900">
                  {invoice.period_start && invoice.period_end
                    ? `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <PaymentForm
            invoiceId={invoice.id}
            amount={invoice.total_amount_paisa}
            organizationName={invoice.organizations?.name || 'Unknown'}
            invoiceNumber={invoice.invoice_number}
            customerName={profile?.name || user.email || 'Customer'}
            customerEmail={profile?.email || user.email || ''}
            customerPhone={invoice.organizations?.phone || ''}
          />
        </div>
      </main>
    </div>
  );
}
