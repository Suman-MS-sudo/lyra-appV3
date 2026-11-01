import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, email, role, account_type, organization_id, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');
  // Coin statements are company-level: only the super customer sees them
  if (profile?.account_type !== 'super_customer' || !profile.organization_id) redirect('/customer/billing');

  const { data: invoice } = await serviceSupabase
    .from('organization_invoices')
    .select('*, organizations!organization_id(id, name, contact_email, address)')
    .eq('id', invoiceId)
    .eq('organization_id', profile.organization_id)
    .in('status', ['pending', 'paid', 'overdue'])
    .single();

  if (!invoice) redirect('/customer/billing');

  // Coins are cash Lyra collects from the machines: this is a statement, nothing for the customer to pay
  const collected = invoice.status === 'paid' && invoice.total_amount_paisa > 0;
  const nil = invoice.total_amount_paisa === 0;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const month = new Date(new Date(invoice.period_start).getTime() + 5.5 * 3600_000).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link href="/customer/billing" className="text-sm transition-colors hover:text-[var(--fg)]" style={{ color: 'var(--muted)' }}>
        ← Back to Billing
      </Link>

      <div className="rounded-2xl p-6 sm:p-8" style={CARD}>
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg)] mb-1">Coin collection statement</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lyra Enterprises · Chennai, Tamil Nadu</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--subtle)' }}>Statement</p>
            <p className="text-lg font-bold text-[var(--fg)]">{invoice.invoice_number}</p>
            <span
              className="inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold rounded-full"
              style={collected || nil ? { background: 'var(--success-bg)', color: 'var(--success)' } : { background: 'var(--warning-bg)', color: 'var(--warning)' }}
            >
              {nil ? 'No coins' : collected ? 'Collected by Lyra' : 'Awaiting collection'}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 pb-8 mb-8" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--subtle)' }}>Organization</p>
            <p className="font-semibold text-[var(--fg)]">{invoice.organizations?.name}</p>
            {invoice.organizations?.address && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{invoice.organizations.address}</p>}
          </div>
          <div className="space-y-2.5">
            {[
              ['Month', month],
              ['Statement date', fmtDate(invoice.created_at)],
              ['Coin payments', String(invoice.total_coin_transactions ?? 0)],
              ...(collected && invoice.paid_at ? [['Collected on', fmtDate(invoice.paid_at)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="text-sm font-medium text-[var(--fg)] text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-lg font-bold text-[var(--fg)]">
          <span>Coins in your machines</span>
          <span>₹{(invoice.total_amount_paisa / 100).toFixed(2)}</span>
        </div>

        <div className="rounded-xl p-4 mt-6" style={{ background: 'var(--surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            {nil
              ? 'No coin payments were made on your machines this month.'
              : collected
                ? 'Lyra has collected these coins from your machines. Nothing is due from you.'
                : 'Lyra staff will collect these coins from your machines. Nothing is due from you.'}
          </p>
        </div>
      </div>
    </main>
  );
}
