import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

console.log('\n🔍 Diagnosing email mismatch issue...\n');

// Get all auth users
const { data: { users } } = await supabase.auth.admin.listUsers();

console.log('📧 Auth Users (auth.users table):');
const relevantUsers = users.filter(u => 
  u.email === 'mssworlz@gmail.com' || u.email === 'suman.phoenix@hotmail.com'
);

relevantUsers.forEach(u => {
  console.log(`   ${u.email}`);
  console.log(`   └─ Auth ID: ${u.id}\n`);
});

// Get profiles
const { data: profiles } = await supabase
  .from('profiles')
  .select('*')
  .in('email', ['mssworlz@gmail.com', 'suman.phoenix@hotmail.com']);

console.log('👤 Profiles (profiles table):');
profiles.forEach(p => {
  console.log(`   ${p.email}`);
  console.log(`   └─ Profile ID: ${p.id}`);
  console.log(`   └─ Role: ${p.role}`);
  console.log(`   └─ Account Type: ${p.account_type}\n`);
});

// Check for mismatch
console.log('⚠️  MISMATCH DETECTION:');
profiles.forEach(p => {
  const authUser = users.find(u => u.id === p.id);
  if (!authUser) {
    console.log(`   ❌ Profile ID ${p.id} (${p.email}) has NO matching auth.users record!`);
  } else if (authUser.email !== p.email) {
    console.log(`   ❌ ID ${p.id}:`);
    console.log(`      - Auth email: ${authUser.email}`);
    console.log(`      - Profile email: ${p.email}`);
    console.log(`      - THIS IS THE PROBLEM! Emails don't match.\n`);
  } else {
    console.log(`   ✅ ${p.email} - Auth and Profile match correctly`);
  }
});

console.log('\n💡 SOLUTION:');
console.log('   Option 1: Swap emails back in profiles table to match auth.users');
console.log('   Option 2: Create a new auth account for mssworlz@gmail.com\n');
console.log('   Which option would you like? Type the number:\n');
