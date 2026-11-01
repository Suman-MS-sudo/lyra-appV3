import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '@/components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Defence in depth (middleware also checks): admin pages are for admins only
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  return (
    <div className="app-shell min-h-screen bg-[var(--bg)]">
      <AdminNav userEmail={user.email ?? ''}>{children}</AdminNav>
    </div>
  );
}
