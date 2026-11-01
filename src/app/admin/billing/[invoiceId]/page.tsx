import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { CheckCircle2, Clock, AlertTriangle, Coins } from 'lucide-react';
import { SendInvoiceEmailButton } from '@/components/SendInvoiceEmailButton';
import { RecordPaymentButton } from '@/components/RecordPaymentButton';
import { DeleteInvoiceButton } from '@/components/DeleteInvoiceButton';
import { PageHeader, Panel } from '@/components/ui/kit';
import { formatIstDate, formatPaisa, periodLabel } from '@/lib/billing';

export const revalidate = 0;

/** Admin view of one monthly coin collection statement. */
export default async function StatementDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const [{ data: invoice }, { data: collections }] = await Promise.all([
    db.from('organization_invoices').select('*, organizations(id, name, contact_email, contact_phone, address, city, state)').eq('id', invoiceId).single(),
    db.from('organization_payments').select('id, amount_paisa, payment_method, status, payment_date, notes').eq('invoice_id', invoiceId).order('payment_date', { ascending: false }),
  ]);
  if (!invoice) redirect('/admin/billing');

  const org = invoice.organizations as { name: string; contact_email?: string; contact_phone?: string; address?: string; city?: string; state?: string } | null;
  const nil = invoice.total_amount_paisa === 0;
  const settled = invoice.status === 'paid';
  const overdue = invoice.status === 'overdue';
  const okCollections = (collections || []).filter((c) => c.status === 'success');
  const collected = okCollections.reduce((t, c) => t + (c.amount_paisa || 0), 0);
  const status = nil
    ? { label: 'No coins', tone: 'ok', icon: CheckCircle2 }
    : settled
      ? { label: 'Collected', tone: 'ok', icon: CheckCircle2 }
      : overdue
        ? { label: 'Collection overdue', tone: 'bad', icon: AlertTriangle }
        : { label: 'To collect', tone: 'warn', icon: Clock };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link href="/admin/billing" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">← Back to billing</Link>

      <PageHeader
        title={`Statement ${invoice.invoice_number}`}
        subtitle={`${org?.name || 'Organization'} · ${periodLabel(invoice.period_start)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!settled && !nil && <RecordPaymentButton invoiceId={invoice.id} amountDue={invoice.amount_due_paisa} organizationName={org?.name || ''} />}
            <SendInvoiceEmailButton invoiceId={invoice.id} />
            {okCollections.length === 0 && <DeleteInvoiceButton invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} organizationName={org?.name || ''} />}
          </div>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Coin collection statement</p>
            <p className="text-2xl font-bold text-[var(--fg)] mt-1">{invoice.invoice_number}</p>
            <p className="text-sm text-[var(--muted)] mt-1">{periodLabel(invoice.period_start)} · created {formatIstDate(invoice.created_at)}</p>
          </div>
          <span className={`ui-pill is-${status.tone}`}><status.icon className="w-3.5 h-3.5" />{status.label}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            ['Coins', (invoice.total_coin_transactions || 0).toLocaleString('en-IN')],
            ['Expected', formatPaisa(invoice.total_amount_paisa)],
            ['Collected', formatPaisa(collected)],
            [settled ? 'Settled' : 'Still to collect', settled ? (invoice.paid_at ? formatIstDate(invoice.paid_at) : '—') : formatPaisa(invoice.amount_due_paisa)],
          ].map(([label, value]) => (
            <div key={label} className="vx-inner p-4">
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="text-lg font-bold text-[var(--fg)] mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-[var(--line)] text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)] mb-2">Organization</p>
            <p className="font-semibold text-[var(--fg)]">{org?.name}</p>
            {org?.address && <p className="text-[var(--muted)]">{org.address}</p>}
            {(org?.city || org?.state) && <p className="text-[var(--muted)]">{[org?.city, org?.state].filter(Boolean).join(', ')}</p>}
            {org?.contact_phone && <p className="text-[var(--muted)] mt-1">{org.contact_phone}</p>}
            {org?.contact_email && <p className="text-[var(--muted)]">{org.contact_email}</p>}
          </div>
          <div className="space-y-2">
            {[
              ['Period', `${formatIstDate(invoice.period_start)} – ${formatIstDate(new Date(new Date(invoice.period_end).getTime() - 1))}`],
              ['Collect by', invoice.due_date ? formatIstDate(invoice.due_date) : '—'],
              ['Sheet emailed to Lyra', invoice.email_sent_at ? formatIstDate(invoice.email_sent_at) : 'Not yet'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><span className="text-[var(--muted)]">{k}</span><span className="font-medium text-[var(--fg)] text-right">{v}</span></div>
            ))}
          </div>
        </div>

        {invoice.notes && <p className="mt-6 p-4 rounded-xl text-sm bg-[var(--surface-2)] text-[var(--fg-2)]">{invoice.notes}</p>}
        <p className="mt-6 text-xs text-[var(--subtle)]">Coins are cash collected from the machines by Lyra staff. The organization is not billed for this statement.</p>
      </Panel>

      <Panel title="Collections">
        {okCollections.length === 0 ? (
          <p className="ui-empty-hint py-6 text-center">{nil ? 'Nothing to collect this month.' : 'No collection recorded yet. Use “Record collection” after the visit.'}</p>
        ) : (
          <ul className="ui-list">
            {okCollections.map((c) => (
              <li key={c.id} className="ui-row">
                <span className="ui-row-icon db-row-icon db-tone-butter"><Coins className="w-4 h-4" /></span>
                <span className="min-w-0">
                  <span className="ui-row-title">{formatPaisa(c.amount_paisa)} collected</span>
                  <span className="ui-row-meta">{c.notes || '—'}</span>
                </span>
                <span className="ui-row-end"><span className="ui-row-meta">{formatIstDate(c.payment_date)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
