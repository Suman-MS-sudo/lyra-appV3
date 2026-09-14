#!/usr/bin/env node

/**
 * Regenerates the Mosquitto password file and ACL from Supabase, so each
 * machine's MQTT credentials always match its current device_secret and
 * each device is restricted to only its own payment topic.
 *
 * Run this on the jumphost (not from your dev machine -- it shells out to
 * mosquitto_passwd, which needs to exist on PATH and write access to
 * /etc/mosquitto/). Re-run whenever a new machine is provisioned or a
 * device_secret is rotated.
 *
 *   node scripts/sync-mqtt-passwords.mjs
 *
 * Requires MQTT_SERVER_USERNAME / MQTT_SERVER_PASSWORD to already be set in
 * .env.local (same credential /api/razorpay/verify's publish path uses) --
 * this script writes that same pair into the password file so the two
 * stay in sync automatically.
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const PASSWORD_FILE = process.env.MOSQUITTO_PASSWORD_FILE || '/etc/mosquitto/passwd';
const ACL_FILE = process.env.MOSQUITTO_ACL_FILE || '/etc/mosquitto/lyra.acl';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const { MQTT_SERVER_USERNAME, MQTT_SERVER_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!MQTT_SERVER_USERNAME || !MQTT_SERVER_PASSWORD) {
  console.error('MQTT_SERVER_USERNAME / MQTT_SERVER_PASSWORD must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: machines, error } = await supabase
  .from('vending_machines')
  .select('id, machine_id, device_secret')
  .not('device_secret', 'is', null);

if (error) {
  console.error('Failed to fetch machines:', error.message);
  process.exit(1);
}

console.log(`Syncing MQTT credentials for ${machines.length} machine(s)...`);

// mosquitto_passwd -c (create/truncate) on the first entry, -b (batch, no
// prompt) on every entry including the first.
let first = !existsSync(PASSWORD_FILE);
execFileSync('mosquitto_passwd', [
  first ? '-cb' : '-b',
  PASSWORD_FILE,
  MQTT_SERVER_USERNAME,
  MQTT_SERVER_PASSWORD,
]);
first = false;

for (const m of machines) {
  execFileSync('mosquitto_passwd', ['-b', PASSWORD_FILE, m.id, m.device_secret]);
}

const aclLines = [
  `user ${MQTT_SERVER_USERNAME}`,
  `topic write lyra/machines/+/payment`,
  '',
];
for (const m of machines) {
  aclLines.push(`user ${m.id}`);
  aclLines.push(`topic read lyra/machines/${m.id}/payment`);
  aclLines.push('');
}

writeFileSync(ACL_FILE, aclLines.join('\n'));

console.log(`Wrote ${PASSWORD_FILE} and ${ACL_FILE}.`);
console.log('Reload Mosquitto for the ACL change to take effect: sudo systemctl reload mosquitto');
