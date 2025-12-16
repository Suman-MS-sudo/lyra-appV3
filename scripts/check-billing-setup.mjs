import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBillingSetup() {
  console.log('🔍 Checking billing system setup...\n');

  // 1. Check if tables exist
  console.log('1. Checking if billing tables exist...');
  try {
    const { data: invoices, error: invError } = await supabase
      .from('organization_invoices')
      .select('id')
      .limit(1);
    
    if (invError && invError.code === '42P01') {
      console.log('❌ organization_invoices table does not exist');
      console.log('   Run: node scripts/apply-billing-migration.mjs\n');
      return;
    }
    console.log('✅ Billing tables exist\n');
  } catch (error) {
    console.log('❌ Error checking tables:', error.message);
    return;
  }

  // 2. Check organizations
  console.log('2. Checking organizations...');
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgError) {
    console.log('❌ Error fetching organizations:', orgError.message);
    return;
  }

  if (!orgs || orgs.length === 0) {
    console.log('❌ No organizations found');
    console.log('   You need to create organizations first in /admin/organizations\n');
    return;
  }

  console.log(`✅ Found ${orgs.length} organization(s):`);
  orgs.forEach(org => console.log(`   - ${org.name}`));
  console.log('');

  // 3. Check profiles linked to organizations
  console.log('3. Checking profiles linked to organizations...');
  for (const org of orgs) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, organization_id')
      .eq('organization_id', org.id);

    console.log(`   ${org.name}: ${profiles?.length || 0} user(s)`);
    
    if (profiles && profiles.length > 0) {
      // Check machines for these users
      const userIds = profiles.map(p => p.id);
      const { data: machines } = await supabase
        .from('vending_machines')
        .select('id, name, customer_id')
        .in('customer_id', userIds);

      console.log(`   ${org.name}: ${machines?.length || 0} machine(s)`);

      if (machines && machines.length > 0) {
        // Check coin payments for these machines
        const machineIds = machines.map(m => m.id);
        const { data: payments } = await supabase
          .from('coin_payments')
          .select('id, amount_in_paisa, created_at')
          .in('machine_id', machineIds)
          .eq('dispensed', true);

        const totalAmount = payments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
        console.log(`   ${org.name}: ${payments?.length || 0} coin payment(s) - ₹${(totalAmount / 100).toFixed(2)}`);
      }
    }
  }
  console.log('');

  // 4. Check existing invoices
  console.log('4. Checking existing invoices...');
  const { data: invoices } = await supabase
    .from('organization_invoices')
    .select('invoice_number, status, total_amount_paisa, organizations(name)');

  if (!invoices || invoices.length === 0) {
    console.log('❌ No invoices generated yet');
    console.log('   Click "Generate Monthly Invoices" button in /admin/billing\n');
  } else {
    console.log(`✅ Found ${invoices.length} invoice(s):`);
    invoices.forEach(inv => {
      console.log(`   - ${inv.invoice_number}: ${inv.organizations?.name} - ₹${(inv.total_amount_paisa / 100).toFixed(2)} (${inv.status})`);
    });
    console.log('');
  }

  // 5. Summary and recommendations
  console.log('📋 Summary:');
  const hasOrgs = orgs && orgs.length > 0;
  const hasProfiles = orgs.some(async org => {
    const { data } = await supabase.from('profiles').select('id').eq('organization_id', org.id).limit(1);
    return data && data.length > 0;
  });

  if (!hasOrgs) {
    console.log('   ⚠️  Create organizations first at /admin/organizations');
  } else {
    console.log('   ✅ Organizations exist');
    console.log('   ⚠️  Make sure users are assigned to organizations');
    console.log('   ⚠️  Make sure machines are assigned to organization users');
    console.log('   ⚠️  Coin payments will appear once machines have transactions');
    console.log('   ℹ️  Then click "Generate Monthly Invoices" to create invoices');
  }
}

checkBillingSetup().catch(console.error);
