import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Cpu } from 'lucide-react';
import FirmwareManager from '@/components/FirmwareManager';

export const revalidate = 0;

export default async function FirmwarePage() {
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

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const { data: versions } = await serviceSupabase
    .from('firmware_versions')
    .select('id, version, filename, sha256, size_bytes, notes, created_at, archived_at, compatible_body_type')
    .order('created_at', { ascending: false });

  const { data: rawMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, machine_id, customer_name, body_type, last_ping, firmware_version, last_firmware_update')
    .order('name', { ascending: true });

  // Same 10-minute freshness rule MachinesTable uses -- a raw asset_online
  // column can stay stuck true forever once ever set, so derive it here too
  // rather than trusting the stored flag directly.
  const machines = (rawMachines || []).map((m) => ({
    ...m,
    asset_online: m.last_ping ? (Date.now() - new Date(m.last_ping).getTime()) < 10 * 60 * 1000 : false,
  }));

  const { data: deployments } = await serviceSupabase
    .from('firmware_deployments')
    .select('id, status, error_message, requested_at, applied_at, updated_at, firmware_version_id, vending_machines(id, name, machine_id)')
    .order('updated_at', { ascending: false });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Cpu className="w-6 h-6 text-[#1d1d1f]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Firmware OTA</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>
            Upload ESP32 firmware builds and deploy them to selected machines
          </p>
        </div>
      </div>

      <FirmwareManager
        versions={versions || []}
        machines={machines || []}
        deployments={deployments || []}
      />
    </main>
  );
}
