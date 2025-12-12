#!/usr/bin/env node

/**
 * Apply stock sync trigger migration
 * This creates a database trigger that auto-syncs vending_machines.stock_level to machine_products.stock
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying stock sync trigger migration...\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241212000000_sync_machine_stock.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log(sql);
    console.log('\n⚙️ Executing...\n');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct execution if RPC not available
      console.log('⚠️ RPC method not available, trying alternative...\n');
      
      // Split and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        // Note: Direct SQL execution requires psql or Supabase dashboard
        console.log('⚠️ Please run this migration manually in Supabase SQL Editor\n');
      }

      console.log('📋 Migration file created at:');
      console.log(`   ${migrationPath}\n`);
      console.log('📌 To apply manually:');
      console.log('   1. Go to Supabase Dashboard → SQL Editor');
      console.log('   2. Paste the migration SQL');
      console.log('   3. Click "Run"\n');
      return;
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('🔗 Stock sync trigger active:');
    console.log('   - When vending_machines.stock_level changes');
    console.log('   - All machine_products.stock auto-update to match\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

applyMigration();
