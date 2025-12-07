'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createTransactionSchema } from '@/lib/validations';
import { AuthenticationError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function createTransaction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const rawData = {
      product_id: formData.get('product_id'),
      vending_machine_id: formData.get('vending_machine_id'),
      quantity: formData.get('quantity') ? Number(formData.get('quantity')) : 1,
      payment_method: formData.get('payment_method') || undefined,
    };

    const validatedData = createTransactionSchema.parse(rawData);

    // Check product availability
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('price, stock, is_active')
      .eq('id', validatedData.product_id)
      .single();

    if (productError || !product) {
      throw new NotFoundError('Product');
    }

    if (!product.is_active) {
      throw new ConflictError('Product is not available');
    }

    if (product.stock < validatedData.quantity) {
      throw new ConflictError('Insufficient stock');
    }

    const amount = product.price * validatedData.quantity;

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        ...validatedData,
        user_id: user.id,
        amount,
        status: 'pending',
      })
      .select()
      .single();

    if (transactionError) {
      logger.error('Failed to create transaction', transactionError);
      throw transactionError;
    }

    // Update product stock
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: product.stock - validatedData.quantity })
      .eq('id', validatedData.product_id);

    if (stockError) {
      logger.error('Failed to update stock', stockError);
      // Rollback transaction
      await supabase.from('transactions').delete().eq('id', transaction.id);
      throw new Error('Failed to process transaction');
    }

    // Update transaction to completed
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', transaction.id);

    if (updateError) {
      logger.error('Failed to complete transaction', updateError);
    }

    logger.info('Transaction completed', { id: transaction.id, user_id: user.id });
    revalidatePath('/customer/transactions');
    revalidatePath('/customer/dashboard');

    return { success: true, data: transaction };
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw new ValidationError('Invalid transaction data');
    }
    logger.error('Error creating transaction', error);
    throw error;
  }
}

export async function getTransactionHistory(limit: number = 10) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        products (name, image_url),
        vending_machines (name, location)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch transaction history', error);
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    logger.error('Error fetching transaction history', error);
    throw error;
  }
}
