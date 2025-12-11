import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Checking L&T Machines...\n');

// Get L&T organization
const { data: org } = await supabase
  .from('organizations')
  .select('*')
  .eq('name', 'Larsen and Toubro Limited')
  .single();

console.log('📋 L&T Organization:');
console.log(`  ID: ${org.id}`);
console.log(`  Super Customer ID: ${org.super_customer_id}`);
console.log(`  Contact Email: ${org.contact_email}\n`);

// Get super customer profile
const { data: superCustomer } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', org.super_customer_id)
  .single();

console.log('👤 Super Customer Profile:');
console.log(`  ID: ${superCustomer.id}`);
console.log(`  Email: ${superCustomer.email}`);
console.log(`  Role: ${superCustomer.role}`);
console.log(`  Account Type: ${superCustomer.account_type}\n`);

// Get machines for this organization
const { data: machines, count } = await supabase
  .from('vending_machines')
  .select('id, name, location, customer_id, organization_id', { count: 'exact' })
  .eq('organization_id', org.id);

console.log(`🏪 Machines in L&T Organization: ${count || 0}\n`);

if (machines && machines.length > 0) {
  console.log('First 5 machines:');
  machines.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name} (${m.location})`);
    console.log(`     Machine ID: ${m.id}`);
    console.log(`     Customer ID: ${m.customer_id}`);
    console.log(`     Organization ID: ${m.organization_id}\n`);
  });

  // Check customer_id values
  const uniqueCustomerIds = [...new Set(machines.map(m => m.customer_id))];
  console.log(`\n📊 Unique customer_id values in machines:`);
  uniqueCustomerIds.forEach(id => {
    const machineCount = machines.filter(m => m.customer_id === id).length;
    console.log(`  ${id}: ${machineCount} machines`);
  });

  console.log(`\n⚠️ Expected customer_id: ${org.super_customer_id}`);
  console.log(`✅ Machines with correct customer_id: ${machines.filter(m => m.customer_id === org.super_customer_id).length}`);
  console.log(`❌ Machines with wrong customer_id: ${machines.filter(m => m.customer_id !== org.super_customer_id).length}`);
}
