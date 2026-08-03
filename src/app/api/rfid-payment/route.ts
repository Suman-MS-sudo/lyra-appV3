import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * RFID Payment API for ESP32
 *
 * Endpoint: POST /api/rfid-payment
 * Body: { machine_id (UUID), card_uid (hex string), product_id? (UUID) }
 *
 * Price is always resolved server-side from machine_products (never trusts
 * a device-supplied amount). If product_id is omitted, the machine's first
 * available product is used (single-product machines).
 *
 * Two card types:
 *  - prepaid:  deducts 1 credit per tap from the card's credits_remaining;
 *              declined once credits reach zero. Product price is still
 *              resolved and logged, it just doesn't gate the tap.
 *  - postpaid: no credit check — every tap dispenses. vend_count and
 *              total_spent_paisa on the card accumulate for later billing.
 *
 * Records the transaction in rfid_payments either way. Returns the product
 * to dispense plus the card's remaining credits (prepaid) so the firmware
 * can display it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, card_uid, product_id } = body;

    if (!machine_id || !card_uid) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve the card
    const { data: card, error: cardError } = await supabase
      .from('rfid_cards')
      .select('id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa, machine_id, product_id')
      .eq('uid', card_uid.toUpperCase())
      .single();

    if (cardError || !card) {
      return errorResponse('Card not registered', 'CARD_NOT_FOUND', 404);
    }

    if (!card.is_active) {
      return errorResponse('Card is inactive', 'CARD_INACTIVE', 403);
    }

    if (card.machine_id && card.machine_id !== machine_id) {
      return errorResponse('This card is not valid on this machine', 'WRONG_MACHINE', 403);
    }

    // A product assigned to the card overrides whatever the request/machine default would resolve to
    const effectiveProductId = card.product_id || product_id;

    // Resolve machine product + price (server is the source of truth for price)
    let machineProductQuery = supabase
      .from('machine_products')
      .select(`
        id,
        stock,
        price,
        product_id,
        product:products (
          id,
          name,
          price
        )
      `)
      .eq('machine_id', machine_id)
      .eq('is_active', 1);

    machineProductQuery = effectiveProductId
      ? machineProductQuery.eq('product_id', effectiveProductId)
      : machineProductQuery.limit(1);

    const { data: machineProduct, error: mpError } = await machineProductQuery.single();

    if (mpError || !machineProduct) {
      return errorResponse('Machine product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    if ((machineProduct.stock ?? 0) <= 0) {
      return errorResponse('Product out of stock', 'OUT_OF_STOCK', 409);
    }

    const product = Array.isArray(machineProduct.product)
      ? machineProduct.product[0]
      : machineProduct.product;

    const priceRupees = machineProduct.price ?? product.price;
    const amountInPaisa = Math.round(priceRupees * 100);
    const isPostpaid = card.card_type === 'postpaid';

    let newCredits = card.credits_remaining;

    if (isPostpaid) {
      // No credit check — just tally usage for later billing.
      const { error: tallyError } = await supabase
        .from('rfid_cards')
        .update({
          vend_count: card.vend_count + 1,
          total_spent_paisa: card.total_spent_paisa + amountInPaisa,
        })
        .eq('id', card.id);

      if (tallyError) {
        console.error('RFID postpaid tally update error:', tallyError);
        return errorResponse('Failed to record usage', 'TALLY_UPDATE_FAILED', 500);
      }
    } else {
      if (card.credits_remaining < 1) {
        return errorResponse(
          `Insufficient credits: has ${card.credits_remaining} remaining`,
          'INSUFFICIENT_CREDITS',
          402
        );
      }

      newCredits = card.credits_remaining - 1;

      const { error: creditsError } = await supabase
        .from('rfid_cards')
        .update({ credits_remaining: newCredits })
        .eq('id', card.id);

      if (creditsError) {
        console.error('RFID credits update error:', creditsError);
        return errorResponse('Failed to deduct credits', 'CREDITS_UPDATE_FAILED', 500);
      }
    }

    // Record the transaction
    const { data: rfidPayment, error: rpError } = await supabase
      .from('rfid_payments')
      .insert({
        machine_id,
        product_id: machineProduct.product_id,
        card_id: card.id,
        card_uid: card.uid,
        amount_in_paisa: amountInPaisa,
        credits_after: isPostpaid ? null : newCredits,
        dispensed: true,
        dispensed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (rpError) {
      console.error('RFID payment insert error:', rpError);
      // Roll back whichever card update happened, to keep card state consistent
      if (isPostpaid) {
        await supabase
          .from('rfid_cards')
          .update({ vend_count: card.vend_count, total_spent_paisa: card.total_spent_paisa })
          .eq('id', card.id);
      } else {
        await supabase.from('rfid_cards').update({ credits_remaining: card.credits_remaining }).eq('id', card.id);
      }
      return errorResponse('Failed to record RFID payment', 'INSERT_FAILED', 500);
    }

    console.log(`🪪 RFID payment: ${card.uid} / ${product.name} / ₹${(amountInPaisa / 100).toFixed(2)} / ${isPostpaid ? `postpaid, tab now ₹${((card.total_spent_paisa + amountInPaisa) / 100).toFixed(2)}` : `credits left ${newCredits}`}`);

    return successResponse({
      message: 'RFID payment recorded',
      payment_id: rfidPayment.id,
      product_id: machineProduct.product_id,
      product_name: product.name,
      amount: amountInPaisa / 100,
      card_type: card.card_type,
      credits_remaining: isPostpaid ? null : newCredits,
      holder_name: card.holder_name,
    });
  } catch (error: any) {
    console.error('RFID payment error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
