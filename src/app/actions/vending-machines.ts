'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createVendingMachineSchema, updateVendingMachineSchema } from '@/lib/validations';
import { AuthenticationError, AuthorizationError, ValidationError, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function createVendingMachine(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new AuthorizationError();
    }

    // Get selected product IDs
    const productIds = formData.getAll('product_ids').filter(id => id);

    const rawData = {
      name: formData.get('name'),
      location: formData.get('location'),
      status: formData.get('status') || 'offline',
      
      // Hardware fields
      machine_id: formData.get('machine_id') || undefined,
      mac_id: formData.get('mac_id') || undefined,
      machine_type: formData.get('machine_type') || undefined,
      product_type: formData.get('product_type') || undefined,
      ip_address: formData.get('ip_address') || undefined,
      firmware_version: formData.get('firmware_version') || undefined,
      
      // Customer fields - UUID from dropdown
      customer_id: formData.get('customer_id') || undefined,
      customer_name: formData.get('customer_name') || undefined,
      customer_contact: formData.get('customer_contact') || undefined,
      customer_alternate_contact: formData.get('customer_alternate_contact') || undefined,
      customer_address: formData.get('customer_address') || undefined,
      customer_location: formData.get('customer_location') || undefined,
      
      // Maintenance fields
      purchase_date: formData.get('purchase_date') || undefined,
      warranty_till: formData.get('warranty_till') || undefined,
      amc_till: formData.get('amc_till') || undefined,
    };

    const validatedData = createVendingMachineSchema.parse(rawData);

    const { data, error } = await supabase
      .from('vending_machines')
      .insert({
        ...validatedData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create vending machine', error);
      throw error;
    }

    // If products were selected, create machine_products mappings
    if (productIds.length > 0 && data.id) {
      const machineProducts = productIds.map(productId => ({
        machine_id: data.id,
        product_id: productId,
        stock: 0, // Default stock, can be updated later
        price: '0.00', // Default price, can be updated later
        is_active: 1,
      }));

      const { error: productError } = await supabase
        .from('machine_products')
        .insert(machineProducts);

      if (productError) {
        logger.error('Failed to map products to machine', productError);
        // Don't throw, machine is already created
      }
    }

    logger.info('Vending machine created', { id: data.id, name: data.name, products: productIds.length });
    revalidatePath('/admin/machines');

    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'ZodError') {
      throw new ValidationError('Invalid vending machine data');
    }
    logger.error('Error creating vending machine', error);
    throw new Error('Failed to create vending machine');
  }
}

export async function updateVendingMachine(id: string, formData: FormData) {
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
      location: formData.get('location') || undefined,
      status: formData.get('status') || undefined,
      latitude: formData.get('latitude') ? Number(formData.get('latitude')) : undefined,
      longitude: formData.get('longitude') ? Number(formData.get('longitude')) : undefined,
    };

    const validatedData = updateVendingMachineSchema.parse(rawData);

    const { data, error } = await supabase
      .from('vending_machines')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update vending machine', error);
      throw error;
    }

    if (!data) {
      throw new NotFoundError('Vending machine');
    }

    logger.info('Vending machine updated', { id: data.id });
    revalidatePath('/admin/machines');
    revalidatePath(`/admin/machines/${id}`);

    return { success: true, data };
  } catch (error) {
    logger.error('Error updating vending machine', error);
    throw error;
  }
}

export async function deleteVendingMachine(id: string) {
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
      .from('vending_machines')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete vending machine', error);
      throw error;
    }

    logger.info('Vending machine deleted', { id });
    revalidatePath('/admin/machines');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting vending machine', error);
    throw error;
  }
}
