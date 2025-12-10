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
      return errorResponse('MAC address is required', 'MISSING_MAC', 400);
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

    // NOTE: We do NOT update last_ping here - only /api/machine-ping updates machine status
    // This prevents the machine from appearing "online" when it's actually offline

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
        total_amount,
        items,
        created_at
      `)
      .eq('machine_id', machine.id)
      .eq('payment_status', 'paid')
      .eq('dispensed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Payment query result:', { 
      pendingPayment: pendingPayment ? { id: pendingPayment.id, items: pendingPayment.items } : null, 
      error: paymentError?.message 
    });

    if (paymentError || !pendingPayment) {
      // No pending payments - default response
      console.log('No pending payment found for machine:', machine.machine_id);
      return successResponse({
        status: 'No pending payments',
      });
    }

    // Step 3: Format products for ESP32 from items JSONB
    let products = [];
    
    try {
      // Items are stored as JSONB array in the items column
      const itemsArray = typeof pendingPayment.items === 'string' 
        ? JSON.parse(pendingPayment.items) 
        : pendingPayment.items;
      
      products = (itemsArray || []).map((item: any) => ({
        product: {
          id: item.product_id || 0,
          name: item.name || 'Unknown Product',
          description: item.description || '',
        },
        quantity: item.quantity || 1,
        price: parseFloat(item.price || 0),
      }));
    } catch (e) {
      console.error('Failed to parse items:', e);
    }

    // Step 4: Mark transaction as dispensed
    // This prevents the ESP32 from dispensing the same payment multiple times
    const { data: updateResult, error: updateError } = await supabase
      .from('transactions')
      .update({ 
        dispensed: true,
        dispensed_at: new Date().toISOString(),
      })
      .eq('id', pendingPayment.id)
      .select();

    if (updateError) {
      console.error('❌ CRITICAL: Failed to mark transaction as dispensed:', updateError);
      console.error('Transaction ID:', pendingPayment.id);
      // Still return success to ESP32 - we'll fix the flag issue later
    } else {
      console.log('✅ Transaction marked as dispensed:', pendingPayment.id);
      console.log('Update result:', updateResult);
    }

    // Step 5: Return payment success response
    const responseData = {
      status: 'success',
      mac: macAddress,
      machineId: machine.machine_id,
      machineName: machine.name,
      transactionId: pendingPayment.id,
      razorpayOrderId: pendingPayment.razorpay_order_id,
      razorpayPaymentId: pendingPayment.razorpay_payment_id,
      amount: pendingPayment.total_amount || pendingPayment.amount,
      products,
      timestamp: pendingPayment.created_at,
    };

    console.log('💰 Returning payment to ESP32:', JSON.stringify(responseData, null, 2));
    
    return successResponse(responseData);

  } catch (error: any) {
    console.error('Payment success error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
