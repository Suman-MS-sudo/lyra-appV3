import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

async function fixRLS() {
  console.log('Fixing RLS policies for profiles table...\n');
  
  // The service role key bypasses RLS, so we'll check current policies first
  const { data: policies, error: policiesError } = await supabase
    .rpc('exec', {
      sql: `
        SELECT polname, polcmd 
        FROM pg_policy 
        WHERE polrelid = 'profiles'::regclass;
      `
    });
  
  console.log('Current policies:', policies);
  console.log('');
  
  console.log('To fix this issue, please:');
  console.log('1. Go to https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql/new');
  console.log('2. Run this SQL:\n');
  console.log('-- Allow authenticated users to read their own profile');
  console.log('DROP POLICY IF EXISTS "Users can view own profile" ON profiles;');
  console.log('CREATE POLICY "Users can view own profile"');
  console.log('ON profiles FOR SELECT');
  console.log('TO authenticated');
  console.log('USING (auth.uid() = id);');
  console.log('');
  console.log('-- Allow users to update their own profile');
  console.log('DROP POLICY IF EXISTS "Users can update own profile" ON profiles;');
  console.log('CREATE POLICY "Users can update own profile"');
  console.log('ON profiles FOR UPDATE');
  console.log('TO authenticated');
  console.log('USING (auth.uid() = id);');
}

fixRLS();
