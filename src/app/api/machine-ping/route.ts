import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Use service role to bypass RLS for machine updates
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const body = await request.json();
    
    const {
      machine_id,
      firmware_version,
      wifi_rssi,
      free_heap,
      uptime,
      network_speed_kbps,
      temperature_celsius,
      stock_count
    } = body;

    // Update machine record with latest ping data
    if (machine_id && machine_id !== 'UNKNOWN') {
      // If machine_id is not a UUID, resolve it via the machine_id string column first
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let resolvedId = machine_id;
      if (!uuidRegex.test(machine_id)) {
        const { data: found } = await supabase
          .from('vending_machines')
          .select('id')
          .eq('machine_id', machine_id)
          .limit(1)
          .maybeSingle();
        if (!found) {
          console.warn(`⚠️ Machine not found for serial: ${machine_id}`);
          return NextResponse.json({ success: false, error: 'Machine not found' }, { status: 404 });
        }
        resolvedId = found.id;
        console.log(`🔑 Resolved serial ${machine_id} → UUID ${resolvedId}`);
      }

      const updateData: any = {
        asset_online: true,
        last_ping: new Date().toISOString(),
        firmware_version: firmware_version || null,
        wifi_rssi: wifi_rssi || null,
        free_heap: free_heap || null,
        uptime: uptime || null,
        network_speed: network_speed_kbps || null,
        temperature: temperature_celsius || null
      };

      // Update stock count if provided (sync from ESP32's EEPROM)
      if (stock_count !== undefined && stock_count !== null) {
        updateData.stock_level = stock_count;
      }

      const { error: updateError } = await supabase
        .from('vending_machines')
        .update(updateData)
        .eq('id', resolvedId);

      // Sync machine_products.stock to ESP32's EEPROM count (ground truth)
      if (stock_count !== undefined && stock_count !== null) {
        await supabase
          .from('machine_products')
          .update({ stock: stock_count })
          .eq('machine_id', resolvedId)
          .eq('is_active', 1);
      }

      if (updateError) {
        console.error('Error updating machine ping:', updateError);
      }

      // Firmware OTA: if there's a pending (or stuck-downloading) deployment
      // for this machine, tell it to fetch the binary from our own
      // /api/firmware-download endpoint (not a direct Supabase Storage URL
      // -- the ESP32's Ethernet stack has no TLS support at all, so it can
      // only ever talk to our own domain, same as every other device call).
      // Status transitions (downloading/applied/failed) are reported back
      // by the device itself via /api/machine-firmware-status, not flipped
      // here.
      //
      // 'downloading' is included, not just 'pending': the device reports
      // "downloading" the instant it starts, before the transfer actually
      // completes -- if it then crashes, loses power, or hits a watchdog
      // reset mid-download (a real, observed failure mode on flaky
      // Ethernet), the deployment is left stuck in 'downloading' forever
      // with nothing to ever move it to 'applied' or 'failed'. Since this
      // device is single-threaded and blocking, there's no concurrent-
      // download to race with -- offering it again on the next ping just
      // lets a genuinely-stuck deployment retry instead of silently never
      // being offered again.
      // .limit(1) + take the first row, not .maybeSingle() -- maybeSingle()
      // throws when more than one row matches, and that error was
      // previously silently discarded here (only `data` was destructured),
      // which is exactly how a duplicate pending/downloading row for one
      // machine went unnoticed and quietly killed OTA for it entirely.
      // createOrReplacePendingDeployments() is now the real fix (it
      // prevents duplicates from being created), but this stays defensive
      // in case a duplicate ever exists anyway -- most-recently-requested
      // row wins rather than the whole check going dark.
      const { data: pendingDeployments, error: pendingError } = await supabase
        .from('firmware_deployments')
        .select('id, firmware_versions(version, sha256)')
        .eq('machine_id', resolvedId)
        .in('status', ['pending', 'downloading'])
        .order('requested_at', { ascending: false })
        .limit(1);

      if (pendingError) {
        console.error('Error checking pending firmware deployment:', pendingError);
      }
      const pendingDeployment = pendingDeployments?.[0] ?? null;

      if (pendingDeployment?.firmware_versions) {
        const fw = Array.isArray(pendingDeployment.firmware_versions)
          ? pendingDeployment.firmware_versions[0]
          : pendingDeployment.firmware_versions;

        return NextResponse.json({
          success: true,
          message: 'Ping received',
          reboot: false,
          reset_stock: false,
          update_available: true,
          deployment_id: pendingDeployment.id,
          firmware_version: fw.version,
          firmware_sha256: fw.sha256,
        });
      }
    }

    // You can return commands to the machine here
    return NextResponse.json({
      success: true,
      message: 'Ping received',
      // Optional: send commands back to ESP32
      reboot: false,
      reset_stock: false,
    });

  } catch (error) {
    console.error('Machine ping error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
