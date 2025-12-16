import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking profiles.organization_id column type...\n');

// Query to check the actual column type in PostgreSQL
const { data, error } = await supabase.rpc('exec_sql', {
  query: `
    SELECT 
      column_name, 
      data_type, 
      udt_name
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'organization_id';
  `
});

console.log('Result:', data, error);

// Try a direct query
const { data: profileData } = await supabase
  .from('profiles')
  .select('organization_id')
  .not('organization_id', 'is', null)
  .limit(1)
  .single();

console.log('\nSample organization_id value:', profileData?.organization_id);
console.log('Type:', typeof profileData?.organization_id);

console.log('\n📋 The issue: profiles.organization_id column type in database needs to match the function parameter type.');
