// Simple script to create admin user
// Run with: node scripts/create-admin.mjs

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

async function createAdminUser() {
  const email = 'suman.phoenix@hotmail.com';
  
  console.log('🔧 Creating admin user...');
  console.log(`📧 Email: ${email}`);

  try {
    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: 'Suman',
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌ Error creating user:', authError.message);
      console.error('Full error:', JSON.stringify(authError, null, 2));
      process.exit(1);
    }

    console.log('✅ User created successfully!');
    console.log(`👤 User ID: ${authData.user.id}`);

    // Send password reset email
    console.log('\n📨 Sending password reset email...');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:3000/reset-password?type=admin`,
    });

    if (resetError) {
      console.error('⚠️  Could not send password reset email:', resetError.message);
    } else {
      console.log('✅ Password reset email sent!');
    }

    // Wait a moment for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('⚠️  Could not fetch profile:', profileError.message);
    } else {
      console.log('\n✅ Profile created:');
      console.log(`   Role: ${profile.role}`);
      console.log(`   Email: ${profile.email}`);
    }

    console.log('\n✨ Admin account setup complete!');
    console.log('📧 Check suman.phoenix@hotmail.com for password reset link');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdminUser();
