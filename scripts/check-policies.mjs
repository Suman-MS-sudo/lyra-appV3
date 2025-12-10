// Check current RLS policies on profiles table
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

console.log('📋 Checking RLS policies on profiles table...\n');

// Query pg_policies to see current policies
const { data, error } = await supabase
  .from('pg_policies')
  .select('*')
  .eq('tablename', 'profiles');

if (error) {
  console.error('Error:', error);
} else {
  console.log('Current policies:');
  data.forEach(policy => {
    console.log(`\n  Policy: "${policy.policyname}"`);
    console.log(`  Command: ${policy.cmd}`);
    console.log(`  Using: ${policy.qual}`);
  });
}

console.log('\n\n🔧 TO FIX: Run this in Supabase SQL Editor:');
console.log('=' .repeat(60));
console.log(`
-- First, disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "allow_read_own_profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "allow_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
`);
console.log('=' .repeat(60));
