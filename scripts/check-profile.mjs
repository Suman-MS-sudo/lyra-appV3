import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

async function checkProfile() {
  console.log('Checking for admin user...\n');
  
  // Check auth.users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('Error listing users:', usersError);
    return;
  }
  
  const adminUser = users.find(u => u.email === 'suman.phoenix@hotmail.com');
  
  if (!adminUser) {
    console.log('❌ Admin user not found in auth.users');
    return;
  }
  
  console.log('✅ Admin user found in auth.users');
  console.log('User ID:', adminUser.id);
  console.log('Email:', adminUser.email);
  console.log('');
  
  // Check profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();
  
  if (profileError) {
    console.log('❌ Profile not found in profiles table');
    console.log('Error:', profileError.message);
    console.log('\nCreating profile...');
    
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: adminUser.id,
        email: adminUser.email,
        full_name: 'Admin User',
        role: 'admin'
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating profile:', createError);
    } else {
      console.log('✅ Profile created successfully');
      console.log(newProfile);
    }
  } else {
    console.log('✅ Profile exists in profiles table');
    console.log('ID:', profile.id);
    console.log('Email:', profile.email);
    console.log('Full Name:', profile.full_name);
    console.log('Role:', profile.role);
  }
}

checkProfile();
