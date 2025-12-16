import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyBillingMigration() {
  console.log('📝 Creating billing tables...\n');

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251215000001_organization_billing.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Execute via Supabase SQL editor or use postgres client
    // Since we can't execute DDL directly via Supabase JS client, we need to use psql or SQL editor
    
    console.log('⚠️  Cannot execute DDL via Supabase JS client.');
    console.log('\n📋 Please run this SQL manually:\n');
    console.log('Option 1: Supabase Dashboard');
    console.log('  1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('  2. Copy the SQL from: supabase/migrations/20251215000001_organization_billing.sql');
    console.log('  3. Paste and run in SQL Editor\n');
    
    console.log('Option 2: psql command line');
    console.log('  Copy the SQL file content and execute via psql\n');
    
    console.log('Option 3: Use this script');
    console.log('  node scripts/apply-billing-sql-direct.mjs\n');
    
    // Show first few lines of SQL
    const lines = sql.split('\n').slice(0, 30);
    console.log('Preview of SQL to run:');
    console.log('─'.repeat(80));
    console.log(lines.join('\n'));
    console.log('...\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyBillingMigration().catch(console.error);
