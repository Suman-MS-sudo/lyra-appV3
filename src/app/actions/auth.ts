'use server';

import { createClient } from '@supabase/supabase-js';

export async function getUserRole(userId: string) {
  // Use service role to bypass RLS and fetch user profile
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return profile.role;
}
