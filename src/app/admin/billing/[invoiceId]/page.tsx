import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { SendInvoiceEmailButton } from '@/components/SendInvoiceEmailButton';

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

  if (profile?.role !== 'admin') {
    redirect('/customer/dashboard');
  }

  // Fetch invoice with organization details
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

  if (!invoice) {
    redirect('/admin/billing');
  }

  const formatCurrency = (paisa: number) => {
    return `₹${(paisa / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Billing
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Invoice {invoice.invoice_number}
              </h1>
              <p className="text-gray-600 mt-1">
                {format(new Date(invoice.created_at), 'MMMM dd, yyyy')}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <SendInvoiceEmailButton invoiceId={invoice.id} />
            </div>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Status Badge */}
          <div className="flex justify-end mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold uppercase ${getStatusColor(invoice.status)}`}>
              {invoice.status}
            </span>
          </div>

          {/* Bill From/To */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">FROM</h3>
              <p className="font-bold text-gray-900">Lyra Enterprises</p>
              <p className="text-gray-600">10/21, Vasuki Street, Cholapuram</p>
              <p className="text-gray-600">Ambattur, Chennai - 600053</p>
              <p className="text-gray-600">+91 81223 78860</p>
              <p className="text-gray-600">lyraenterprisessales@gmail.com</p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">BILL TO</h3>
              <p className="font-bold text-gray-900">{invoice.organizations.name}</p>
              {invoice.organizations.address && (
                <p className="text-gray-600">{invoice.organizations.address}</p>
              )}
              {invoice.organizations.city && (
                <p className="text-gray-600">
                  {invoice.organizations.city}, {invoice.organizations.state} {invoice.organizations.zip_code}
                </p>
              )}
              {invoice.organizations.contact_email && (
                <p className="text-gray-600">{invoice.organizations.contact_email}</p>
              )}
              {invoice.organizations.gstin && (
                <p className="text-gray-600 mt-2">GSTIN: {invoice.organizations.gstin}</p>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-3 gap-6 mb-8 pb-8 border-b">
            <div>
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Billing Period</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(invoice.period_start), 'MMM dd')} - {format(new Date(invoice.period_end), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold text-gray-900">
                {invoice.status === 'paid' && invoice.paid_at
                  ? format(new Date(invoice.paid_at), 'MMM dd, yyyy')
                  : 'Upon Receipt'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 text-sm font-semibold text-gray-600">Description</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-4 text-gray-900">
                    <p className="font-medium">Coin Payment Transactions</p>
                    <p className="text-sm text-gray-600">
                      Vending machine coin payments for the period {format(new Date(invoice.period_start), 'MMM dd')} - {format(new Date(invoice.period_end), 'MMM dd, yyyy')}
                    </p>
                  </td>
                  <td className="py-4 text-right text-gray-900">
                    {invoice.total_coin_transactions}
                  </td>
                  <td className="py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(invoice.total_amount_paisa)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80">
              <div className="flex justify-between py-3 border-t">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(invoice.total_amount_paisa)}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-gray-600">Tax (0%)</span>
                <span className="font-semibold">₹0.00</span>
              </div>
              <div className="flex justify-between py-4 border-t-2 border-gray-900">
                <span className="text-lg font-bold">Total Amount</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(invoice.total_amount_paisa)}
                </span>
              </div>
              
              {invoice.amount_paid_paisa > 0 && (
                <>
                  <div className="flex justify-between py-3 border-t text-green-600">
                    <span>Amount Paid</span>
                    <span className="font-semibold">-{formatCurrency(invoice.amount_paid_paisa)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-900">
                    <span className="font-bold">Balance Due</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(invoice.amount_due_paisa)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment Info */}
          {invoice.status === 'paid' && invoice.paid_at ? (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">
                ✓ Paid on {format(new Date(invoice.paid_at), 'MMMM dd, yyyy')}
              </p>
              {invoice.razorpay_payment_id && (
                <p className="text-sm text-green-700 mt-1">
                  Payment ID: {invoice.razorpay_payment_id}
                </p>
              )}
            </div>
          ) : invoice.status === 'pending' || invoice.status === 'overdue' ? (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-800 font-medium">
                    Payment Required
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Amount Due: {formatCurrency(invoice.amount_due_paisa)}
                  </p>
                </div>
                <Link
                  href={`/admin/billing/${invoice.id}/pay`}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Pay Now
                </Link>
              </div>
            </div>
          ) : null}

          {/* Notes */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Notes</h3>
            {invoice.notes ? (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900 font-medium">📋 Consolidated Invoice</p>
                <p className="text-sm text-amber-800 mt-1">{invoice.notes}</p>
              </div>
            ) : null}
            <p className="text-gray-600">
              Thank you for your business. Payment is due upon receipt. For any questions regarding this invoice, please contact our billing department.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
