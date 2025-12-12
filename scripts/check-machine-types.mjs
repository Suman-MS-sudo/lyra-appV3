import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return; // Skip empty lines and comments
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
    env[key] = value;
  }
});

console.log('Supabase URL:', env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing');
console.log('Service Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMachineTypes() {
  const machineId = '7ced716a-ee7c-477e-a38c-0554b1de7900';
  
  const { data, error } = await supabase
    .from('vending_machines')
    .select('id, name, machine_type, product_type')
    .eq('id', machineId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Machine Details ===');
  console.log('Machine ID:', data.id);
  console.log('Machine Name:', data.name);
  console.log('Machine Type (DB Value):', data.machine_type);
  console.log('Product Type (DB Value):', data.product_type);
  console.log('\n');
}

checkMachineTypes();
