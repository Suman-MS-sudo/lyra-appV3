// Simple ESP32 Payment Flow Demonstration
// This creates a test payment and shows how ESP32 would poll for it

const MAC_ADDRESS = 'C0:CD:D6:84:85:DC';
const API_URL = `http://localhost:3000/api/payment_success?mac=${encodeURIComponent(MAC_ADDRESS)}`;

console.log('🧪 ESP32 Payment Flow Demo\n');
console.log('=' .repeat(70));

// Step 1: Check current status (should be "No pending payments")
console.log('\n📡 Step 1: ESP32 polling for payments (initial state)...');
console.log(`   Endpoint: ${API_URL}\n`);

try {
  const response1 = await fetch(API_URL);
  const result1 = await response1.json();
  
  console.log('   Response:');
  console.log('   ' + JSON.stringify(result1, null, 2).replace(/\n/g, '\n   '));
  
  if (result1.data?.status === 'No pending payments') {
    console.log('\n   ✅ Expected: No pending payments');
  }
} catch (error) {
  console.error('\n   ❌ API Error:', error.message);
  process.exit(1);
}

// Step 2: Instructions for making a payment
console.log('\n' + '='.repeat(70));
console.log('\n💳 Step 2: MAKE A PAYMENT NOW\n');
console.log('   1. Open: http://localhost:3000/?value=lyra_SNVM_003');
console.log('   2. Add product to cart');
console.log('   3. Click "Pay Now"');
console.log('   4. Use test card: 4111 1111 1111 1111');
console.log('   5. CVV: 123, Expiry: 12/25');
console.log('   6. Complete the payment\n');
console.log('   Then press ENTER to continue...');

// Wait for user to press Enter
await new Promise(resolve => {
  process.stdin.once('data', resolve);
});

// Step 3: Poll again (should now have payment)
console.log('\n📡 Step 3: ESP32 polling again (after payment)...\n');

try {
  const response2 = await fetch(API_URL);
  const result2 = await response2.json();
  
  console.log('   Response:');
  console.log('   ' + JSON.stringify(result2, null, 2).replace(/\n/g, '\n   '));
  
  if (result2.data?.status === 'success') {
    console.log('\n   🎉 PAYMENT DETECTED!');
    console.log(`   ESP32 will now dispense ${result2.data.products?.length || 0} product(s):`);
    result2.data.products?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.product.name} x${p.quantity} @ ₹${p.price}`);
    });
    console.log('\n   Transaction marked as "dispensed" to prevent duplicates');
  } else if (result2.data?.status === 'No pending payments') {
    console.log('\n   ℹ️  No payment found. Did you complete the payment?');
  }
} catch (error) {
  console.error('\n   ❌ API Error:', error.message);
}

// Step 4: Poll one more time (should be back to "No pending")
console.log('\n📡 Step 4: ESP32 polling again (should be empty now)...\n');

try {
  const response3 = await fetch(API_URL);
  const result3 = await response3.json();
  
  console.log('   Response:');
  console.log('   ' + JSON.stringify(result3, null, 2).replace(/\n/g, '\n   '));
  
  if (result3.data?.status === 'No pending payments') {
    console.log('\n   ✅ CORRECT! Payment was already dispensed');
    console.log('   This prevents ESP32 from dispensing the same payment twice');
  }
} catch (error) {
  console.error('\n   ❌ API Error:', error.message);
}

console.log('\n' + '='.repeat(70));
console.log('\n📋 Summary:\n');
console.log('   • ESP32 polls /api/payment_success?mac=<MAC> every 4 seconds');
console.log('   • Default response: {"status":"No pending payments"}');
console.log('   • When payment exists: Returns product list with quantities');
console.log('   • After dispensing: Transaction marked as "dispensed"');
console.log('   • Next poll: Back to "No pending payments"');
console.log('\n🏁 Demo completed!\n');
