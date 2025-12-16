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

async function generateDecemberInvoice() {
  console.log('📝 Generating invoice for December 2025...\n');

  // Get Lyra organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('name', 'Lyra')
    .single();

  if (!org) {
    console.log('❌ Lyra organization not found');
    return;
  }

  console.log(`Organization: ${org.name} (${org.id})\n`);

  // December period
  const periodStart = '2025-12-01T00:00:00.000Z';
  const periodEnd = '2026-01-01T00:00:00.000Z';

  // Calculate amounts
  const { data: amounts, error: calcError } = await supabase
    .rpc('calculate_invoice_amounts', {
      p_organization_id: org.id,
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

  if (calcError) {
    console.log('❌ Error calculating amounts:', calcError.message);
    return;
  }

  const totalAmount = amounts?.[0]?.total_amount_paisa || 0;
  const totalTransactions = amounts?.[0]?.total_transactions || 0;

  console.log(`Period: Dec 1 - Dec 31, 2025`);
  console.log(`Transactions: ${totalTransactions}`);
  console.log(`Total Amount: ₹${(totalAmount / 100).toFixed(2)}\n`);

  if (totalAmount === 0) {
    console.log('⚠️  No coin payments found for December');
    return;
  }

  // Generate invoice number
  const { data: invoiceNumber } = await supabase
    .rpc('generate_invoice_number');

  console.log(`Invoice Number: ${invoiceNumber}\n`);

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('organization_invoices')
    .insert({
      organization_id: org.id,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      total_coin_transactions: totalTransactions,
      total_amount_paisa: totalAmount,
      amount_paid_paisa: 0,
      amount_due_paisa: totalAmount,
      status: 'pending',
    })
    .select()
    .single();

  if (invoiceError) {
    console.log('❌ Error creating invoice:', invoiceError.message);
    return;
  }

  console.log('✅ Invoice created successfully!');
  console.log(`   ID: ${invoice.id}`);
  console.log(`   Invoice #: ${invoice.invoice_number}`);
  console.log(`   Status: ${invoice.status}`);
  console.log(`   Amount Due: ₹${(invoice.amount_due_paisa / 100).toFixed(2)}\n`);
  console.log(`🔗 Payment Link: http://localhost:3000/admin/billing/${invoice.id}/pay\n`);
}

generateDecemberInvoice().catch(console.error);
