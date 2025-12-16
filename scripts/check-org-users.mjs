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

async function checkOrgs() {
  console.log('📊 Organizations and Users:\n');

  const { data: orgs } = await supabase
    .from('organizations')
    .select('*');

  for (const org of orgs || []) {
    console.log(`${org.name} (${org.id})`);
    
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('organization_id', org.id);

    if (users && users.length > 0) {
      users.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    } else {
      console.log('   (no users assigned)');
    }
    console.log('');
  }

  // Now check the machine with the coin payment
  console.log('🔧 Machine with coin payment:');
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';
  
  const { data: machine } = await supabase
    .from('vending_machines')
    .select('*, profiles(email, organization_id)')
    .eq('id', machineId)
    .single();

  console.log(`   Name: ${machine.name}`);
  console.log(`   Customer ID: ${machine.customer_id}`);
  console.log(`   Customer Email: ${machine.profiles?.email || 'NOT FOUND'}`);
  console.log(`   Customer Org ID: ${machine.profiles?.organization_id || 'NOT ASSIGNED'}\n`);

  if (!machine.profiles) {
    console.log('❌ PROBLEM: Machine customer_id points to non-existent profile!\n');
    console.log('💡 SOLUTION: Assign machine to an existing user with an organization.\n');
    
    // Show L&T users if they exist
    const { data: lntOrg } = await supabase
      .from('organizations')
      .select('*')
      .ilike('name', '%Larsen%')
      .maybeSingle();

    if (lntOrg) {
      const { data: lntUsers } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('organization_id', lntOrg.id);

      if (lntUsers && lntUsers.length > 0) {
        console.log('Suggested user to assign machine to:');
        console.log(`   ${lntUsers[0].email} (${lntUsers[0].id})\n`);
        console.log('Run this SQL:');
        console.log(`   UPDATE vending_machines SET customer_id = '${lntUsers[0].id}' WHERE id = '${machineId}';\n`);
      }
    }
  } else if (!machine.profiles.organization_id) {
    console.log('❌ PROBLEM: Machine customer is not linked to any organization!\n');
    console.log(`💡 SOLUTION: Assign organization_id to profile ${machine.profiles.email}\n`);
  } else {
    console.log('✅ Machine is properly linked to an organization!\n');
  }
}

checkOrgs().catch(console.error);
