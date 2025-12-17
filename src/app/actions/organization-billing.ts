'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GenerateInvoiceParams {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
}

interface SendInvoiceEmailParams {
  invoiceId: string;
}

interface RecordPaymentParams {
  invoiceId: string;
  amountPaisa: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  notes?: string;
}

/**
 * Generate invoice for an organization for a specific period
 */
export async function generateInvoice(params: GenerateInvoiceParams) {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Only admins can generate invoices');
  }

  const { organizationId, periodStart, periodEnd } = params;

  // Check if invoice already exists for this period
  const { data: existing } = await serviceSupabase
    .from('organization_invoices')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .single();

  if (existing) {
    throw new Error('Invoice already exists for this period');
  }

  // Calculate amounts using the database function
  const { data: amounts, error: calcError } = await serviceSupabase
    .rpc('calculate_invoice_amounts', {
      p_organization_id: organizationId,
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

  if (calcError) throw calcError;

  const totalAmount = amounts?.[0]?.total_amount_paisa || 0;
  const totalTransactions = amounts?.[0]?.total_transactions || 0;

  // Generate invoice number
  const { data: invoiceNumber } = await serviceSupabase
    .rpc('generate_invoice_number');

  // Create invoice
  const { data: invoice, error: insertError } = await serviceSupabase
    .from('organization_invoices')
    .insert({
      organization_id: organizationId,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      total_coin_transactions: totalTransactions,
      total_amount_paisa: totalAmount,
      amount_paid_paisa: 0,
      amount_due_paisa: totalAmount,
      status: 'pending'
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { success: true, invoice };
}

/**
 * Generate invoices for all organizations for the previous month
 */
export async function generateMonthlyInvoices() {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Only admins can generate invoices');
  }

  // Get all active organizations
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name');

  if (!organizations) return { success: false, message: 'No organizations found' };

  // Calculate previous month period
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodStart = lastMonth.toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const results = [];

  for (const org of organizations) {
    try {
      const result = await generateInvoice({
        organizationId: org.id,
        periodStart,
        periodEnd
      });
      results.push({ organizationId: org.id, name: org.name, success: true, invoice: result.invoice });
    } catch (error: any) {
      results.push({ organizationId: org.id, name: org.name, success: false, error: error.message });
    }
  }

  return { success: true, results };
}

/**
 * Send invoice email to organization
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Only admins can send invoice emails');
  }

  const { invoiceId } = params;

  // Get invoice with organization details
  const { data: invoice, error: fetchError } = await serviceSupabase
    .from('organization_invoices')
    .select(`
      *,
      organizations (
        id,
        name,
        contact_email
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (fetchError || !invoice) {
    throw new Error('Invoice not found');
  }

  if (!invoice.organizations.contact_email) {
    throw new Error('Organization does not have a contact email');
  }

  // Import email utilities
  const { sendEmail, generateInvoiceEmailHTML } = await import('@/lib/email');
  
  // Generate email content
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lyra-app.co.in';
  const invoiceUrl = `${appUrl}/admin/billing/${invoice.id}`;
  const paymentUrl = `${appUrl}/admin/billing/${invoice.id}/pay`;
  
  const formatCurrency = (paisa: number) => {
    return `₹${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate due date: 30 days from invoice creation
  const dueDate = new Date(invoice.created_at);
  dueDate.setDate(dueDate.getDate() + 30);

  const emailHTML = generateInvoiceEmailHTML({
    invoiceNumber: invoice.invoice_number,
    organizationName: invoice.organizations.name,
    totalAmount: formatCurrency(invoice.total_amount_paisa),
    dueDate: invoice.status === 'paid' && invoice.paid_at 
      ? `Paid on ${formatDate(invoice.paid_at)}`
      : formatDate(dueDate.toISOString()),
    invoiceUrl,
    paymentUrl,
    totalAmountPaisa: invoice.total_amount_paisa,
  });

  // Determine email subject based on amount
  const emailSubject = invoice.total_amount_paisa === 0
    ? `Monthly Statement ${invoice.invoice_number} - No Payment Required`
    : `Invoice ${invoice.invoice_number} from Lyra Enterprises`;

  // Send email
  const result = await sendEmail({
    to: invoice.organizations.contact_email,
    subject: emailSubject,
    html: emailHTML,
  });

  if (!result.success) {
    throw new Error(`Failed to send email: ${result.error}`);
  }

  // Update invoice email tracking
  await serviceSupabase
    .from('organization_invoices')
    .update({
      email_sent: true,
      email_sent_at: new Date().toISOString(),
      reminder_count: (invoice.reminder_count || 0) + 1,
      last_reminder_sent_at: new Date().toISOString()
    })
    .eq('id', invoiceId);

  return { success: true, invoice, message: `Email sent to ${invoice.organizations.contact_email}` };
}

/**
 * Record a manual payment for an invoice
 */
export async function recordManualPayment(params: RecordPaymentParams) {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Only admins can record payments');
  }

  const { invoiceId, amountPaisa, notes } = params;

  // Get invoice
  const { data: invoice, error: fetchError } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations(id)')
    .eq('id', invoiceId)
    .single();

  if (fetchError || !invoice) {
    throw new Error('Invoice not found');
  }

  // Create payment record
  const { data: payment, error: paymentError } = await serviceSupabase
    .from('organization_payments')
    .insert({
      invoice_id: invoiceId,
      organization_id: invoice.organizations.id,
      amount_paisa: amountPaisa,
      payment_method: 'manual',
      status: 'success',
      notes: notes || 'Manual payment recorded by admin',
      payment_date: new Date().toISOString()
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  return { success: true, payment };
}

/**
 * Get all invoices with organization details
 */
export async function getAllInvoices() {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  const { data: invoices, error } = await serviceSupabase
    .from('organization_invoices')
    .select(`
      *,
      organizations (
        id,
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return { success: true, invoices };
}

/**
 * Get invoice details with payments
 */
export async function getInvoiceDetails(invoiceId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: invoice, error } = await serviceSupabase
    .from('organization_invoices')
    .select(`
      *,
      organizations (
        id,
        name,
        email
      ),
      organization_payments (
        id,
        amount_paisa,
        payment_method,
        status,
        payment_date,
        razorpay_payment_id,
        notes
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw error;

  return { success: true, invoice };
}

/**
 * Delete an invoice and all associated payments
 */
export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();
  
  // Check admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Only admins can delete invoices');
  }

  // Delete invoice (cascade will delete associated payments)
  const { error } = await serviceSupabase
    .from('organization_invoices')
    .delete()
    .eq('id', invoiceId);

  if (error) throw error;

  // Revalidate the billing page to reflect changes
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/admin/billing');

  return { success: true, message: 'Invoice deleted successfully' };
}
