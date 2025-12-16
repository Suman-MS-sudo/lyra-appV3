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

async function fixLyraMachine() {
  console.log('🔍 Checking Lyra organization setup...\n');

  // Get Lyra organization
  const { data: lyraOrg } = await supabase
    .from('organizations')
    .select('*')
    .eq('name', 'Lyra')
    .single();

  if (!lyraOrg) {
    console.log('❌ Lyra organization not found!');
    return;
  }

  console.log(`Organization: ${lyraOrg.name} (${lyraOrg.id})`);
  console.log(`Super Customer: ${lyraOrg.super_customer_id}\n`);

  // Check if super customer profile exists and has organization_id
  const { data: superCustomer } = await supabase
    .from('profiles')
    .select('id, email, organization_id')
    .eq('id', lyraOrg.super_customer_id)
    .single();

  if (!superCustomer) {
    console.log('❌ Super customer profile not found!');
    return;
  }

  console.log(`Super Customer: ${superCustomer.email}`);
  console.log(`Organization ID: ${superCustomer.organization_id || 'NOT ASSIGNED'}\n`);

  // If super customer doesn't have organization_id, assign it
  if (!superCustomer.organization_id) {
    console.log('💡 Assigning organization to super customer...');
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: lyraOrg.id })
      .eq('id', superCustomer.id);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    console.log('✅ Super customer linked to Lyra organization\n');
  }

  // Now update the machine
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';
  console.log('🔧 Updating machine assignment...');
  
  const { error: machineError } = await supabase
    .from('vending_machines')
    .update({ customer_id: lyraOrg.super_customer_id })
    .eq('id', machineId);

  if (machineError) {
    console.log('❌ Error:', machineError.message);
    return;
  }

  console.log('✅ Machine assigned to Lyra super customer\n');

  // Verify - need to refetch after update
  const { data: updatedCustomer } = await supabase
    .from('profiles')
    .select('email, organization_id, organizations(name)')
    .eq('id', lyraOrg.super_customer_id)
    .single();

  const { data: machine } = await supabase
    .from('vending_machines')
    .select('name')
    .eq('id', machineId)
    .single();

  console.log('Verification:');
  console.log(`   Machine: ${machine?.name || 'N/A'}`);
  console.log(`   Customer: ${updatedCustomer?.email || 'N/A'}`);
  console.log(`   Organization: ${updatedCustomer?.organizations?.name || 'N/A'}\n`);

  // Check coin payment
  const { data: payment } = await supabase
    .from('coin_payments')
    .select('amount_in_paisa')
    .eq('machine_id', machineId)
    .eq('dispensed', true)
    .single();

  if (payment) {
    console.log('💰 Coin Payment: ₹' + (payment.amount_in_paisa / 100).toFixed(2));
    console.log('✅ This should now appear under Lyra in billing page!\n');
  }
}

fixLyraMachine().catch(console.error);
