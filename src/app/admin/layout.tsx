import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '@/components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)' }}
    >
      <AdminNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
