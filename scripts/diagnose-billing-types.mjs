import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env file manually
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

console.log('🔍 Checking database column types...\n');

// Check organizations table
const { data: orgs, error: orgsError } = await supabase
  .from('organizations')
  .select('id, name')
  .limit(1);

if (orgsError) {
  console.log('❌ Organizations table:', orgsError.message);
} else {
  console.log('✅ Organizations table exists');
  console.log('   Sample ID type:', typeof orgs[0]?.id, '-', orgs[0]?.id);
}

// Check profiles table
const { data: profiles, error: profilesError } = await supabase
  .from('profiles')
  .select('id, organization_id')
  .not('organization_id', 'is', null)
  .limit(1);

if (profilesError) {
  console.log('❌ Profiles table:', profilesError.message);
} else {
  console.log('✅ Profiles table exists');
  console.log('   Sample organization_id type:', typeof profiles[0]?.organization_id, '-', profiles[0]?.organization_id);
}

// Check if billing tables exist
const { data: invoices, error: invoicesError } = await supabase
  .from('organization_invoices')
  .select('id, organization_id')
  .limit(1);

if (invoicesError) {
  console.log('❌ organization_invoices table:', invoicesError.message);
} else {
  console.log('✅ organization_invoices table exists');
  if (invoices[0]) {
    console.log('   Sample organization_id type:', typeof invoices[0]?.organization_id, '-', invoices[0]?.organization_id);
  }
}

// Check function exists - use profiles.organization_id (TEXT) not organizations.id (UUID)
const { data: fnTest, error: fnError } = await supabase
  .rpc('calculate_invoice_amounts', {
    p_organization_id: profiles[0]?.organization_id || 'test',
    p_period_start: '2025-12-01T00:00:00Z',
    p_period_end: '2025-12-31T23:59:59Z'
  });

if (fnError) {
  console.log('\n❌ Function test failed:', fnError.message);
  console.log('   Error hint:', fnError.hint);
} else {
  console.log('\n✅ Function calculate_invoice_amounts works!');
  console.log('   Result:', fnTest);
}

console.log('\n📋 Summary:');
console.log('- Organizations.id should match organization_invoices.organization_id type');
console.log('- Profiles.organization_id should also match');
console.log('\nIf types mismatch, the SQL migration needs to be re-run in Supabase Dashboard.');
