import { NextResponse } from 'next/server';

// GET /api/time — trivial time source for Ethernet-only ESP32 machines.
// They can't use NTP (UIPEthernet implements its own uIP stack, separate
// from the ESP-IDF LWIP/SNTP subsystem configTime()/sntp rely on), but they
// already have a working plain-HTTP path through the proxy, so this gives
// them an epoch reference the same way. No auth — same trust level as the
// other machine-facing endpoints (get-machine-id-from-mac, machine-ping),
// and it returns nothing sensitive.
export async function GET() {
  return NextResponse.json({ success: true, data: { epoch: Math.floor(Date.now() / 1000) } });
}
