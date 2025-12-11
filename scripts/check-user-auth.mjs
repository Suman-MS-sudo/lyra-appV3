import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

const email = process.argv[2] || 'mssworlz@gmail.com';

console.log(`\n🔍 Checking auth account for: ${email}\n`);

// Check if user exists in auth.users
const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

if (usersError) {
  console.error('❌ Error listing users:', usersError);
  process.exit(1);
}

const user = users.find(u => u.email === email);

if (!user) {
  console.log(`❌ No auth.users account found for ${email}`);
  console.log(`\n📋 You need to create an auth account first.`);
  console.log(`   Run: node scripts/create-admin.mjs ${email} <password>\n`);
  process.exit(1);
}

console.log('✅ Auth account exists:');
console.log(`   User ID: ${user.id}`);
console.log(`   Email: ${user.email}`);
console.log(`   Created: ${user.created_at}\n`);

// Check profile
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .maybeSingle();

if (profileError) {
  console.error('❌ Error fetching profile:', profileError);
  process.exit(1);
}

if (!profile) {
  console.log(`❌ No profile found for user ID: ${user.id}`);
  console.log(`   Auth account exists but profile is missing!\n`);
  process.exit(1);
}

console.log('✅ Profile exists:');
console.log(`   ID: ${profile.id}`);
console.log(`   Email: ${profile.email}`);
console.log(`   Role: ${profile.role}`);
console.log(`   Account Type: ${profile.account_type}`);
console.log(`   Organization ID: ${profile.organization_id}\n`);

// Check machines
const { data: machines, count } = await supabase
  .from('vending_machines')
  .select('id, name', { count: 'exact' })
  .eq('customer_id', profile.id);

console.log(`📊 Machines owned by this user: ${count || 0}`);
if (machines && machines.length > 0) {
  machines.slice(0, 5).forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name}`);
  });
  if (machines.length > 5) {
    console.log(`   ... and ${machines.length - 5} more`);
  }
}

console.log('\n');
