import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local manually
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const machines = [
  { mac_id: '6C:C8:40:8B:52:80', machine_id: 'CN00005_SNVM_00001', name: 'L&T-1' },
  { mac_id: '6C:C8:40:8B:D7:80', machine_id: 'CN00005_SNVM_00002', name: 'L&T-2' },
  { mac_id: '6C:C8:40:8B:83:3C', machine_id: 'CN00005_SNVM_00003', name: 'L&T-3' },
  { mac_id: 'F4:65:0B:BF:24:78', machine_id: 'CN00005_SNVM_00004', name: 'L&T-4' },
  { mac_id: '6C:C8:40:8B:39:08', machine_id: 'CN00005_SNVM_00005', name: 'L&T-5' },
  { mac_id: '6C:C8:40:8B:54:7C', machine_id: 'CN00005_SNVM_00006', name: 'L&T-6' },
  { mac_id: '80:F3:DA:4C:13:0C', machine_id: 'CN00005_SNVM_00007', name: 'L&T-7' },
  { mac_id: '20:E7:C8:74:BD:48', machine_id: 'CN00005_SNVM_00008', name: 'L&T-8' },
  { mac_id: '6C:C8:40:8C:32:74', machine_id: 'CN00005_SNVM_00009', name: 'L&T-9' },
  { mac_id: '6C:C8:40:8B:4F:68', machine_id: 'CN00005_SNVM_00010', name: 'L&T-10' },
  { mac_id: '6C:C8:40:8C:53:A0', machine_id: 'CN00005_SNVM_00011', name: 'L&T-11' },
  { mac_id: '6C:C8:40:8B:2D:B0', machine_id: 'CN00005_SNVM_00012', name: 'L&T-12' },
  { mac_id: '4C:C3:82:0D:56:3C', machine_id: 'CN00005_SNVM_00013', name: 'L&T-13' },
  { mac_id: '6C:C8:40:8B:37:24', machine_id: 'CN00005_SNVM_00014', name: 'L&T-14' },
  { mac_id: '6C:C8:40:8B:60:20', machine_id: 'CN00005_SNVM_00015', name: 'L&T-15' },
  { mac_id: 'F4:65:0B:BF:17:84', machine_id: 'CN00005_SNVM_00016', name: 'L&T-16' },
  { mac_id: '80:F3:DA:4C:41:14', machine_id: 'CN00005_SNVM_00017', name: 'L&T-17' },
  { mac_id: '68:25:DD:34:19:30', machine_id: 'CN00005_SNVM_00018', name: 'L&T-18' },
  { mac_id: '68:25:DD:33:4A:24', machine_id: 'CN00005_SNVM_00019', name: 'L&T-19' },
  { mac_id: '68:25:DD:33:21:98', machine_id: 'CN00005_SNVM_00021', name: 'L&T-21' },
  { mac_id: '00:4B:12:2F:C7:C4', machine_id: 'CN00005_SNVM_00022', name: 'L&T-22' },
  { mac_id: '68:25:DD:FD:2A:90', machine_id: 'CN00005_SNVM_00023', name: 'L&T-23' },
  { mac_id: '38:18:2B:8B:73:B0', machine_id: 'CN00005_SNVM_00024', name: 'L&T-24' },
];

async function seedMachines() {
  try {
    console.log('🚀 Starting L&T machines seed...\n');

    // Common data for all machines (same as L&T-20)
    const commonData = {
      location: 'Chennai',
      status: 'offline',
      latitude: null,
      longitude: null,
      last_sync: new Date().toISOString(),
      machine_type: 'SNVM_WF_SL30',
      product_type: 'SANITARY PAD',
      ip_address: null,
      device_secret: null,
      customer_id: '424ea2c2-26ca-4bd6-92e4-bdd489110a65',
      customer_name: 'Larsen and Toubro Limited',
      customer_contact: '9791230836',
      customer_alternate_contact: null,
      customer_address: '25GG+2XC, Mount Poonamallee Rd, Park Dugar, Ramapuram,',
      customer_location: null,
      product_count: 0,
      product_variety_count: 0,
      asset_online: false,
      last_ping: null,
      purchase_date: '2025-12-20',
      warranty_till: '2026-12-20',
      amc_till: '2026-12-20',
      firmware_version: null,
      last_firmware_update: null,
      wifi_rssi: null,
      free_heap: null,
      uptime: null,
      stock_level: null,
      ip_address_current: null,
      connection_type: null,
      last_error: null,
      last_error_time: null,
      total_dispenses: 0,
      failed_dispenses: 0,
      network_speed: null,
      temperature: null,
    };

    let successCount = 0;
    let errorCount = 0;

    for (const machine of machines) {
      const machineData = {
        ...commonData,
        name: machine.name,
        machine_id: machine.machine_id,
        mac_id: machine.mac_id,
      };

      const { data, error } = await supabase
        .from('vending_machines')
        .insert(machineData)
        .select();

      if (error) {
        console.error(`❌ Error inserting ${machine.name}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Successfully inserted ${machine.name} (${machine.machine_id})`);
        successCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📋 Total: ${machines.length}`);

    if (successCount === machines.length) {
      console.log('\n🎉 All L&T machines seeded successfully!');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

seedMachines();
