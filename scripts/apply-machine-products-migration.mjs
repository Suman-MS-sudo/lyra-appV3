import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20231207000005_machine_products.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration: 20231207000005_machine_products.sql');
    console.log('---');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // Try direct query method
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';' 
          });
          
          if (stmtError) {
            console.error('Error executing statement:', stmtError);
            console.error('Statement:', statement.substring(0, 100) + '...');
          } else {
            console.log('✓ Executed statement');
          }
        }
      }
    } else {
      console.log('✓ Migration applied successfully');
    }

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

applyMigration();
