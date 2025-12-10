-- Create organizations table for partner organization management (if not exists)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    super_customer_id UUID REFERENCES profiles(id),
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'India',
    gstin TEXT,
    pan TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='is_active') THEN
        ALTER TABLE organizations ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='city') THEN
        ALTER TABLE organizations ADD COLUMN city TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='state') THEN
        ALTER TABLE organizations ADD COLUMN state TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='zip_code') THEN
        ALTER TABLE organizations ADD COLUMN zip_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='country') THEN
        ALTER TABLE organizations ADD COLUMN country TEXT DEFAULT 'India';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='gstin') THEN
        ALTER TABLE organizations ADD COLUMN gstin TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='pan') THEN
        ALTER TABLE organizations ADD COLUMN pan TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='notes') THEN
        ALTER TABLE organizations ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_organizations_super_customer ON organizations(super_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage organizations" ON organizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.account_type = 'admin'
        )
    );

-- Super customers can view their own organization
CREATE POLICY "Super customers can view their organization" ON organizations
    FOR SELECT
    USING (
        super_customer_id = auth.uid()
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_organizations_updated_at();
