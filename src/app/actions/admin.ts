'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createVendingMachine(formData: FormData) {
  // Get selected product IDs
  const productIds = formData.getAll('product_ids').filter(id => id);

  const machineData = {
    name: formData.get('name') as string,
    location: formData.get('location') as string,
    status: formData.get('status') as string || 'offline',
    
    // Hardware fields
    machine_id: formData.get('machine_id') as string || null,
    mac_id: formData.get('mac_id') as string || null,
    machine_type: formData.get('machine_type') as string || null,
    product_type: formData.get('product_type') as string || null,
    ip_address: formData.get('ip_address') as string || null,
    firmware_version: formData.get('firmware_version') as string || null,
    
    // Organization fields (customer_id stores the organization UUID)
    customer_id: formData.get('organization_id') as string || null,
    customer_name: formData.get('customer_name') as string || null,
    customer_contact: formData.get('customer_contact') as string || null,
    customer_alternate_contact: formData.get('customer_alternate_contact') as string || null,
    customer_address: formData.get('customer_address') as string || null,
    customer_location: formData.get('customer_location') as string || null,
    
    // Maintenance fields
    purchase_date: formData.get('purchase_date') as string || null,
    warranty_till: formData.get('warranty_till') as string || null,
    amc_till: formData.get('amc_till') as string || null,
    
    last_sync: new Date().toISOString()
  };

  const { data: machine, error } = await serviceSupabase
    .from('vending_machines')
    .insert(machineData)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // If products were selected, create machine_products mappings
  if (productIds.length > 0 && machine?.id) {
    const machineProducts = productIds.map(productId => ({
      machine_id: machine.id,
      product_id: productId,
      stock: 0, // Default stock
      price: '0.00', // Default price
      is_active: 1,
    }));

    await serviceSupabase
      .from('machine_products')
      .insert(machineProducts);
  }

  revalidatePath('/admin/machines');
  redirect('/admin/machines');
}

export async function createProduct(formData: FormData) {
  const name = formData.get('name') as string;
  const price = parseFloat(formData.get('price') as string);
  const sku = formData.get('sku') as string;

  const { error } = await serviceSupabase
    .from('products')
    .insert({
      name,
      price,
      sku
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function updateProduct(productId: string, formData: FormData) {
  const name = formData.get('name') as string;
  const price = parseFloat(formData.get('price') as string);
  const stock = parseInt(formData.get('stock') as string);

  const { error } = await serviceSupabase
    .from('products')
    .update({
      name,
      price,
      stock_quantity: stock,
      is_available: stock > 0
    })
    .eq('id', productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function deleteProduct(productId: string) {
  const { error } = await serviceSupabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/products');
}

export async function updateMachine(machineId: string, formData: FormData) {
  const name = formData.get('name') as string;
  const location = formData.get('location') as string;
  const status = formData.get('status') as string;

  const { error } = await serviceSupabase
    .from('vending_machines')
    .update({
      name,
      location,
      status
    })
    .eq('id', machineId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/machines');
  redirect('/admin/machines');
}

export async function deleteMachine(machineId: string) {
  const { error } = await serviceSupabase
    .from('vending_machines')
    .delete()
    .eq('id', machineId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/machines');
}

export async function updateCustomer(formData: FormData) {
  const userId = formData.get('user_id') as string;
  const fullName = formData.get('full_name') as string;
  const organizationId = formData.get('organization_id') as string;
  const canEdit = formData.get('can_edit') === 'on';

  const { error } = await serviceSupabase
    .from('profiles')
    .update({
      full_name: fullName,
      organization_id: organizationId || null,
      permissions: {
        can_edit: canEdit,
        can_view: true
      }
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/customers');
  redirect('/admin/customers');
}
