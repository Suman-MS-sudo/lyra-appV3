import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      machineId,
      products,
    } = await request.json();

    // Verify payment signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Payment verified, create transaction record
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get machine details
    const { data: machine } = await serviceSupabase
      .from('vending_machines')
      .select('id, customer_id')
      .eq('machine_id', machineId)
      .single();

    if (!machine) {
      return NextResponse.json(
        { success: false, error: 'Machine not found' },
        { status: 404 }
      );
    }

    // Calculate total amount
    const totalAmount = products.reduce(
      (sum: number, p: any) => sum + parseFloat(p.price) * p.quantity,
      0
    );

    // Create transaction
    const { data: transaction, error: txError } = await serviceSupabase
      .from('transactions')
      .insert({
        machine_id: machine.id,
        customer_id: machine.customer_id,
        total_amount: totalAmount,
        payment_status: 'paid',
        payment_method: 'razorpay',
        razorpay_order_id,
        razorpay_payment_id,
        items: products,
        dispensed: false, // ESP32 will mark as true after dispensing
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Update stock for each product
    for (const product of products) {
      await serviceSupabase.rpc('decrement_stock', {
        p_machine_id: machine.id,
        p_product_id: product.product_id,
        p_quantity: product.quantity,
      });
    }

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Payment verified and transaction recorded',
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { success: false, error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
