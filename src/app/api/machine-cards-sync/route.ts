import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { UNCAPPED_MONTHLY_REMAINING, effectiveMonthlyCount, fetchOrgMonthlyLimits } from '@/lib/rfid-monthly-cap';
import { machineOrganizationId } from '@/lib/machine-scope';

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
 * machine if it has a row in rfid_card_machines for this machine_id
 * (possibly alongside other machines -- a card can be restricted to several
 * machines at once now, not just zero or one), or it has ZERO restriction
 * rows and is an org-wide "any machine" card whose organization_id matches
 * the machine's owning customer.
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

    const CARD_FIELDS = 'id, uid, credits_remaining, is_active, card_type, product_id, organization_id, monthly_vend_count, monthly_vend_month';

    // Pass 1: cards specifically restricted to this machine, via the join
    // table (a card can be restricted to several machines now, not just
    // one). Flat queries rather than a nested embed -- see
    // fetchAdminRfidCards in src/lib/rfid-cards.ts for why.
    const { data: restrictedHereRows, error: restrictedHereError } = await supabase
      .from('rfid_card_machines')
      .select('card_id')
      .eq('machine_id', machineId);

    if (restrictedHereError) {
      return errorResponse(restrictedHereError.message, 'INTERNAL_ERROR', 500);
    }

    const cardIdsForThisMachine = [...new Set((restrictedHereRows || []).map(r => r.card_id))];
    const cardMap = new Map<string, any>();

    if (cardIdsForThisMachine.length > 0) {
      const { data: restrictedCards, error: restrictedCardsError } = await supabase
        .from('rfid_cards')
        .select(CARD_FIELDS)
        .in('id', cardIdsForThisMachine);

      if (restrictedCardsError) {
        return errorResponse(restrictedCardsError.message, 'INTERNAL_ERROR', 500);
      }
      for (const c of restrictedCards || []) cardMap.set(c.id, c);
    }

    // Every card ID that has ANY restriction row at all (not just for this
    // machine) -- needed so Pass 2 doesn't let a card restricted to some
    // OTHER machine leak in just because its organization_id also matches.
    const { data: allRestrictedRows, error: allRestrictedError } = await supabase
      .from('rfid_card_machines')
      .select('card_id');

    if (allRestrictedError) {
      return errorResponse(allRestrictedError.message, 'INTERNAL_ERROR', 500);
    }
    const allRestrictedCardIds = new Set((allRestrictedRows || []).map(r => r.card_id));

    // Pass 2: org-wide / true-wildcard cards -- zero restriction rows, and
    // either belong to this machine's owning customer or have no
    // organization at all.
    // Resolve a machine assigned to a team member back to their organization,
    // so the org's cards still sync to it for offline use.
    const machineOrg = await machineOrganizationId(supabase, machine.customer_id);
    let orgQuery = supabase.from('rfid_cards').select(CARD_FIELDS);
    orgQuery = machineOrg
      ? orgQuery.or(`organization_id.eq.${machineOrg},organization_id.is.null`)
      : orgQuery.is('organization_id', null);

    const { data: orgCandidates, error: orgError } = await orgQuery;

    if (orgError) {
      return errorResponse(orgError.message, 'INTERNAL_ERROR', 500);
    }

    for (const c of orgCandidates || []) {
      if (!allRestrictedCardIds.has(c.id)) cardMap.set(c.id, c);
    }

    const cards = Array.from(cardMap.values());

    // Cards of an organization with rfid_monthly_limit set are capped at
    // that many taps/month regardless of card_type — the machine enforces
    // this itself while offline, so it needs the current remaining count,
    // not the raw counter columns. Uncapped cards get a count the machine
    // won't run down between syncs.
    const orgLimits = await fetchOrgMonthlyLimits(supabase);
    const now = new Date();
    const cardsWithMonthly = (cards || []).map(({ id, organization_id, monthly_vend_count, monthly_vend_month, ...rest }) => {
      const limit = organization_id ? orgLimits.get(organization_id) : undefined;
      return {
        ...rest,
        monthly_remaining: limit
          ? Math.max(0, limit - effectiveMonthlyCount(monthly_vend_month, monthly_vend_count, now))
          : UNCAPPED_MONTHLY_REMAINING,
      };
    });

    return successResponse({ cards: cardsWithMonthly });
  } catch (error) {
    console.error('❌ Error syncing machine cards:', error);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
