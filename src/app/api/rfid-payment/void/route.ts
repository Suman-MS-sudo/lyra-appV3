import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * POST /api/rfid-payment/void — reverses an RFID payment the machine
 * couldn't actually dispense for.
 *
 * /api/rfid-payment charges/deducts before the machine has physically
 * attempted to dispense anything (the motor doesn't fire until after that
 * call returns). If the firmware's own stock tracking then finds every
 * motor empty, the customer would otherwise be charged for nothing with no
 * record that anything went wrong. The firmware calls this right after that
 * happens, using the payment_id it got back from /api/rfid-payment.
 *
 * Body: { payment_id }
 *
 * Idempotent: calling this twice for the same payment_id only refunds once
 * (checks rfid_payments.dispensed before touching the card).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment_id } = body;

    if (!payment_id) {
      return errorResponse('payment_id is required', 'MISSING_FIELDS', 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: payment, error: paymentError } = await supabase
      .from('rfid_payments')
      .select('id, card_id, amount_in_paisa, dispensed')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return errorResponse('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    if (!payment.dispensed) {
      // Already voided (e.g. firmware retried the call after a network
      // hiccup on the first attempt) — don't refund twice.
      return successResponse({ message: 'Payment already voided', payment_id });
    }

    const { data: card, error: cardError } = await supabase
      .from('rfid_cards')
      .select('id, card_type, credits_remaining, vend_count, total_spent_paisa')
      .eq('id', payment.card_id)
      .single();

    if (cardError || !card) {
      return errorResponse('Card not found for this payment', 'CARD_NOT_FOUND', 404);
    }

    if (card.card_type === 'postpaid') {
      const { error: tallyError } = await supabase
        .from('rfid_cards')
        .update({
          vend_count: Math.max(0, card.vend_count - 1),
          total_spent_paisa: Math.max(0, card.total_spent_paisa - payment.amount_in_paisa),
        })
        .eq('id', card.id);

      if (tallyError) {
        console.error('RFID void postpaid tally update error:', tallyError);
        return errorResponse('Failed to reverse usage tally', 'TALLY_UPDATE_FAILED', 500);
      }
    } else {
      const { error: creditsError } = await supabase
        .from('rfid_cards')
        .update({ credits_remaining: card.credits_remaining + 1 })
        .eq('id', card.id);

      if (creditsError) {
        console.error('RFID void credits update error:', creditsError);
        return errorResponse('Failed to refund credit', 'CREDITS_UPDATE_FAILED', 500);
      }
    }

    const { error: updateError } = await supabase
      .from('rfid_payments')
      .update({ dispensed: false })
      .eq('id', payment_id);

    if (updateError) {
      console.error('RFID payment void update error:', updateError);
      return errorResponse('Failed to mark payment as voided', 'UPDATE_FAILED', 500);
    }

    console.log(`↩️ RFID payment voided (dispense failed): ${payment_id}`);

    return successResponse({ message: 'Payment voided and refunded', payment_id });
  } catch (error: any) {
    console.error('RFID payment void error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
