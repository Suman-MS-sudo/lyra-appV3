import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import EditUserForm from '@/components/EditUserForm';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch user data
  const { data: userProfile, error } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !userProfile) {
    console.error('Error fetching user profile:', error);
    redirect('/admin/users');
  }

  // Fetch all organizations for dropdown
  const { data: organizations } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .order('name');

  return <EditUserForm user={userProfile} organizations={organizations || []} />;
}
