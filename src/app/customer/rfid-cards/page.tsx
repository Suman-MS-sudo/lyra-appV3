import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import CustomerRfidCardsClient from '@/components/CustomerRfidCardsClient';
import { fetchCustomerRfidCards } from '@/lib/rfid-cards';

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

  const cards = await fetchCustomerRfidCards(serviceSupabase, {
    machines: machines || [],
    organizationId: profile?.organization_id ?? null,
  });

  return (
    <CustomerRfidCardsClient
      initialCards={cards as any}
      machines={machines || []}
    />
  );
}
