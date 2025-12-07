'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createProductSchema, updateProductSchema } from '@/lib/validations';
import { AuthenticationError, AuthorizationError, ValidationError, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function createProduct(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new AuthorizationError();
    }

    const rawData = {
      vending_machine_id: formData.get('vending_machine_id'),
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      price: Number(formData.get('price')),
      stock: Number(formData.get('stock')),
      max_stock: Number(formData.get('max_stock')),
      image_url: formData.get('image_url') || undefined,
      sku: formData.get('sku') || undefined,
    };

    const validatedData = createProductSchema.parse(rawData);

    const { data, error } = await supabase
      .from('products')
      .insert(validatedData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create product', error);
      throw error;
    }

    logger.info('Product created', { id: data.id, name: data.name });
    revalidatePath('/admin/products');
    revalidatePath(`/admin/machines/${data.vending_machine_id}`);

    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw new ValidationError('Invalid product data');
    }
    logger.error('Error creating product', error);
    throw error;
  }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new AuthorizationError();
    }

    const rawData = {
      name: formData.get('name') || undefined,
      description: formData.get('description') || undefined,
      price: formData.get('price') ? Number(formData.get('price')) : undefined,
      stock: formData.get('stock') ? Number(formData.get('stock')) : undefined,
      max_stock: formData.get('max_stock') ? Number(formData.get('max_stock')) : undefined,
      image_url: formData.get('image_url') || undefined,
      sku: formData.get('sku') || undefined,
      is_active: formData.get('is_active') === 'true',
    };

    const validatedData = updateProductSchema.parse(rawData);

    const { data, error } = await supabase
      .from('products')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update product', error);
      throw error;
    }

    if (!data) {
      throw new NotFoundError('Product');
    }

    logger.info('Product updated', { id: data.id });
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${id}`);

    return { success: true, data };
  } catch (error) {
    logger.error('Error updating product', error);
    throw error;
  }
}

export async function deleteProduct(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete product', error);
      throw error;
    }

    logger.info('Product deleted', { id });
    revalidatePath('/admin/products');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting product', error);
    throw error;
  }
}
