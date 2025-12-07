import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjghhrubobqwplvokszz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw';
const supabase = createClient(supabaseUrl, supabaseKey);

const MAC_ADDRESS = 'C0:CD:D6:84:85:DC';
const API_URL = `http://localhost:3000/api/payment_success?mac=${encodeURIComponent(MAC_ADDRESS)}`;

console.log('🧪 Creating Test Payment Transaction\n');
console.log('='.repeat(70));

// Get machine
const { data: machine, error: machineError } = await supabase
  .from('vending_machines')
  .select('id, machine_id, name, mac_id')
  .eq('mac_id', MAC_ADDRESS)
  .single();

if (machineError || !machine) {
  console.error('❌ Machine not found');
  process.exit(1);
}

console.log(`\n✅ Machine: ${machine.name} (${machine.machine_id})`);

// Get a user for the transaction
const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

if (userError || !users || users.length === 0) {
  console.error('❌ No users found in database');
  process.exit(1);
}

const testUser = users[0];
console.log(`✅ User: ${testUser.id}`);

// Get a product
const { data: products } = await supabase
  .from('machine_products')
  .select('id, price, product:products(id, name)')
  .eq('machine_id', machine.id)
  .gt('stock', 0)
  .limit(1);

if (!products || products.length === 0) {
  console.error('❌ No products available');
  process.exit(1);
}

const product = products[0];
console.log(`✅ Product: ${product.product.name} - ₹${product.price}`);

// Create test transaction
console.log('\n💳 Creating test transaction...');
const { data: transaction, error: txError } = await supabase
  .from('transactions')
  .insert({
    user_id: testUser.id, // Required by old schema
    product_id: product.product.id, // Required by old schema
    vending_machine_id: machine.id, // Required by old schema
    amount: parseFloat(product.price), // Required by old schema
    machine_id: machine.id, // New schema
    total_amount: parseFloat(product.price),
    payment_status: 'paid',
    payment_method: 'razorpay',
    razorpay_order_id: 'order_test_' + Date.now(),
    razorpay_payment_id: 'pay_test_' + Date.now(),
    dispensed: false,
  })
  .select()
  .single();

if (txError) {
  console.error('❌ Transaction creation failed:', txError.message);
  process.exit(1);
}

console.log(`✅ Transaction created: ${transaction.id}`);

// Create transaction item
const { error: itemError } = await supabase
  .from('transaction_items')
  .insert({
    transaction_id: transaction.id,
    machine_product_id: product.id,
    quantity: 1,
    price: product.price,
  });

if (itemError) {
  console.error('⚠️  Transaction item creation failed:', itemError.message);
  console.log('   (Continuing anyway - may work without items table)');
}

// Test API endpoint
console.log('\n📡 Testing ESP32 API endpoint...');
console.log(`   ${API_URL}\n`);

let response, result;
try {
  response = await fetch(API_URL);
  result = await response.json();
} catch (error) {
  if (error.cause?.code === 'ECONNREFUSED') {
    console.log('⚠️  Dev server not running!');
    console.log('   Start it with: npm run dev');
    console.log('\n   Then test the API manually:');
    console.log(`   ${API_URL}`);
    console.log(`\n✅ Transaction created successfully: ${transaction.id}`);
    console.log('   The ESP32 will receive payment when server is running!\n');
    process.exit(0);
  }
  throw error;
}

console.log('Response:');
console.log(JSON.stringify(result, null, 2));

if (result.data?.status === 'success') {
  console.log('\n🎉 SUCCESS! ESP32 will receive payment notification!');
  console.log(`\nProducts to dispense:`);
  result.data.products?.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.product.name} x${p.quantity}`);
  });
} else {
  console.log('\n❌ Failed - payment not detected');
}

// Check if marked as dispensed
console.log('\n📊 Checking if transaction was marked as dispensed...');
const { data: updated } = await supabase
  .from('transactions')
  .select('dispensed, dispensed_at')
  .eq('id', transaction.id)
  .single();

console.log(`   Dispensed: ${updated.dispensed}`);
console.log(`   Dispensed At: ${updated.dispensed_at || 'N/A'}`);

// Test second call
console.log('\n🔁 Testing second API call (should be empty)...');
const response2 = await fetch(API_URL);
const result2 = await response2.json();

if (result2.data?.status === 'No pending payments') {
  console.log('✅ CORRECT! No pending payments (already dispensed)');
} else {
  console.log('⚠️  Unexpected response:', result2);
}

console.log('\n' + '='.repeat(70));
console.log('✅ Test completed!\n');
