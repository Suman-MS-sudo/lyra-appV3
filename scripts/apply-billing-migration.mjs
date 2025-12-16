import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
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

async function applyMigration() {
  console.log('📝 Applying organization billing migration...');
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251215000001_organization_billing.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const statement of statements) {
    try {
      if (statement.includes('CREATE') || statement.includes('ALTER') || statement.includes('GRANT')) {
        await supabase.rpc('exec_sql', { sql: statement });
        successCount++;
        console.log('✅ Statement executed successfully');
      }
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists')) {
        console.log('⚠️  Already exists, skipping...');
      } else {
        console.error('❌ Error:', error.message);
        errorCount++;
      }
    }
  }
  
  console.log(`\n✅ Migration applied: ${successCount} successful, ${errorCount} errors`);
}

applyMigration().catch(console.error);
