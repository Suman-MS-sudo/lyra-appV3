import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    const { machineId } = await params;

    // Validate machine ID
    if (!machineId || machineId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid machine ID' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch machine details by machine_id (string identifier)
    const { data: machine, error: machineError } = await serviceSupabase
      .from('vending_machines')
      .select('*')
      .eq('machine_id', machineId)
      .single();

    if (machineError || !machine) {
      return NextResponse.json(
        { success: false, error: 'Machine not found' },
        { status: 404 }
      );
    }

    // Check if machine is truly online (last ping within 20 minutes)
    let isOnline = false;
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      const now = new Date().getTime();
      const twentyMinutes = 20 * 60 * 1000; // 20 minutes in milliseconds
      isOnline = (now - lastPingTime) < twentyMinutes;
    }

    // Update machine.asset_online with calculated value
    machine.asset_online = isOnline;

    // Update machine online status in database
    // Get firmware version from query params if provided
    const firmwareVersion = request.nextUrl.searchParams.get('firmware');
    
    const updateData: any = {
      asset_online: isOnline,
      last_ping: new Date().toISOString(),
    };
    
    if (firmwareVersion) {
      updateData.firmware_version = firmwareVersion;
      console.log(`📡 Updated firmware version for ${machine.machine_id}: ${firmwareVersion}`);
    }
    
    const { error: updateError } = await serviceSupabase
      .from('vending_machines')
      .update(updateData)
      .eq('id', machine.id);
    
    if (updateError) {
      console.error('Error updating machine:', updateError);
    }

    // Fetch products for this machine from machine_products junction table
    const { data: machineProducts, error: productsError } = await serviceSupabase
      .from('machine_products')
      .select(`
        id,
        product_id,
        stock,
        price,
        is_active,
        products (
          id,
          name,
          description,
          image_url
        )
      `)
      .eq('machine_id', machine.id)
      .eq('is_active', 1)
      .order('created_at', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    return NextResponse.json({
      success: true,
      machine,
      products: machineProducts || [],
    });
  } catch (error: any) {
    console.error('Error in machine products API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
