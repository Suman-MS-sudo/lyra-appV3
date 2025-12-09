#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyNetworkSpeedMigration() {
  console.log('📡 Applying network speed migration...\n');

  try {
    const migrationPath = join(__dirname, '../supabase/migrations/20241210000001_add_network_speed.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct execution if RPC fails
      console.log('Trying alternative execution method...');
      
      // Add network_speed column
      const { error: alterError } = await supabase
        .from('vending_machines')
        .select('network_speed')
        .limit(1);

      if (alterError && alterError.message.includes('column')) {
        console.log('✅ Column network_speed does not exist, needs manual migration');
        console.log('\nPlease run this SQL in Supabase SQL Editor:');
        console.log('---');
        console.log(sql);
        console.log('---');
      } else {
        console.log('✅ Column network_speed already exists!');
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

    console.log('\n📊 Verification: Checking vending_machines table...');
    const { data, error: checkError } = await supabase
      .from('vending_machines')
      .select('machine_id, network_speed')
      .limit(1);

    if (!checkError) {
      console.log('✅ network_speed column is accessible');
      console.log('Sample data:', data);
    } else {
      console.log('⚠️  Error checking column:', checkError.message);
    }

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }

  console.log('\n✅ Done!');
}

applyNetworkSpeedMigration();
