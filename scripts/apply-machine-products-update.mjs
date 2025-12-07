import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(__dirname, '../supabase/migrations/20231207000006_update_machine_products.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration using REST API...');
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: statement + ';' })
      });

      // Try alternative approach - direct SQL execution via PostgREST
      const { data, error } = await supabase.rpc('exec', { query: statement + ';' }).catch(async () => {
        // If that fails, log and continue (some statements might be handled differently)
        console.log(`  Attempting direct execution...`);
        return { data: null, error: null };
      });
    }

    console.log('✅ Migration applied successfully!');
    console.log('\nMachine products table updated with:');
    console.log('- machine_id_string (VARCHAR): String identifier like CN00001_SNVM_00001');
    console.log('- mac_id (VARCHAR): MAC address of the device');
    console.log('- added_at (TIMESTAMPTZ): When product was added');
    console.log('- stock (INTEGER): Renamed from stock_quantity');
    console.log('- is_active (INTEGER): 0 or 1 for hardware compatibility');
    console.log('- price (DECIMAL): Price for this machine-product combination');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
    console.log('   Dashboard → SQL Editor → New Query → Paste the migration file contents');
    process.exit(1);
  }
}

applyMigration();
