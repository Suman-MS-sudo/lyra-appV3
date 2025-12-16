import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { organizationId, periodStart, periodEnd } = await request.json();

    if (!organizationId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get organization details to get UUID and validate
    const { data: org, error: orgError } = await serviceSupabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if invoice already exists for this period
    const { data: existing } = await serviceSupabase
      .from('organization_invoices')
      .select('id, invoice_number')
      .eq('organization_id', organizationId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: `Invoice ${existing.invoice_number} already exists for this period` 
      }, { status: 400 });
    }

    // Calculate amounts using the database function (pass UUID directly)
    const { data: amounts, error: calcError } = await serviceSupabase
      .rpc('calculate_invoice_amounts', {
        p_organization_id: organizationId, // Pass UUID directly, not string
        p_period_start: periodStart,
        p_period_end: periodEnd
      });

    if (calcError) {
      return NextResponse.json({ error: calcError.message }, { status: 500 });
    }

    const totalAmount = amounts?.[0]?.total_amount_paisa || 0;
    const totalTransactions = amounts?.[0]?.total_transactions || 0;

    // Check for any unpaid invoices for this organization
    const { data: unpaidInvoices } = await serviceSupabase
      .from('organization_invoices')
      .select('id, invoice_number, amount_due_paisa, period_start, period_end')
      .eq('organization_id', organizationId)
      .in('status', ['pending', 'overdue'])
      .lt('period_end', periodStart) // Only consolidate older invoices
      .order('period_start', { ascending: true });

    // Calculate consolidated amount
    const unpaidAmount = unpaidInvoices?.reduce((sum, inv) => sum + inv.amount_due_paisa, 0) || 0;
    const consolidatedAmount = totalAmount + unpaidAmount;
    
    // Create notes about consolidation
    let notes = '';
    if (unpaidInvoices && unpaidInvoices.length > 0) {
      notes = `Consolidated invoice including ${unpaidInvoices.length} unpaid invoice(s): ${unpaidInvoices.map(inv => inv.invoice_number).join(', ')}. `;
      notes += `Previous dues: ₹${(unpaidAmount / 100).toFixed(2)}, Current period: ₹${(totalAmount / 100).toFixed(2)}`;
    }

    if (totalAmount === 0 && unpaidAmount === 0) {
      return NextResponse.json({ 
        error: 'No coin payments found for this period and no outstanding dues' 
      }, { status: 400 });
    }

    // Generate invoice number
    const { data: invoiceNumber } = await serviceSupabase
      .rpc('generate_invoice_number');

    // Create consolidated invoice
    const { data: invoice, error: invoiceError } = await serviceSupabase
      .from('organization_invoices')
      .insert({
        organization_id: organizationId,
        invoice_number: invoiceNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_coin_transactions: totalTransactions,
        total_amount_paisa: consolidatedAmount, // Use consolidated amount
        amount_paid_paisa: 0,
        amount_due_paisa: consolidatedAmount,
        status: unpaidAmount > 0 ? 'overdue' : 'pending', // Mark as overdue if consolidating old dues
        notes: notes || null,
      })
      .select()
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      invoice,
      message: `Invoice ${invoice.invoice_number} generated successfully`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
