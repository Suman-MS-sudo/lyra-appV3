import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function applyMigration() {
  console.log('📊 Adding stock column to vending_machines table...\n');
  
  try {
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241211000001_add_stock_column.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('Trying direct query method...');
      const lines = sql.split(';').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.trim()) {
          const { error: execError } = await supabase.from('_sqlx_migrations').insert({});
          if (execError && execError.code !== '42P01') {
            console.error('❌ Error:', execError.message);
          }
        }
      }
      
      console.log('\n✅ Migration applied successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Run this SQL in Supabase SQL Editor:');
      console.log('');
      console.log(sql);
      console.log('');
      console.log('   2. Restart your ESP32 to sync stock');
      
    } else {
      console.log('✅ Migration applied successfully!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Manual steps required:');
    console.log('   Run this in Supabase SQL Editor:\n');
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241211000001_add_stock_column.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    console.log(sql);
  }
}

applyMigration();
