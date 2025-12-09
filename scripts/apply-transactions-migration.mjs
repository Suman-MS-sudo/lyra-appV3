import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://fjghhrubobqwplvokszz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Applying transactions table migration...\n');

try {
  // Read migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20231207000009_update_transactions.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log('Migration SQL:');
  console.log(sql);
  console.log('\n📝 Executing migration...\n');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.startsWith('COMMENT')) {
      console.log('⏭️  Skipping COMMENT statement');
      continue;
    }
    
    console.log(`Executing: ${statement.substring(0, 100)}...`);
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: statement + ';'
    });
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Success');
    }
  }

  console.log('\n✅ Migration complete!');
  console.log('\nVerifying table structure...');
  
  // Verify the changes
  const { data: columns, error: verifyError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'transactions'
        ORDER BY ordinal_position;
      `
    });
  
  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
  } else {
    console.log('\n📊 Transactions table structure:');
    console.table(columns);
  }

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
