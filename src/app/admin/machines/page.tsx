import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Building2 } from 'lucide-react';
import MachinesTable from '@/components/MachinesTable';

export const revalidate = 0;

export default async function MachinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('*')
    .order('created_at', { ascending: false });

  const machinesWithUpdatedStatus = machines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      machine.asset_online = (Date.now() - lastPingTime) < 10 * 60 * 1000;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vending Machines</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Monitor and manage all machines</p>
        </div>
        <Link
          href="/admin/machines/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Add Machine
        </Link>
      </div>

      {machinesWithUpdatedStatus.length > 0 ? (
        <Suspense fallback={null}>
          <MachinesTable machines={machinesWithUpdatedStatus} />
        </Suspense>
      ) : (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>No vending machines found</p>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.28)' }}>Add your first machine to get started</p>
          <Link
            href="/admin/machines/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
          >
            <Plus className="w-4 h-4" />
            Add Your First Machine
          </Link>
        </div>
      )}
    </main>
  );
}
