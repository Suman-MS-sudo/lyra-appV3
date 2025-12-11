import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

const machineIds = [
  '734a041d-11a0-4463-8bad-749242ff78de', // L&T-1
  '913b4e3a-4d17-448b-8c09-9835f2fe1e39', // L&T-2
  '9e32b549-28de-469f-aeb2-5a629cd52110', // L&T-3
  '858a1e0e-aa42-4bab-a30f-5d7735aaceed', // L&T-4
  '29b2c138-ab57-425d-8e2b-362793904682', // L&T-5
  '12bf6da2-8908-495b-98fd-44b81e966435', // L&T-6
  '2190af60-ced4-4e04-a40e-c928eb779881', // L&T-7
  '5ce12b15-0351-4992-949c-3bb62bddca77', // L&T-8
  '7ad9917f-8174-4948-b89f-ddc235d83f75', // L&T-9
  '870b2312-85c6-4eb5-ac79-eb5639599799', // L&T-10
  '2adf3a9f-b7fc-4eb9-8339-1f528d79d29b', // L&T-11
  'b3d18e51-d1d7-4d31-8bbb-88b10161ce11', // L&T-12
  '2c36816e-8567-4a62-88d6-7150b9fd6724', // L&T-13
  '3e362491-dcf8-497a-abec-43d36f4bfaf2', // L&T-14
  'bf8ae376-eea9-4332-952d-7703cdaf07be', // L&T-15
  '3fd460f3-b9b4-43d3-8f47-e307c4f0d3a3', // L&T-16
  '76db3788-067b-4cb6-8b8f-318dbfb150ae', // L&T-17
  'ad8fcda9-76cc-43f0-b40e-8f4af47fadbe', // L&T-18
  '726d2ef8-922c-429f-a73b-e60f721a9914', // L&T-19
  'ceb4907f-0f79-41ee-9cc2-100e368136a9', // L&T-20 (already exists)
  '6925dc49-b209-4d70-92a4-acad58479d74', // L&T-21
  'd9d63ae4-6d59-4cdb-81a8-9af87a262cd1', // L&T-22
  '739d7b15-c505-4dcd-b0de-7a602d0752d1', // L&T-23
  '60aa65ed-a534-401a-ab64-cc7252c14e7b', // L&T-24
];

const productId = '3363667a-1551-4e89-9fc6-d26d526256ad';

console.log('\n🔧 Adding machine-product mappings for L&T machines...\n');

// Check which machines already have this product
const { data: existing } = await supabase
  .from('machine_products')
  .select('machine_id')
  .eq('product_id', productId)
  .in('machine_id', machineIds);

const existingMachineIds = existing?.map(e => e.machine_id) || [];
const newMachineIds = machineIds.filter(id => !existingMachineIds.includes(id));

console.log(`📊 Status:`);
console.log(`   Total machines: ${machineIds.length}`);
console.log(`   Already mapped: ${existingMachineIds.length}`);
console.log(`   To be added: ${newMachineIds.length}\n`);

if (newMachineIds.length === 0) {
  console.log('✅ All machines already have the product mapped!\n');
  process.exit(0);
}

// Create machine_product entries for new machines
const machineProducts = newMachineIds.map(machineId => ({
  machine_id: machineId,
  product_id: productId,
  stock: 0,
  slot_number: null,
  is_active: 1,
  price: '0.00'
}));

const { data: inserted, error } = await supabase
  .from('machine_products')
  .insert(machineProducts)
  .select();

if (error) {
  console.error('❌ Error inserting machine products:', error);
  process.exit(1);
}

console.log(`✅ Successfully added ${inserted.length} machine-product mappings\n`);

// Verify final count
const { count } = await supabase
  .from('machine_products')
  .select('*', { count: 'exact', head: true })
  .eq('product_id', productId)
  .in('machine_id', machineIds);

console.log(`✅ Total machines with product: ${count}/${machineIds.length}\n`);
