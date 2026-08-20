#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>

// =====================================================
// LCD
// =====================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// =====================================================
// SIM800L
//
// SIM800L TXD -> UNO D0 / RX
// SIM800L RXD -> UNO D1 / TX
// SIM800L GND -> UNO GND
// SIM800L VCC -> 4.0 - 4.1V
//
// DO NOT connect SIM800L RX directly to 5V UNO TX.
// Use proper level shifting.
// =====================================================

// Hardware Serial
// D0 = RX
// D1 = TX

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

#define MOTOR_TIME 3000UL
#define PAYMENT_TIMEOUT 120000UL

// =====================================================
// VARIABLES
// =====================================================
int stock = 0;

float receivedAmount = 0;

unsigned long paymentStartTime = 0;

bool waitingForBalance = false;

// Coin
bool coinPulseActive = false;

unsigned long coinPulseStart = 0;
unsigned long lastCoinTime = 0;

// =====================================================
// SETUP
// =====================================================
void setup() {

  // ---------------------------------------------------
  // RELAY
  // ---------------------------------------------------
  pinMode(RELAY_PIN, OUTPUT);

  // MOTOR OFF
  digitalWrite(RELAY_PIN, LOW);

  // ---------------------------------------------------
  // COIN
  // ---------------------------------------------------
  pinMode(COIN_PIN, INPUT_PULLUP);

  // ---------------------------------------------------
  // RESET
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
  // LOAD STOCK
  // ---------------------------------------------------
  stock = EEPROM.read(EEPROM_ADDR);

  if (stock > MAX_STOCK) {

    stock = MAX_STOCK;

    EEPROM.update(
      EEPROM_ADDR,
      stock
    );
  }

  // ---------------------------------------------------
  // SIM800L
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SIM800L Starting");

  lcd.setCursor(0, 1);
  lcd.print("Please wait...");

  // Hardware serial
  Serial.begin(9600);

  delay(3000);

  // ---------------------------------------------------
  // INITIALIZE SIM800L
  // ---------------------------------------------------
  initializeSIM800L();

  delay(1000);

  // ---------------------------------------------------
  // IDLE
  // ---------------------------------------------------
  showIdleMessage();
}

// =====================================================
// LOOP
// =====================================================
void loop() {

  // ---------------------------------------------------
  // RESET
  // ---------------------------------------------------
  checkResetButton();

  // ---------------------------------------------------
  // COIN
  // ---------------------------------------------------
  checkCoin();

  // ---------------------------------------------------
  // SMS
  // ---------------------------------------------------
  checkSMS();

  // ---------------------------------------------------
  // PAYMENT TIMEOUT
  // ---------------------------------------------------
  if (waitingForBalance) {

    if (
      millis() - paymentStartTime >=
      PAYMENT_TIMEOUT
    ) {

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
// SIM800L INITIALIZATION
// =====================================================
void initializeSIM800L() {

  clearSIMBuffer();

  // ---------------------------------------------------
  // AT
  // ---------------------------------------------------
  Serial.println("AT");

  delay(1000);

  clearSIMBuffer();

  // ---------------------------------------------------
  // SMS TEXT MODE
  // ---------------------------------------------------
  Serial.println("AT+CMGF=1");

  delay(500);

  clearSIMBuffer();

  // ---------------------------------------------------
  // NEW SMS DIRECT NOTIFICATION
  // ---------------------------------------------------
  Serial.println(
    "AT+CNMI=1,2,0,0,0"
  );

  delay(500);

  clearSIMBuffer();

  // ---------------------------------------------------
  // SMS READY
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SIM800L Ready");

  lcd.setCursor(0, 1);
  lcd.print("Stock: ");
  lcd.print(stock);

  delay(1500);
}

// =====================================================
// COIN DETECTION
// =====================================================
void checkCoin() {

  int coinState =
    digitalRead(COIN_PIN);

  // ---------------------------------------------------
  // LOW = START
  // ---------------------------------------------------
  if (
    coinState == LOW &&
    !coinPulseActive
  ) {

    if (
      millis() - lastCoinTime >
      300
    ) {

      coinPulseActive = true;

      coinPulseStart = millis();
    }
  }

  // ---------------------------------------------------
  // HIGH = END
  // ---------------------------------------------------
  if (
    coinPulseActive &&
    coinState == HIGH
  ) {

    unsigned long pulseTime =
      millis() - coinPulseStart;

    coinPulseActive = false;

    lastCoinTime = millis();

    // -------------------------------------------------
    // VALID COIN PULSE
    // -------------------------------------------------
    if (
      pulseTime >= 10 &&
      pulseTime <= 2000
    ) {

      processPayment(5);
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

  unsigned long startTime =
    millis();

  // ---------------------------------------------------
  // READ MODEM DATA
  // ---------------------------------------------------
  while (
    millis() - startTime <
    1500
  ) {

    while (Serial.available()) {

      char c =
        Serial.read();

      // Keep printable characters
      if (
        c >= 32 &&
        c <= 126
      ) {

        sms += c;
      }

      startTime = millis();
    }
  }

  if (sms.length() == 0) {
    return;
  }

  // ---------------------------------------------------
  // UPPERCASE COPY
  // ---------------------------------------------------
  String check = sms;

  check.toUpperCase();

  // ---------------------------------------------------
  // YOUR PHONEPE SMS FORMAT
  //
  // received Rs.5 from ASIF AQBAL A
  // via PhonePe for txn T05022018215929483
  // ---------------------------------------------------

  bool hasPhonePe =
    check.indexOf("PHONEPE") >= 0;

  bool hasTransaction =
    check.indexOf("TXN") >= 0;

  bool hasRs5 =
    check.indexOf("RS.5") >= 0 ||
    check.indexOf("RS .5") >= 0 ||
    check.indexOf("RS 5") >= 0;

  // ---------------------------------------------------
  // VALID PHONEPE PAYMENT
  // ---------------------------------------------------
  if (
    hasPhonePe &&
    hasTransaction &&
    hasRs5
  ) {

    lcd.clear();

    lcd.setCursor(0, 0);
    lcd.print("UPI Payment");

    lcd.setCursor(0, 1);
    lcd.print("Rs.5 Received");

    delay(1000);

    processPayment(5);

  } else {

    // Ignore all other SMS
    return;
  }
}

// =====================================================
// PROCESS PAYMENT
// =====================================================
void processPayment(float amount) {

  // ---------------------------------------------------
  // STOCK CHECK
  // ---------------------------------------------------
  if (stock <= 0) {

    receivedAmount = 0;

    waitingForBalance = false;

    showOutOfStock();

    return;
  }

  // ---------------------------------------------------
  // ADD PAYMENT
  // ---------------------------------------------------
  receivedAmount += amount;

  // ---------------------------------------------------
  // FULL PAYMENT
  // ---------------------------------------------------
  if (
    receivedAmount >=
    PRODUCT_PRICE
  ) {

    // IMPORTANT:
    // Clear payment before dispensing
    receivedAmount = 0;

    waitingForBalance = false;

    dispenseItem();

    return;
  }

  // ---------------------------------------------------
  // PARTIAL PAYMENT
  // ---------------------------------------------------
  float remaining =
    PRODUCT_PRICE -
    receivedAmount;

  waitingForBalance = true;

  paymentStartTime =
    millis();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Paid Rs.");
  lcd.print(receivedAmount, 0);

  lcd.setCursor(0, 1);
  lcd.print("Pay Rs.");
  lcd.print(remaining, 0);
}

// =====================================================
// DISPENSE
// =====================================================
void dispenseItem() {

  // ---------------------------------------------------
  // SAFETY CHECK
  // ---------------------------------------------------
  if (stock <= 0) {

    digitalWrite(
      RELAY_PIN,
      LOW
    );

    showOutOfStock();

    return;
  }

  // ---------------------------------------------------
  // PAYMENT DISPLAY
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Payment Received");

  lcd.setCursor(0, 1);
  lcd.print("Dispensing...");

  delay(300);

  // ---------------------------------------------------
  // MOTOR ON
  // ---------------------------------------------------
  digitalWrite(
    RELAY_PIN,
    HIGH
  );

  unsigned long motorStart =
    millis();

  // ---------------------------------------------------
  // MOTOR RUN
  // ---------------------------------------------------
  while (
    millis() - motorStart <
    MOTOR_TIME
  ) {

    digitalWrite(
      RELAY_PIN,
      HIGH
    );

    delay(10);
  }

  // ---------------------------------------------------
  // MOTOR OFF
  // ---------------------------------------------------
  digitalWrite(
    RELAY_PIN,
    LOW
  );

  // ---------------------------------------------------
  // STOCK -
  // ---------------------------------------------------
  stock--;

  EEPROM.update(
    EEPROM_ADDR,
    stock
  );

  // ---------------------------------------------------
  // COLLECTION
  // ---------------------------------------------------
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Please Collect");

  lcd.setCursor(0, 1);
  lcd.print("The Napkin");

  delay(3000);

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
// RESET / REFILL
// =====================================================
void checkResetButton() {

  if (
    digitalRead(RESET_PIN) ==
    LOW
  ) {

    // -------------------------------------------------
    // REFILL
    // -------------------------------------------------
    stock = MAX_STOCK;

    EEPROM.update(
      EEPROM_ADDR,
      stock
    );

    // -------------------------------------------------
    // CANCEL PAYMENT
    // -------------------------------------------------
    receivedAmount = 0;

    waitingForBalance = false;

    // -------------------------------------------------
    // MOTOR OFF
    // -------------------------------------------------
    digitalWrite(
      RELAY_PIN,
      LOW
    );

    lcd.clear();

    lcd.setCursor(0, 0);
    lcd.print("Stock Refilled");

    lcd.setCursor(0, 1);
    lcd.print("Stock: ");
    lcd.print(stock);

    delay(2000);

    showIdleMessage();

    // -------------------------------------------------
    // WAIT FOR RELEASE
    // -------------------------------------------------
    while (
      digitalRead(RESET_PIN) ==
      LOW
    ) {

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
// CLEAR SIM800L BUFFER
// =====================================================
void clearSIMBuffer() {

  while (Serial.available()) {

    Serial.read();
  }
}