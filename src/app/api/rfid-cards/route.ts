import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminRfidCards } from '@/lib/rfid-cards';

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

// GET /api/rfid-cards — list all cards
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const cards = await fetchAdminRfidCards(auth.service!);
    return NextResponse.json({ cards });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/rfid-cards — register a new card
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { uid, holder_name, organization_id, machine_ids, product_id, initial_credits, card_type } = body;

  if (!uid) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }

  const resolvedType = card_type === 'postpaid' ? 'postpaid' : 'prepaid';
  const resolvedMachineIds: string[] = Array.isArray(machine_ids) ? machine_ids.filter(Boolean) : [];

  const { data: card, error } = await auth.service!
    .from('rfid_cards')
    .insert({
      uid: String(uid).toUpperCase(),
      holder_name: holder_name || null,
      organization_id: organization_id || null,
      // Legacy single-machine column: kept in sync only for the simple
      // (0 or 1 machine) case so any old code still reading it directly
      // isn't left stale; rfid_card_machines is the real source of truth.
      machine_id: resolvedMachineIds.length === 1 ? resolvedMachineIds[0] : null,
      product_id: product_id || null,
      card_type: resolvedType,
      // Postpaid cards don't use credits — always store 0 regardless of what was passed.
      credits_remaining: resolvedType === 'postpaid' ? 0 : Math.max(0, Math.round(initial_credits || 0)),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A card with this UID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (resolvedMachineIds.length > 0) {
    const { error: linkError } = await auth.service!
      .from('rfid_card_machines')
      .insert(resolvedMachineIds.map(machine_id => ({ card_id: card.id, machine_id })));
    if (linkError) {
      console.error('Failed to link card to machines:', linkError.message);
    }
  }

  return NextResponse.json({ card });
}
