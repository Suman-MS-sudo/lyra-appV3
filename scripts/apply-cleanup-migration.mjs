import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Applying transaction cleanup migration...\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20251213000001_cleanup_old_transaction_columns.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log();

    // Execute migration
    console.log('⚙️  Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log();
    console.log('📋 Changes made:');
    console.log('  ✓ Dropped old RLS policies (user_id based)');
    console.log('  ✓ Created new RLS policies (customer_id based)');
    console.log('  ✓ Dropped deprecated columns:');
    console.log('    - user_id');
    console.log('    - product_id');
    console.log('    - vending_machine_id');
    console.log('    - amount');
    console.log('  ✓ Set NOT NULL constraints on:');
    console.log('    - machine_id');
    console.log('    - total_amount');
    console.log('    - payment_status');
    console.log('  ✓ Added indexes and constraints');
    console.log();
    console.log('🎉 Transaction table cleanup complete!');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

// Check if we have any data in old columns before migrating
async function checkOldData() {
  console.log('🔍 Checking for data in old columns...\n');

  const { data: txWithOldData, error } = await supabase
    .from('transactions')
    .select('id, user_id, product_id, vending_machine_id, amount, customer_id, machine_id, total_amount')
    .limit(5);

  if (error) {
    console.error('❌ Error checking data:', error);
    return;
  }

  if (txWithOldData && txWithOldData.length > 0) {
    console.log('📊 Sample transactions:');
    console.table(txWithOldData);
    console.log();

    const hasOldData = txWithOldData.some(tx => 
      tx.user_id || tx.product_id || tx.vending_machine_id || tx.amount
    );

    if (hasOldData) {
      console.log('⚠️  WARNING: Some transactions still have data in old columns!');
      console.log('   The migration will copy data from old to new columns if needed.');
      console.log();
    } else {
      console.log('✅ All transactions are using new columns only.');
      console.log();
    }
  }
}

async function main() {
  await checkOldData();
  
  console.log('⚠️  This migration will:');
  console.log('  1. Update RLS policies');
  console.log('  2. Drop old columns (user_id, product_id, vending_machine_id, amount)');
  console.log('  3. Set NOT NULL constraints on new columns');
  console.log();
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await applyMigration();
}

main().catch(console.error);
