// Quick fix for RLS infinite recursion
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
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('🔧 Fixing RLS policies for profiles table...');

// The service role bypasses RLS, so we can query directly
const { data, error } = await supabase
  .from('profiles')
  .select('id, email, role')
  .limit(1);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Service role can access profiles');
  console.log('Sample:', data);
}

console.log('\n⚠️  The RLS policy has infinite recursion.');
console.log('To fix, run this SQL in Supabase SQL Editor:');
console.log('\n```sql');
console.log(`DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
`);
console.log('```\n');
