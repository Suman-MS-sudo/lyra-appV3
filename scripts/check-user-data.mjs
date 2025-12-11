import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

const email = 'mssworlz@gmail.com';

console.log(`\n🔍 Checking data for ${email}...\n`);

// Get user
const { data: { users } } = await supabase.auth.admin.listUsers();
const user = users.find(u => u.email === email);

if (!user) {
  console.log('❌ User not found');
  process.exit(1);
}

console.log(`✅ User ID: ${user.id}\n`);

// Get machines
const { data: machines, count: machineCount } = await supabase
  .from('vending_machines')
  .select('id, name, location', { count: 'exact' })
  .eq('customer_id', user.id);

console.log(`🏪 Machines: ${machineCount || 0}`);
if (machines && machines.length > 0) {
  machines.slice(0, 5).forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name} (${m.location})`);
  });
  if (machines.length > 5) {
    console.log(`   ... and ${machines.length - 5} more`);
  }
  console.log('');
}

const machineIds = machines?.map(m => m.id) || [];

// Get products in these machines
const { data: products, count: productCount } = await supabase
  .from('products')
  .select('id, name, vending_machine_id', { count: 'exact' })
  .in('vending_machine_id', machineIds);

console.log(`📦 Products in machines: ${productCount || 0}`);
if (products && products.length > 0) {
  products.slice(0, 10).forEach((p, i) => {
    const machine = machines.find(m => m.id === p.vending_machine_id);
    console.log(`   ${i + 1}. ${p.name} (in ${machine?.name})`);
  });
  if (products.length > 10) {
    console.log(`   ... and ${products.length - 10} more`);
  }
  console.log('');
}

// Get transactions
const { data: transactions, count: txCount } = await supabase
  .from('transactions')
  .select('id, amount, created_at', { count: 'exact' })
  .in('vending_machine_id', machineIds);

console.log(`💳 Online Transactions: ${txCount || 0}`);

// Get coin payments
const { data: coinPayments, count: coinCount } = await supabase
  .from('coin_payments')
  .select('id, amount_in_paisa, created_at', { count: 'exact' })
  .in('machine_id', machineIds);

console.log(`🪙 Coin Payments: ${coinCount || 0}\n`);

if (machineCount === 0) {
  console.log('⚠️  No machines found - dashboard will be empty');
} else if (productCount === 0) {
  console.log('⚠️  No products found in machines - products section will be empty');
} else {
  console.log('✅ Data looks good!');
}

console.log('');
