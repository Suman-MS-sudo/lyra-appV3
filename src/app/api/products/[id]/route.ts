import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    if (profile?.account_type !== 'admin') {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const body = await request.json();
    const { name, sku, price } = body;

    if (!name || !sku || price === undefined) {
      return errorResponse('Name, SKU, and price are required', 'VALIDATION_ERROR', 400);
    }

    // Update product
    const { data: product, error } = await serviceSupabase
      .from('products')
      .update({
        name,
        sku,
        price: parseFloat(price)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse(product);
  } catch (error: any) {
    console.error('Error in product update API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    if (profile?.account_type !== 'admin') {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    // Check if product is assigned to any machine
    const { data: machineProducts } = await serviceSupabase
      .from('machine_products')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (machineProducts && machineProducts.length > 0) {
      return errorResponse(
        'Cannot delete product that is assigned to machines',
        'VALIDATION_ERROR',
        400
      );
    }

    // Delete product
    const { error } = await serviceSupabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error in product delete API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
