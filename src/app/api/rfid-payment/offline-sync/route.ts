import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { effectiveMonthlyCount, vendMonthOf } from '@/lib/rfid-monthly-cap';

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

type CardRow = {
  id: string;
  uid: string;
  credits_remaining: number;
  card_type: string;
  vend_count: number;
  total_spent_paisa: number;
  monthly_vend_count: number;
  monthly_vend_month: string | null;
};

/**
 * POST /api/rfid-payment/offline-sync
 * Body: { machine_id (UUID), transactions: OfflineTransaction[] }
 *
 * Reconciles a batch of RFID taps an Ethernet-only machine dispensed while
 * offline (see GET /api/machine-cards-sync for how it validated cards
 * locally in the first place).
 *
 * Batched, not per-transaction: an earlier version issued up to 4 sequential
 * Supabase round trips per transaction (select card, select machine_product,
 * update card, insert payment). With a machine that's been offline a while
 * (10-15+ queued taps is routine), that's 50-75+ sequential round trips —
 * comfortably over the ESP32 firmware's 5s HTTP timeout, which made this
 * endpoint time out on every single retry and the queue never drain (see the
 * firmware's makeEthernetHTTPRequest() timeout handling). This version does
 * the reads as 2 batched queries and the writes as 1 batched upsert + one
 * update per uniquely-touched card, independent of batch size.
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
 * (unique per device+tap). The batch insert uses upsert with
 * ignoreDuplicates so a retried batch (e.g. after a prior timeout) skips
 * rows it already has, returned via .select() as exactly the newly-inserted
 * subset — anything NOT in that returned set was already synced.
 *
 * Ordering: inserting first (before touching any card balance) means we
 * only need to apply a card's credit/tally delta for transactions that are
 * confirmed new, so there's no separate rollback step for the
 * already-synced case — mirrors the old code's outcome without needing to
 * undo a speculative mutation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machine_id, transactions } = body as { machine_id?: string; transactions?: OfflineTransaction[] };

    if (!machine_id || !Array.isArray(transactions)) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    const batch = transactions.slice(0, MAX_BATCH_SIZE);
    const results: SyncResult[] = [];

    const validTxs = batch.filter(tx => {
      if (tx.client_tx_id && tx.card_uid && tx.product_id) return true;
      console.warn(`RFID offline sync: MISSING_FIELDS for tx ${tx.client_tx_id || 'unknown'} (card_uid="${tx.card_uid}", product_id="${tx.product_id}")`);
      results.push({ client_tx_id: tx.client_tx_id || 'unknown', status: 'error', error_code: 'MISSING_FIELDS' });
      return false;
    });

    if (validTxs.length === 0) {
      return successResponse({ results });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const uids = [...new Set(validTxs.map(tx => tx.card_uid.toUpperCase()))];
    const productIds = [...new Set(validTxs.map(tx => tx.product_id))];

    const [{ data: cards }, { data: machineProducts }] = await Promise.all([
      supabase
        .from('rfid_cards')
        .select('id, uid, credits_remaining, card_type, vend_count, total_spent_paisa, monthly_vend_count, monthly_vend_month')
        .in('uid', uids),
      supabase
        .from('machine_products')
        .select('product_id, price, product:products ( id, name, price )')
        .eq('machine_id', machine_id)
        .in('product_id', productIds)
        .eq('is_active', 1),
    ]);

    const cardByUid = new Map<string, CardRow>((cards ?? []).map((c: CardRow) => [c.uid, c]));
    const productByPid = new Map((machineProducts ?? []).map((mp: any) => [mp.product_id, mp]));

    // Resolve each transaction against the prefetched maps and build the
    // insert rows. amount_in_paisa/credits_after are computed optimistically
    // here (assuming this transaction is genuinely new) — for the rare
    // retried-batch case, any transaction that turns out to already be
    // synced never gets inserted (its original row/credits_after from the
    // first successful sync is untouched), so the optimism only matters for
    // transactions that really are new, where it's correct.
    type PendingRow = {
      client_tx_id: string;
      card_uid: string;
      insert: Record<string, any>;
      delta: { isPostpaid: boolean; amountInPaisa: number };
    };
    const pending: PendingRow[] = [];

    for (const tx of validTxs) {
      const uid = tx.card_uid.toUpperCase();
      const card = cardByUid.get(uid);
      if (!card) {
        console.warn(`RFID offline sync: CARD_NOT_FOUND for tx ${tx.client_tx_id} (card_uid=${uid})`);
        results.push({ client_tx_id: tx.client_tx_id, status: 'error', error_code: 'CARD_NOT_FOUND' });
        continue;
      }

      const machineProduct = productByPid.get(tx.product_id);
      if (!machineProduct) {
        console.warn(`RFID offline sync: PRODUCT_NOT_FOUND for tx ${tx.client_tx_id} (machine_id=${machine_id}, product_id="${tx.product_id}")`);
        results.push({ client_tx_id: tx.client_tx_id, status: 'error', error_code: 'PRODUCT_NOT_FOUND' });
        continue;
      }

      const product = Array.isArray((machineProduct as any).product) ? (machineProduct as any).product[0] : (machineProduct as any).product;
      const priceRupees = (machineProduct as any).price ?? product.price;
      const amountInPaisa = Math.round(priceRupees * 100);
      const isPostpaid = card.card_type === 'postpaid';

      // Running in-memory balance so multiple taps of the SAME card within
      // this one batch apply sequentially against each other (matching the
      // old per-transaction fetch-then-write order) without a round trip
      // per tap.
      const rawNewCredits = card.credits_remaining - 1;
      const clampedNewCredits = Math.max(0, rawNewCredits);
      if (isPostpaid) {
        card.vend_count += 1;
        card.total_spent_paisa += amountInPaisa;
      } else {
        card.credits_remaining = clampedNewCredits;
      }

      const dispensedAt = typeof tx.offline_ms_ago === 'number'
        ? new Date(Date.now() - tx.offline_ms_ago).toISOString()
        : new Date().toISOString();

      // The tap was already allowed/refused by the machine's own local
      // monthly counter at dispense time (see the firmware's
      // handleOfflineRfidTap()) — this is pure bookkeeping to keep the
      // server's count in sync, not a re-check, keyed off when the tap
      // actually happened rather than "now" (a batch can span a month
      // boundary if the machine was offline for a while).
      const dispensedAtDate = new Date(dispensedAt);
      const effectiveMonthly = effectiveMonthlyCount(card.monthly_vend_month, card.monthly_vend_count, dispensedAtDate);
      card.monthly_vend_count = effectiveMonthly + 1;
      card.monthly_vend_month = vendMonthOf(dispensedAtDate);

      pending.push({
        client_tx_id: tx.client_tx_id,
        card_uid: uid,
        insert: {
          machine_id,
          product_id: (machineProduct as any).product_id,
          card_id: card.id,
          card_uid: card.uid,
          amount_in_paisa: amountInPaisa,
          credits_after: isPostpaid ? null : rawNewCredits,
          dispensed: true,
          dispensed_at: dispensedAt,
          motor_index: tx.motor_index ?? null,
          client_tx_id: tx.client_tx_id,
          offline: true,
        },
        delta: { isPostpaid, amountInPaisa },
      });
    }

    if (pending.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('rfid_payments')
        .upsert(pending.map(p => p.insert), { onConflict: 'client_tx_id', ignoreDuplicates: true })
        .select('client_tx_id');

      if (insertError) {
        console.error('RFID offline sync batch insert error:', insertError);
        for (const p of pending) {
          results.push({ client_tx_id: p.client_tx_id, status: 'error', error_code: 'INSERT_FAILED' });
        }
      } else {
        const newlyInserted = new Set((inserted ?? []).map((r: any) => r.client_tx_id));

        // Cards whose final balance actually needs writing — only those
        // touched by at least one genuinely-new transaction. Anything that
        // turned out to be already-synced had its optimistic delta above
        // reversed here before the balance is persisted, so a retried
        // batch can't double-apply a credit deduction or tally bump.
        const touchedUids = new Set<string>();
        for (const p of pending) {
          if (newlyInserted.has(p.client_tx_id)) {
            results.push({ client_tx_id: p.client_tx_id, status: 'synced' });
            touchedUids.add(p.card_uid);
          } else {
            results.push({ client_tx_id: p.client_tx_id, status: 'already_synced' });
            const card = cardByUid.get(p.card_uid)!;
            if (p.delta.isPostpaid) {
              card.vend_count -= 1;
              card.total_spent_paisa -= p.delta.amountInPaisa;
            } else {
              card.credits_remaining += 1;
            }
            // Mirrors vend_count's simple -1 reversal above — precise as
            // long as a retried batch doesn't itself straddle a month
            // rollover, which the 5/month cap makes vanishingly unlikely.
            card.monthly_vend_count = Math.max(0, card.monthly_vend_count - 1);
          }
        }

        await Promise.all(
          [...touchedUids].map(uid => {
            const card = cardByUid.get(uid)!;
            const isPostpaid = card.card_type === 'postpaid';
            return supabase
              .from('rfid_cards')
              .update({
                ...(isPostpaid
                  ? { vend_count: card.vend_count, total_spent_paisa: card.total_spent_paisa }
                  : { credits_remaining: card.credits_remaining }),
                monthly_vend_count: card.monthly_vend_count,
                monthly_vend_month: card.monthly_vend_month,
              })
              .eq('id', card.id);
          })
        );
      }
    }

    console.log(`📦 RFID offline sync: machine ${machine_id}, ${results.filter(r => r.status === 'synced').length}/${batch.length} newly synced`);

    return successResponse({ results });
  } catch (error: any) {
    console.error('RFID offline sync error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
