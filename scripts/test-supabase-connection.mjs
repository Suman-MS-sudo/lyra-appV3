#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

console.log('Testing Supabase Connection...\n');

// Read .env.local file
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};

// Parse environment variables (handles multiline values)
const lines = envContent.split('\n');
let currentKey = null;
let currentValue = '';

for (const line of lines) {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) continue;
  
  const match = trimmedLine.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    // Save previous key-value if exists
    if (currentKey) {
      envVars[currentKey] = currentValue.trim();
    }
    currentKey = match[1];
    currentValue = match[2];
  } else if (currentKey) {
    // Continuation of previous value
    currentValue += trimmedLine;
  }
}
// Save last key-value
if (currentKey) {
  envVars[currentKey] = currentValue.trim();
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Environment Variables:');
console.log('✓ NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
console.log('✓ NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
console.log();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables!');
  process.exit(1);
}

// Test connection
console.log('Testing Supabase connection...');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

try {
  // Test auth endpoint
  console.log('1. Testing auth endpoint...');
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.log('   ⚠️  Auth endpoint:', authError.message);
  } else {
    console.log('   ✓ Auth endpoint working');
  }

  // Test database connection
  console.log('2. Testing database connection...');
  const { count, error: dbError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  if (dbError) {
    console.log('   ❌ Database error:', dbError.message);
  } else {
    console.log(`   ✓ Database connected (${count} profiles)`);
  }

  // Test specific user login
  console.log('\n3. Testing login with your credentials...');
  console.log('   Email: mssworlz@gmail.com');
  
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'mssworlz@gmail.com',
    password: process.argv[2] || 'your-password-here'
  });

  if (loginError) {
    console.log('   ❌ Login error:', loginError.message);
    if (loginError.message.includes('Invalid login credentials')) {
      console.log('   💡 Hint: User exists but password is incorrect, or user does not exist');
    }
  } else {
    console.log('   ✓ Login successful!');
    console.log('   User ID:', loginData.user.id);
    console.log('   Email:', loginData.user.email);
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', loginData.user.id)
      .single();
    
    if (profileError) {
      console.log('   ⚠️  Profile fetch error:', profileError.message);
    } else {
      console.log('   Role:', profile.role);
      console.log('   Name:', profile.full_name || 'Not set');
    }
  }

  console.log('\n✅ Connection test complete!');
} catch (error) {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
}
