#!/usr/bin/env node

/**
 * Sync machine_products.stock from vending_machines.stock_level
 * This fixes the mismatch where ESP32 updates stock_level but not machine_products
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.log('Usage:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node sync-machine-product-stock.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncStock() {
  console.log('🔄 Syncing machine_products.stock from vending_machines.stock_level...\n');

  // Get machine with stock_level
  const { data: machine, error: machineError } = await supabase
    .from('vending_machines')
    .select('id, machine_id, stock_level')
    .eq('id', 'd1262fb0-7666-459f-838a-a6deafda7069')
    .single();

  if (machineError || !machine) {
    console.error('❌ Failed to fetch machine:', machineError);
    return;
  }

  console.log(`📊 Machine: ${machine.machine_id}`);
  console.log(`   Stock Level: ${machine.stock_level}\n`);

  // Get machine_products for this machine
  const { data: machineProducts, error: mpError } = await supabase
    .from('machine_products')
    .select('id, product_id, stock, products(name)')
    .eq('machine_id', machine.id);

  if (mpError) {
    console.error('❌ Failed to fetch machine_products:', mpError);
    return;
  }

  console.log(`📦 Found ${machineProducts?.length || 0} products\n`);

  // Update each product stock to match machine stock_level
  for (const mp of machineProducts || []) {
    const productName = mp.products?.name || 'Unknown';
    
    console.log(`   Updating "${productName}":`);
    console.log(`   - Old stock: ${mp.stock}`);
    console.log(`   - New stock: ${machine.stock_level}`);

    const { error: updateError } = await supabase
      .from('machine_products')
      .update({ stock: machine.stock_level })
      .eq('id', mp.id);

    if (updateError) {
      console.error(`   ❌ Update failed:`, updateError);
    } else {
      console.log(`   ✅ Updated successfully\n`);
    }
  }

  console.log('✅ Stock sync complete!');
}

syncStock().catch(console.error);
