import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrphanedMachines() {
  console.log('Finding orphaned machines (assigned to deleted users)...\n');

  // Get all machine customer_ids
  const { data: machines } = await supabase
    .from('vending_machines')
    .select('id, name, customer_id')
    .ilike('name', 'L&T-%');

  // Check each customer_id to see if profile exists
  const orphaned = [];
  for (const machine of machines) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', machine.customer_id)
      .single();

    if (!profile) {
      orphaned.push(machine);
    }
  }

  console.log(`Found ${orphaned.length} orphaned machines:`);
  orphaned.forEach(m => console.log(`- ${m.name} (id: ${m.id})`));

  if (orphaned.length === 0) {
    console.log('No orphaned machines found!');
    return;
  }

  // Reassign to mssworlz@gmail.com
  const superCustomerId = 'da44fafc-3b08-42b8-b634-3eabdf80fc91';
  console.log(`\nReassigning to super customer (${superCustomerId})...`);

  const { error } = await supabase
    .from('vending_machines')
    .update({ customer_id: superCustomerId })
    .in('id', orphaned.map(m => m.id));

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`✅ Successfully reassigned ${orphaned.length} machines to mssworlz@gmail.com`);
  }
}

fixOrphanedMachines().catch(console.error);
