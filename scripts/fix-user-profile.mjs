// Fix missing profile for existing user
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixUserProfile() {
  const email = process.argv[2] || 'mssworlz@gmail.com';
  
  console.log(`🔧 Fixing profile for ${email}...`);

  try {
    // Get user from auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User ${email} not found in auth.users`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.id}`);

    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      console.log('✅ Profile already exists:', existingProfile);
      console.log('   Role:', existingProfile.role);
      console.log('   Name:', existingProfile.full_name);
      return;
    }

    // Create profile
    console.log('📝 Creating profile...');
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        role: 'admin',
        full_name: user.user_metadata?.full_name || 'Admin User',
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating profile:', insertError.message);
      console.error('Full error:', JSON.stringify(insertError, null, 2));
      process.exit(1);
    }

    console.log('✅ Profile created successfully!');
    console.log('   ID:', newProfile.id);
    console.log('   Email:', newProfile.email);
    console.log('   Role:', newProfile.role);
    console.log('   Name:', newProfile.full_name);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixUserProfile();
