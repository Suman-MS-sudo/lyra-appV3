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

async function fixMachine() {
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';
  const newCustomerId = 'da44fafc-3b08-42b8-b634-3eabdf80fc91'; // mssworlz@gmail.com from L&T

  console.log('🔧 Updating machine assignment...\n');

  const { error } = await supabase
    .from('vending_machines')
    .update({ customer_id: newCustomerId })
    .eq('id', machineId);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log('✅ Machine updated successfully!\n');

  // Verify
  const { data: machine, error: machineError } = await supabase
    .from('vending_machines')
    .select('*')
    .eq('id', machineId)
    .single();

  if (machineError || !machine) {
    console.log('❌ Could not verify machine:', machineError?.message || 'Not found');
    return;
  }

  console.log('Verification:');
  console.log(`   Machine: ${machine.name || 'N/A'} (${machine.location || 'N/A'})`);
  console.log(`   Customer ID: ${machine.customer_id}\n`);
  
  // Get customer details separately
  const { data: customer } = await supabase
    .from('profiles')
    .select('email, organization_id')
    .eq('id', machine.customer_id)
    .single();
    
  if (customer) {
    console.log(`   Customer: ${customer.email}`);
    
    if (customer.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', customer.organization_id)
        .single();
      console.log(`   Organization: ${org?.name || 'N/A'}\n`);
    } else {
      console.log('   Organization: NOT ASSIGNED\n');
    }
  }

  // Check if coin payment is now visible
  const { data: payment } = await supabase
    .from('coin_payments')
    .select('amount_in_paisa, products(name)')
    .eq('machine_id', machineId)
    .eq('dispensed', true)
    .single();

  if (payment) {
    console.log('💰 Coin Payment:');
    console.log(`   Product: ${payment.products?.name || 'N/A'}`);
    console.log(`   Amount: ₹${(payment.amount_in_paisa / 100).toFixed(2)}\n`);
    console.log('✅ This payment should now appear in the billing page!\n');
  }
}

fixMachine().catch(console.error);
