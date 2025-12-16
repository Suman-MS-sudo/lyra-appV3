import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMachineCustomer() {
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';
  const invalidCustomerId = '710cee6a-a298-4ede-8fdc-e531753f33c3';

  console.log('🔍 Finding correct customer...\n');

  // Get all profiles with organizations
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, organization_id, organizations(name)')
    .not('organization_id', 'is', null);

  if (!profiles || profiles.length === 0) {
    console.log('❌ No profiles with organizations found!\n');
    return;
  }

  console.log('Available customers:');
  profiles.forEach((profile, idx) => {
    console.log(`${idx + 1}. ${profile.email} - ${profile.organizations?.name}`);
    console.log(`   ID: ${profile.id}\n`);
  });

  // Get L&T organization
  const { data: lntOrg } = await supabase
    .from('organizations')
    .select('*')
    .ilike('name', '%Larsen%')
    .single();

  if (!lntOrg) {
    console.log('❌ L&T organization not found!\n');
    return;
  }

  console.log(`Found L&T organization: ${lntOrg.name} (${lntOrg.id})\n`);

  // Get L&T users
  const lntUsers = profiles.filter(p => p.organization_id === lntOrg.id);
  
  if (lntUsers.length === 0) {
    console.log('❌ No users in L&T organization!\n');
    return;
  }

  console.log(`L&T has ${lntUsers.length} user(s):`);
  lntUsers.forEach(user => {
    console.log(`   - ${user.email} (${user.id})`);
  });

  const targetUser = lntUsers[0];
  console.log(`\n💡 Assigning machine to: ${targetUser.email}\n`);

  // Update machine
  const { error } = await supabase
    .from('vending_machines')
    .update({ customer_id: targetUser.id })
    .eq('id', machineId);

  if (error) {
    console.log('❌ Error updating machine:', error.message);
    return;
  }

  console.log('✅ Machine updated successfully!');
  console.log(`   Machine ${machineId} now assigned to ${targetUser.email}\n`);

  // Verify
  const { data: updated } = await supabase
    .from('vending_machines')
    .select('*, profiles(email, organizations(name))')
    .eq('id', machineId)
    .single();

  console.log('Verification:');
  console.log(`   Machine: ${updated.name}`);
  console.log(`   Customer: ${updated.profiles?.email}`);
  console.log(`   Organization: ${updated.profiles?.organizations?.name}`);
  console.log('\n✅ Coin payment should now appear in billing page!\n');
}

fixMachineCustomer().catch(console.error);
