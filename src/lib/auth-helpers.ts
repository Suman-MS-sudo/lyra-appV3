import { createClient } from '@/lib/supabase/server';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || profile?.role !== 'admin') {
    throw new AuthorizationError();
  }

  return { user, profile };
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
