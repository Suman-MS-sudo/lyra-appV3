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

async function testTransactionsPageQuery() {
  console.log('🔍 Testing exact query from transactions page...\n');

  // Test the exact query used in transactions page
  console.log('1️⃣  Testing transactions query with FK join:');
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select(`
      *,
      profiles!transactions_customer_id_fkey (email),
      vending_machines!transactions_machine_id_fkey (name, location)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (txError) {
    console.error('❌ Error:', txError);
    console.log('\n2️⃣  Trying without FK hint:');
    
    const { data: txNoHint, error: txError2 } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles (email),
        vending_machines (name, location)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (txError2) {
      console.error('❌ Error without hint:', txError2);
    } else {
      console.log(`✅ Found ${txNoHint?.length || 0} transactions (without FK hint)`);
      console.table(txNoHint?.map(tx => ({
        id: tx.id.substring(0, 8),
        total_amount: tx.total_amount,
        machine_id: tx.machine_id?.substring(0, 8),
        machine_name: tx.vending_machines?.name,
        payment_status: tx.payment_status,
        created_at: new Date(tx.created_at).toLocaleString()
      })));
    }
  } else {
    console.log(`✅ Found ${transactions?.length || 0} transactions`);
    console.table(transactions?.map(tx => ({
      id: tx.id.substring(0, 8),
      total_amount: tx.total_amount,
      machine_id: tx.machine_id?.substring(0, 8),
      machine_name: tx.vending_machines?.name,
      payment_status: tx.payment_status,
      created_at: new Date(tx.created_at).toLocaleString()
    })));
  }

  // Test coin payments query
  console.log('\n3️⃣  Testing coin_payments query:');
  const { data: coinPayments, error: coinError } = await supabase
    .from('coin_payments')
    .select(`
      *,
      products (name),
      vending_machines (name, location)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (coinError) {
    console.error('❌ Error:', coinError);
  } else {
    console.log(`✅ Found ${coinPayments?.length || 0} coin payments`);
    console.table(coinPayments?.map(tx => ({
      id: tx.id.substring(0, 8),
      amount_in_paisa: tx.amount_in_paisa,
      product: tx.products?.name,
      machine: tx.vending_machines?.name,
      created_at: new Date(tx.created_at).toLocaleString()
    })));
  }

  // Calculate stats like the page does
  console.log('\n📊 Stats Calculation:');
  const onlineRevenue = transactions?.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;
  
  console.log(`  Online Revenue: ₹${onlineRevenue.toFixed(2)} (${transactions?.length || 0} transactions)`);
  console.log(`  Coin Revenue: ₹${coinRevenue.toFixed(2)} (${coinPayments?.length || 0} transactions)`);
  console.log(`  Total Revenue: ₹${totalRevenue.toFixed(2)}`);
  console.log(`  Total Count: ${(transactions?.length || 0) + (coinPayments?.length || 0)}`);
  
  const paidTransactions = transactions?.filter(tx => tx.payment_status === 'paid') || [];
  console.log(`  Paid transactions: ${paidTransactions.length}`);
}

testTransactionsPageQuery().catch(console.error);
