import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Update Product Stock API for ESP32
 *
 * Endpoint: POST /api/update-product-stock
 * Body: { machine_id, product_id, quantity, mode?, motor_stock? }
 *
 * Updates stock levels when ESP32 dispenses products. motor_stock is an
 * optional per-motor breakdown (e.g. [25,25,24,25]) sent by quad-motor
 * machines so the admin UI can show exact hopper levels; single-motor
 * machines never send it and vending_machines.motor_stock stays null.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, product_id, quantity, mode, motor_stock } = body;

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

    // Keep vending_machines.stock_level (and motor_stock, if provided) in sync
    if (mode === 'set') {
      // Recalculate total from all products on this machine
      const { data: allProducts } = await supabase
        .from('machine_products')
        .select('stock')
        .eq('machine_id', machine_id);
      if (allProducts) {
        const totalStock = allProducts.reduce((sum, p) => sum + (p.stock ?? 0), 0);
        const machineUpdate: { stock_level: number; motor_stock?: number[] } = { stock_level: totalStock };
        if (Array.isArray(motor_stock)) machineUpdate.motor_stock = motor_stock;
        await supabase
          .from('vending_machines')
          .update(machineUpdate)
          .eq('id', machine_id);
      }
    } else {
      // Decrement machine stock_level by the same quantity
      const { data: machine } = await supabase
        .from('vending_machines')
        .select('stock_level')
        .eq('id', machine_id)
        .single();
      if (machine) {
        await supabase
          .from('vending_machines')
          .update({ stock_level: Math.max(0, (machine.stock_level ?? 0) - quantity) })
          .eq('id', machine_id);
      }
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
