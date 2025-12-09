import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Payment Success API for ESP32 Vending Machines
 * 
 * Endpoint: GET /api/payment_success?mac=<machine_mac_address>
 * 
 * Returns:
 * - Default: {"status":"No pending payments"}
 * - Payment pending: {"status":"success","mac":"...","products":[{...}]}
 * 
 * This endpoint is polled by ESP32 every 4 seconds to check for online payments.
 * When a payment is found, it's marked as "dispensed" to prevent duplicate dispensing.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const macAddress = searchParams.get('mac');

    if (!macAddress) {
      return errorResponse('MAC address is required', 400);
    }

    // Use service role to bypass RLS (ESP32 endpoint doesn't have user context)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Find the vending machine by MAC address (case-insensitive)
    const { data: machine, error: machineError } = await supabase
      .from('vending_machines')
      .select('id, machine_id, name')
      .ilike('mac_id', macAddress)
      .single();

    console.log('MAC lookup:', { macAddress, machine, error: machineError?.message });

    // Update firmware version and last ping if provided
    const firmwareVersion = searchParams.get('firmware');
    if (machine && firmwareVersion) {
      await supabase
        .from('vending_machines')
        .update({
          firmware_version: firmwareVersion,
          last_ping: new Date().toISOString(),
          asset_online: true,
        })
        .eq('id', machine.id);
      console.log(`📡 Updated firmware for ${machine.machine_id}: ${firmwareVersion}`);
    } else if (machine) {
      // Just update last_ping if no firmware version
      await supabase
        .from('vending_machines')
        .update({
          last_ping: new Date().toISOString(),
          asset_online: true,
        })
        .eq('id', machine.id);
    }

    if (machineError || !machine) {
      console.log(`Machine not found for MAC: ${macAddress}`);
      return successResponse({
        status: 'No pending payments',
        message: 'Machine not registered',
      });
    }

    // Step 2: Find pending payment (paid but not dispensed)
    // Look for the most recent transaction that:
    // - Belongs to this machine
    // - Has payment_status = 'paid' (Razorpay payment completed)
    // - Has dispensed = false (not yet dispensed by ESP32)
    const { data: pendingPayment, error: paymentError } = await supabase
      .from('transactions')
      .select(`
        id,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        created_at,
        transaction_items (
          quantity,
          price,
          machine_products (
            id,
            product:products (
              id,
              name,
              description
            )
          )
        )
      `)
      .eq('machine_id', machine.id)
      .eq('payment_status', 'paid')
      .eq('dispensed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !pendingPayment) {
      // No pending payments - default response
      return successResponse({
        status: 'No pending payments',
      });
    }

    // Step 3: Format products for ESP32
    const products = pendingPayment.transaction_items?.map((item: any) => ({
      product: {
        id: item.machine_products?.product?.id || 0,
        name: item.machine_products?.product?.name || 'Unknown Product',
        description: item.machine_products?.product?.description || '',
      },
      quantity: item.quantity,
      price: parseFloat(item.price),
    })) || [];

    // Step 4: Mark transaction as dispensed
    // This prevents the ESP32 from dispensing the same payment multiple times
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        dispensed: true,
        dispensed_at: new Date().toISOString(),
      })
      .eq('id', pendingPayment.id);

    if (updateError) {
      console.error('Failed to mark transaction as dispensed:', updateError);
      // Still return success to ESP32 - we'll fix the flag issue later
    }

    // Step 5: Return payment success response
    return successResponse({
      status: 'success',
      mac: macAddress,
      machineId: machine.machine_id,
      machineName: machine.name,
      transactionId: pendingPayment.id,
      razorpayOrderId: pendingPayment.razorpay_order_id,
      razorpayPaymentId: pendingPayment.razorpay_payment_id,
      amount: pendingPayment.amount,
      products,
      timestamp: pendingPayment.created_at,
    });

  } catch (error: any) {
    console.error('Payment success API error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
