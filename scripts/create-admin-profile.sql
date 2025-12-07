-- Manually create admin profile for suman.phoenix@hotmail.com
-- Run in SQL Editor: https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql/new

INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
  id,
  email,
  'admin'::user_role,
  'Suman'
FROM auth.users
WHERE email = 'suman.phoenix@hotmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin'::user_role, full_name = 'Suman';
