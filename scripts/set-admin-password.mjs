// Set password directly without email reset
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

const email = 'suman.phoenix@hotmail.com';
const newPassword = 'Admin@123456'; // Change this to your desired password

console.log('🔧 Setting password directly for admin user...');

// Get user
const { data: users } = await supabase.auth.admin.listUsers();
const user = users.users.find(u => u.email === email);

if (!user) {
  console.error('❌ User not found!');
  process.exit(1);
}

// Update password directly
const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword
});

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Password set successfully!');
console.log(`📧 Email: ${email}`);
console.log(`🔑 Password: ${newPassword}`);
console.log('\n🔗 Login at: http://localhost:3000/login?type=admin');
