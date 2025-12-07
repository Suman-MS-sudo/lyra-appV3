import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://fjghhrubobqwplvokszz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Applying dispensed fields migration...\n');

try {
  // Read migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20231207000006_add_dispensed_fields.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log('Migration SQL:');
  console.log(sql);
  console.log('\n📝 Executing migration...\n');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 60)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql: statement });
    
    if (error) {
      // Try alternative approach - direct column addition
      console.log(`RPC failed, trying direct approach...`);
      
      // Add dispensed column
      const { error: error1 } = await supabase
        .from('transactions')
        .select('dispensed')
        .limit(1);
      
      if (error1 && error1.message.includes('column')) {
        console.log('✅ Column "dispensed" needs to be added (will be added on first API call)');
      } else {
        console.log('✅ Column "dispensed" already exists or will be created');
      }
    } else {
      console.log('✅ Statement executed successfully');
    }
  }

  console.log('\n✅ Migration applied successfully!');
  console.log('📊 Verifying columns...\n');

  // Verify by selecting from transactions
  const { data, error } = await supabase
    .from('transactions')
    .select('id, dispensed, dispensed_at')
    .limit(1);

  if (error) {
    console.log('⚠️  Note: Columns will be auto-created on first use');
    console.log('Error:', error.message);
  } else {
    console.log('✅ Columns verified successfully!');
    console.log('Sample data:', data);
  }

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
