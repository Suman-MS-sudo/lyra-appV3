import type { SupabaseClient } from '@supabase/supabase-js';

const ADMIN_CARD_FIELDS = `
  id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa,
  organization_id, machine_id, product_id, created_at, updated_at,
  organization:organizations ( id, name ),
  machine:vending_machines ( id, name, location ),
  product:products ( id, name, price )
`;

/**
 * Cards for the admin list, with `machines` (0+, via rfid_card_machines --
 * the source of truth for which specific machines a card is restricted to)
 * attached alongside the legacy single `machine` field. Shared by
 * GET /api/rfid-cards and the initial SSR load in /admin/rfid-cards so the
 * two can't drift out of sync on how machine assignments are resolved.
 */
export async function fetchAdminRfidCards(service: SupabaseClient) {
  // Two separate queries rather than one nested embed (rfid_cards ->
  // rfid_card_machines -> vending_machines, alongside rfid_cards' own
  // direct machine:vending_machines embed) -- PostgREST's relationship
  // detection for a freshly-created join table straddling a schema-cache
  // reload turned out unreliable in practice, and a flat query per table is
  // simpler to reason about regardless.
  const [{ data: cards, error }, { data: linkRows, error: linkError }] = await Promise.all([
    service
      .from('rfid_cards')
      .select(ADMIN_CARD_FIELDS)
      .order('created_at', { ascending: false }),
    service
      .from('rfid_card_machines')
      .select('card_id, machine:vending_machines ( id, name, location )'),
  ]);

  if (error) throw error;
  if (linkError) throw linkError;

  const machinesByCard = new Map<string, { id: string; name: string; location: string }[]>();
  for (const row of linkRows || []) {
    const machine = Array.isArray((row as any).machine) ? (row as any).machine[0] : (row as any).machine;
    if (!machine) continue;
    const list = machinesByCard.get((row as any).card_id) || [];
    list.push(machine);
    machinesByCard.set((row as any).card_id, list);
  }

  return (cards || []).map((c: any) => ({
    ...c,
    machines: machinesByCard.get(c.id) || [],
  }));
}

const CUSTOMER_CARD_FIELDS = 'id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa, machine_id, created_at';

/**
 * Cards visible to a customer: (1) cards restricted to specific machines
 * they can see (via rfid_card_machines), plus (2) org-wide/wildcard cards
 * (zero restriction rows) belonging to their organization. A restricted
 * card must not also leak in via (2) just because its organization_id
 * happens to match. Shared by GET /api/customer/rfid-cards and the initial
 * SSR load in /customer/rfid-cards.
 */
export async function fetchCustomerRfidCards(
  service: SupabaseClient,
  { machines, organizationId }: { machines: { id: string; name: string; location: string }[]; organizationId: string | null }
) {
  const machineIds = machines.map(m => m.id);
  if (machineIds.length === 0 && !organizationId) return [];

  // Flat queries (no embed) -- see fetchAdminRfidCards for why: a nested
  // embed through a freshly-created join table proved unreliable across a
  // PostgREST schema-cache reload, so every rfid_card_machines read in this
  // file resolves it via two plain queries merged in JS instead.
  const { data: restrictedRows, error: restrictedError } = await service
    .from('rfid_card_machines')
    .select('card_id, machine_id')
    .in('machine_id', machineIds.length > 0 ? machineIds : ['00000000-0000-0000-0000-000000000000']);

  if (restrictedError) throw restrictedError;

  const restrictedCardIdsForCustomer = [...new Set((restrictedRows || []).map(r => r.card_id))];

  const { data: restrictedCards, error: restrictedCardsError } = restrictedCardIdsForCustomer.length > 0
    ? await service.from('rfid_cards').select(CUSTOMER_CARD_FIELDS).in('id', restrictedCardIdsForCustomer)
    : { data: [], error: null };

  if (restrictedCardsError) throw restrictedCardsError;

  // All cards with ANY restriction row at all (not just ones restricted to
  // this customer's machines) -- needed so an org-wide candidate that's
  // actually restricted to some OTHER customer's machine is correctly
  // excluded below, not mistaken for a true org-wide card.
  const { data: allRestrictedCardIdRows, error: allRestrictedError } = await service
    .from('rfid_card_machines')
    .select('card_id');

  if (allRestrictedError) throw allRestrictedError;
  const allRestrictedCardIds = new Set((allRestrictedCardIdRows || []).map(r => r.card_id));

  const cardMap = new Map<string, any>();
  for (const c of restrictedCards || []) cardMap.set(c.id, c);

  const { data: orgCandidates, error: orgError } = organizationId
    ? await service.from('rfid_cards').select(CUSTOMER_CARD_FIELDS).eq('organization_id', organizationId)
    : { data: [], error: null };

  if (orgError) throw orgError;

  for (const c of orgCandidates || []) {
    if (!allRestrictedCardIds.has(c.id)) cardMap.set(c.id, c);
  }

  const machineById = new Map(machines.map(m => [m.id, m]));
  const machinesByCard = new Map<string, { id: string; name: string; location: string }[]>();
  for (const row of restrictedRows || []) {
    const machine = machineById.get(row.machine_id);
    if (!machine) continue;
    const list = machinesByCard.get(row.card_id) || [];
    list.push(machine);
    machinesByCard.set(row.card_id, list);
  }

  return Array.from(cardMap.values())
    .map(c => ({ ...c, machines: machinesByCard.get(c.id) || [] }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
