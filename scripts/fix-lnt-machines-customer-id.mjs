import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

console.log('\n🔧 Fixing L&T Machines Customer ID...\n');

// Get L&T organization
const { data: org } = await supabase
  .from('organizations')
  .select('id, name, super_customer_id')
  .eq('name', 'Larsen and Toubro Limited')
  .single();

console.log(`📋 Organization: ${org.name}`);
console.log(`   Organization ID: ${org.id}`);
console.log(`   Super Customer ID: ${org.super_customer_id}\n`);

// Get machines with wrong customer_id (pointing to org instead of user)
const { data: wrongMachines, count } = await supabase
  .from('vending_machines')
  .select('id, name, customer_id', { count: 'exact' })
  .eq('customer_id', org.id); // Currently pointing to organization ID

console.log(`❌ Found ${count} machines with wrong customer_id (pointing to org ID)\n`);

if (count > 0) {
  // Update all machines to point to the super_customer profile ID
  const { data: updated, error } = await supabase
    .from('vending_machines')
    .update({ customer_id: org.super_customer_id })
    .eq('customer_id', org.id)
    .select('id, name, customer_id');

  if (error) {
    console.error('❌ Error updating machines:', error);
  } else {
    console.log(`✅ Updated ${updated.length} machines`);
    console.log(`   Changed customer_id from: ${org.id}`);
    console.log(`   Changed customer_id to:   ${org.super_customer_id}\n`);
    
    console.log('📝 Sample updated machines:');
    updated.slice(0, 5).forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name} - customer_id: ${m.customer_id}`);
    });
  }
}

// Verify the fix
const { count: correctCount } = await supabase
  .from('vending_machines')
  .select('id', { count: 'exact' })
  .eq('customer_id', org.super_customer_id);

console.log(`\n✅ Verification: ${correctCount} machines now correctly point to super_customer profile\n`);
