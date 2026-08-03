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

// GET /api/rfid-cards — list all cards
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data: cards, error } = await auth.service!
    .from('rfid_cards')
    .select(`
      id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa,
      organization_id, machine_id, product_id, created_at, updated_at,
      organization:organizations ( id, name ),
      machine:vending_machines ( id, name, location ),
      product:products ( id, name, price )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards });
}

// POST /api/rfid-cards — register a new card
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { uid, holder_name, organization_id, machine_id, product_id, initial_credits, card_type } = body;

  if (!uid) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }

  const resolvedType = card_type === 'postpaid' ? 'postpaid' : 'prepaid';

  const { data: card, error } = await auth.service!
    .from('rfid_cards')
    .insert({
      uid: String(uid).toUpperCase(),
      holder_name: holder_name || null,
      organization_id: organization_id || null,
      machine_id: machine_id || null,
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

  return NextResponse.json({ card });
}
