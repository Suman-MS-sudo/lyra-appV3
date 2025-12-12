import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import EditMachineForm from '@/components/EditMachineForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function EditMachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service role for admin operations
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type, role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.account_type === 'admin';
  const isSuperCustomer = profile?.role === 'customer' && profile?.account_type === 'super_customer';
  
  if (!isAdmin && !isSuperCustomer) {
    redirect('/customer/dashboard');
  }

  // Fetch machine to edit
  const { data: machine, error } = await serviceSupabase
    .from('vending_machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !machine) {
    redirect('/admin/machines');
  }

  // Fetch customers for dropdown
  const { data: customers } = await serviceSupabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'customer')
    .order('full_name');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/machines" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Machine</h1>
              <p className="text-sm text-gray-500">Update machine details and configuration</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <EditMachineForm machine={machine} customers={customers || []} />
      </main>
    </div>
  );
}
