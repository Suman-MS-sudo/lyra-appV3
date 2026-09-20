import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { fetchCustomerRfidCards } from '@/lib/rfid-cards';

// Resolves the RFID-enabled machine IDs this logged-in customer is allowed
// to assign cards to: super_customers see every machine in their org,
// regular customers see only machines assigned directly to them.
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
    .select('id, name, location')
    .eq('customer_id', isSuperCustomer ? profile.organization_id : user.id)
    .eq('rfid_enabled', true);

  return { service, profile, machines: machines || [] };
}

// GET /api/customer/rfid-cards — cards assigned to machines this customer can
// see, plus any org-wide ("any machine") cards belonging to their organization.
export async function GET() {
  const auth = await requireCustomerAndMachines();
  if (auth.error) return auth.error;

  try {
    const cards = await fetchCustomerRfidCards(auth.service!, {
      machines: auth.machines!,
      organizationId: auth.profile!.organization_id,
    });
    return NextResponse.json({ cards });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/customer/rfid-cards — register a new card, scoped to one or more
// of this customer's own RFID-enabled machines (no "any machine" cards —
// that's an admin-only capability since it spans customers).
export async function POST(request: NextRequest) {
  const auth = await requireCustomerAndMachines();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { uid, holder_name, machine_ids, initial_credits, card_type } = body;

  if (!uid) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }
  const resolvedMachineIds: string[] = Array.isArray(machine_ids) ? machine_ids.filter(Boolean) : [];
  if (resolvedMachineIds.length === 0) {
    return NextResponse.json({ error: 'Please select at least one machine' }, { status: 400 });
  }

  const allowedMachineIds = new Set(auth.machines!.map(m => m.id));
  if (resolvedMachineIds.some(id => !allowedMachineIds.has(id))) {
    return NextResponse.json({ error: 'You do not have access to one of the selected machines' }, { status: 403 });
  }

  const resolvedType = card_type === 'postpaid' ? 'postpaid' : 'prepaid';

  const { data: card, error } = await auth.service!
    .from('rfid_cards')
    .insert({
      uid: String(uid).toUpperCase(),
      holder_name: holder_name || null,
      organization_id: auth.profile!.organization_id || null,
      machine_id: resolvedMachineIds.length === 1 ? resolvedMachineIds[0] : null,
      card_type: resolvedType,
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

  const { error: linkError } = await auth.service!
    .from('rfid_card_machines')
    .insert(resolvedMachineIds.map(machine_id => ({ card_id: card.id, machine_id })));
  if (linkError) {
    console.error('Failed to link card to machines:', linkError.message);
  }

  return NextResponse.json({ card });
}
