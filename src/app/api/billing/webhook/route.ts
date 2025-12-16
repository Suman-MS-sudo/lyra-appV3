import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle payment captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Find invoice by order ID
      const { data: invoice, error: invoiceError } = await supabase
        .from('organization_invoices')
        .select('id, organization_id, amount_due_paisa, status')
        .eq('razorpay_order_id', orderId)
        .single();

      if (invoiceError || !invoice) {
        console.error('Invoice not found for order:', orderId);
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      // Check if payment already recorded
      const { data: existingPayment } = await supabase
        .from('organization_payments')
        .select('id')
        .eq('razorpay_payment_id', payment.id)
        .single();

      if (existingPayment) {
        console.log('Payment already recorded:', payment.id);
        return NextResponse.json({ received: true, status: 'duplicate' });
      }

      // Record payment in database
      const { error: paymentError } = await supabase
        .from('organization_payments')
        .insert({
          invoice_id: invoice.id,
          organization_id: invoice.organization_id,
          amount_paisa: payment.amount,
          payment_method: 'razorpay',
          razorpay_order_id: orderId,
          razorpay_payment_id: payment.id,
          status: 'success',
          payment_date: new Date(payment.created_at * 1000).toISOString(),
          notes: `Razorpay payment captured. Method: ${payment.method}`,
        });

      if (paymentError) {
        console.error('Error recording payment:', paymentError);
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
      }

      // Update invoice with payment details
      await supabase
        .from('organization_invoices')
        .update({
          razorpay_payment_id: payment.id,
          payment_method: 'razorpay',
          paid_at: new Date(payment.created_at * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      console.log('Payment recorded successfully:', {
        invoiceId: invoice.id,
        paymentId: payment.id,
        amount: payment.amount,
      });

      // Note: The database trigger will automatically:
      // - Update amount_paid_paisa
      // - Calculate amount_due_paisa
      // - Change status to 'paid' if fully paid

      return NextResponse.json({ 
        received: true, 
        status: 'success',
        invoiceId: invoice.id 
      });
    }

    // Handle payment failed event
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: invoice } = await supabase
        .from('organization_invoices')
        .select('id, organization_id')
        .eq('razorpay_order_id', orderId)
        .single();

      if (invoice) {
        // Record failed payment attempt
        await supabase.from('organization_payments').insert({
          invoice_id: invoice.id,
          organization_id: invoice.organization_id,
          amount_paisa: payment.amount,
          payment_method: 'razorpay',
          razorpay_order_id: orderId,
          razorpay_payment_id: payment.id,
          status: 'failed',
          payment_date: new Date(payment.created_at * 1000).toISOString(),
          notes: `Payment failed. Error: ${payment.error_description || 'Unknown error'}`,
        });
      }

      return NextResponse.json({ received: true, status: 'failed' });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
