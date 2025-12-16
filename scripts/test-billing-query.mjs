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

async function testBillingQuery() {
  console.log('🔍 Testing billing page query logic...\n');

  // Calculate date ranges (same as billing page)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  console.log('Date ranges:');
  console.log(`  This Month: ${thisMonthStart.toISOString()} to ${nextMonthStart.toISOString()}`);
  console.log(`  Last Month: ${lastMonthStart.toISOString()} to ${thisMonthStart.toISOString()}\n`);

  // Get L&T organization
  const { data: lntOrg } = await supabase
    .from('organizations')
    .select('*')
    .ilike('name', '%Larsen%')
    .single();

  if (!lntOrg) {
    console.log('❌ L&T organization not found');
    return;
  }

  console.log(`Organization: ${lntOrg.name} (${lntOrg.id})\n`);

  // Step 1: Get profiles
  const { data: orgProfiles } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('organization_id', lntOrg.id);

  console.log(`Step 1: Found ${orgProfiles?.length || 0} profile(s)`);
  orgProfiles?.forEach(p => console.log(`  - ${p.email}`));
  console.log('');

  const userIds = orgProfiles?.map(p => p.id) || [];

  // Step 2: Get machines
  const { data: orgMachines } = await supabase
    .from('vending_machines')
    .select('id, name, customer_id')
    .in('customer_id', userIds);

  console.log(`Step 2: Found ${orgMachines?.length || 0} machine(s)`);
  orgMachines?.forEach(m => console.log(`  - ${m.name} (customer: ${m.customer_id})`));
  console.log('');

  const machineIds = orgMachines?.map(m => m.id) || [];

  // Step 3: Get THIS month coin payments
  const { data: thisMonthPayments, error: thisMonthError } = await supabase
    .from('coin_payments')
    .select('id, amount_in_paisa, created_at, dispensed, machine_id')
    .in('machine_id', machineIds)
    .gte('created_at', thisMonthStart.toISOString())
    .lt('created_at', nextMonthStart.toISOString())
    .eq('dispensed', true);

  console.log(`Step 3: This Month Payments Query`);
  console.log(`  Filter: created_at >= ${thisMonthStart.toISOString()}`);
  console.log(`  Filter: created_at < ${nextMonthStart.toISOString()}`);
  console.log(`  Filter: dispensed = true`);
  console.log(`  Filter: machine_id IN [${machineIds.slice(0, 3).join(', ')}...]`);
  
  if (thisMonthError) {
    console.log(`  ❌ Error: ${thisMonthError.message}\n`);
  } else {
    console.log(`  ✅ Found ${thisMonthPayments?.length || 0} payment(s)`);
    if (thisMonthPayments && thisMonthPayments.length > 0) {
      thisMonthPayments.forEach(p => {
        console.log(`     - ₹${(p.amount_in_paisa / 100).toFixed(2)} on ${p.created_at}`);
      });
      const total = thisMonthPayments.reduce((sum, p) => sum + p.amount_in_paisa, 0);
      console.log(`     Total: ₹${(total / 100).toFixed(2)}`);
    }
    console.log('');
  }

  // Step 4: Get LAST month coin payments
  const { data: lastMonthPayments, error: lastMonthError } = await supabase
    .from('coin_payments')
    .select('id, amount_in_paisa, created_at, dispensed, machine_id')
    .in('machine_id', machineIds)
    .gte('created_at', lastMonthStart.toISOString())
    .lt('created_at', thisMonthStart.toISOString())
    .eq('dispensed', true);

  console.log(`Step 4: Last Month Payments Query`);
  console.log(`  Filter: created_at >= ${lastMonthStart.toISOString()}`);
  console.log(`  Filter: created_at < ${thisMonthStart.toISOString()}`);
  console.log(`  Filter: dispensed = true`);
  
  if (lastMonthError) {
    console.log(`  ❌ Error: ${lastMonthError.message}\n`);
  } else {
    console.log(`  ✅ Found ${lastMonthPayments?.length || 0} payment(s)`);
    if (lastMonthPayments && lastMonthPayments.length > 0) {
      lastMonthPayments.forEach(p => {
        console.log(`     - ₹${(p.amount_in_paisa / 100).toFixed(2)} on ${p.created_at}`);
      });
      const total = lastMonthPayments.reduce((sum, p) => sum + p.amount_in_paisa, 0);
      console.log(`     Total: ₹${(total / 100).toFixed(2)}`);
    }
    console.log('');
  }

  // Check the actual coin payment
  console.log('Step 5: Check the actual coin payment in database');
  const { data: allPayments } = await supabase
    .from('coin_payments')
    .select('*')
    .eq('id', '86cda39c-d708-40a4-b4f5-9f4c536647f7')
    .single();

  if (allPayments) {
    console.log(`  Payment exists:`);
    console.log(`    ID: ${allPayments.id}`);
    console.log(`    Machine ID: ${allPayments.machine_id}`);
    console.log(`    Amount: ₹${(allPayments.amount_in_paisa / 100).toFixed(2)}`);
    console.log(`    Created: ${allPayments.created_at}`);
    console.log(`    Dispensed: ${allPayments.dispensed}`);
    console.log(`    Is in machineIds: ${machineIds.includes(allPayments.machine_id)}`);
  }
}

testBillingQuery().catch(console.error);
