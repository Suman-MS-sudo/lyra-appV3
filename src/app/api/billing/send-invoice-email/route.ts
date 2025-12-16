import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateInvoiceEmailHTML } from '@/lib/email';

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

    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Get invoice details with organization
    const { data: invoice, error: invoiceError } = await serviceSupabase
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

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.organizations.contact_email) {
      return NextResponse.json({ 
        error: 'Organization does not have a contact email' 
      }, { status: 400 });
    }

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

    const emailHTML = generateInvoiceEmailHTML({
      invoiceNumber: invoice.invoice_number,
      organizationName: invoice.organizations.name,
      totalAmount: formatCurrency(invoice.total_amount_paisa),
      dueDate: invoice.status === 'paid' && invoice.paid_at 
        ? formatDate(invoice.paid_at)
        : 'Upon Receipt',
      invoiceUrl,
      paymentUrl,
    });

    // Send email
    const result = await sendEmail({
      to: invoice.organizations.contact_email,
      subject: `Invoice ${invoice.invoice_number} from Lyra Enterprises`,
      html: emailHTML,
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: 'Failed to send email',
        details: result.error 
      }, { status: 500 });
    }

    // Update invoice to mark email as sent
    await serviceSupabase
      .from('organization_invoices')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    return NextResponse.json({ 
      success: true, 
      message: `Invoice email sent to ${invoice.organizations.contact_email}`,
      messageId: result.messageId
    });

  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
