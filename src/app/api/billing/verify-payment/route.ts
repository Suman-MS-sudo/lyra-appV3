import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find invoice
    const { data: invoice } = await supabase
      .from('organization_invoices')
      .select('id, organization_id, amount_due_paisa')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if payment already recorded
    const { data: existingPayment } = await supabase
      .from('organization_payments')
      .select('id')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .single();

    if (!existingPayment) {
      // Record payment
      await supabase.from('organization_payments').insert({
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        amount_paisa: invoice.amount_due_paisa,
        payment_method: 'razorpay',
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status: 'success',
        payment_date: new Date().toISOString(),
        notes: 'Payment verified via frontend',
      });

      // Update invoice
      await supabase
        .from('organization_invoices')
        .update({
          razorpay_payment_id,
          payment_method: 'razorpay',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
