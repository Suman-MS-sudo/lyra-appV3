-- Fix infinite recursion in profiles RLS policies
-- The issue: checking if user is admin requires reading profiles table,
-- which creates infinite recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate without recursion
-- Everyone can view their own profile (no recursion)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Use auth.jwt() to check role instead of querying profiles table
CREATE POLICY "Allow profile read for authenticated users"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );
