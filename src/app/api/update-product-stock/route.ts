import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Update Product Stock API for ESP32
 * 
 * Endpoint: POST /api/update-product-stock
 * Body: { machine_id, product_id, quantity, mode? }
 * 
 * Updates stock levels when ESP32 dispenses products
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, product_id, quantity, mode } = body;

    if (!machine_id || !product_id || quantity === undefined) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the machine_product entry
    const { data: machineProduct, error: findError } = await supabase
      .from('machine_products')
      .select('id, stock')
      .eq('machine_id', machine_id)
      .eq('product_id', product_id)
      .single();

    if (findError || !machineProduct) {
      console.log(`Machine product not found: ${machine_id} / ${product_id}`);
      return errorResponse('Machine product not found', 'NOT_FOUND', 404);
    }

    // Update stock based on mode
    let newStock = machineProduct.stock;
    
    if (mode === 'set') {
      // Set absolute stock level
      newStock = quantity;
    } else {
      // Decrement stock (default behavior when dispensing)
      newStock = Math.max(0, machineProduct.stock - quantity);
    }

    const { error: updateError } = await supabase
      .from('machine_products')
      .update({ stock: newStock })
      .eq('id', machineProduct.id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      return errorResponse('Failed to update stock', 'UPDATE_FAILED', 500);
    }

    console.log(`📦 Stock updated: ${machine_id} / product ${product_id} -> ${newStock}`);

    return successResponse({
      message: 'Stock updated successfully',
      product_id,
      old_stock: machineProduct.stock,
      new_stock: newStock,
    });

  } catch (error: any) {
    console.error('Update product stock error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
