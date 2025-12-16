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

async function checkCoinPayment() {
  console.log('🔍 Checking coin payment...\n');

  const paymentId = '86cda39c-d708-40a4-b4f5-9f4c536647f7';
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';

  // Get payment details
  console.log('1. Payment details:');
  const { data: payment } = await supabase
    .from('coin_payments')
    .select('*, products(name)')
    .eq('id', paymentId)
    .single();

  console.log(`   Amount: ₹${(payment.amount_in_paisa / 100).toFixed(2)}`);
  console.log(`   Product: ${payment.products?.name || 'Unknown'}`);
  console.log(`   Dispensed: ${payment.dispensed}`);
  console.log(`   Date: ${payment.created_at}\n`);

  // Get machine details
  console.log('2. Machine details:');
  const { data: machine } = await supabase
    .from('vending_machines')
    .select('id, name, location, customer_id')
    .eq('id', machineId)
    .single();

  if (!machine) {
    console.log('   ❌ Machine not found!\n');
    return;
  }

  console.log(`   Machine: ${machine.name} (${machine.location})`);
  console.log(`   Customer ID: ${machine.customer_id || 'NOT ASSIGNED'}\n`);

  if (!machine.customer_id) {
    console.log('❌ PROBLEM: Machine has no customer_id assigned!');
    console.log('   This is why it doesn\'t show in billing.\n');
    
    // Show available users
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, organization_id, organizations(name)')
      .not('organization_id', 'is', null)
      .limit(10);

    if (users && users.length > 0) {
      console.log('💡 Available users to assign:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.organizations?.name})`);
      });
      console.log(`\n   Run: UPDATE vending_machines SET customer_id = '<user_id>' WHERE id = '${machineId}';\n`);
    }
    return;
  }

  // Get customer profile
  console.log('3. Customer profile:');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, organization_id, organizations(name)')
    .eq('id', machine.customer_id)
    .single();

  if (!profile) {
    console.log('   ❌ Customer profile not found!\n');
    return;
  }

  console.log(`   Email: ${profile.email}`);
  console.log(`   Organization ID: ${profile.organization_id || 'NOT ASSIGNED'}`);
  console.log(`   Organization: ${profile.organizations?.name || 'None'}\n`);

  if (!profile.organization_id) {
    console.log('❌ PROBLEM: Customer is not linked to any organization!');
    console.log('   This is why the payment doesn\'t show in billing.\n');
    
    // Show available organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgs && orgs.length > 0) {
      console.log('💡 Available organizations:');
      orgs.forEach(org => {
        console.log(`   - ${org.name} (${org.id})`);
      });
      console.log(`\n   Run: UPDATE profiles SET organization_id = '<org_id>' WHERE id = '${profile.id}';\n`);
    }
    return;
  }

  // Check if payment would show in billing
  console.log('4. Billing visibility:');
  console.log(`   ✅ Payment is linked to organization: ${profile.organizations?.name}`);
  console.log(`   ✅ Should appear in billing for this organization\n`);

  // Verify the query used in billing page
  console.log('5. Testing billing query...');
  const { data: orgProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', profile.organization_id);

  const userIds = orgProfiles?.map(p => p.id) || [];
  console.log(`   Found ${userIds.length} user(s) in organization`);

  const { data: orgMachines } = await supabase
    .from('vending_machines')
    .select('id')
    .in('customer_id', userIds);

  const machineIds = orgMachines?.map(m => m.id) || [];
  console.log(`   Found ${machineIds.length} machine(s) for these users`);

  const { data: payments } = await supabase
    .from('coin_payments')
    .select('amount_in_paisa')
    .in('machine_id', machineIds)
    .eq('dispensed', true);

  const total = payments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
  console.log(`   Found ${payments?.length || 0} payment(s) - Total: ₹${(total / 100).toFixed(2)}\n`);

  if (payments && payments.length > 0) {
    console.log('✅ SUCCESS: Payment should be visible in billing page!');
    console.log('   If not showing, try refreshing the page or clearing cache.\n');
  } else {
    console.log('❌ Payment not found in query - there may be an issue with the data linkage.\n');
  }
}

checkCoinPayment().catch(console.error);
