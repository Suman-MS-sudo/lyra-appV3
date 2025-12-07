// Verify admin user profile
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', 'suman.phoenix@hotmail.com');

if (error) {
  console.error('❌ Error:', error.message);
} else if (!data || data.length === 0) {
  console.log('⚠️  No profile found yet. The trigger might still be processing...');
} else {
  const profile = data[0];
  console.log('✅ Admin Profile:');
  console.log(`   Email: ${profile.email}`);
  console.log(`   Role: ${profile.role}`);
  console.log(`   Name: ${profile.full_name || 'Not set'}`);
  console.log(`   ID: ${profile.id}`);
}
