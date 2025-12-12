-- Fix profiles foreign key constraint pointing to wrong table
-- Drop the incorrect foreign key
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;

-- Add the correct foreign key pointing to organizations table
ALTER TABLE profiles 
ADD CONSTRAINT profiles_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE SET NULL;
