import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import RfidCardsClient from '@/components/RfidCardsClient';

export const revalidate = 0;

export default async function RfidCardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const [
    { data: cards },
    { data: organizations },
    { data: machines },
    { data: products },
  ] = await Promise.all([
    serviceSupabase
      .from('rfid_cards')
      .select(`
        id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa,
        organization_id, machine_id, product_id, created_at, updated_at,
        organization:organizations ( id, name ),
        machine:vending_machines ( id, name, location ),
        product:products ( id, name, price )
      `)
      .order('created_at', { ascending: false }),
    serviceSupabase.from('organizations').select('id, name').order('name'),
    serviceSupabase.from('vending_machines').select('id, name, location, customer_id').order('name'),
    serviceSupabase.from('products').select('id, name, price').eq('is_active', true).order('name'),
  ]);

  return (
    <RfidCardsClient
      initialCards={(cards as any) || []}
      organizations={organizations || []}
      machines={machines || []}
      products={products || []}
    />
  );
}
