// Create admin profile manually
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

// Get the user ID
const { data: users, error: userError } = await supabase.auth.admin.listUsers();

if (userError) {
  console.error('❌ Error fetching users:', userError.message);
  process.exit(1);
}

const adminUser = users.users.find(u => u.email === 'suman.phoenix@hotmail.com');

if (!adminUser) {
  console.error('❌ User not found!');
  process.exit(1);
}

console.log(`✅ Found user: ${adminUser.id}`);

// Insert or update profile
const { data, error } = await supabase
  .from('profiles')
  .upsert({
    id: adminUser.id,
    email: adminUser.email,
    role: 'admin',
    full_name: 'Suman',
  })
  .select()
  .single();

if (error) {
  console.error('❌ Error creating profile:', error.message);
  process.exit(1);
}

console.log('✅ Admin profile created successfully!');
console.log(`   Email: ${data.email}`);
console.log(`   Role: ${data.role}`);
console.log(`   Name: ${data.full_name}`);
console.log('\n📧 Check your email (suman.phoenix@hotmail.com) for the password reset link!');
console.log('🔗 Then login at: http://localhost:3000/login?type=admin');
