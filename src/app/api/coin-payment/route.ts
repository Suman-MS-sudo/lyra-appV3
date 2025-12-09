import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Coin Payment API for ESP32
 * 
 * Endpoint: POST /api/coin-payment
 * Body: { machine_id, product_id (UUID), amount_in_paisa }
 * 
 * Records coin-based transactions in dedicated coin_payments table
 * and updates stock in machine_products
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

    // Verify machine_product exists and get current stock
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
      .eq('product_id', product_id)
      .single();

    if (mpError || !machineProduct) {
      console.error('Machine product not found:', machine_id, product_id);
      return errorResponse('Machine product not found', 'NOT_FOUND', 404);
    }

    const product = Array.isArray(machineProduct.product) 
      ? machineProduct.product[0] 
      : machineProduct.product;

    // Create coin payment record
    const { data: coinPayment, error: cpError } = await supabase
      .from('coin_payments')
      .insert({
        machine_id,
        product_id,
        amount_in_paisa,
        quantity: 1,
        dispensed: true,
        dispensed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cpError) {
      console.error('Coin payment insert error:', cpError);
      return errorResponse('Failed to record coin payment', 'INSERT_FAILED', 500);
    }

    // Update stock in machine_products (decrement by 1)
    const newStock = Math.max(0, machineProduct.stock - 1);
    const { error: stockError } = await supabase
      .from('machine_products')
      .update({ 
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', machineProduct.id);

    if (stockError) {
      console.error('Stock update error:', stockError);
      // Log error but don't fail the request - payment already recorded
    }

    console.log(`💰 Coin payment recorded: ${machine_id} / ${product.name} / ₹${amountInRupees} / Stock: ${machineProduct.stock} → ${newStock}`);

    return successResponse({
      message: 'Coin payment recorded and stock updated',
      payment_id: coinPayment.id,
      amount: amountInRupees,
      product_name: product.name,
      old_stock: machineProduct.stock,
      new_stock: newStock,
    });

  } catch (error: any) {
    console.error('Coin payment error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
