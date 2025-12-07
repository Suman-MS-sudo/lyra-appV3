# ESP32 Payment Success Integration

## API Endpoint

**URL:** `/api/payment_success?mac=<MAC_ADDRESS>`  
**Method:** `GET`  
**Polling Frequency:** Every 4 seconds (configured in ESP32)

## Response Formats

### No Pending Payments (Default)
```json
{
  "status": "No pending payments"
}
```

### Payment Success (Product Dispense Required)
```json
{
  "status": "success",
  "mac": "AA:BB:CC:DD:EE:FF",
  "machineId": "lyra_SNVM_003",
  "machineName": "Snacks Vending Machine",
  "transactionId": "uuid-here",
  "razorpayOrderId": "order_xxxxx",
  "razorpayPaymentId": "pay_xxxxx",
  "amount": 50.00,
  "products": [
    {
      "product": {
        "id": 1,
        "name": "Lays Chips",
        "description": "Classic salted chips"
      },
      "quantity": 2,
      "price": 25.00
    }
  ],
  "timestamp": "2025-12-08T10:30:00Z"
}
```

## ESP32 Integration Flow

### 1. Payment Made by Customer (Web App)
- Customer selects products on lyra-app.co.in
- Razorpay payment modal opens
- Customer completes payment
- Backend creates transaction with:
  - `payment_status = 'paid'`
  - `dispensed = false`

### 2. ESP32 Polls for Payment
```cpp
// ESP32 code polls every 4 seconds
void listenForOnlinePayment() {
  String url = SERVER_BASE + "/api/payment_success?mac=" + deviceMacAddress;
  // GET request to url
  // Parse JSON response
}
```

### 3. Backend Response Logic
```typescript
// Find machine by MAC address
// Look for transactions where:
//   - machine_id matches
//   - payment_status = 'paid'
//   - dispensed = false
// If found:
//   - Return payment details with products
//   - Mark transaction as dispensed = true
//   - Set dispensed_at = NOW()
// Else:
//   - Return "No pending payments"
```

### 4. ESP32 Dispenses Products
```cpp
// If status == "success"
for (each product in products) {
  for (int i = 0; i < quantity; i++) {
    dispenseAsCoinSequence(); // Activate motor, update stock
  }
}
// Stock automatically updated via notifyProductStockUpdate()
```

## Database Schema Changes

### Transactions Table (New Fields)
```sql
ALTER TABLE transactions
ADD COLUMN dispensed BOOLEAN DEFAULT FALSE,
ADD COLUMN dispensed_at TIMESTAMPTZ;
```

**Purpose:**
- `dispensed`: Prevents duplicate dispensing
- `dispensed_at`: Audit trail for when product was physically delivered

## Testing the Integration

### 1. Test Endpoint Directly
```bash
# Should return "No pending payments"
curl "http://localhost:3000/api/payment_success?mac=AA:BB:CC:DD:EE:FF"
```

### 2. Make a Test Payment
1. Open lyra-app.co.in/?value=lyra_SNVM_003
2. Add products to cart
3. Click "Pay Now"
4. Complete Razorpay test payment:
   - Card: 4111 1111 1111 1111
   - Expiry: 12/25
   - CVV: 123

### 3. Poll Endpoint Again
```bash
# Should now return payment success with products
curl "http://localhost:3000/api/payment_success?mac=<MACHINE_MAC>"
```

### 4. Poll Again (After Dispensing)
```bash
# Should return "No pending payments" (already dispensed)
curl "http://localhost:3000/api/payment_success?mac=<MACHINE_MAC>"
```

## Security Considerations

1. **MAC Address Validation**: Only dispenses for matching MAC
2. **One-Time Dispensing**: `dispensed` flag prevents duplicates
3. **Timestamp Tracking**: `dispensed_at` for audit trail
4. **Payment Verification**: Only returns `payment_status = 'paid'`

## Error Handling

### Machine Not Found
```json
{
  "status": "No pending payments",
  "message": "Machine not registered"
}
```

### Database Errors
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Migration Required

Run this migration before testing:
```bash
# Apply dispensed fields migration
node scripts/apply-dispensed-migration.mjs
```

Or manually in Supabase SQL Editor:
```sql
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS dispensed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_dispensed 
ON transactions(machine_id, payment_status, dispensed) 
WHERE payment_status = 'paid' AND dispensed = false;
```

## Next Steps

1. ✅ Created `/api/payment_success` endpoint
2. ✅ Added `dispensed` tracking to transactions
3. ✅ Updated payment verification to set `dispensed = false`
4. ⏳ Apply database migration
5. ⏳ Test complete flow: Payment → Poll → Dispense
6. ⏳ Verify stock updates correctly
