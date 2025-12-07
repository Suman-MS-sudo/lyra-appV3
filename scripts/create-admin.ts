/**
 * Script to create an admin user in Supabase
 * Usage: npx tsx scripts/create-admin.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    // Create user with Supabase Auth (will send password reset email)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Suman',
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌ Error creating user:', authError.message);
      process.exit(1);
    }

    console.log('✅ User created successfully!');
    console.log(`👤 User ID: ${authData.user.id}`);

    // Send password reset email
    console.log('\n📨 Sending password reset email...');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login?reset=true`,
    });

    if (resetError) {
      console.error('⚠️  Warning: Could not send password reset email:', resetError.message);
      console.log('💡 You can manually send a password reset from Supabase dashboard');
    } else {
      console.log('✅ Password reset email sent to:', email);
    }

    // Verify profile was created with admin role (via trigger)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('⚠️  Warning: Could not fetch profile:', profileError.message);
    } else {
      console.log('\n✅ Profile created:');
      console.log(`   Role: ${profile.role}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Name: ${profile.full_name || 'Not set'}`);
    }

    console.log('\n✨ Admin account setup complete!');
    console.log('📧 Check your email for password reset link');
    console.log('🔗 Or reset manually at: https://fjghhrubobqwplvokszz.supabase.co/project/fjghhrubobqwplvokszz/auth/users');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdminUser();
