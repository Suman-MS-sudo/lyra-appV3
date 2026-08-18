import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import EditMachineForm from '@/components/EditMachineForm';

export const revalidate = 0;

export default async function EditMachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const isAdmin = profile?.account_type === 'admin';
  const isSuperCustomer = profile?.role === 'customer' && profile?.account_type === 'super_customer';

  if (!isAdmin && !isSuperCustomer) redirect('/customer/dashboard');

  const { data: machine, error } = await serviceSupabase
    .from('vending_machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !machine) redirect('/admin/machines');

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .order('name');

  // Compute a live `asset_online` flag for UI (don't persist here)
  const machineWithOnline = { ...machine } as any;
  if (machineWithOnline?.last_ping) {
    const lastPingTime = new Date(machineWithOnline.last_ping).getTime();
    // Consider machine online if last ping within 10 minutes
    machineWithOnline.asset_online = (Date.now() - lastPingTime) < 10 * 60 * 1000;
  } else {
    machineWithOnline.asset_online = false;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Machine</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Update machine details and configuration</p>
          </div>
          <div className="text-sm">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${machineWithOnline.asset_online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {machineWithOnline.asset_online ? 'Live & Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <EditMachineForm machine={machineWithOnline} organizations={organizations || []} />
      </Suspense>
    </main>
  );
}
