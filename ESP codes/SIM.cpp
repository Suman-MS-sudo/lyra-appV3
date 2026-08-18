#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>
#include <SoftwareSerial.h>
#include <avr/wdt.h>

// LCD setup
LiquidCrystal_I2C lcd(0x27, 16, 2);

// SIM800L pins
#define RX_PIN 7   // SIM800L TX → Arduino RX
#define TX_PIN 8   // SIM800L RX → Arduino TX 
SoftwareSerial sim800L(RX_PIN, TX_PIN);

// Relay and inputs
#define RELAY_PIN 6
#define COIN_PIN 2
#define RESET_PIN 4

// EEPROM
#define EEPROM_ADDR 0
#define MAX_STOCK 25

// Globals
String smsBuffer;
float receivedAmount = 0;
unsigned long startTime = 0;
bool waitingForBalance = false;
int stock = 0;

// COIN_PIN debounce/edge-detection state. Idle level is HIGH now (see
// INPUT_PULLUP in setup()) — a pulse coin acceptor's pulse output is
// open-collector, normally floating/pulled HIGH and pulling LOW during an
// actual pulse, so the pull-up gives the pin a real, defined idle state
// instead of floating with no idle state at all. That matters even with
// nothing physically wired to the pin: a fully floating INPUT (no pull
// resistor either way) can pick up ambient EMI and settle on a stable-but-
// wrong level for far longer than any debounce window, which is what was
// vending product with zero coin/QR activity — not just brief noise
// glitches, which the debounce below still separately guards against.
int lastCoinState = HIGH;
unsigned long lastCoinChangeTime = 0;
#define COIN_DEBOUNCE_MS 50

bool waitForResponse();

void setup() {
    // If the board ever genuinely locks up (as opposed to the brownout-reset
    // loop this was seeing — see the SIM800L init comment below), this
    // forces an automatic recovery after 8s of no wdt_reset() instead of
    // needing someone to notice and power-cycle it by hand. Every long
    // delay() in this sketch is comfortably under that, and loop()/
    // dispenseItem() feed it explicitly around their longer delay() calls.
    wdt_enable(WDTO_8S);

    pinMode(RELAY_PIN, OUTPUT);
    pinMode(COIN_PIN, INPUT_PULLUP);
    pinMode(RESET_PIN, INPUT_PULLUP);
    digitalWrite(RELAY_PIN, LOW);

    lcd.init();
    lcd.backlight();

    // Load stock from EEPROM
    stock = EEPROM.read(EEPROM_ADDR);
    if (stock > MAX_STOCK) stock = MAX_STOCK;

    showIdleMessage();

    // Serial debug
    Serial.begin(9600);

    // SIM800L init. Two "Initializing SIM800L..." lines with nothing after
    // means the board itself reset mid-handshake, not that this loop hung —
    // the SIM800L can pull up to ~2A during network search/registration,
    // and if it shares a weak supply rail with the Arduino (USB power, a
    // small linear regulator) that current spike sags the rail enough to
    // brown the MCU out right as it's talking to the module. That's a
    // power-supply issue (dedicated ~2A-capable supply for the SIM800L +
    // a large low-ESR cap, e.g. 1000-2200uF, directly across its VCC/GND)
    // that no amount of retry logic here can fix — but the old code also
    // never actually checked whether the module responded "OK" before
    // moving on, so a module that was still booting (e.g. right after a
    // brownout) got silently left unconfigured for SMS. This now retries a
    // few times and reports clearly if it never comes up, instead of
    // pretending it succeeded.
    sim800L.begin(9600);
    Serial.println("Initializing SIM800L...");
    bool simReady = false;
    for (uint8_t attempt = 0; attempt < 5 && !simReady; attempt++) {
        wdt_reset();
        sim800L.println("AT");
        simReady = waitForResponse();
        if (!simReady) delay(500);
    }

    if (simReady) {
        sim800L.println("AT+CMGF=1"); // SMS text mode
        waitForResponse();
        sim800L.println("AT+CNMI=1,2,0,0,0"); // New SMS notify
        waitForResponse();
        Serial.println("SIM800L ready");
    } else {
        Serial.println("SIM800L not responding after 5 attempts — QR/SMS payments unavailable, coin still works");
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("SIM800L Error");
        delay(2000);
        showIdleMessage();
    }
}

void loop() {
    wdt_reset();

    // Reset stock
    if (digitalRead(RESET_PIN) == LOW) {
        stock = MAX_STOCK;
        EEPROM.write(EEPROM_ADDR, stock);
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Stock Refilled");
        delay(2000);
        showIdleMessage();
    }

    // Coin input — edge-triggered with debounce, not a raw level poll.
    // The old `if (digitalRead(COIN_PIN) == HIGH)` fired on every loop
    // iteration the pin happened to read HIGH (including a floating pin
    // with no defined idle level at all — see the COIN_PIN comment above),
    // and the blocking delay(500) afterward stalled SMS reading and the
    // reset button for half a second on every trigger, real or not. Idle
    // is HIGH (pull-up) now, so a coin pulse is a LOW level, and only a
    // HIGH-to-LOW transition that stays low past the debounce window counts.
    int coinState = digitalRead(COIN_PIN);
    if (coinState != lastCoinState) {
        lastCoinChangeTime = millis();
    }
    if ((millis() - lastCoinChangeTime) > COIN_DEBOUNCE_MS) {
        if (coinState == LOW && lastCoinState == HIGH) {
            processPayment(5.0); // Coin always Rs.5
        }
    }
    lastCoinState = coinState;

    // SMS input
    while (sim800L.available()) {
        smsBuffer = sim800L.readString();
        Serial.println("Raw SMS Data:");
        Serial.println(smsBuffer);

        float amount = extractAmount(smsBuffer);
        if (amount > 0) {
            processPayment(amount);
        }
    }

    // Timeout for partial payments
    if (waitingForBalance && (millis() - startTime > 120000)) {
        Serial.println("Balance timeout. Resetting.");
        receivedAmount = 0;
        waitingForBalance = false;
    }
}

void processPayment(float amount) {
    receivedAmount += amount;
    Serial.print("Total received: Rs. ");
    Serial.println(receivedAmount);

    if (receivedAmount >= 5) {
        dispenseItem();
        receivedAmount = 0;
        waitingForBalance = false;
    } else if (!waitingForBalance) {
        waitingForBalance = true;
        startTime = millis();
        Serial.println("Waiting for remaining balance...");
    }
}

float extractAmount(String message) {
    // Require a payment-confirmation keyword alongside the amount — without
    // this, ANY incoming GSM text containing e.g. "Rs.5" (a balance-check
    // reply, a promotional SMS, a misc network notification) was treated as
    // a real payment. UPI/bank credit SMS consistently include one of these
    // words, so this filters out everything else without needing to know
    // the exact sender/template in advance.
    String lower = message;
    lower.toLowerCase();
    bool looksLikePayment = lower.indexOf("credited") != -1 ||
                             lower.indexOf("received") != -1 ||
                             lower.indexOf("paid") != -1;
    if (!looksLikePayment) return 0;

    if (message.indexOf("Rs.5") != -1 || message.indexOf("INR 5") != -1) return 5.0;
    if (message.indexOf("Rs.4") != -1 || message.indexOf("INR 4") != -1) return 4.0;
    if (message.indexOf("Rs.3") != -1 || message.indexOf("INR 3") != -1) return 3.0;
    if (message.indexOf("Rs.2") != -1 || message.indexOf("INR 2") != -1) return 2.0;
    if (message.indexOf("Rs.1") != -1 || message.indexOf("INR 1") != -1) return 1.0;
    return 0;
}

void dispenseItem() {
    if (stock <= 0) {
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Out of Stock!");
        Serial.println("Cannot vend: stock empty.");
        delay(3000);
        showIdleMessage();
        return;
    }

    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Payment Received");
    Serial.println("Dispensing...");

    digitalWrite(RELAY_PIN, HIGH);
    delay(3000);
    digitalWrite(RELAY_PIN, LOW);
    wdt_reset();

    stock--;
    EEPROM.write(EEPROM_ADDR, stock);

    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Please Collect");
    lcd.setCursor(0,1);
    lcd.print("The Napkin");
    delay(3000);
    wdt_reset();

    showIdleMessage();
}

void showIdleMessage() {
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Lyra Enterprises");
    lcd.setCursor(0,1);
    lcd.print("Stock: ");
    lcd.print(stock);
}

bool waitForResponse() {
    delay(500);
    String response = "";
    while (sim800L.available()) {
        response += (char)sim800L.read();
    }
    Serial.println(response);
    return response.indexOf("OK") != -1;
}
