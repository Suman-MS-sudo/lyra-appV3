#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>
#include <SoftwareSerial.h>

// =====================================================
// LCD
// =====================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// =====================================================
// SIM MODULE (A7670C) — on hardware Serial (Uno pins 0/1)
// A7670C TXD -> Arduino Pin 0 (RX)
// A7670C RXD -> Arduino Pin 1 (TX), through a voltage divider — this
//   module's RX input is not 5V tolerant, Arduino's TX is 5V
// GND -> Arduino GND
// VCC -> dedicated regulated ~4V supply with a bulk capacitor at the
//   module's power pins, NOT the Arduino's 5V rail — transmit current
//   spikes (~2A) need headroom a shared/weak supply can't give, and
//   that's what causes corrupted serial reads.
//
// Hardware Serial instead of SoftwareSerial: more reliable UART, but
// pins 0/1 are shared with the USB-to-serial chip used for uploading
// sketches. IMPORTANT: disconnect the module's TXD from pin 0 before
// every firmware upload — the bootloader uses this same pin, and the
// module driving it at the same time can make the upload fail or hang.
// Reconnect it after the upload finishes.
//
// Because hardware Serial is now dedicated to the module, all debug/
// status output goes out over a separate SoftwareSerial port instead
// (see DEBUG_RX/DEBUG_TX below) rather than the usual Serial Monitor.
//
// A7670C boots at a fixed baud (commonly 115200 out of the box) rather
// than autobauding like SIM800L did. No manual bring-up step needed
// though — bringUpModule() below probes for the module at SIM_BAUD
// first, and if it only finds it at its factory default, reconfigures
// it (AT+IPR + AT&W) to SIM_BAUD itself and re-opens the port there.
// That happens once per fresh/reset module; every boot after that
// finds it at SIM_BAUD immediately.
// =====================================================

// Kept low (not the 115200 many of these modules default to) — even on
// hardware Serial, a lower rate leaves more margin against electrical
// noise during the module's transmit current spikes. If corruption
// shows up despite a proper dedicated power supply, drop this further.
#define SIM_BAUD 9600

// =====================================================
// DEBUG OUTPUT (SoftwareSerial, since hardware Serial is now the
// module link) — connect a USB-TTL adapter's RX to Arduino Pin 8 and
// its GND to Arduino GND, then open a serial terminal (Arduino Serial
// Monitor pointed at the adapter's COM port, or PuTTY/CoolTerm) at
// 9600 baud to view logs. Pin 7 (SoftwareSerial's RX) is unused —
// debug output is one-directional — so it can be left unconnected.
// =====================================================
#define DEBUG_RX 7
#define DEBUG_TX 8

SoftwareSerial debugSerial(DEBUG_RX, DEBUG_TX);

// =====================================================
// PINS
// =====================================================
#define RELAY_PIN 6
#define COIN_PIN 2
#define RESET_PIN 4

// =====================================================
// SETTINGS
// =====================================================
#define EEPROM_ADDR 0
#define MAX_STOCK 25

#define PRODUCT_PRICE 5

// Motor ON time
#define MOTOR_TIME 3000

// Payment timeout
#define PAYMENT_TIMEOUT 120000UL

// =====================================================
// VARIABLES
// =====================================================
int stock = 0;

float receivedAmount = 0;

unsigned long paymentStartTime = 0;

bool waitingForBalance = false;

// Coin pulse state
bool coinPulseActive = false;

unsigned long coinPulseStart = 0;

// Prevent repeated detection
unsigned long lastCoinTime = 0;

// =====================================================
// SETUP
// =====================================================
void setup() {

  // Debug output — see DEBUG_RX/DEBUG_TX comment above
  debugSerial.begin(9600);

  // ---------------------------------------------------
  // Relay
  // ---------------------------------------------------
  pinMode(RELAY_PIN, OUTPUT);

  // Relay OFF
  digitalWrite(RELAY_PIN, LOW);

  // ---------------------------------------------------
  // Coin acceptor
  // ---------------------------------------------------
  // Plain INPUT, not INPUT_PULLUP — this acceptor drives the line HIGH
  // per coin (confirmed against a known-working reference sketch for the
  // same hardware), not LOW. INPUT_PULLUP would have left the pin idling
  // near the internal weak pull-up's level and checkCoin() watching for
  // the wrong polarity entirely, which is why no pulses were ever detected.
  pinMode(COIN_PIN, INPUT);

  // ---------------------------------------------------
  // Reset button
  // ---------------------------------------------------
  pinMode(RESET_PIN, INPUT_PULLUP);

  // ---------------------------------------------------
  // LCD
  // ---------------------------------------------------
  lcd.init();
  lcd.backlight();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Lyra Enterprises");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  delay(1500);

  // ---------------------------------------------------
  // Load stock
  // ---------------------------------------------------
  stock = EEPROM.read(EEPROM_ADDR);

  if (stock > MAX_STOCK) {
    stock = MAX_STOCK;
    EEPROM.update(EEPROM_ADDR, stock);
  }

  debugSerial.print("Stock: ");
  debugSerial.println(stock);

  // ---------------------------------------------------
  // A7670C
  // ---------------------------------------------------
  debugSerial.println("Initializing A7670C...");

  bool moduleReady = bringUpModule();

  if (moduleReady) {
    debugSerial.println("Module responded.");
    logModuleStatus();
  } else {
    debugSerial.println("WARNING: no response from A7670C after retries — check wiring/power. Continuing anyway.");
  }

  clearSIMBuffer();

  Serial.println("AT+CMGF=1");
  delay(500);

  clearSIMBuffer();

  Serial.println("AT+CNMI=1,2,0,0,0");
  delay(500);

  clearSIMBuffer();

  // ---------------------------------------------------
  // Idle screen
  // ---------------------------------------------------
  showIdleMessage();

  debugSerial.println("Machine Ready.");
}

// =====================================================
// LOOP
// =====================================================
void loop() {

  // ===================================================
  // RESET / REFILL
  // ===================================================
  checkResetButton();

  // ===================================================
  // COIN
  // ===================================================
  checkCoin();

  // ===================================================
  // SMS
  // ===================================================
  checkSMS();

  // ===================================================
  // PAYMENT TIMEOUT
  // ===================================================
  if (waitingForBalance) {

    if (millis() - paymentStartTime >= PAYMENT_TIMEOUT) {

      debugSerial.println("Payment timeout.");

      receivedAmount = 0;
      waitingForBalance = false;

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Payment Timeout");

      lcd.setCursor(0, 1);
      lcd.print("Try Again");

      delay(2000);

      showIdleMessage();
    }
  }
}

// =====================================================
// COIN DETECTION
// =====================================================
void checkCoin() {

  int coinState = digitalRead(COIN_PIN);

  // ---------------------------------------------------
  // Raw pin-state diagnostic — everything below this only
  // ever prints when a FULL, valid pulse completes, so if
  // the coin acceptor's signal isn't reaching COIN_PIN at
  // all (bad wiring, wrong pin, no shared GND, acceptor not
  // powered), there would be total silence either way and
  // no way to tell which case you're in. This instead logs
  // every raw transition immediately, with no filtering, so
  // you can confirm whether the pin ever moves at all while
  // inserting a coin. Remove once the mechanism is confirmed
  // working — it's diagnostic only, not needed for normal use.
  static int lastRawState = -1;
  if (coinState != lastRawState) {
    debugSerial.print("[COIN_PIN raw] ");
    debugSerial.println(coinState == LOW ? "LOW" : "HIGH");
    lastRawState = coinState;
  }

  // ---------------------------------------------------
  // Detect HIGH pulse — this acceptor drives the line HIGH per coin, not
  // LOW (see the pinMode(COIN_PIN, INPUT) comment in setup()).
  // ---------------------------------------------------
  if (coinState == HIGH && !coinPulseActive) {

    // Ignore extremely fast repeated pulses
    if (millis() - lastCoinTime > 300) {

      coinPulseActive = true;

      coinPulseStart = millis();

      debugSerial.println("Coin pulse START");
    }
  }

  // ---------------------------------------------------
  // Wait for pulse to finish
  // ---------------------------------------------------
  if (coinPulseActive && coinState == LOW) {

    unsigned long pulseTime = millis() - coinPulseStart;

    coinPulseActive = false;

    lastCoinTime = millis();

    debugSerial.print("Coin pulse length: ");
    debugSerial.print(pulseTime);
    debugSerial.println(" ms");

    // -------------------------------------------------
    // Validate pulse
    // -------------------------------------------------

    // Ignore very short electrical noise
    if (pulseTime >= 10 && pulseTime <= 2000) {

      debugSerial.println("VALID ₹5 COIN");

      processPayment(5);

    } else {

      debugSerial.println("Invalid/noise pulse ignored.");
    }
  }
}

// =====================================================
// SMS CHECK
// =====================================================
void checkSMS() {

  if (!Serial.available()) {
    return;
  }

  String sms = "";

  // Drain everything currently buffered as fast as possible — no per-byte
  // delay. At 9600 baud a new byte arrives roughly every ~1ms; sleeping
  // per character while the module is still transmitting risks losing
  // characters on a long message — that's what was producing garbled
  // text like "Yoeve rdcdIved" instead of "You've received" back when
  // this ran over SoftwareSerial. Keep reading as long as new bytes keep
  // showing up within a short quiet window, so a message that arrives in
  // a couple of back-to-back chunks isn't cut short.
  unsigned long lastByteTime = millis();
  while (millis() - lastByteTime < 100) {
    while (Serial.available()) {
      sms += (char)Serial.read();
      lastByteTime = millis();
    }
    // This loop can block for 100ms+ (the module doesn't only send full SMS
    // here — periodic network/signal-status URCs land in checkSMS() too,
    // not just actual messages). checkCoin() otherwise only runs once per
    // loop() pass, so without polling it here too, a coin pulse landing
    // during this wait — valid pulses can be as short as 10ms — would be
    // missed entirely, since loop() can't get back to checkCoin() until
    // this function returns.
    checkCoin();
  }

  debugSerial.println("--------------------------------");
  debugSerial.println("SIM MODULE DATA:");
  debugSerial.println(sms);
  debugSerial.println("--------------------------------");

  sms.toUpperCase();

  // -------------------------------------------------
  // Extract payment amount. A recognized currency/verb
  // prefix (RS., RS, INR, RECEIVED, CREDITED) directly
  // followed by a digit IS the definition of a valid
  // payment here — e.g. "RECEIVED 5" or "INR 5" are
  // accepted on their own, without also needing a
  // separate "CREDITED"/"PAYMENT SUCCESS"/"UPI" keyword
  // elsewhere in the message. Real bank/UPI SMS wording
  // varies a lot, and SIM serial noise (see checkSMS()
  // above) can garble or drop words unpredictably, so
  // requiring multiple keywords to agree was rejecting
  // otherwise-clearly-valid payments.
  // -------------------------------------------------
  float amount = extractAmount(sms);

  if (amount > 0) {

    debugSerial.print("VALID PAYMENT: Rs.");
    debugSerial.println(amount);

    processPayment(amount);

  } else {

    debugSerial.println("Not a payment SMS. Ignored.");
  }
}

// =====================================================
// EXTRACT AMOUNT
// =====================================================
float extractAmount(String message) {

  message.toUpperCase();

  // Collapse all spaces before matching, so "RS. 5", "RS 5",
  // "INR 5", "RECEIVED 5" etc. all normalize the same way —
  // far more robust than enumerating every exact phrasing,
  // and tolerant of spacing SIM serial noise shifts around.
  message.replace(" ", "");

  const char* prefixes[] = { "RS.", "RS", "INR", "RECEIVED", "CREDITED" };
  const int numPrefixes = sizeof(prefixes) / sizeof(prefixes[0]);

  for (int amount = 5; amount >= 1; amount--) {
    for (int p = 0; p < numPrefixes; p++) {
      if (message.indexOf(String(prefixes[p]) + String(amount)) >= 0) {
        return amount;
      }
    }
  }

  return 0;
}

// =====================================================
// PROCESS PAYMENT
// =====================================================
void processPayment(float amount) {

  // ---------------------------------------------------
  // Check stock
  // ---------------------------------------------------
  if (stock <= 0) {

    debugSerial.println("OUT OF STOCK - PAYMENT IGNORED");

    receivedAmount = 0;
    waitingForBalance = false;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Out of Stock!");

    lcd.setCursor(0, 1);
    lcd.print("Please Refill");

    delay(2500);

    showIdleMessage();

    return;
  }

  // ---------------------------------------------------
  // Add payment
  // ---------------------------------------------------
  receivedAmount += amount;

  debugSerial.print("Total received: Rs.");
  debugSerial.println(receivedAmount);

  // ---------------------------------------------------
  // Full payment
  // ---------------------------------------------------
  if (receivedAmount >= PRODUCT_PRICE) {

    debugSerial.println("PAYMENT COMPLETE");

    // Reset payment BEFORE dispensing
    receivedAmount = 0;
    waitingForBalance = false;

    dispenseItem();

    return;
  }

  // ---------------------------------------------------
  // Partial payment
  // ---------------------------------------------------
  float remaining = PRODUCT_PRICE - receivedAmount;

  waitingForBalance = true;

  paymentStartTime = millis();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Paid: Rs.");
  lcd.print(receivedAmount, 0);

  lcd.setCursor(0, 1);
  lcd.print("Pay Rs.");
  lcd.print(remaining, 0);

  debugSerial.print("Remaining: Rs.");
  debugSerial.println(remaining);
}

// =====================================================
// DISPENSE
// =====================================================
void dispenseItem() {

  // ---------------------------------------------------
  // Safety stock check
  // ---------------------------------------------------
  if (stock <= 0) {

    digitalWrite(RELAY_PIN, LOW);

    debugSerial.println("DISPENSE CANCELLED - NO STOCK");

    showOutOfStock();

    return;
  }

  // ---------------------------------------------------
  // Payment received
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Payment Received");

  lcd.setCursor(0, 1);
  lcd.print("Dispensing...");

  debugSerial.println("================================");
  debugSerial.println("MOTOR ON");
  debugSerial.println("================================");

  delay(500);

  // ---------------------------------------------------
  // MOTOR ON
  // ---------------------------------------------------
  digitalWrite(RELAY_PIN, HIGH);

  unsigned long motorStart = millis();

  // ---------------------------------------------------
  // Motor runs for MOTOR_TIME
  // ---------------------------------------------------
  while (millis() - motorStart < MOTOR_TIME) {

    // Keep relay ON
    digitalWrite(RELAY_PIN, HIGH);

    delay(10);
  }

  // ---------------------------------------------------
  // MOTOR OFF
  // ---------------------------------------------------
  digitalWrite(RELAY_PIN, LOW);

  debugSerial.println("MOTOR OFF");

  // ---------------------------------------------------
  // Reduce stock
  // ---------------------------------------------------
  stock--;

  EEPROM.update(EEPROM_ADDR, stock);

  debugSerial.print("Remaining stock: ");
  debugSerial.println(stock);

  // ---------------------------------------------------
  // Collection message
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Please Collect");

  lcd.setCursor(0, 1);
  lcd.print("The Napkin");

  delay(3000);

  // ---------------------------------------------------
  // Idle
  // ---------------------------------------------------
  showIdleMessage();
}

// =====================================================
// OUT OF STOCK
// =====================================================
void showOutOfStock() {

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Out of Stock!");

  lcd.setCursor(0, 1);
  lcd.print("Please Refill");

  delay(2500);

  showIdleMessage();
}

// =====================================================
// RESET BUTTON
// =====================================================
void checkResetButton() {

  if (digitalRead(RESET_PIN) == LOW) {

    debugSerial.println("RESET / REFILL PRESSED");

    // Reset stock
    stock = MAX_STOCK;

    EEPROM.update(EEPROM_ADDR, stock);

    // Cancel payment
    receivedAmount = 0;
    waitingForBalance = false;

    // Make absolutely sure motor is OFF
    digitalWrite(RELAY_PIN, LOW);

    lcd.clear();

    lcd.setCursor(0, 0);
    lcd.print("Stock Refilled");

    lcd.setCursor(0, 1);
    lcd.print("Stock: ");
    lcd.print(stock);

    delay(2000);

    showIdleMessage();

    // Wait until button released
    while (digitalRead(RESET_PIN) == LOW) {
      delay(20);
    }
  }
}

// =====================================================
// IDLE SCREEN
// =====================================================
void showIdleMessage() {

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Lyra Enterprises");

  lcd.setCursor(0, 1);
  lcd.print("Stock: ");
  lcd.print(stock);
}

// =====================================================
// CLEAR SIM MODULE BUFFER
// =====================================================
void clearSIMBuffer() {

  while (Serial.available()) {
    Serial.read();
  }
}

// =====================================================
// WAIT FOR "OK" FROM SIM MODULE
// =====================================================
bool waitForModuleOK(unsigned long timeoutMs) {

  unsigned long start = millis();
  String resp = "";

  while (millis() - start < timeoutMs) {
    while (Serial.available()) {
      resp += (char)Serial.read();
      if (resp.indexOf("OK") >= 0) {
        return true;
      }
    }
  }

  return false;
}

// =====================================================
// BRING UP SIM MODULE
// =====================================================
// Probes for the module at SIM_BAUD first. If that fails, tries the
// factory-default 115200 — if found there, permanently reconfigures the
// module to SIM_BAUD (AT+IPR + AT&W) so every future boot finds it
// immediately at SIM_BAUD without this fallback. Returns false only if
// the module doesn't respond at either baud (wiring/power problem).
bool bringUpModule() {

  const long candidateBauds[] = { SIM_BAUD, 115200 };
  const int numBauds = sizeof(candidateBauds) / sizeof(candidateBauds[0]);

  for (int b = 0; b < numBauds; b++) {

    Serial.begin(candidateBauds[b]);
    delay(300);

    bool found = false;

    // Boot time to first responding to AT varies by board/firmware, so
    // retry for a few seconds at this baud before giving up on it.
    for (int attempt = 0; attempt < 10 && !found; attempt++) {
      clearSIMBuffer();
      Serial.println("AT");
      found = waitForModuleOK(500);
    }

    if (!found) {
      continue;
    }

    if (candidateBauds[b] == SIM_BAUD) {
      return true;
    }

    // Found it at a baud we don't want to keep it at long-term — lock
    // it to SIM_BAUD.
    debugSerial.print("Module found at ");
    debugSerial.print(candidateBauds[b]);
    debugSerial.print(" — reconfiguring to ");
    debugSerial.println(SIM_BAUD);

    clearSIMBuffer();
    Serial.print("AT+IPR=");
    Serial.println(SIM_BAUD);
    delay(300);

    clearSIMBuffer();
    Serial.println("AT&W");
    delay(300);

    Serial.begin(SIM_BAUD);
    delay(300);

    clearSIMBuffer();
    Serial.println("AT");
    return waitForModuleOK(1000);
  }

  return false;
}

// =====================================================
// LOG SIM/NETWORK STATUS (diagnostic — SIM present, signal strength)
// =====================================================
void logModuleStatus() {

  clearSIMBuffer();
  Serial.println("AT+CPIN?");
  debugSerial.print("SIM status: ");
  debugSerial.println(readModuleLine(500));

  clearSIMBuffer();
  Serial.println("AT+CSQ");
  debugSerial.print("Signal quality: ");
  debugSerial.println(readModuleLine(500));
}

// =====================================================
// READ RAW RESPONSE FROM SIM MODULE (diagnostic helper)
// =====================================================
String readModuleLine(unsigned long timeoutMs) {

  unsigned long start = millis();
  String resp = "";

  while (millis() - start < timeoutMs) {
    while (Serial.available()) {
      resp += (char)Serial.read();
    }
  }

  return resp;
}
