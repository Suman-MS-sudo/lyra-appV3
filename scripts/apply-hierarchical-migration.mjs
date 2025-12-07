import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

async function applyMigration() {
  console.log('Applying hierarchical accounts migration...\n');
  
  const sql = readFileSync('supabase/migrations/20231207000004_hierarchical_accounts.sql', 'utf8');
  
  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 60) + '...');
    
    const { error } = await supabase.rpc('exec', {
      sql: statement + ';'
    });
    
    if (error) {
      console.error('Error:', error.message);
      
      // Try direct query for some statements
      try {
        const result = await fetch(
          `https://fjghhrubobqwplvokszz.supabase.co/rest/v1/rpc/exec`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
            },
            body: JSON.stringify({ sql: statement })
          }
        );
      } catch (e) {
        // Continue with next statement
      }
    } else {
      console.log('✅ Success\n');
    }
  }
  
  console.log('\n⚠️  Manual Step Required:');
  console.log('Go to https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql/new');
  console.log('and run the migration SQL from:');
  console.log('supabase/migrations/20231207000004_hierarchical_accounts.sql');
}

applyMigration();
