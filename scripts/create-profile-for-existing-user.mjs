// Create profile for existing auth user
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local manually
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

const email = process.argv[2] || 'lyraenterprisessales@gmail.com';

console.log(`🔧 Creating profile for existing user: ${email}...\n`);

async function createProfileForExistingUser() {
  try {
    // Get the user from auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ No user found in auth with email: ${email}`);
      process.exit(1);
    }
    
    console.log(`✅ Found user in auth: ${user.id}`);
    
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();
    
    if (existingProfile) {
      console.log(`✅ Profile already exists with role: ${existingProfile.role}`);
      return;
    }
    
    // Create profile
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        role: 'admin',
        account_type: 'admin',
        full_name: user.user_metadata?.full_name || null
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      process.exit(1);
    }
    
    console.log('✅ Profile created successfully!');
    console.log(`   Email: ${newProfile.email}`);
    console.log(`   Role: ${newProfile.role}`);
    console.log(`   Account Type: ${newProfile.account_type}`);
    console.log(`   ID: ${newProfile.id}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createProfileForExistingUser();