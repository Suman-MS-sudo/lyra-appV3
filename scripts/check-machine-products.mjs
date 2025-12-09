import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
    env[key] = value;
  }
});

console.log('Using Supabase URL:', env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMachineProducts() {
  const machineId = 'lyra_SNVM_003';
  
  // Get machine
  const { data: machine, error: machineError } = await supabase
    .from('vending_machines')
    .select('id, machine_id, name')
    .eq('machine_id', machineId)
    .single();
  
  if (machineError || !machine) {
    console.log('❌ Machine not found:', machineError?.message);
    return;
  }
  
  console.log('✅ Machine found:');
  console.log('  ID:', machine.id);
  console.log('  Machine ID:', machine.machine_id);
  console.log('  Name:', machine.name);
  console.log();
  
  // Get products assigned to this machine
  const { data: machineProducts, error: productsError } = await supabase
    .from('machine_products')
    .select(`
      id,
      product_id,
      stock,
      price,
      products (
        id,
        name,
        description
      )
    `)
    .eq('machine_id', machine.id);
  
  if (productsError) {
    console.log('❌ Error fetching products:', productsError.message);
    return;
  }
  
  console.log('📦 Products assigned to this machine:');
  if (!machineProducts || machineProducts.length === 0) {
    console.log('   ⚠️  No products assigned!');
    console.log();
    console.log('   The ESP32 is trying to update product_id: 1');
    console.log('   But there are no products in machine_products table for this machine.');
    console.log();
    console.log('   👉 You need to assign products to this machine in the admin panel.');
  } else {
    machineProducts.forEach((mp, i) => {
      console.log(`   ${i + 1}. ${mp.products?.name || 'Unknown'}`);
      console.log(`      Product ID: ${mp.product_id}`);
      console.log(`      Stock: ${mp.stock}`);
      console.log(`      Price: ₹${mp.price}`);
      console.log();
    });
  }
}

checkMachineProducts();
