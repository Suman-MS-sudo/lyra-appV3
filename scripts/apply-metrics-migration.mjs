import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envFile = readFileSync(envPath, 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const equalsIndex = line.indexOf('=');
    if (equalsIndex > 0) {
      const key = line.substring(0, equalsIndex).trim();
      const value = line.substring(equalsIndex + 1).trim();
      envVars[key] = value;
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('\n📡 Checking current machine data...\n');
    
    // First, let's see what columns currently exist
    const { data: machines, error: queryError } = await supabase
      .from('vending_machines')
      .select('*')
      .eq('machine_id', 'lyra_SNVM_003')
      .single();
    
    if (queryError) {
      console.error('❌ Error querying machine:', queryError);
    } else {
      console.log('Current machine data:');
      console.log(JSON.stringify(machines, null, 2));
      console.log('\n📋 Available columns:', Object.keys(machines).join(', '));
      
      // Check if new columns exist
      const hasNewColumns = 'wifi_rssi' in machines && 'free_heap' in machines;
      
      if (hasNewColumns) {
        console.log('\n✅ Health metric columns already exist!');
      } else {
        console.log('\n⚠️  Health metric columns do NOT exist yet.');
        console.log('\n📝 To apply migration, please:');
        console.log('   1. Go to Supabase Dashboard > SQL Editor');
        console.log('   2. Copy and paste the contents of:');
        console.log('      supabase/migrations/20231207000010_add_machine_metrics.sql');
        console.log('   3. Run the SQL query');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyMigration();
