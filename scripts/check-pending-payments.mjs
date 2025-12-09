#!/usr/bin/env node
/**
 * Check for pending payments in the database
 * Usage: node scripts/check-pending-payments.mjs [MAC_ADDRESS]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables manually
const envPath = join(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
} catch (err) {
  console.error('⚠️  Could not load .env.local, using existing environment variables');
}

const macAddress = process.argv[2] || 'C0:CD:D6:84:85:DC';

console.log('🔍 Checking for pending payments...\n');
console.log('MAC Address:', macAddress);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Find machine by MAC
const { data: machine, error: machineError } = await supabase
  .from('vending_machines')
  .select('id, machine_id, name, mac_id')
  .ilike('mac_id', macAddress)
  .single();

if (machineError || !machine) {
  console.error('❌ Machine not found:', machineError?.message);
  process.exit(1);
}

console.log('\n✅ Machine found:');
console.log('   ID:', machine.id);
console.log('   Machine ID:', machine.machine_id);
console.log('   Name:', machine.name);
console.log('   MAC:', machine.mac_id);

// Check for pending payments
const { data: pendingPayments, error: paymentsError } = await supabase
  .from('transactions')
  .select('*')
  .eq('machine_id', machine.id)
  .eq('payment_status', 'paid')
  .order('created_at', { ascending: false });

if (paymentsError) {
  console.error('\n❌ Error fetching payments:', paymentsError.message);
  process.exit(1);
}

console.log('\n📊 Payment Summary:');
console.log(`   Total paid transactions: ${pendingPayments.length}`);

const notDispensed = pendingPayments.filter(p => !p.dispensed);
const dispensed = pendingPayments.filter(p => p.dispensed);

console.log(`   ✅ Dispensed: ${dispensed.length}`);
console.log(`   ⏳ Not dispensed: ${notDispensed.length}`);

if (notDispensed.length > 0) {
  console.log('\n🔔 PENDING PAYMENTS (not dispensed):');
  notDispensed.forEach((payment, index) => {
    console.log(`\n   Payment ${index + 1}:`);
    console.log(`   Transaction ID: ${payment.id}`);
    console.log(`   Razorpay Order: ${payment.razorpay_order_id}`);
    console.log(`   Amount: ₹${payment.total_amount || payment.amount}`);
    console.log(`   Created: ${new Date(payment.created_at).toLocaleString()}`);
    console.log(`   Items:`, JSON.parse(payment.items || '[]'));
  });
  
  console.log('\n⚠️  ESP32 should pick up these payments on next poll!');
} else {
  console.log('\n✅ No pending payments - all have been dispensed');
}

if (dispensed.length > 0) {
  console.log(`\n📜 Recently dispensed (last ${Math.min(3, dispensed.length)}):`);
  dispensed.slice(0, 3).forEach((payment, index) => {
    console.log(`   ${index + 1}. ${payment.razorpay_order_id} - ₹${payment.total_amount || payment.amount} (${new Date(payment.dispensed_at).toLocaleString()})`);
  });
}

console.log('\n✅ Check complete!\n');
