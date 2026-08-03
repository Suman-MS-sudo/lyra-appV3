import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Receipt } from 'lucide-react';
import { OrgTransactionsTable, TxRow } from '@/components/OrgTransactionsTable';

export const revalidate = 0;

export default async function OrgTransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'admin') redirect('/customer/dashboard');

  const { id: orgId } = await params;

  // Fetch org name
  const { data: org } = await serviceSupabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  if (!org) redirect('/admin/organizations');

  // Get all machines belonging to this org
  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name')
    .eq('customer_id', orgId);

  const machineIds = machines?.map((m: any) => m.id) ?? [];
  const machineMap: Record<string, string> = {};
  machines?.forEach((m: any) => { machineMap[m.id] = m.name; });

  const rows: TxRow[] = [];

  if (machineIds.length > 0) {
    // Online transactions
    const { data: onlineTxs } = await serviceSupabase
      .from('transactions')
      .select('id, machine_id, items, total_amount, payment_status, created_at')
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
      .limit(500);

    for (const tx of onlineTxs ?? []) {
      const items = Array.isArray(tx.items) ? tx.items : [];
      const product = items.map((i: any) => i.name ?? 'Unknown').join(', ') || 'Online Payment';
      rows.push({
        id: tx.id,
        type: 'online',
        machine_name: machineMap[tx.machine_id] ?? tx.machine_id,
        product,
        amount: Number(tx.total_amount),
        status: tx.payment_status,
        created_at: tx.created_at,
      });
    }

    // Coin payments
    const { data: coinTxs } = await serviceSupabase
      .from('coin_payments')
      .select('id, machine_id, product_id, amount_in_paisa, created_at, products(name)')
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
      .limit(500);

    for (const tx of coinTxs ?? []) {
      const product = Array.isArray(tx.products)
        ? tx.products[0]?.name ?? 'Unknown'
        : (tx.products as any)?.name ?? 'Unknown';
      rows.push({
        id: tx.id,
        type: 'coin',
        machine_name: machineMap[tx.machine_id] ?? tx.machine_id,
        product,
        amount: tx.amount_in_paisa / 100,
        status: 'dispensed',
        created_at: tx.created_at,
      });
    }

    // RFID payments
    const { data: rfidTxs } = await serviceSupabase
      .from('rfid_payments')
      .select('id, machine_id, product_id, amount_in_paisa, created_at, products(name)')
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
      .limit(500);

    for (const tx of rfidTxs ?? []) {
      const product = Array.isArray(tx.products)
        ? tx.products[0]?.name ?? 'Unknown'
        : (tx.products as any)?.name ?? 'Unknown';
      rows.push({
        id: tx.id,
        type: 'rfid',
        machine_name: machineMap[tx.machine_id] ?? tx.machine_id,
        product,
        amount: tx.amount_in_paisa / 100,
        status: 'dispensed',
        created_at: tx.created_at,
      });
    }

    // Sort combined list newest first
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.status === 'paid' || r.status === 'dispensed' ? r.amount : 0), 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/organizations"
          className="p-2 rounded-xl transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.50)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{org.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Transaction history</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Transactions', value: rows.length },
          { label: 'Total Revenue', value: `₹${totalRevenue.toFixed(2)}` },
          { label: 'Machines', value: machineIds.length },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{kpi.label}</p>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.40)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
            {rows.length} transaction{rows.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <OrgTransactionsTable rows={rows} orgId={orgId} />
      </div>
    </main>
  );
}
