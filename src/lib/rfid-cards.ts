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
  const { data: cards, error } = await service
    .from('rfid_cards')
    .select(`${ADMIN_CARD_FIELDS}, rfid_card_machines ( machine:vending_machines ( id, name, location ) )`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (cards || []).map((c: any) => ({
    ...c,
    machines: (c.rfid_card_machines || []).map((r: any) => r.machine).filter(Boolean),
    rfid_card_machines: undefined,
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

  const { data: restrictedRows, error: restrictedError } = await service
    .from('rfid_card_machines')
    .select(`card_id, machine_id, rfid_cards!inner ( ${CUSTOMER_CARD_FIELDS} )`)
    .in('machine_id', machineIds.length > 0 ? machineIds : ['00000000-0000-0000-0000-000000000000']);

  if (restrictedError) throw restrictedError;

  const restrictedCardIds = new Set<string>();
  const cardMap = new Map<string, any>();
  for (const row of restrictedRows || []) {
    const c = row.rfid_cards as any;
    restrictedCardIds.add(row.card_id);
    if (!cardMap.has(c.id)) cardMap.set(c.id, c);
  }

  const { data: orgCandidates, error: orgError } = organizationId
    ? await service.from('rfid_cards').select(CUSTOMER_CARD_FIELDS).eq('organization_id', organizationId)
    : { data: [], error: null };

  if (orgError) throw orgError;

  for (const c of orgCandidates || []) {
    if (!restrictedCardIds.has(c.id)) cardMap.set(c.id, c);
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
