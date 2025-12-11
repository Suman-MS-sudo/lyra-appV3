import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

console.log('\n🔄 Swapping emails completely (auth.users + profiles)...\n');

// Get current state
const { data: { users } } = await supabase.auth.admin.listUsers();

const user1 = users.find(u => u.email === 'suman.phoenix@hotmail.com');
const user2 = users.find(u => u.email === 'mssworlz@gmail.com');

console.log('📋 Current State:');
console.log(`   Auth: suman.phoenix@hotmail.com → ID: ${user1?.id}`);
console.log(`   Auth: mssworlz@gmail.com → ID: ${user2?.id}\n`);

// Step 1: Update auth.users emails to temporary values
console.log('Step 1: Setting temporary emails in auth.users...');

await supabase.auth.admin.updateUserById(user1.id, {
  email: 'temp1@temp.com'
});

await supabase.auth.admin.updateUserById(user2.id, {
  email: 'temp2@temp.com'
});

console.log('   ✅ Temporary emails set\n');

// Step 2: Swap to final emails
console.log('Step 2: Swapping to final emails in auth.users...');

await supabase.auth.admin.updateUserById(user1.id, {
  email: 'mssworlz@gmail.com'
});

await supabase.auth.admin.updateUserById(user2.id, {
  email: 'suman.phoenix@hotmail.com'
});

console.log('   ✅ Auth emails swapped\n');

// Step 3: Update profiles table
console.log('Step 3: Updating profiles table...');

await supabase.from('profiles').update({ 
  email: 'temp1@temp.com' 
}).eq('id', user1.id);

await supabase.from('profiles').update({ 
  email: 'temp2@temp.com' 
}).eq('id', user2.id);

await supabase.from('profiles').update({ 
  email: 'mssworlz@gmail.com' 
}).eq('id', user1.id);

await supabase.from('profiles').update({ 
  email: 'suman.phoenix@hotmail.com' 
}).eq('id', user2.id);

console.log('   ✅ Profile emails swapped\n');

// Verify
console.log('✅ VERIFICATION:');
const { data: { users: updatedUsers } } = await supabase.auth.admin.listUsers();
const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', [user1.id, user2.id]);

[user1.id, user2.id].forEach(id => {
  const authUser = updatedUsers.find(u => u.id === id);
  const profile = profiles.find(p => p.id === id);
  console.log(`   ID: ${id}`);
  console.log(`   └─ Auth: ${authUser.email}`);
  console.log(`   └─ Profile: ${profile.email}`);
  console.log(`   └─ Match: ${authUser.email === profile.email ? '✅' : '❌'}\n`);
});

console.log('🎉 Email swap complete!\n');
console.log('Now you can log in as:');
console.log(`   - mssworlz@gmail.com (was suman.phoenix@hotmail.com)`);
console.log(`   - suman.phoenix@hotmail.com (was mssworlz@gmail.com)\n`);
