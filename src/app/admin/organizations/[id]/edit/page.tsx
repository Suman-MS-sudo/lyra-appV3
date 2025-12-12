import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import EditOrganizationForm from '@/components/EditOrganizationForm';

export default async function EditOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
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

  // Fetch organization data
  const { data: organization, error } = await serviceSupabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !organization) {
    redirect('/admin/organizations');
  }

  return <EditOrganizationForm organization={organization} />;
}
