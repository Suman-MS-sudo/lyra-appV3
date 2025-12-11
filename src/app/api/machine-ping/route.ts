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

    console.log('📡 Machine ping received:', {
      machine_id,
      firmware_version,
      wifi_rssi,
      stock_count
    });

    // Update machine record with latest ping data
    if (machine_id && machine_id !== 'UNKNOWN') {
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
        updateData.stock = stock_count;
        console.log(`📦 Updating stock from machine: ${stock_count}`);
      }

      const { error: updateError } = await supabase
        .from('vending_machines')
        .update(updateData)
        .eq('id', machine_id);

      if (updateError) {
        console.error('Error updating machine ping:', updateError);
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
