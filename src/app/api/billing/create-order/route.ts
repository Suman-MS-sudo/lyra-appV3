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

    if (invoice.amount_due_paisa <= 0) {
      return NextResponse.json({ error: 'No amount due' }, { status: 400 });
    }

    // Check if order already exists and is still valid
    if (invoice.razorpay_order_id) {
      try {
        const existingOrder = await razorpay.orders.fetch(invoice.razorpay_order_id);
        if (existingOrder.status !== 'paid') {
          // Order exists and not expired, reuse it
          return NextResponse.json({
            orderId: existingOrder.id,
            amount: existingOrder.amount,
            currency: existingOrder.currency,
            organizationName: invoice.organizations.name,
            invoiceNumber: invoice.invoice_number,
          });
        }
      } catch (err) {
        // Order doesn't exist or expired, create new one
      }
    }

    // Create Razorpay order with 30-day expiry
    const expiryTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days in seconds
    
    const order = await razorpay.orders.create({
      amount: invoice.amount_due_paisa, // Amount in paisa
      currency: 'INR',
      receipt: invoice.invoice_number,
      notes: {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        organization_name: invoice.organizations.name,
        invoice_number: invoice.invoice_number,
      },
      payment_capture: 1, // Auto capture payment
    });

    // Update invoice with Razorpay order ID
    await serviceSupabase
      .from('organization_invoices')
      .update({ 
        razorpay_order_id: order.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      organizationName: invoice.organizations.name,
      invoiceNumber: invoice.invoice_number,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
