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

async function checkMissing() {
  const { data: allLntMachines, count } = await supabase
    .from('vending_machines')
    .select('id, name, customer_id', { count: 'exact' })
    .ilike('name', 'L&T-%')
    .order('name');

  console.log('Total L&T machines:', count);
  console.log('\nAll L&T machines:');
  allLntMachines.forEach((m, i) => {
    console.log(`${i + 1}. ${m.name}: customer_id = ${m.customer_id}`);
  });

  const orgIds = ['da44fafc-3b08-42b8-b634-3eabdf80fc91', '01822a65-c1d7-4719-bb9d-d2c64d35f017'];
  const missing = allLntMachines.filter(m => !orgIds.includes(m.customer_id));

  console.log(`\n=== ${missing.length} machines NOT in organization ===`);
  missing.forEach(m => console.log(`${m.name}: customer_id = ${m.customer_id}`));
}

checkMissing().catch(console.error);
