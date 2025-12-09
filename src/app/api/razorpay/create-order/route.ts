import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { amount, currency = 'INR', machineId } = await request.json();

    // Check if machine is online (last ping within 20 minutes)
    if (machineId) {
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: machine } = await serviceSupabase
        .from('vending_machines')
        .select('last_ping, machine_name')
        .eq('machine_id', machineId)
        .single();

      if (machine && machine.last_ping) {
        const lastPingTime = new Date(machine.last_ping).getTime();
        const now = new Date().getTime();
        const twentyMinutes = 20 * 60 * 1000; // 20 minutes in milliseconds

        if (now - lastPingTime > twentyMinutes) {
          console.error(`❌ Machine ${machineId} is offline - last ping: ${machine.last_ping}`);
          return NextResponse.json(
            { 
              success: false, 
              error: `Machine "${machine.machine_name || machineId}" is currently offline. Please try again later or contact support.`,
              offline: true
            },
            { status: 503 } // Service Unavailable
          );
        }
      }
    }

    // Get credentials with fallback
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_lmKnnhDWFEBx4e';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'OrxoAbykv5jDlvzJxgPifKh6';

    console.log('API Route - Using Razorpay Key ID:', keyId);
    console.log('API Route - Key Secret exists:', !!keySecret);

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    console.log('Received amount:', amount);
    console.log('Amount type:', typeof amount);

    if (!amount || amount <= 0) {
      console.error('Invalid amount received:', amount);
      return NextResponse.json(
        { success: false, error: `Invalid amount: ${amount}` },
        { status: 400 }
      );
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay accepts amount in paise
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
