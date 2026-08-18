import { NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

const MAX_BATCH_SIZE = 100;

type OfflineTransaction = {
  client_tx_id: string;
  card_uid: string;
  product_id: string;
  motor_index?: number;
  offline_ms_ago?: number;
};

type SyncResult = {
  client_tx_id: string;
  status: 'synced' | 'already_synced' | 'error';
  error_code?: string;
};

/**
 * POST /api/rfid-payment/offline-sync
 * Body: { machine_id (UUID), transactions: OfflineTransaction[] }
 *
 * Reconciles a batch of RFID taps an Ethernet-only machine dispensed while
 * offline (see GET /api/machine-cards-sync for how it validated cards
 * locally in the first place). Each transaction is processed independently
 * and sequentially — never in parallel, since concurrent updates to the
 * same card's credits/tally within one batch would race each other.
 *
 * Unlike the live /api/rfid-payment route, this does NOT re-reject a
 * transaction just because the card is now inactive or restricted to a
 * different machine: the physical dispense already happened, in good faith,
 * based on the device's local cache at tap time — rejecting here wouldn't
 * un-dispense the product, it would just leave the ledger wrong. The only
 * hard requirement is that the card still exists at all (rfid_payments.card_id
 * is a NOT NULL FK) — if it was deleted since the tap, that one transaction
 * is reported as an error and the rest of the batch still proceeds.
 *
 * Idempotency: each transaction carries a client-generated client_tx_id
 * (unique per device+tap). We attempt the rfid_payments insert directly and
 * treat a Postgres unique-violation (23505) on that column as "already
 * synced" rather than pre-checking existence first, which would leave a
 * window for a retried batch (e.g. after an HTTP timeout) to double-insert.
 *
 * Credit/tally updates use the same read-then-write pattern as the live
 * route (fetch fresh, compute, write) rather than a single atomic SQL
 * expression — consistent with how the rest of this codebase does it today,
 * with the same small residual race window against a *concurrent* request
 * touching the same card. A stored-procedure-based atomic update would close
 * that gap but is a bigger schema commitment than this feature needs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, transactions } = body as { machine_id?: string; transactions?: OfflineTransaction[] };

    if (!machine_id || !Array.isArray(transactions)) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    const batch = transactions.slice(0, MAX_BATCH_SIZE);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results: SyncResult[] = [];

    for (const tx of batch) {
      const result = await syncOne(supabase, machine_id, tx);
      results.push(result);
    }

    console.log(`📦 RFID offline sync: machine ${machine_id}, ${results.filter(r => r.status === 'synced').length}/${batch.length} newly synced`);

    return successResponse({ results });
  } catch (error: any) {
    console.error('RFID offline sync error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}

async function syncOne(supabase: SupabaseClient<any, any, any, any, any>, machineId: string, tx: OfflineTransaction): Promise<SyncResult> {
  if (!tx.client_tx_id || !tx.card_uid || !tx.product_id) {
    return { client_tx_id: tx.client_tx_id || 'unknown', status: 'error', error_code: 'MISSING_FIELDS' };
  }

  const { data: card, error: cardError } = await supabase
    .from('rfid_cards')
    .select('id, uid, credits_remaining, card_type, vend_count, total_spent_paisa')
    .eq('uid', tx.card_uid.toUpperCase())
    .single();

  if (cardError || !card) {
    return { client_tx_id: tx.client_tx_id, status: 'error', error_code: 'CARD_NOT_FOUND' };
  }

  // Same price resolution as the live route — server stays the source of
  // truth for what a queued tap actually cost, even though the firmware
  // decided offline whether to gate on it (prepaid: it didn't need to,
  // price is irrelevant to the flat 1-credit deduction; postpaid: it
  // dispensed unconditionally either way).
  const { data: machineProduct, error: mpError } = await supabase
    .from('machine_products')
    .select('product_id, price, product:products ( id, name, price )')
    .eq('machine_id', machineId)
    .eq('product_id', tx.product_id)
    .eq('is_active', 1)
    .single();

  if (mpError || !machineProduct) {
    return { client_tx_id: tx.client_tx_id, status: 'error', error_code: 'PRODUCT_NOT_FOUND' };
  }

  const product = Array.isArray(machineProduct.product) ? machineProduct.product[0] : machineProduct.product;
  const priceRupees = machineProduct.price ?? product.price;
  const amountInPaisa = Math.round(priceRupees * 100);
  const isPostpaid = card.card_type === 'postpaid';

  // The rawNewCredits value (which can go negative) is what gets logged on
  // the rfid_payments row, even though the actual rfid_cards row clamps at 0
  // — this keeps the shortfall from an offline oversell visible in the
  // payment history instead of silently disappearing at the clamp.
  const rawNewCredits = card.credits_remaining - 1;
  const clampedNewCredits = Math.max(0, rawNewCredits);

  if (isPostpaid) {
    await supabase
      .from('rfid_cards')
      .update({
        vend_count: card.vend_count + 1,
        total_spent_paisa: card.total_spent_paisa + amountInPaisa,
      })
      .eq('id', card.id);
  } else {
    await supabase
      .from('rfid_cards')
      .update({ credits_remaining: clampedNewCredits })
      .eq('id', card.id);
  }

  const dispensedAt = typeof tx.offline_ms_ago === 'number'
    ? new Date(Date.now() - tx.offline_ms_ago).toISOString()
    : new Date().toISOString();

  const { error: insertError } = await supabase
    .from('rfid_payments')
    .insert({
      machine_id: machineId,
      product_id: machineProduct.product_id,
      card_id: card.id,
      card_uid: card.uid,
      amount_in_paisa: amountInPaisa,
      credits_after: isPostpaid ? null : rawNewCredits,
      dispensed: true,
      dispensed_at: dispensedAt,
      motor_index: tx.motor_index ?? null,
      client_tx_id: tx.client_tx_id,
      offline: true,
    });

  if (insertError) {
    if ((insertError as any).code === '23505') {
      // Already synced in a previous attempt at this batch — the card
      // mutation above just got re-applied though, which would double-count
      // it. Roll that specific mutation back before reporting success.
      if (isPostpaid) {
        await supabase
          .from('rfid_cards')
          .update({ vend_count: card.vend_count, total_spent_paisa: card.total_spent_paisa })
          .eq('id', card.id);
      } else {
        await supabase.from('rfid_cards').update({ credits_remaining: card.credits_remaining }).eq('id', card.id);
      }
      return { client_tx_id: tx.client_tx_id, status: 'already_synced' };
    }

    console.error('RFID offline sync insert error:', insertError);
    // Roll back the card mutation to keep state consistent, same as the live route.
    if (isPostpaid) {
      await supabase
        .from('rfid_cards')
        .update({ vend_count: card.vend_count, total_spent_paisa: card.total_spent_paisa })
        .eq('id', card.id);
    } else {
      await supabase.from('rfid_cards').update({ credits_remaining: card.credits_remaining }).eq('id', card.id);
    }
    return { client_tx_id: tx.client_tx_id, status: 'error', error_code: 'INSERT_FAILED' };
  }

  return { client_tx_id: tx.client_tx_id, status: 'synced' };
}
