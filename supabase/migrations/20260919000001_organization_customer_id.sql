-- Admin-entered short reference code for an organization (e.g. "CN00005"),
-- separate from the internal UUID primary key. Purely a label the admin
-- assigns themselves -- no uniqueness constraint, since the admin may reuse
-- or leave it blank for some orgs.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS customer_id TEXT;

COMMENT ON COLUMN organizations.customer_id IS 'Admin-entered customer/organization reference code, e.g. CN00005 -- distinct from the UUID id column';
