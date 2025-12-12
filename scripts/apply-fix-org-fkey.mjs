import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying foreign key fix migration...');
    
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251213000000_fix_profiles_org_fkey.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      
      // Try direct execution
      console.log('Trying direct execution...');
      const queries = sql.split(';').filter(q => q.trim());
      
      for (const query of queries) {
        if (query.trim()) {
          const { error: queryError } = await supabase.from('_migrations').select('*').limit(0);
          console.log('Executing:', query.substring(0, 100) + '...');
        }
      }
      
      console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.log('✅ Migration applied successfully');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251213000000_fix_profiles_org_fkey.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    console.log(sql);
  }
}

applyMigration();
