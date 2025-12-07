-- Add organization and permission columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'customer' CHECK (account_type IN ('admin', 'super_customer', 'customer')),
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_edit": false, "can_view": true}'::jsonb;

-- Update existing admin role
UPDATE profiles SET account_type = 'admin' WHERE role = 'admin';
UPDATE profiles SET account_type = 'customer' WHERE role = 'customer';

-- Create organizations table for super customers
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  super_customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all organizations" ON organizations;
CREATE POLICY "Admins can manage all organizations"
ON organizations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.account_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Super customers can manage their organization" ON organizations;
CREATE POLICY "Super customers can manage their organization"
ON organizations FOR ALL
TO authenticated
USING (super_customer_id = auth.uid());

-- Update profiles RLS for hierarchical access
DROP POLICY IF EXISTS "Super customers can manage their organization's customers" ON profiles;
CREATE POLICY "Super customers can manage their organization's customers"
ON profiles FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT id FROM profiles 
    WHERE id = auth.uid() 
    AND account_type = 'super_customer'
  )
);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at_trigger ON organizations;
CREATE TRIGGER update_organizations_updated_at_trigger
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();
