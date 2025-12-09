#!/usr/bin/env node

/**
 * Verify complete payment and stock tracking system
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('🔍 Verifying Payment & Stock Tracking System\n');
  
  let allGood = true;

  // 1. Check coin_payments table exists
  console.log('1️⃣  Checking coin_payments table...');
  const { data: coinPayments, error: cpError } = await supabase
    .from('coin_payments')
    .select('id')
    .limit(1);
  
  if (cpError && !cpError.message.includes('0 rows')) {
    console.log('   ❌ coin_payments table not found');
    console.log('   💡 Run: node scripts/apply-coin-payments-migration.mjs\n');
    allGood = false;
  } else {
    console.log('   ✅ coin_payments table exists\n');
  }

  // 2. Check machine_products table has UUID product_ids
  console.log('2️⃣  Checking machine_products structure...');
  const { data: machineProducts, error: mpError } = await supabase
    .from('machine_products')
    .select('id, machine_id, product_id, stock')
    .limit(1);
  
  if (mpError) {
    console.log('   ❌ Cannot access machine_products');
    allGood = false;
  } else if (machineProducts && machineProducts.length > 0) {
    const sample = machineProducts[0];
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sample.product_id);
    if (isUUID) {
      console.log('   ✅ product_id is UUID format');
      console.log(`   📋 Sample: ${sample.product_id}\n`);
    } else {
      console.log('   ⚠️  product_id is not UUID (might be integer)');
      allGood = false;
    }
  } else {
    console.log('   ⚠️  No machine_products found (assign products to machines)\n');
  }

  // 3. Check transactions table structure
  console.log('3️⃣  Checking transactions table...');
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, dispensed, dispensed_at')
    .limit(1);
  
  if (txError) {
    console.log('   ❌ Cannot access transactions');
    allGood = false;
  } else {
    console.log('   ✅ transactions table accessible\n');
  }

  // 4. Summary
  console.log('━'.repeat(50));
  if (allGood) {
    console.log('✅ All systems ready!');
    console.log('\n📋 Next steps:');
    console.log('   1. Upload ESP32 firmware (ESP32_FIRMWARE_OPTIMIZED.ino)');
    console.log('   2. Watch serial monitor for:');
    console.log('      - "✅ Default Product ID: {uuid}"');
    console.log('   3. Test coin payment');
    console.log('   4. Verify coin_payments table populates');
    console.log('   5. Check stock syncs correctly\n');
  } else {
    console.log('⚠️  Some issues detected');
    console.log('   Review errors above and fix before proceeding\n');
  }
}

verify();
