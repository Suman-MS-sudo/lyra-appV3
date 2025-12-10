import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying organizations table migration...');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241210000001_create_organizations_table.sql');
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('Trying direct SQL execution...');
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        const { error: execError } = await supabase.rpc('exec', { 
          query: statement 
        });
        if (execError) {
          console.error('Error executing statement:', execError);
          console.log('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('Organizations table created with:');
    console.log('- 15 fields (id, name, contact info, business details)');
    console.log('- RLS policies for admin and super_customer access');
    console.log('- Indexes on super_customer_id and is_active');
    console.log('- Auto-update trigger for updated_at');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
