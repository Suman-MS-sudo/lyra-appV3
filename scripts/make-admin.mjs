// Update user role to admin
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const email = process.argv[2] || 'mssworlz@gmail.com';

console.log(`🔧 Updating ${email} to admin role...\n`);

const { data: updated, error } = await supabase
  .from('profiles')
  .update({ 
    role: 'admin',
    account_type: 'admin' 
  })
  .eq('email', email)
  .select()
  .single();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('✅ Updated successfully!');
console.log('   Email:', updated.email);
console.log('   Role:', updated.role);
console.log('   Account Type:', updated.account_type);
console.log('\n🔓 Please log out and log back in as Admin to see changes.');
