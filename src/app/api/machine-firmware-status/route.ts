import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Device-facing endpoint. The ESP32 reports OTA progress here after it
 * receives an update_available instruction from /api/machine-ping.
 *
 * Endpoint: POST /api/machine-firmware-status
 * Body: { deployment_id, device_secret, status: "downloading" | "applied" | "failed", error_message? }
 *
 * device_secret travels in the body rather than a header -- the firmware's
 * shared HTTP helpers (makeHTTPRequest / makeEthernetHTTPRequest) don't
 * support adding custom per-request headers, and extending them risked
 * touching the payment/ping code paths that are already fragile. Body-field
 * auth gives the same protection (a MAC alone isn't secret, so it can't gate
 * who's allowed to report a deployment's status for a given machine) without
 * that risk.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deployment_id, device_secret: deviceSecret, status, error_message } = body as {
      deployment_id?: string;
      device_secret?: string;
      status?: 'downloading' | 'applied' | 'failed';
      error_message?: string;
    };

    if (!deviceSecret) {
      return NextResponse.json({ success: false, error: 'device_secret is required' }, { status: 401 });
    }

    if (!deployment_id) {
      return NextResponse.json({ success: false, error: 'deployment_id is required' }, { status: 400 });
    }
    if (!status || !['downloading', 'applied', 'failed'].includes(status)) {
      return NextResponse.json({ success: false, error: 'status must be downloading, applied, or failed' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: deployment, error: deploymentError } = await supabase
      .from('firmware_deployments')
      .select('id, machine_id, firmware_version_id, vending_machines(id, device_secret), firmware_versions(version)')
      .eq('id', deployment_id)
      .maybeSingle();

    if (deploymentError || !deployment) {
      return NextResponse.json({ success: false, error: 'Deployment not found' }, { status: 404 });
    }

    const machine = Array.isArray(deployment.vending_machines)
      ? deployment.vending_machines[0]
      : deployment.vending_machines;

    if (!machine || machine.device_secret !== deviceSecret) {
      return NextResponse.json({ success: false, error: 'Invalid device secret' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status, updated_at: now };
    if (status === 'failed') updateData.error_message = error_message || 'Unknown error';
    if (status === 'applied') updateData.applied_at = now;

    const { error: updateError } = await supabase
      .from('firmware_deployments')
      .update(updateData)
      .eq('id', deployment_id);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (status === 'applied') {
      const firmwareVersion = Array.isArray(deployment.firmware_versions)
        ? deployment.firmware_versions[0]
        : deployment.firmware_versions;

      await supabase
        .from('vending_machines')
        .update({
          firmware_version: firmwareVersion?.version ?? null,
          last_firmware_update: now,
        })
        .eq('id', deployment.machine_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Firmware status report error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
