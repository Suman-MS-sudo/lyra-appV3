import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import CustomerRfidCardsClient from '@/components/CustomerRfidCardsClient';

export const revalidate = 0;

export default async function CustomerRfidCardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type, organization_id')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  const isSuperCustomer = profile?.account_type === 'super_customer';

  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location')
    .eq('customer_id', isSuperCustomer ? profile?.organization_id : user.id)
    .eq('rfid_enabled', true)
    .order('name');

  const machineIds = (machines || []).map(m => m.id);

  // Includes org-wide ("any machine") cards, which have machine_id = NULL and
  // so wouldn't match a plain .in(machine_id) filter.
  const cardFilters: string[] = [];
  if (machineIds.length > 0) cardFilters.push(`machine_id.in.(${machineIds.join(',')})`);
  if (profile?.organization_id) cardFilters.push(`and(machine_id.is.null,organization_id.eq.${profile.organization_id})`);

  const { data: cards } = cardFilters.length > 0
    ? await serviceSupabase
        .from('rfid_cards')
        .select(`
          id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa,
          machine_id, created_at,
          machine:vending_machines ( id, name, location )
        `)
        .or(cardFilters.join(','))
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <CustomerRfidCardsClient
      initialCards={(cards as any) || []}
      machines={machines || []}
    />
  );
}
