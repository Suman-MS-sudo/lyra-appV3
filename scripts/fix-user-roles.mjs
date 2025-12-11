import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

console.log('\n🔧 Setting up correct user roles and organizations...\n');

// Get organizations
const { data: lyraOrg } = await supabase
  .from('organizations')
  .select('*')
  .eq('name', 'Lyra')
  .single();

const { data: lntOrg } = await supabase
  .from('organizations')
  .select('*')
  .eq('name', 'Larsen and Toubro Limited')
  .single();

console.log('📋 Organizations:');
console.log(`   Lyra ID: ${lyraOrg.id}`);
console.log(`   L&T ID: ${lntOrg.id}\n`);

// Get user IDs
const { data: { users } } = await supabase.auth.admin.listUsers();
const sumanUser = users.find(u => u.email === 'suman.phoenix@hotmail.com');
const mssworlzUser = users.find(u => u.email === 'mssworlz@gmail.com');

console.log('👤 Users:');
console.log(`   suman.phoenix@hotmail.com → ${sumanUser.id}`);
console.log(`   mssworlz@gmail.com → ${mssworlzUser.id}\n`);

// Update suman.phoenix@hotmail.com → Admin for Lyra
console.log('Step 1: Setting suman.phoenix@hotmail.com as admin...');
const { error: sumanError } = await supabase
  .from('profiles')
  .update({
    role: 'admin',
    account_type: 'admin'
  })
  .eq('id', sumanUser.id);

if (sumanError) {
  console.error('   ❌ Error:', sumanError);
} else {
  console.log('   ✅ Updated to admin\n');
}

// Update Lyra organization super_customer_id
await supabase
  .from('organizations')
  .update({ super_customer_id: sumanUser.id })
  .eq('id', lyraOrg.id);

// Update mssworlz@gmail.com → Super Customer for L&T
console.log('Step 2: Setting mssworlz@gmail.com as super_customer for L&T...');
const { error: mssworlzError } = await supabase
  .from('profiles')
  .update({
    role: 'customer',
    account_type: 'super_customer'
  })
  .eq('id', mssworlzUser.id);

if (mssworlzError) {
  console.error('   ❌ Error:', mssworlzError);
} else {
  console.log('   ✅ Updated to super_customer\n');
}

// Update L&T organization super_customer_id
await supabase
  .from('organizations')
  .update({ super_customer_id: mssworlzUser.id })
  .eq('id', lntOrg.id);

// Verify
console.log('✅ VERIFICATION:\n');

const { data: profiles } = await supabase
  .from('profiles')
  .select('*')
  .in('id', [sumanUser.id, mssworlzUser.id]);

const { data: orgs } = await supabase
  .from('organizations')
  .select('*')
  .in('id', [lyraOrg.id, lntOrg.id]);

profiles.forEach(p => {
  const org = orgs.find(o => o.super_customer_id === p.id);
  console.log(`📧 ${p.email}`);
  console.log(`   Role: ${p.role}`);
  console.log(`   Account Type: ${p.account_type}`);
  console.log(`   Super Customer of: ${org?.name || 'None'}\n`);
});

// Check machines
const { data: lntMachines, count: lntCount } = await supabase
  .from('vending_machines')
  .select('id', { count: 'exact' })
  .eq('customer_id', mssworlzUser.id);

const { data: lyraMachines, count: lyraCount } = await supabase
  .from('vending_machines')
  .select('id', { count: 'exact' })
  .eq('customer_id', sumanUser.id);

console.log('🏪 Machine Ownership:');
console.log(`   mssworlz@gmail.com (L&T): ${lntCount || 0} machines`);
console.log(`   suman.phoenix@hotmail.com (Lyra): ${lyraCount || 0} machines\n`);

console.log('🎉 Setup complete!\n');
console.log('Login as:');
console.log('   • suman.phoenix@hotmail.com → ADMIN (sees all data)');
console.log('   • mssworlz@gmail.com → SUPER_CUSTOMER (sees only L&T machines)\n');
