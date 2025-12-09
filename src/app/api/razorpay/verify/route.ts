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
    const { data: machine, error: machineError } = await serviceSupabase
      .from('vending_machines')
      .select('id, customer_id, machine_id')
      .eq('machine_id', machineId)
      .single();

    if (machineError || !machine) {
      console.error('Machine lookup error:', machineError);
      return NextResponse.json(
        { success: false, error: 'Machine not found', details: machineError?.message },
        { status: 404 }
      );
    }

    console.log('Machine found:', { id: machine.id, machine_id: machine.machine_id });

    // Calculate total amount
    const totalAmount = products.reduce(
      (sum: number, p: any) => sum + parseFloat(p.price) * p.quantity,
      0
    );

    console.log('Creating transaction:', {
      machine_id: machine.id,
      customer_id: machine.customer_id,
      total_amount: totalAmount,
      products_count: products.length,
    });

    // Create transaction
    const { data: transaction, error: txError } = await serviceSupabase
      .from('transactions')
      .insert({
        machine_id: machine.id,
        customer_id: machine.customer_id,
        total_amount: totalAmount,
        payment_status: 'paid',
        status: 'completed', // Transaction status enum
        payment_method: 'razorpay',
        quantity: products.reduce((sum: number, p: any) => sum + p.quantity, 0), // Total quantity
        razorpay_order_id,
        razorpay_payment_id,
        items: products,
        dispensed: false, // ESP32 will mark as true after dispensing
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction', details: txError.message },
        { status: 500 }
      );
    }

    console.log('Transaction created successfully:', transaction.id);

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
