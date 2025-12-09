import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Coin Payment API for ESP32
 * 
 * Endpoint: POST /api/coin-payment
 * Body: { machine_id, product_id, amount_in_paisa }
 * 
 * Records coin-based transactions (offline payments)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, product_id, amount_in_paisa } = body;

    if (!machine_id || !product_id || !amount_in_paisa) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Convert paisa to rupees (100 paisa = 1 rupee)
    const amountInRupees = amount_in_paisa / 100;

    // Get machine products to find the actual product UUID
    // ESP32 sends product_id as integer (motor number), we need to map it
    const { data: machineProduct, error: mpError } = await supabase
      .from('machine_products')
      .select(`
        id,
        stock,
        product:products (
          id,
          name,
          price
        )
      `)
      .eq('machine_id', machine_id)
      .limit(1)
      .single();

    let productUuid = null;
    let productName = 'Coin Purchase';
    
    if (machineProduct && !mpError && machineProduct.product) {
      const prod = Array.isArray(machineProduct.product) 
        ? machineProduct.product[0] 
        : machineProduct.product;
      productUuid = prod.id;
      productName = prod.name;
    }

    // Create transaction record for coin payment
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        machine_id,
        product_id: productUuid, // Use UUID or null
        amount: amountInRupees,
        total_amount: amountInRupees,
        quantity: 1,
        status: 'completed',
        payment_method: 'coin',
        payment_status: 'paid',
        dispensed: true,
        dispensed_at: new Date().toISOString(),
        items: JSON.stringify([{
          product_id: productUuid,
          name: productName,
          price: amountInRupees,
          quantity: 1,
        }]),
      })
      .select()
      .single();

    if (txError) {
      console.error('Coin payment transaction error:', txError);
      return errorResponse('Failed to record transaction', 'TRANSACTION_FAILED', 500);
    }

    console.log(`💰 Coin payment recorded: ${machine_id} / ₹${amountInRupees}`);

    return successResponse({
      message: 'Coin payment recorded',
      transaction_id: transaction.id,
      amount: amountInRupees,
    });

  } catch (error: any) {
    console.error('Coin payment error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
