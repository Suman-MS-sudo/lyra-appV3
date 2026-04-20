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
    .select('id, email, role, organization_id, organizations!organization_id(id, name, contact_email, address, phone)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  // Get invoice (exclude draft and paid invoices)
  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name, contact_email, address, phone)')
    .eq('id', params.invoiceId)
    .eq('organization_id', profile?.organization_id)
    .neq('status', 'draft')
    .single();

  if (!invoice) {
    redirect('/customer/billing');
  }

  if (invoice.status === 'paid') {
    redirect(`/customer/billing/${invoice.id}`);
  }

  if (invoice.total_amount_paisa <= 0) {
    redirect(`/customer/billing/${invoice.id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pay Invoice</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Invoice {invoice.invoice_number}</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Details</h2>
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="flex justify-between py-3">
            <span className="text-gray-500 dark:text-gray-400">Organization</span>
            <span className="font-medium text-gray-900 dark:text-white">{invoice.organizations?.name}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-gray-500 dark:text-gray-400">Invoice Number</span>
            <span className="font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-gray-500 dark:text-gray-400">Billing Period</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {invoice.period_start && invoice.period_end
                ? `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-base font-semibold text-gray-900 dark:text-white">Total Amount</span>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
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
