import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Device-facing endpoint. The ESP32's Ethernet stack has no TLS support at
 * all (see ESP32_RFID_Firmware.ino / "HTTPS not supported over Ethernet"),
 * so it cannot fetch a Supabase Storage signed URL directly -- it can only
 * ever talk to our own domain, same as every other device call. This route
 * fetches the binary from Storage server-side (where TLS is no problem) and
 * streams it back over whatever transport the machine used to reach us
 * (plain HTTP through the jumphost relay for Ethernet machines, real HTTPS
 * directly for WiFi machines).
 *
 * Endpoint: GET /api/firmware-download?deployment_id=<id>&device_secret=<secret>
 */
export async function GET(request: NextRequest) {
  try {
    const deploymentId = request.nextUrl.searchParams.get('deployment_id');
    const deviceSecret = request.nextUrl.searchParams.get('device_secret');

    if (!deploymentId || !deviceSecret) {
      return NextResponse.json({ error: 'deployment_id and device_secret are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: deployment } = await supabase
      .from('firmware_deployments')
      .select('id, vending_machines(device_secret), firmware_versions(storage_path, sha256)')
      .eq('id', deploymentId)
      .maybeSingle();

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const machine = Array.isArray(deployment.vending_machines)
      ? deployment.vending_machines[0]
      : deployment.vending_machines;

    if (!machine || machine.device_secret !== deviceSecret) {
      return NextResponse.json({ error: 'Invalid device secret' }, { status: 401 });
    }

    const firmware = Array.isArray(deployment.firmware_versions)
      ? deployment.firmware_versions[0]
      : deployment.firmware_versions;

    if (!firmware) {
      return NextResponse.json({ error: 'Firmware version not found' }, { status: 404 });
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('firmware')
      .download(firmware.storage_path);

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'Failed to fetch firmware binary' }, { status: 500 });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(arrayBuffer.byteLength),
        'X-Firmware-SHA256': firmware.sha256,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Firmware download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
