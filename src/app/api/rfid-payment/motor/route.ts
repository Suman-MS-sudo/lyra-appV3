import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * POST /api/rfid-payment/motor — backfill which physical motor dispensed a
 * payment, on quad-motor machines. The motor isn't chosen until *after*
 * /api/rfid-payment already created the payment row (round-robin selection
 * happens during the physical dispense step), so the firmware calls this
 * right after the motor fires, using the payment_id it got back from that
 * earlier response.
 *
 * Body: { payment_id, motor_index }  (motor_index is 0-indexed: 0=M1..3=M4)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment_id, motor_index } = body;

    if (!payment_id || typeof motor_index !== 'number') {
      return errorResponse('payment_id and motor_index are required', 'MISSING_FIELDS', 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('rfid_payments')
      .update({ motor_index })
      .eq('id', payment_id);

    if (error) {
      console.error('RFID payment motor_index update error:', error);
      return errorResponse('Failed to record motor index', 'UPDATE_FAILED', 500);
    }

    return successResponse({ message: 'Motor index recorded', payment_id, motor_index });
  } catch (error: any) {
    console.error('RFID payment motor_index error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
