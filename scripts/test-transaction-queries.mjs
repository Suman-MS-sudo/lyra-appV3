import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables from .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQueries() {
  console.log('🔍 Testing transaction queries...\n');

  // Test 1: Get all transactions
  console.log('1️⃣  Fetching all transactions:');
  const { data: allTx, error: allError } = await supabase
    .from('transactions')
    .select('id, total_amount, payment_status, items, machine_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (allError) {
    console.error('❌ Error:', allError);
  } else {
    console.log(`✅ Found ${allTx?.length || 0} transactions`);
    console.table(allTx);
  }

  // Test 2: Get paid transactions
  console.log('\n2️⃣  Fetching paid transactions:');
  const { data: paidTx, error: paidError } = await supabase
    .from('transactions')
    .select('total_amount')
    .eq('payment_status', 'paid');

  if (paidError) {
    console.error('❌ Error:', paidError);
  } else {
    const revenue = paidTx?.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
    console.log(`✅ Found ${paidTx?.length || 0} paid transactions`);
    console.log(`💰 Total Revenue: ₹${revenue.toFixed(2)}`);
    console.table(paidTx);
  }

  // Test 3: Get recent transactions with items
  console.log('\n3️⃣  Fetching recent transactions with items:');
  const { data: recentTx, error: recentError } = await supabase
    .from('transactions')
    .select('total_amount, created_at, items')
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentError) {
    console.error('❌ Error:', recentError);
  } else {
    console.log(`✅ Found ${recentTx?.length || 0} recent transactions`);
    recentTx?.forEach(tx => {
      const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
      const productNames = items.map((item) => item.name).join(', ') || 'No items';
      console.log(`  - ₹${parseFloat(tx.total_amount || 0).toFixed(2)} - ${productNames} - ${new Date(tx.created_at).toLocaleString()}`);
    });
  }

  // Test 4: Get coin payments
  console.log('\n4️⃣  Fetching coin payments:');
  const { data: coinPayments, error: coinError } = await supabase
    .from('coin_payments')
    .select('amount_in_paisa, created_at, machine_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (coinError) {
    console.error('❌ Error:', coinError);
  } else {
    const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
    console.log(`✅ Found ${coinPayments?.length || 0} coin payments`);
    console.log(`💰 Coin Revenue: ₹${coinRevenue.toFixed(2)}`);
    console.table(coinPayments);
  }

  // Test 5: Combined stats
  console.log('\n📊 Combined Statistics:');
  const onlineRevenue = paidTx?.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  console.log(`  Online Revenue: ₹${onlineRevenue.toFixed(2)} (${paidTx?.length || 0} transactions)`);
  console.log(`  Coin Revenue: ₹${coinRevenue.toFixed(2)} (${coinPayments?.length || 0} transactions)`);
  console.log(`  Total Revenue: ₹${(onlineRevenue + coinRevenue).toFixed(2)}`);
  console.log(`  Total Transactions: ${(paidTx?.length || 0) + (coinPayments?.length || 0)}`);
}

testQueries().catch(console.error);
