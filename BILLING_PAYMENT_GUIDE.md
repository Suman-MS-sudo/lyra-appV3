# Organization Billing & Payment System

## How Paid and Unpaid Amounts are Tracked

### Database Schema

#### 1. **organization_invoices** Table
Tracks invoices generated for each organization's coin payments:

```sql
- total_amount_paisa: Total coin payments in billing period (e.g., ₹500.00 = 50000 paisa)
- amount_paid_paisa: Amount already paid by organization (e.g., ₹300.00 = 30000 paisa)
- amount_due_paisa: Remaining balance (total_amount_paisa - amount_paid_paisa)
- status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled'
```

**Status Flow:**
- `draft` → Invoice created but not finalized
- `pending` → Invoice sent to organization, awaiting payment
- `paid` → Fully paid (amount_due_paisa = 0)
- `overdue` → Past due date, not paid
- `cancelled` → Invoice cancelled

#### 2. **organization_payments** Table
Records each payment transaction:

```sql
- amount_paisa: Payment amount
- status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded'
- razorpay_order_id: Razorpay order reference
- razorpay_payment_id: Razorpay payment reference
- payment_date: When payment was made
```

### Automatic Calculation

**Database Trigger:** `trigger_update_invoice_on_payment`

When a payment with `status='success'` is recorded:
1. Automatically adds `amount_paisa` to invoice's `amount_paid_paisa`
2. Recalculates `amount_due_paisa = total_amount_paisa - amount_paid_paisa`
3. Changes invoice status to `'paid'` when fully paid
4. Updates `updated_at` timestamp

**Example:**
```
Invoice: ₹1000.00 (total_amount_paisa = 100000)

Payment 1: ₹400.00 → amount_paid = 40000, amount_due = 60000, status = 'pending'
Payment 2: ₹600.00 → amount_paid = 100000, amount_due = 0, status = 'paid'
```

### How Billing Page Shows Data

```typescript
// Summary Cards
const totalPending = invoices
  .filter(inv => inv.status === 'pending')
  .reduce((sum, inv) => sum + inv.amount_due_paisa, 0);

const totalPaid = invoices
  .filter(inv => inv.status === 'paid')
  .reduce((sum, inv) => sum + inv.total_amount_paisa, 0);

const totalOverdue = invoices
  .filter(inv => inv.status === 'overdue')
  .reduce((sum, inv) => sum + inv.amount_due_paisa, 0);
```

---

## How to Generate Invoice with QR Payment

### Current State
✅ Invoice generation (database records)
✅ Manual payment recording
❌ Razorpay integration (not implemented)
❌ QR code generation (not implemented)
❌ Automatic payment verification (not implemented)

### Implementation Steps

#### Step 1: Create Razorpay Order API Route

Create: `src/app/api/billing/create-order/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { NextRequest, NextResponse } from 'next/server';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await request.json();

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get invoice details
    const { data: invoice, error } = await serviceSupabase
      .from('organization_invoices')
      .select('*, organizations(name, contact_email)')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: invoice.amount_due_paisa, // Amount in paisa
      currency: 'INR',
      receipt: invoice.invoice_number,
      notes: {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        organization_name: invoice.organizations.name,
      },
    });

    // Update invoice with Razorpay order ID
    await serviceSupabase
      .from('organization_invoices')
      .update({ razorpay_order_id: order.id })
      .eq('id', invoiceId);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      organizationName: invoice.organizations.name,
      invoiceNumber: invoice.invoice_number,
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

#### Step 2: Create Payment Page with QR Code

Create: `src/app/admin/billing/[invoiceId]/pay/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import PaymentForm from '@/components/PaymentForm';

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
    return <div>Invoice not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
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
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-semibold">
                ₹{(invoice.total_amount_paisa / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="text-green-600">
                ₹{(invoice.amount_paid_paisa / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-semibold">Amount Due:</span>
              <span className="font-bold text-blue-600">
                ₹{(invoice.amount_due_paisa / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <PaymentForm 
            invoiceId={invoice.id}
            amount={invoice.amount_due_paisa}
            invoiceNumber={invoice.invoice_number}
          />
        </div>
      </div>
    </div>
  );
}
```

#### Step 3: Create Payment Form Component with QR

Create: `src/components/PaymentForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

interface PaymentFormProps {
  invoiceId: string;
  amount: number;
  invoiceNumber: string;
}

export default function PaymentForm({ invoiceId, amount, invoiceNumber }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const data = await response.json();
      setOrderId(data.orderId);

      // Generate UPI QR Code
      const upiUrl = `upi://pay?pa=${process.env.NEXT_PUBLIC_UPI_ID}&pn=Lyra&am=${(amount / 100).toFixed(2)}&cu=INR&tn=Invoice ${invoiceNumber}`;
      const qr = await QRCode.toDataURL(upiUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCode(qr);

      // Also initialize Razorpay for manual payment
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'Lyra',
        description: `Payment for ${data.invoiceNumber}`,
        order_id: data.orderId,
        handler: async function (response: any) {
          // Payment successful - verify via webhook
          alert('Payment successful! Verifying...');
          router.push('/admin/billing?payment=success');
        },
        prefill: {
          name: data.organizationName,
        },
        theme: {
          color: '#3B82F6',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!qrCode ? (
        <button
          onClick={handleCreateOrder}
          disabled={loading}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating Order...' : 'Pay Now'}
        </button>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Scan QR Code to Pay</h3>
            <img src={qrCode} alt="Payment QR Code" className="mx-auto" />
            <p className="text-sm text-gray-600 mt-4">
              Scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
            </p>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-gray-600 mb-4 text-center">
              Or pay using other methods:
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200"
            >
              Use Card / Netbanking / Other UPI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Create Razorpay Webhook Handler

Create: `src/app/api/billing/webhook/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Find invoice by order ID
      const { data: invoice } = await supabase
        .from('organization_invoices')
        .select('id, organization_id, amount_due_paisa')
        .eq('razorpay_order_id', orderId)
        .single();

      if (invoice) {
        // Record payment
        await supabase.from('organization_payments').insert({
          invoice_id: invoice.id,
          organization_id: invoice.organization_id,
          amount_paisa: payment.amount,
          payment_method: 'razorpay',
          razorpay_order_id: orderId,
          razorpay_payment_id: payment.id,
          status: 'success',
          payment_date: new Date(payment.created_at * 1000).toISOString(),
        });

        // Trigger will automatically update invoice
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### Step 5: Add "Pay" Button to Billing Page

Update: `src/app/admin/billing/page.tsx` (in the invoices table)

```tsx
<Link
  href={`/admin/billing/${invoice.id}/pay`}
  className="text-blue-600 hover:text-blue-800"
>
  Pay Now
</Link>
```

#### Step 6: Environment Variables

Add to `.env.local`:

```bash
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id
NEXT_PUBLIC_UPI_ID=your_upi_id@paytm
```

#### Step 7: Install Dependencies

```bash
npm install razorpay qrcode
npm install --save-dev @types/qrcode
```

---

## Payment Flow

1. **Admin generates invoice** → `generateMonthlyInvoices()` creates invoice record
2. **Organization receives email** → Email with invoice details and payment link
3. **Organization clicks "Pay"** → Redirected to `/admin/billing/{invoiceId}/pay`
4. **System creates Razorpay order** → API call to `/api/billing/create-order`
5. **QR code displayed** → User scans with UPI app
6. **Payment completed** → Razorpay sends webhook to `/api/billing/webhook`
7. **Payment recorded** → New record in `organization_payments` with status='success'
8. **Invoice updated automatically** → Database trigger updates `amount_paid_paisa` and status
9. **Admin sees updated status** → Billing page shows invoice as "Paid"

---

## Testing Payment Flow

1. Generate test invoice:
   - Go to `/admin/billing`
   - Click "Generate Monthly Invoices"

2. Test payment:
   - Click "Pay Now" on an invoice
   - Use Razorpay test mode
   - Test card: 4111 1111 1111 1111

3. Verify:
   - Check `organization_payments` table for new record
   - Check invoice status changed to 'paid'
   - Check `amount_due_paisa` is now 0

---

## Manual Payment Recording

For cash/cheque/bank transfer:

```typescript
// Already implemented in RecordPaymentButton component
await recordManualPayment(invoiceId, amount, notes);
```

This also triggers the automatic invoice update.
