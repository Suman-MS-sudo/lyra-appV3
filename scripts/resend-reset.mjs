// Resend password reset with correct redirect URL
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

console.log('📨 Sending password reset email with correct redirect...');

const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `http://localhost:3000/auth/callback?type=admin`,
});

if (error) {
  console.error('❌ Error:', error.message);
} else {
  console.log('✅ Password reset email sent!');
  console.log('📧 Check suman.phoenix@hotmail.com');
  console.log('🔗 The link will now take you to the password reset page');
}
