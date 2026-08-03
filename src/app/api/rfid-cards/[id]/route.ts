import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { service };
}

// PATCH /api/rfid-cards/[id] — top up credits, rename, toggle active state,
// reassign customer/machine/product, or settle a postpaid card's accrued tab.
// Body may include any of: top_up_credits (prepaid: adds to credits_remaining),
// settle_tab (postpaid: zeroes vend_count/total_spent_paisa once billed),
// holder_name, is_active, organization_id, machine_id, product_id
// (pass null/'' on the assignment fields to clear them)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { top_up_credits, settle_tab, holder_name, is_active, organization_id, machine_id, product_id } = body;

  const updates: Record<string, unknown> = {};
  if (holder_name !== undefined) updates.holder_name = holder_name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (organization_id !== undefined) updates.organization_id = organization_id || null;
  if (machine_id !== undefined) updates.machine_id = machine_id || null;
  if (product_id !== undefined) updates.product_id = product_id || null;

  if (top_up_credits !== undefined) {
    const { data: card, error: fetchError } = await auth.service!
      .from('rfid_cards')
      .select('credits_remaining')
      .eq('id', id)
      .single();

    if (fetchError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    updates.credits_remaining = Math.max(0, card.credits_remaining + Math.round(top_up_credits));
  }

  if (settle_tab) {
    updates.vend_count = 0;
    updates.total_spent_paisa = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
  }

  const { data: card, error } = await auth.service!
    .from('rfid_cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ card });
}

// DELETE /api/rfid-cards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { error } = await auth.service!.from('rfid_cards').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
