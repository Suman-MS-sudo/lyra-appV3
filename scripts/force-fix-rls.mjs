// Force fix RLS policies via Supabase service role
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Force fixing RLS policies...\n');

// The SQL to execute
const sql = `
-- Disable RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create new simple policies
CREATE POLICY "profiles_read_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
`;

console.log('📋 SQL to execute:');
console.log('='.repeat(60));
console.log(sql);
console.log('='.repeat(60));

console.log('\n⚠️  IMPORTANT: This script cannot execute DDL directly.');
console.log('Please run the SQL above in Supabase Dashboard at:');
console.log('https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql/new\n');

// Try to verify current state
console.log('📊 Current profile access test (using service role):');
const { data, error } = await supabase
  .from('profiles')
  .select('id, email, role')
  .limit(1);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Service role can access:', data);
}
