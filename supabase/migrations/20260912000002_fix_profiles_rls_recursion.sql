-- Fix "infinite recursion detected in policy for relation profiles" (42P17).
--
-- The "Super customers can manage their organization's customers" policy
-- (added in 20231207000004_hierarchical_accounts.sql) queries the profiles
-- table from inside a policy that governs the profiles table itself:
--   USING (organization_id IN (SELECT id FROM profiles WHERE id = auth.uid() AND account_type = 'super_customer'))
-- Evaluating that policy re-triggers RLS on profiles, which re-evaluates
-- the same policy, forever. A later migration (20241210000002) fixed a
-- similar recursion elsewhere but never touched this one.
--
-- Standard fix: look up the current user's own row through a SECURITY
-- DEFINER function, which runs with the function owner's privileges and so
-- bypasses RLS entirely instead of re-entering it.

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.profiles
  WHERE id = auth.uid() AND account_type = 'super_customer'
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "Super customers can manage their organization's customers" ON public.profiles;
CREATE POLICY "Super customers can manage their organization's customers"
ON public.profiles FOR ALL
TO authenticated
USING (organization_id = public.current_user_organization_id());
