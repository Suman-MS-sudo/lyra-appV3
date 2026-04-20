import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { FileText, Calendar, Building2, Download, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
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
    .select('id, email, role, organization_id, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  // Get invoice (show pending and paid only)
  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', params.invoiceId)
    .eq('organization_id', profile?.organization_id)
    .in('status', ['pending', 'paid'])
    .single();

  if (!invoice) {
    redirect('/customer/billing');
  }

  const dueDate = new Date(invoice.created_at);
  dueDate.setDate(dueDate.getDate() + 30);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/customer/billing" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          ← Back to Billing
        </Link>
        {invoice.status !== 'paid' && invoice.total_amount_paisa > 0 && (
          <Link
            href={`/customer/billing/${invoice.id}/pay`}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 font-medium text-sm"
          >
            Pay Now
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 sm:p-8">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Lyra Enterprises</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Chennai, Tamil Nadu, India</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Invoice</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{invoice.invoice_number}</div>
            <div className="mt-2">
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                invoice.status === 'paid' || invoice.total_amount_paisa === 0
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
              }`}>
                {invoice.total_amount_paisa === 0 ? 'Nil' : invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Details */}
        <div className="grid md:grid-cols-2 gap-8 pb-8 mb-8 border-b border-gray-200 dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-semibold text-gray-900 dark:text-white">{invoice.organizations?.name}</p>
            {invoice.organizations?.address && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{invoice.organizations.address}</p>}
            {invoice.organizations?.contact_email && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{invoice.organizations.contact_email}</p>}
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
                <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Description</p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Coin payment collection service for vending machines during the billing period.
            </p>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-200 dark:border-gray-800">
            <span>Total</span>
            <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Status messages */}
        {invoice.total_amount_paisa === 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
              ✓ No payment required for this period. No vending machine transactions were recorded during this billing cycle.
            </p>
          </div>
        )}
        {invoice.status === 'paid' && invoice.total_amount_paisa > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">✓ This invoice has been paid. Thank you!</p>
          </div>
        )}
        {invoice.status !== 'paid' && invoice.total_amount_paisa > 0 && (
          <Link
            href={`/customer/billing/${invoice.id}/pay`}
            className="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 font-medium text-center transition-opacity"
          >
            Pay Now with Razorpay
          </Link>
        )}
      </div>
    </main>
  );
}
