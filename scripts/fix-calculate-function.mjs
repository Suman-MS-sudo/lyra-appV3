import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env file manually
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Fixing calculate_invoice_amounts function...\n');

console.log('⚠️  Cannot execute DDL via Supabase JS client.');
console.log('\n📝 Please copy and run the following SQL in Supabase Dashboard SQL Editor:\n');

const fixSQL = `
-- Step 1: Drop all versions of the function
DROP FUNCTION IF EXISTS calculate_invoice_amounts(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_invoice_amounts(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- Step 2: Create the correct TEXT version
CREATE FUNCTION calculate_invoice_amounts(
  p_organization_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE(
  total_transactions BIGINT,
  total_amount_paisa BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_transactions,
    COALESCE(SUM(cp.amount_in_paisa), 0)::BIGINT as total_amount_paisa
  FROM coin_payments cp
  INNER JOIN vending_machines vm ON cp.machine_id = vm.id
  INNER JOIN profiles p ON vm.customer_id = p.id
  WHERE p.organization_id = p_organization_id
    AND cp.created_at >= p_period_start
    AND cp.created_at < p_period_end
    AND cp.dispensed = true;
END;
$$ LANGUAGE plpgsql;
`;

console.log('════════════════════════════════════════════════════════════════');
console.log(fixSQL);
console.log('════════════════════════════════════════════════════════════════');

console.log('\n✅ After running the above SQL, try generating the invoice again.');
