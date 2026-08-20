import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { MONTHLY_VEND_LIMIT, effectiveMonthlyCount } from '@/lib/rfid-monthly-cap';

/**
 * GET /api/machine-cards-sync?machine_id=<uuid>
 *
 * Lets an Ethernet-only ESP32 machine download a lightweight local cache of
 * the RFID cards it's allowed to serve, so it can keep validating taps and
 * dispensing product while its network connection is down (see
 * POST /api/rfid-payment/offline-sync for how the resulting offline
 * transactions get reconciled once it reconnects).
 *
 * Scoping mirrors assertOwnsCard() in
 * src/app/api/customer/rfid-cards/[id]/route.ts: a card belongs to this
 * machine if it's locked to it directly (card.machine_id = machine_id), or
 * it's an org-wide "any machine" card (card.machine_id IS NULL) whose
 * organization_id matches the machine's owning customer.
 *
 * Payload is intentionally minimal (no holder_name/org/machine info) — the
 * device only needs enough to answer "is this UID valid, and how many
 * credits does it have" locally.
 */
export async function GET(request: NextRequest) {
  try {
    const machineId = request.nextUrl.searchParams.get('machine_id');
    if (!machineId) {
      return errorResponse('machine_id is required', 'MISSING_FIELDS', 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: machine, error: machineError } = await supabase
      .from('vending_machines')
      .select('id, customer_id')
      .eq('id', machineId)
      .single();

    if (machineError || !machine) {
      return errorResponse('Machine not found', 'MACHINE_NOT_FOUND', 404);
    }

    const CARD_FIELDS = 'uid, credits_remaining, is_active, card_type, product_id, monthly_vend_count, monthly_vend_month';

    let cardsQuery = supabase
      .from('rfid_cards')
      .select(CARD_FIELDS)
      .eq('machine_id', machineId);

    if (machine.customer_id) {
      cardsQuery = supabase
        .from('rfid_cards')
        .select(CARD_FIELDS)
        .or(`machine_id.eq.${machineId},and(machine_id.is.null,organization_id.eq.${machine.customer_id})`);
    }

    const { data: cards, error: cardsError } = await cardsQuery;

    if (cardsError) {
      return errorResponse(cardsError.message, 'INTERNAL_ERROR', 500);
    }

    // Every card is capped at MONTHLY_VEND_LIMIT taps/month regardless of
    // card_type — the machine enforces this itself while offline, so it
    // needs the current remaining count, not the raw counter columns.
    const now = new Date();
    const cardsWithMonthly = (cards || []).map(({ monthly_vend_count, monthly_vend_month, ...rest }) => ({
      ...rest,
      monthly_remaining: Math.max(0, MONTHLY_VEND_LIMIT - effectiveMonthlyCount(monthly_vend_month, monthly_vend_count, now)),
    }));

    return successResponse({ cards: cardsWithMonthly });
  } catch (error) {
    console.error('❌ Error syncing machine cards:', error);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
