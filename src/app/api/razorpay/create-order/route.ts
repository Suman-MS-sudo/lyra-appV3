import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    // Get credentials with fallback
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_lmKnnhDWFEBx4e';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'OrxoAbykv5jDlvzJxgPifKh6';

    console.log('API Route - Using Razorpay Key ID:', keyId);
    console.log('API Route - Key Secret exists:', !!keySecret);

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const { amount, currency = 'INR' } = await request.json();

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
