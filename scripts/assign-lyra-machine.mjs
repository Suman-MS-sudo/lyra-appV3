import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

console.log('\n🔧 Assigning Lyra machine to suman.phoenix@hotmail.com...\n');

// Get suman user ID
const { data: { users } } = await supabase.auth.admin.listUsers();
const sumanUser = users.find(u => u.email === 'suman.phoenix@hotmail.com');

console.log(`👤 suman.phoenix@hotmail.com → ${sumanUser.id}\n`);

// Update the Lyra machine
const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';

const { data: updated, error } = await supabase
  .from('vending_machines')
  .update({ customer_id: sumanUser.id })
  .eq('id', machineId)
  .select('id, name, customer_id');

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Updated machine:');
  console.log(`   Name: ${updated[0].name}`);
  console.log(`   ID: ${updated[0].id}`);
  console.log(`   Customer ID: ${updated[0].customer_id}\n`);
}

// Verify machine counts
const { data: lyraMachines, count: lyraCount } = await supabase
  .from('vending_machines')
  .select('id', { count: 'exact' })
  .eq('customer_id', sumanUser.id);

const mssworlzUser = users.find(u => u.email === 'mssworlz@gmail.com');
const { data: lntMachines, count: lntCount } = await supabase
  .from('vending_machines')
  .select('id', { count: 'exact' })
  .eq('customer_id', mssworlzUser.id);

console.log('✅ VERIFICATION:');
console.log(`   suman.phoenix@hotmail.com: ${lyraCount || 0} machines`);
console.log(`   mssworlz@gmail.com: ${lntCount || 0} machines\n`);
