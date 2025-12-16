import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PaymentForm from '@/components/PaymentForm';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

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
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invoice Not Found</h1>
            <p className="text-gray-600 mb-6">The invoice you're looking for doesn't exist.</p>
            <Link 
              href="/admin/billing"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={20} />
              Back to Billing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if already paid
  if (invoice.status === 'paid' && invoice.amount_due_paisa === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Complete</h1>
              <p className="text-gray-600">This invoice has been fully paid.</p>
            </div>
            
            <div className="space-y-4 mb-8 border-t pt-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-semibold">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Organization:</span>
                <span className="font-semibold">{invoice.organizations.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold">₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid On:</span>
                <span className="text-green-600">
                  {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <Link
              href="/admin/billing"
              className="block w-full text-center bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200"
            >
              Back to Billing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if link is still valid (30 days from creation)
  const createdAt = new Date(invoice.created_at);
  const expiryDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiryDate;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Billing
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold mb-6">Pay Invoice</h1>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Number:</span>
              <span className="font-semibold">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Organization:</span>
              <span className="font-semibold">{invoice.organizations.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Period:</span>
              <span className="font-semibold">
                {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-semibold">₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
            </div>
            {invoice.amount_paid_paisa > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="text-green-600">₹{(invoice.amount_paid_paisa / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg border-t pt-4">
              <span className="font-semibold">Amount Due:</span>
              <span className="font-bold text-blue-600">
                ₹{(invoice.amount_due_paisa / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payment Link Valid Until:</span>
              <span className={isExpired ? 'text-red-600' : 'text-green-600'}>
                {expiryDate.toLocaleDateString()}
              </span>
            </div>
          </div>

          {isExpired ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800 font-semibold mb-2">Payment Link Expired</p>
              <p className="text-red-600 text-sm">
                This payment link expired on {expiryDate.toLocaleDateString()}. 
                Please contact admin for a new payment link.
              </p>
            </div>
          ) : (
            <PaymentForm 
              invoiceId={invoice.id}
              amount={invoice.amount_due_paisa}
              invoiceNumber={invoice.invoice_number}
              organizationName={invoice.organizations.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
