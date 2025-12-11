#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Use environment variables directly
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMachineStatus() {
  const machineId = 'd1262fb0-7666-459f-838a-a6deafda7069';
  
  const { data, error } = await supabase
    .from('vending_machines')
    .select('id, machine_id, asset_online, last_ping, stock_level, firmware_version, wifi_rssi, temperature, network_speed')
    .eq('id', machineId)
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n🔍 Machine Status in Database:');
  console.log('================================');
  console.log('Machine ID:', data.machine_id);
  console.log('UUID:', data.id);
  console.log('Online:', data.asset_online);
  console.log('Last Ping:', data.last_ping);
  console.log('Stock Level:', data.stock_level);
  console.log('Firmware:', data.firmware_version);
  console.log('WiFi RSSI:', data.wifi_rssi);
  console.log('Temperature:', data.temperature);
  console.log('Network Speed:', data.network_speed);
  console.log('================================\n');
  
  // Calculate time since last ping
  if (data.last_ping) {
    const lastPing = new Date(data.last_ping);
    const now = new Date();
    const diffMs = now - lastPing;
    const diffMins = Math.floor(diffMs / 60000);
    console.log(`⏰ Last ping was ${diffMins} minutes ago`);
    console.log(`   (${lastPing.toLocaleString()})\n`);
  }
}

checkMachineStatus();
