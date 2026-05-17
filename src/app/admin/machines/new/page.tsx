import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MachineForm } from '@/components/MachineForm';

export const revalidate = 0;

export default async function NewMachinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'admin') redirect('/customer/dashboard');

  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name, contact_email, contact_phone, address')
    .order('name');

  const { data: products } = await serviceSupabase
    .from('products')
    .select('id, name, description, price')
    .order('name');

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add Vending Machine</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Create a new vending machine with organization and product mapping</p>
      </div>
      <MachineForm organizations={organizations || []} products={products || []} />
    </main>
  );
}
