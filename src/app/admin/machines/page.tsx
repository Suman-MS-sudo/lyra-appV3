import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft, Plus } from 'lucide-react';
import MachinesTable from '@/components/MachinesTable';

export default async function MachinesPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service role to check admin status and fetch data
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type, role')
    .eq('id', user.id)
    .single();

  // Only allow admins - redirect super customers to their own machines page
  if (profile?.role !== 'admin') {
    redirect('/customer/dashboard');
  }

  // Fetch all vending machines (admin sees everything)
  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('*')
    .order('created_at', { ascending: false });

  // Recalculate online status based on last_ping (10 minute timeout)
  // This ensures admin dashboard shows accurate real-time status
  const machinesWithUpdatedStatus = machines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      const now = new Date().getTime();
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      machine.asset_online = (now - lastPingTime) < tenMinutes;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vending Machines</h1>
                <p className="text-sm text-gray-500">Monitor and manage all machines</p>
              </div>
            </div>
            <Link
              href="/admin/machines/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Machine
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {machinesWithUpdatedStatus && machinesWithUpdatedStatus.length > 0 ? (
          <MachinesTable machines={machinesWithUpdatedStatus} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No vending machines found</p>
            <Link
              href="/admin/machines/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Your First Machine
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
