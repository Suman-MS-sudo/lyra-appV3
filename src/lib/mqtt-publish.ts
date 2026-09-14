import mqtt from 'mqtt';

/**
 * Publishes a payment-success event to a machine's MQTT topic, for machines
 * running the new push-based firmware (USE_MQTT_PAYMENT_PUSH) instead of
 * polling /api/payment_success. Old machines are unaffected -- this is only
 * ever called in addition to, never instead of, the existing polling flow's
 * own data (the transaction row itself), so a machine that never receives
 * this message can still pick the payment up next time it happens to poll.
 *
 * Vercel serverless functions can't hold a persistent connection, so this
 * connects, publishes, and disconnects each call -- fine for something as
 * infrequent as "a payment just completed."
 */

export interface PaymentPushPayload {
  status: 'success';
  mac: string;
  machineId: string;
  machineName: string;
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  products: unknown[];
  timestamp: string;
}

export async function publishPaymentSuccess(
  machineUuid: string,
  payload: PaymentPushPayload
): Promise<void> {
  const brokerUrl = process.env.MQTT_BROKER_URL; // e.g. mqtts://lyra-app.co.in:8883
  const username = process.env.MQTT_SERVER_USERNAME;
  const password = process.env.MQTT_SERVER_PASSWORD;

  if (!brokerUrl || !username || !password) {
    console.warn('MQTT not configured (MQTT_BROKER_URL/MQTT_SERVER_USERNAME/MQTT_SERVER_PASSWORD) -- skipping push, old machines are unaffected either way');
    return;
  }

  const topic = `lyra/machines/${machineUuid}/payment`;

  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, {
      username,
      password,
      connectTimeout: 5000,
      reconnectPeriod: 0, // single attempt -- this is a one-shot publish, not a long-lived client
    });

    const cleanup = (err?: Error) => {
      client.end(true);
      if (err) reject(err); else resolve();
    };

    const timeout = setTimeout(() => cleanup(new Error('MQTT publish timed out')), 8000);

    client.on('connect', () => {
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        clearTimeout(timeout);
        cleanup(err ?? undefined);
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      cleanup(err);
    });
  });
}
