import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

import { PaymentSuccessBanner } from '@/components/PaymentSuccessBanner';
import { ManualInvoiceGenerator } from '@/components/ManualInvoiceGenerator';
import { GenerateMonthlyInvoicesButton } from '@/components/GenerateMonthlyInvoicesButton';
import { BillingTablesClient } from '@/components/BillingTablesClient';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

export default async function OrganizationBillingPage({
  searchParams
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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
    redirect('/customer/dashboard');
  }

  const { data: invoices } = await serviceSupabase
    .from('organization_invoices')
    .select(`
      *,
      organizations (
        id,
        name,
        contact_email
      )
    `)
    .order('created_at', { ascending: false });

  const totalPending = invoices?.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount_due_paisa, 0) || 0;
  const totalPaid = invoices?.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;
  const totalOverdue = invoices?.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount_due_paisa, 0) || 0;

  const organizationInvoices = invoices?.reduce((acc, invoice) => {
    const orgId = invoice.organization_id;
    if (!acc[orgId]) {
      acc[orgId] = {
        organization: invoice.organizations,
        invoices: [],
        totalCollected: 0,
        totalPending: 0,
        totalOverdue: 0,
        oldestUnpaidDueDate: null as Date | null
      };
    }
    acc[orgId].invoices.push(invoice);

    if (invoice.status === 'paid') {
      acc[orgId].totalCollected += invoice.total_amount_paisa;
    } else if (invoice.status === 'pending' && invoice.amount_due_paisa > 0) {
      acc[orgId].totalPending += invoice.amount_due_paisa;
      const invoiceDate = new Date(invoice.period_end);
      if (!acc[orgId].oldestUnpaidDueDate || invoiceDate < acc[orgId].oldestUnpaidDueDate) {
        acc[orgId].oldestUnpaidDueDate = invoiceDate;
      }
    } else if (invoice.status === 'overdue' && invoice.amount_due_paisa > 0) {
      acc[orgId].totalOverdue += invoice.amount_due_paisa;
      const invoiceDate = new Date(invoice.period_end);
      if (!acc[orgId].oldestUnpaidDueDate || invoiceDate < acc[orgId].oldestUnpaidDueDate) {
        acc[orgId].oldestUnpaidDueDate = invoiceDate;
      }
    }

    return acc;
  }, {} as Record<string, any>) || {};

  const organizationSummaries = Object.values(organizationInvoices);

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name, contact_email');

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const orgCoinData = await Promise.all(
    (organizations || []).map(async (org) => {
      const { data: orgProfiles } = await serviceSupabase
        .from('profiles')
        .select('id')
        .eq('organization_id', org.id);

      const userIds = orgProfiles?.map(p => p.id) || [];

      if (userIds.length === 0) {
        return { ...org, thisMonthTotal: 0, thisMonthCount: 0, lastMonthTotal: 0, lastMonthCount: 0, machineCount: 0 };
      }

      const { data: orgMachines } = await serviceSupabase
        .from('vending_machines')
        .select('id')
        .in('customer_id', userIds);

      const machineIds = orgMachines?.map(m => m.id) || [];

      if (machineIds.length === 0) {
        return { ...org, thisMonthTotal: 0, thisMonthCount: 0, lastMonthTotal: 0, lastMonthCount: 0, machineCount: 0 };
      }

      const { data: thisMonthPayments } = await serviceSupabase
        .from('coin_payments')
        .select('amount_in_paisa')
        .in('machine_id', machineIds)
        .gte('created_at', thisMonthStart.toISOString())
        .lt('created_at', nextMonthStart.toISOString())
        .eq('dispensed', true);

      const thisMonthTotal = thisMonthPayments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
      const thisMonthCount = thisMonthPayments?.length || 0;

      const { data: lastMonthPayments } = await serviceSupabase
        .from('coin_payments')
        .select('amount_in_paisa')
        .in('machine_id', machineIds)
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString())
        .eq('dispensed', true);

      const lastMonthTotal = lastMonthPayments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
      const lastMonthCount = lastMonthPayments?.length || 0;

      return { ...org, thisMonthTotal, thisMonthCount, lastMonthTotal, lastMonthCount, machineCount: machineIds.length };
    })
  );

  const totalThisMonthCoin = orgCoinData.reduce((sum, org) => sum + org.thisMonthTotal, 0);
  const totalLastMonthCoin = orgCoinData.reduce((sum, org) => sum + org.lastMonthTotal, 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {params.payment === 'success' && <PaymentSuccessBanner />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organization Billing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Manage coin payment invoices and collections</p>
        </div>
        <div className="flex items-center gap-3">
          <ManualInvoiceGenerator />
          <GenerateMonthlyInvoicesButton />
        </div>
      </div>

      <BillingTablesClient
        organizationSummaries={organizationSummaries as any}
        orgCoinData={orgCoinData}
        invoices={invoices}
        CARD={CARD}
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalOverdue={totalOverdue}
        totalThisMonthCoin={totalThisMonthCoin}
        totalLastMonthCoin={totalLastMonthCoin}
      />
    </main>
  );
}
