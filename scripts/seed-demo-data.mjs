import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjghhrubobqwplvokszz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  // Seed vending machines
  const machines = [
    { name: 'Machine #1', location: 'Location 1', mac_id: 'C0:CD:D6:84:85:DC' },
    { name: 'Machine #2', location: 'Location 2', mac_id: 'C0:CD:D6:84:85:DD' },
    { name: 'Machine #3', location: 'Location 3', mac_id: 'C0:CD:D6:84:85:DE' },
  ];
  await supabase.from('vending_machines').insert(machines);

  // Seed transactions
  const { data: machineData } = await supabase.from('vending_machines').select('id').limit(3);
  const { data: userData } = await supabase.from('profiles').select('id').eq('role', 'customer').limit(1);
  const transactions = [
    {
      machine_id: machineData?.[0]?.id,
      user_id: userData?.[0]?.id,
      amount: 5,
      total_amount: 5,
      payment_status: 'paid',
      dispensed: true,
      created_at: new Date().toISOString(),
    },
    {
      machine_id: machineData?.[1]?.id,
      user_id: userData?.[0]?.id,
      amount: 10,
      total_amount: 10,
      payment_status: 'paid',
      dispensed: true,
      created_at: new Date().toISOString(),
    },
    {
      machine_id: machineData?.[2]?.id,
      user_id: userData?.[0]?.id,
      amount: 15,
      total_amount: 15,
      payment_status: 'paid',
      dispensed: true,
      created_at: new Date().toISOString(),
    },
  ];
  await supabase.from('transactions').insert(transactions);

  console.log('✅ Demo data seeded!');
}

seed();
