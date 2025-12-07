-- Create admin user and send password reset email
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql/new)

-- Step 1: Insert user into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'suman.phoenix@hotmail.com',
  crypt('temporary_password_12345', gen_salt('bf')), -- Temporary password
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Suman","role":"admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Step 2: Profile will be auto-created by trigger with admin role from user_metadata

-- Step 3: Send password reset email (you'll need to do this manually from dashboard)
-- Go to: Authentication → Users → Find suman.phoenix@hotmail.com → Click "..." → Send password reset email
