import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { publishPaymentSuccess } from '@/lib/mqtt-publish';

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
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'OrxoAbykv5jDlvzJxgPifKh6';
    const expectedSign = crypto
      .createHmac('sha256', keySecret)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      console.error('Payment signature verification failed:', {
        razorpay_order_id,
        razorpay_payment_id,
        keyEnvSet: !!process.env.RAZORPAY_KEY_SECRET,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Fetch order details from Razorpay to get user_id from notes
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_lmKnnhDWFEBx4e';
    
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.fetch(razorpay_order_id);
    const userId = order.notes?.user_id;

    console.log('Order notes:', { userId, machineId: order.notes?.machine_id });

    // Payment verified, create transaction record
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get machine details
    const { data: machine, error: machineError } = await serviceSupabase
      .from('vending_machines')
      .select('id, customer_id, machine_id, name, mac_id, mqtt_payment_push')
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
      customer_id: userId === 'guest' ? null : userId,
      total_amount: totalAmount,
      products_count: products.length,
    });

    // Create transaction - customer_id is null for guest purchases
    const { data: transaction, error: txError } = await serviceSupabase
      .from('transactions')
      .insert({
        machine_id: machine.id,
        customer_id: userId === 'guest' ? null : userId, // null for guest purchases
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

    // Machines on the new MQTT-push firmware don't poll payment_success at
    // all, so they'd never otherwise see this transaction -- push it, then
    // mark dispensed here ourselves since no poll will come along to do it.
    // Old machines (mqtt_payment_push=false, the default) are completely
    // unaffected: dispensed stays false and the existing polling flow in
    // /api/payment_success handles it exactly as it always has.
    if (machine.mqtt_payment_push) {
      try {
        // Firmware's handlePaymentDocument() reads each item as
        // item["product"]["id"]/["name"] -- the raw `products` from the
        // request body is flat (product_id/name/price/quantity), so it has
        // to be remapped into that nested shape before publishing, same as
        // /api/payment_success already does for the HTTP-polling path.
        const productsForFirmware = products.map((p: any) => ({
          product: {
            id: p.product_id || 0,
            name: p.name || 'Unknown Product',
            description: p.description || '',
          },
          quantity: p.quantity || 1,
          price: parseFloat(p.price || 0),
        }));

        await publishPaymentSuccess(machine.id, {
          status: 'success',
          mac: machine.mac_id,
          machineId: machine.id,
          machineName: machine.name,
          transactionId: transaction.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          amount: totalAmount,
          products: productsForFirmware,
          timestamp: transaction.created_at,
        });

        await serviceSupabase
          .from('transactions')
          .update({ dispensed: true, dispensed_at: new Date().toISOString() })
          .eq('id', transaction.id);
      } catch (mqttError) {
        // Known gap: if the push itself fails (broker unreachable, device
        // offline with no queued session, etc.) there's no polling fallback
        // for an MQTT-only machine in this first pass -- the transaction
        // stays dispensed=false with nothing to pick it up. Worth a retry/
        // outbox mechanism if this turns out to happen in practice.
        console.error('MQTT payment push failed:', mqttError);
      }
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
