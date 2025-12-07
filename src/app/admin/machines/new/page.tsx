import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import { MachineForm } from '@/components/MachineForm';

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

  // Fetch organizations
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name, contact_email, contact_phone, address')
    .order('name');

  // Fetch all products
  const { data: products } = await serviceSupabase
    .from('products')
    .select('id, name, description, price')
    .order('name');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/machines" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Vending Machine</h1>
              <p className="text-sm text-gray-500">Create a new vending machine with organization and product mapping</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <MachineForm organizations={organizations || []} products={products || []} />
      </main>
    </div>
  );
}
