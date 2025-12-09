import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjghhrubobqwplvokszz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw'
);

async function fixAdmin() {
  console.log('Fetching all profiles...\n');
  
  // Get all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${profiles.length} profile(s):\n`);
  profiles.forEach((p, i) => {
    console.log(`${i + 1}. Email: ${p.email}`);
    console.log(`   Role: ${p.role}`);
    console.log(`   Account Type: ${p.account_type}`);
    console.log(`   ID: ${p.id}`);
    console.log('');
  });
  
  // Find the first profile (likely yours) and make it admin
  if (profiles.length > 0) {
    const yourProfile = profiles[0];
    
    console.log(`\nUpdating profile for ${yourProfile.email} to admin...`);
    
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', yourProfile.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating:', updateError);
    } else {
      console.log('✅ Profile updated successfully!');
      console.log('New role:', updated.role);
    }
  }
}

fixAdmin();
