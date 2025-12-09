#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Use environment variables directly
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHealthMetrics() {
  console.log('🔍 Checking health metrics for lyra_SNVM_003...\n');

  const { data: machine, error } = await supabase
    .from('vending_machines')
    .select('machine_id, firmware_version, wifi_rssi, free_heap, uptime, last_ping')
    .eq('machine_id', 'lyra_SNVM_003')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!machine) {
    console.error('❌ Machine not found');
    process.exit(1);
  }

  // Fetch stock from machine_products
  const { data: products } = await supabase
    .from('machine_products')
    .select('stock')
    .eq('machine_id', 'lyra_SNVM_003');

  const totalStock = products?.reduce((sum, p) => sum + (p.stock || 0), 0) || 0;

  console.log('📊 Machine Health Metrics:');
  console.log('  Machine ID:', machine.machine_id);
  console.log('  Firmware Version:', machine.firmware_version || 'N/A');
  console.log('  WiFi Signal (RSSI):', machine.wifi_rssi != null ? `${machine.wifi_rssi} dBm` : 'N/A');
  console.log('  Free Heap:', machine.free_heap != null ? `${machine.free_heap} bytes` : 'N/A');
  console.log('  Uptime:', machine.uptime != null ? `${machine.uptime} seconds` : 'N/A');
  console.log('  Total Stock:', totalStock, 'units (from machine_products)');
  console.log('  Last Ping:', machine.last_ping || 'N/A');
  console.log('\n✅ Done!');
}

checkHealthMetrics();
