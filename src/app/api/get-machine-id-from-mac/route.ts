import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  console.log('🔍 [GET /api/get-machine-id-from-mac] Request received');
  try {
    const searchParams = request.nextUrl.searchParams;
    const mac = searchParams.get('mac');
    const firmware = searchParams.get('firmware');
    
    console.log('🔍 MAC:', mac, 'Firmware:', firmware);

    if (!mac) {
      console.log('❌ No MAC provided');
      return errorResponse('MAC address is required', 'INVALID_MAC', 400);
    }

    // Use service role to bypass RLS for machine lookup
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

    // Look up machine by MAC address
    const { data: machine, error } = await supabase
      .from('vending_machines')
      .select('id, machine_id, name')
      .eq('mac_id', mac.toUpperCase())
      .single();

    console.log('📊 Database query result:', { machine, error });

    if (error || !machine) {
      console.log('❌ Machine not found');
      return errorResponse('Machine not found', 'MACHINE_NOT_FOUND', 404);
    }

    // Update firmware version only (don't update last_ping - that's done by /api/machine-ping)
    if (firmware) {
      await supabase
        .from('vending_machines')
        .update({ 
          firmware_version: firmware
        })
        .eq('id', machine.id);
    }

    console.log('✅ Returning machine_id:', machine.machine_id);
    return successResponse({
      machine_id: machine.machine_id,
      machine_name: machine.name
    });
  } catch (error) {
    console.error('❌ Error fetching machine info:', error);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
