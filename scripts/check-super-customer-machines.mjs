import { createClient } from '@supabase/supabase-js';

// Load env vars manually
import { readFileSync } from 'fs';
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMachines() {
  // Get super customer profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, account_type, organization_id')
    .eq('email', 'mssworlz@gmail.com')
    .single();

  console.log('Super customer profile:');
  console.log(JSON.stringify(profile, null, 2));

  if (!profile?.organization_id) {
    console.log('\nNo organization_id found!');
    return;
  }

  // Get all users in the organization
  const { data: orgUsers } = await supabase
    .from('profiles')
    .select('id, email, account_type')
    .eq('organization_id', profile.organization_id);

  console.log('\nUsers in organization:');
  console.log(JSON.stringify(orgUsers, null, 2));

  const userIds = orgUsers?.map(u => u.id) || [];
  console.log('\nUser IDs:', userIds);

  // Get machines for all organization users
  const { data: machines, count } = await supabase
    .from('vending_machines')
    .select('id, name, customer_id', { count: 'exact' })
    .in('customer_id', userIds);

  console.log('\n=== MACHINES COUNT:', count, '===');
  
  // Group by customer
  const byCustomer = {};
  machines?.forEach(m => {
    const owner = orgUsers.find(u => u.id === m.customer_id);
    const ownerEmail = owner?.email || 'unknown';
    if (!byCustomer[ownerEmail]) {
      byCustomer[ownerEmail] = [];
    }
    byCustomer[ownerEmail].push(m.name);
  });

  console.log('\nMachines by owner:');
  Object.entries(byCustomer).forEach(([email, machineNames]) => {
    console.log(`\n${email}: ${machineNames.length} machines`);
    machineNames.forEach(name => console.log(`  - ${name}`));
  });
}

checkMachines().catch(console.error);
