import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateProductPrice() {
  try {
    console.log('Updating product price...\n');

    // First, get the machine and product IDs
    const { data: machine, error: machineError } = await supabase
      .from('vending_machines')
      .select('id, machine_id, name')
      .eq('machine_id', 'lyra_SNVM_003')
      .single();

    if (machineError) {
      console.error('Error finding machine:', machineError);
      return;
    }

    console.log('Found machine:', machine.name, '(', machine.machine_id, ')');

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('name', 'sanitary napkin XL')
      .single();

    if (productError) {
      console.error('Error finding product:', productError);
      return;
    }

    console.log('Found product:', product.name);

    // Update the price and stock in machine_products
    const { data: updated, error: updateError } = await supabase
      .from('machine_products')
      .update({ 
        price: '50.00',
        stock: 30  // Also setting stock
      })
      .eq('machine_id', machine.id)
      .eq('product_id', product.id)
      .select();

    if (updateError) {
      console.error('Error updating price:', updateError);
      return;
    }

    console.log('\n✅ Successfully updated!');
    console.log('Updated records:', updated);

    // Verify the update
    const { data: verification, error: verifyError } = await supabase
      .from('machine_products')
      .select(`
        price,
        stock,
        products (name),
        vending_machines (machine_id, name)
      `)
      .eq('machine_id', machine.id)
      .eq('product_id', product.id);

    if (!verifyError && verification) {
      console.log('\nVerification:');
      verification.forEach(record => {
        console.log(`  Product: ${record.products.name}`);
        console.log(`  Machine: ${record.vending_machines.name} (${record.vending_machines.machine_id})`);
        console.log(`  Price: ₹${record.price}`);
        console.log(`  Stock: ${record.stock}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

updateProductPrice();
