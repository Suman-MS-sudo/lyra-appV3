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

// A card is manageable by this customer if it's restricted to one or more
// of their own RFID-enabled machines (via rfid_card_machines -- at least one
// overlap is enough, since a customer with a partial view of an org-wide
// multi-machine assignment should still be able to manage it), OR it's an
// org-wide ("any machine") card with zero machine restrictions, scoped by
// organization_id instead.
async function assertOwnsCard(service: any, id: string, machineIds: Set<string>, organizationId: string | null) {
  const { data: card } = await service
    .from('rfid_cards')
    .select('id, machine_id, organization_id, credits_remaining, vend_count, total_spent_paisa, rfid_card_machines ( machine_id )')
    .eq('id', id)
    .single();
  if (!card) return null;

  const assignedMachineIds: string[] = (card.rfid_card_machines || []).map((r: any) => r.machine_id);
  if (assignedMachineIds.length > 0) {
    return assignedMachineIds.some(mid => machineIds.has(mid)) ? card : null;
  }
  return organizationId && card.organization_id === organizationId ? card : null;
}

// PATCH /api/customer/rfid-cards/[id] — top up credits, rename, toggle active,
// reassign which of the customer's own machines the card works on, or settle
// a postpaid card's tab. Only for cards on the customer's own machines.
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
  const { top_up_credits, settle_tab, holder_name, is_active, machine_ids } = body;

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

  let resolvedMachineIds: string[] | undefined;
  if (Array.isArray(machine_ids)) {
    resolvedMachineIds = machine_ids.filter(Boolean);
    if (resolvedMachineIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one machine' }, { status: 400 });
    }
    if (resolvedMachineIds.some(mid => !auth.machineIds!.has(mid))) {
      return NextResponse.json({ error: 'You do not have access to one of the selected machines' }, { status: 403 });
    }
    updates.machine_id = resolvedMachineIds.length === 1 ? resolvedMachineIds[0] : null;
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

  if (resolvedMachineIds !== undefined) {
    await auth.service!.from('rfid_card_machines').delete().eq('card_id', id);
    const { error: linkError } = await auth.service!
      .from('rfid_card_machines')
      .insert(resolvedMachineIds.map(machine_id => ({ card_id: id, machine_id })));
    if (linkError) {
      console.error('Failed to update card machine assignments:', linkError.message);
    }
  }

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
