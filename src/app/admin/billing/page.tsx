import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { 
  ArrowLeft, 
  IndianRupee, 
  FileText, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Send,
  Download,
  Plus
} from 'lucide-react';
import { GenerateMonthlyInvoicesButton } from '@/components/GenerateMonthlyInvoicesButton';
import { SendInvoiceEmailButton } from '@/components/SendInvoiceEmailButton';
import { RecordPaymentButton } from '@/components/RecordPaymentButton';
import { PaymentSuccessBanner } from '@/components/PaymentSuccessBanner';
import { ManualInvoiceGenerator } from '@/components/ManualInvoiceGenerator';
import { DeleteInvoiceButton } from '@/components/DeleteInvoiceButton';

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

  // Fetch all invoices with organization details
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

  // Calculate summary statistics
  const totalPending = invoices?.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount_due_paisa, 0) || 0;
  const totalPaid = invoices?.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;
  const totalOverdue = invoices?.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount_due_paisa, 0) || 0;
  const pendingCount = invoices?.filter(inv => inv.status === 'pending' || inv.status === 'overdue').length || 0;

  // Group invoices by organization
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
    } else if (invoice.status === 'pending') {
      acc[orgId].totalPending += invoice.amount_due_paisa;
      const invoiceDate = new Date(invoice.period_end);
      if (!acc[orgId].oldestUnpaidDueDate || invoiceDate < acc[orgId].oldestUnpaidDueDate) {
        acc[orgId].oldestUnpaidDueDate = invoiceDate;
      }
    } else if (invoice.status === 'overdue') {
      acc[orgId].totalOverdue += invoice.amount_due_paisa;
      const invoiceDate = new Date(invoice.period_end);
      if (!acc[orgId].oldestUnpaidDueDate || invoiceDate < acc[orgId].oldestUnpaidDueDate) {
        acc[orgId].oldestUnpaidDueDate = invoiceDate;
      }
    }
    
    return acc;
  }, {} as Record<string, any>) || {};

  const organizationSummaries = Object.values(organizationInvoices);

  // Get all organizations and calculate coin payment data
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name, contact_email');

  // Calculate current month and last month periods
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Get coin payment data for each organization
  const orgCoinData = await Promise.all(
    (organizations || []).map(async (org) => {
      // Get organization's user profiles
      const { data: orgProfiles } = await serviceSupabase
        .from('profiles')
        .select('id')
        .eq('organization_id', org.id);

      const userIds = orgProfiles?.map(p => p.id) || [];

      if (userIds.length === 0) {
        return {
          ...org,
          thisMonthTotal: 0,
          thisMonthCount: 0,
          lastMonthTotal: 0,
          lastMonthCount: 0,
          machineCount: 0
        };
      }

      // Get machines for this organization
      const { data: orgMachines } = await serviceSupabase
        .from('vending_machines')
        .select('id')
        .in('customer_id', userIds);

      const machineIds = orgMachines?.map(m => m.id) || [];

      if (machineIds.length === 0) {
        return {
          ...org,
          thisMonthTotal: 0,
          thisMonthCount: 0,
          lastMonthTotal: 0,
          lastMonthCount: 0,
          machineCount: 0
        };
      }

      // This month coin payments
      const { data: thisMonthPayments } = await serviceSupabase
        .from('coin_payments')
        .select('amount_in_paisa')
        .in('machine_id', machineIds)
        .gte('created_at', thisMonthStart.toISOString())
        .lt('created_at', nextMonthStart.toISOString())
        .eq('dispensed', true);

      const thisMonthTotal = thisMonthPayments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
      const thisMonthCount = thisMonthPayments?.length || 0;

      // Last month coin payments
      const { data: lastMonthPayments } = await serviceSupabase
        .from('coin_payments')
        .select('amount_in_paisa')
        .in('machine_id', machineIds)
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString())
        .eq('dispensed', true);

      const lastMonthTotal = lastMonthPayments?.reduce((sum, p) => sum + (p.amount_in_paisa || 0), 0) || 0;
      const lastMonthCount = lastMonthPayments?.length || 0;

      return {
        ...org,
        thisMonthTotal,
        thisMonthCount,
        lastMonthTotal,
        lastMonthCount,
        machineCount: machineIds.length
      };
    })
  );

  const totalThisMonthCoin = orgCoinData.reduce((sum, org) => sum + org.thisMonthTotal, 0);
  const totalLastMonthCoin = orgCoinData.reduce((sum, org) => sum + org.lastMonthTotal, 0);

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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return styles[status] || styles.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {params.payment === 'success' && <PaymentSuccessBanner />}
      
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Organization Billing</h1>
                <p className="text-sm text-gray-500">Manage coin payment invoices and collections</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ManualInvoiceGenerator />
              <GenerateMonthlyInvoicesButton />
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPending)}</p>
              <p className="text-xs text-gray-500 mt-1">{pendingCount} invoice(s)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Collected (Paid)</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOverdue)}</p>
              <p className="text-xs text-gray-500 mt-1">Needs follow-up</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">All statuses</p>
            </div>
          </div>
        </div>

        {/* Organization-wise Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Organization-wise Billing Summary</h2>
            <p className="text-sm text-gray-500">Payment status and outstanding dues by organization</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Invoices
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collected (Paid)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overdue Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oldest Due Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizationSummaries.length > 0 ? (
                  organizationSummaries.map((orgSummary: any) => {
                    const hasUnpaid = orgSummary.totalPending > 0 || orgSummary.totalOverdue > 0;
                    const daysOverdue = orgSummary.oldestUnpaidDueDate 
                      ? Math.floor((new Date().getTime() - new Date(orgSummary.oldestUnpaidDueDate).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    
                    return (
                      <tr key={orgSummary.organization.id} className={`hover:bg-gray-50 ${hasUnpaid ? 'bg-yellow-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{orgSummary.organization.name}</div>
                          <div className="text-xs text-gray-500">{orgSummary.organization.contact_email}</div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900">
                          {orgSummary.invoices.length}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                          {formatCurrency(orgSummary.totalCollected)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-yellow-600">
                          {formatCurrency(orgSummary.totalPending)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                          {formatCurrency(orgSummary.totalOverdue)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          {orgSummary.oldestUnpaidDueDate ? (
                            <div>
                              <div className={`font-medium ${daysOverdue > 30 ? 'text-red-600' : daysOverdue > 15 ? 'text-orange-600' : 'text-gray-900'}`}>
                                {formatDate(orgSummary.oldestUnpaidDueDate.toISOString())}
                              </div>
                              {daysOverdue > 0 && (
                                <div className="text-xs text-red-600">
                                  {daysOverdue} days overdue
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`#org-${orgSummary.organization.id}`}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              View Invoices
                            </Link>
                            {hasUnpaid && (
                              <button
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                              >
                                Send Reminder
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No organizations with invoices yet
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                    {formatCurrency(totalPaid)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-yellow-600">
                    {formatCurrency(totalPending)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-red-600">
                    {formatCurrency(totalOverdue)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Organization Coin Payment Data */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Coin Payment Overview</h2>
              <p className="text-sm text-gray-500">Organization-wise coin payment breakdown</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-right">
                <p className="text-gray-500">This Month</p>
                <p className="font-semibold text-blue-600">{formatCurrency(totalThisMonthCoin)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Last Month (Billable)</p>
                <p className="font-semibold text-green-600">{formatCurrency(totalLastMonthCoin)}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machines
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Month Txns
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Month Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    This Month Txns
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    This Month Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orgCoinData.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{org.name}</div>
                      <div className="text-xs text-gray-500">{org.contact_email}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {org.machineCount}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {org.lastMonthCount}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                      {formatCurrency(org.lastMonthTotal)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {org.thisMonthCount}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">
                      {formatCurrency(org.thisMonthTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                    {formatCurrency(totalLastMonthCoin)}
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-blue-600">
                    {formatCurrency(totalThisMonthCoin)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Invoices</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices && invoices.length > 0 ? (
                  invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{invoice.invoice_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{invoice.organizations?.name}</div>
                        <div className="text-xs text-gray-500">{invoice.organizations?.contact_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(invoice.period_start)}
                        </div>
                        <div className="text-xs text-gray-500">
                          to {formatDate(invoice.period_end)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {invoice.total_coin_transactions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total_amount_paisa)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                        {formatCurrency(invoice.amount_paid_paisa)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                        {formatCurrency(invoice.amount_due_paisa)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {invoice.status !== 'paid' && invoice.amount_due_paisa > 0 && (
                            <>
                              <Link
                                href={`/admin/billing/${invoice.id}/pay`}
                                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
                              >
                                Pay Now
                              </Link>
                              <RecordPaymentButton 
                                invoiceId={invoice.id}
                                amountDue={invoice.amount_due_paisa}
                                organizationName={invoice.organizations?.name}
                              />
                            </>
                          )}
                          <Link
                            href={`/admin/billing/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            View
                          </Link>
                          {invoice.status !== 'paid' && (
                            <SendInvoiceEmailButton invoiceId={invoice.id} />
                          )}
                          <DeleteInvoiceButton 
                            invoiceId={invoice.id}
                            invoiceNumber={invoice.invoice_number}
                            organizationName={invoice.organizations?.name}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium mb-2">No invoices yet</p>
                      <p className="text-sm">Generate monthly invoices to start tracking organization payments</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
