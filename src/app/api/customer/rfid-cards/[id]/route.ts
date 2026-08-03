import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

async function requireCustomerAndMachines() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, account_type, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'admin') {
    return { error: NextResponse.json({ error: 'Customer access required' }, { status: 403 }) };
  }

  const isSuperCustomer = profile.account_type === 'super_customer';

  const { data: machines } = await service
    .from('vending_machines')
    .select('id')
    .eq('customer_id', isSuperCustomer ? profile.organization_id : user.id)
    .eq('rfid_enabled', true);

  return { service, profile, machineIds: new Set((machines || []).map(m => m.id)) };
}

// A card is manageable by this customer if it's locked to one of their own
// RFID-enabled machines, OR it's an org-wide ("any machine") card — those
// have machine_id = NULL and are scoped by organization_id instead.
async function assertOwnsCard(service: any, id: string, machineIds: Set<string>, organizationId: string | null) {
  const { data: card } = await service.from('rfid_cards').select('id, machine_id, organization_id, credits_remaining, vend_count, total_spent_paisa').eq('id', id).single();
  if (!card) return null;
  if (card.machine_id) {
    return machineIds.has(card.machine_id) ? card : null;
  }
  return organizationId && card.organization_id === organizationId ? card : null;
}

// PATCH /api/customer/rfid-cards/[id] — top up credits, rename, toggle active,
// or settle a postpaid card's tab. Only for cards on the customer's own machines.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCustomerAndMachines();
  if (auth.error) return auth.error;

  const { id } = await params;
  const card = await assertOwnsCard(auth.service!, id, auth.machineIds!, auth.profile!.organization_id);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const body = await request.json();
  const { top_up_credits, settle_tab, holder_name, is_active } = body;

  const updates: Record<string, unknown> = {};
  if (holder_name !== undefined) updates.holder_name = holder_name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (top_up_credits !== undefined) {
    updates.credits_remaining = Math.max(0, card.credits_remaining + Math.round(top_up_credits));
  }
  if (settle_tab) {
    updates.vend_count = 0;
    updates.total_spent_paisa = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
  }

  const { data: updated, error } = await auth.service!
    .from('rfid_cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ card: updated });
}

// DELETE /api/customer/rfid-cards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCustomerAndMachines();
  if (auth.error) return auth.error;

  const { id } = await params;
  const card = await assertOwnsCard(auth.service!, id, auth.machineIds!, auth.profile!.organization_id);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const { error } = await auth.service!.from('rfid_cards').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
