import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

async function checkAdmins() {
  console.log('Checking admin profiles...\n');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, account_type')
    .eq('role', 'admin');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${profiles.length} admin profile(s):\n`);
  profiles.forEach((p, i) => {
    console.log(`${i + 1}. Email: ${p.email}`);
    console.log(`   Role: ${p.role}`);
    console.log(`   Account Type: ${p.account_type}`);
    console.log(`   ID: ${p.id}`);
    console.log('');
  });
}

checkAdmins();
