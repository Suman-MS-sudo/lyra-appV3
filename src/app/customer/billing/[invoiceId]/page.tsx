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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {invoice.organizations?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/customer/billing"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Back to Billing
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Lyra Enterprises</h2>
              <p className="text-sm text-gray-600">
                Chennai, Tamil Nadu<br />
                India
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Invoice Number</div>
              <div className="text-lg font-bold text-gray-900">{invoice.invoice_number}</div>
            </div>
          </div>

          {/* Bill To & Invoice Details */}
          <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b">
            <div>
              <div className="text-sm text-gray-500 mb-2">Bill To</div>
              <div className="font-semibold text-gray-900">{invoice.organizations?.name}</div>
              {invoice.organizations?.address && (
                <p className="text-sm text-gray-600 mt-1">{invoice.organizations.address}</p>
              )}
              {invoice.organizations?.contact_email && (
                <p className="text-sm text-gray-600 mt-1">{invoice.organizations.contact_email}</p>
              )}
            </div>
            <div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Invoice Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Due Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {dueDate.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Billing Period:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {invoice.period_start && invoice.period_end
                      ? `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status:</span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.status === 'paid' || invoice.total_amount_paisa === 0
                        ? 'bg-green-100 text-green-800'
                        : invoice.status === 'draft'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {invoice.total_amount_paisa === 0 ? 'No Payment Needed' : invoice.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="mb-8">
            <div className="text-sm font-semibold text-gray-900 mb-4">Description</div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">
                Coin payment collection service for vending machines during the billing period.
              </p>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="space-y-3 mb-8">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal:</span>
              <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t">
              <span>Total Amount:</span>
              <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Actions */}
          {invoice.total_amount_paisa === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                ✓ No payment is required for this period. No vending machine transactions were recorded during this billing cycle.
              </p>
            </div>
          )}

          {invoice.status !== 'paid' && invoice.total_amount_paisa > 0 && (
            <div className="flex gap-3">
              <Link
                href={`/customer/billing/${invoice.id}/pay`}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium text-center"
              >
                Pay Now with Razorpay
              </Link>
            </div>
          )}

          {invoice.status === 'paid' && invoice.total_amount_paisa > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✓ This invoice has been paid. Thank you!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
