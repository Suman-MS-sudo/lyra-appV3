import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Get Machine Products API for ESP32
 * 
 * Endpoint: GET /api/machine-products?machine_id={uuid}
 * 
 * Returns assigned products for a machine (for coin payment tracking)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machine_id = searchParams.get('machine_id');

    if (!machine_id) {
      return errorResponse('Missing machine_id', 'MISSING_FIELD', 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all products assigned to this machine
    const { data: machineProducts, error } = await supabase
      .from('machine_products')
      .select(`
        id,
        stock,
        price,
        product:products (
          id,
          name,
          description
        )
      `)
      .eq('machine_id', machine_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Machine products fetch error:', error);
      return errorResponse('Failed to fetch products', 'FETCH_FAILED', 500);
    }

    if (!machineProducts || machineProducts.length === 0) {
      return errorResponse('No products assigned to this machine', 'NO_PRODUCTS', 404);
    }

    // Format response for ESP32
    const products = machineProducts.map((mp) => {
      const product = Array.isArray(mp.product) ? mp.product[0] : mp.product;
      return {
        product_id: product.id,
        name: product.name,
        description: product.description || '',
        stock: mp.stock,
        price: parseFloat(mp.price || '0'),
      };
    });

    // Return first product as default for single-product machines
    const defaultProduct = products[0];

    return successResponse({
      machine_id,
      product_count: products.length,
      default_product: defaultProduct,
      all_products: products,
    });

  } catch (error: any) {
    console.error('Machine products error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
