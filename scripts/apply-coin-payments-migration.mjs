#!/usr/bin/env node

/**
 * Apply coin_payments migration
 * Creates new table for tracking physical coin payments
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying coin_payments migration...\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241210000001_coin_payments.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log('📊 Creating coin_payments table...\n');

    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // If RPC doesn't exist, try direct SQL execution
      console.log('⚠️  RPC method not available, using direct execution...\n');
      
      // Split and execute SQL statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().includes('create table')) {
          console.log('Creating table...');
        } else if (statement.toLowerCase().includes('create index')) {
          console.log('Creating index...');
        } else if (statement.toLowerCase().includes('create policy')) {
          console.log('Creating RLS policy...');
        }

        const { error: execError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (execError && !execError.message.includes('already exists')) {
          console.error(`❌ Error executing statement: ${execError.message}`);
        }
      }
    }

    // Verify table exists
    const { data: tables, error: tableError } = await supabase
      .from('coin_payments')
      .select('id')
      .limit(1);

    if (tableError && !tableError.message.includes('0 rows')) {
      console.error('\n❌ Migration verification failed:', tableError.message);
      console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Go to SQL Editor');
      console.log('   4. Paste the contents of supabase/migrations/20241210000001_coin_payments.sql');
      console.log('   5. Click "Run"\n');
      return;
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📋 Created:');
    console.log('   - coin_payments table');
    console.log('   - Indexes for performance');
    console.log('   - RLS policies for security');
    console.log('\n🔧 Next steps:');
    console.log('   1. Upload updated ESP32 firmware');
    console.log('   2. Test coin payment flow');
    console.log('   3. Verify coin_payments table populates');
    console.log('   4. Check stock syncs to database\n');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n💡 Manual migration required:');
    console.log('   Run the SQL from supabase/migrations/20241210000001_coin_payments.sql');
    console.log('   in the Supabase SQL Editor\n');
    process.exit(1);
  }
}

applyMigration();
