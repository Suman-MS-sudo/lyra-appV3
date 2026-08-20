// ESP32 firmware for Lyra vending machine — RFID-ONLY payment mode
// BODY TYPE: SINGLE MOTOR — 35 napkin capacity, one dispenser
//
// Same payment flow and architecture as the quad-motor variant, with a
// single dispenser instead of 4 (no round-robin — one motor, one stock
// counter).
//
// Hardware:
//   RFID reader: MFRC522, SS=GPIO27, RST=GPIO15, shared SPI bus (SCK18/MISO19/MOSI23)
//   Display: HW-61 1602A LCD (16x2, PCF8574 I2C backpack), SDA=GPIO21, SCL=GPIO22,
//            I2C addr 0x27 (try 0x3F if blank)
//   Library: "LiquidCrystal I2C" by Frank de Brabander (install via Library Manager)
//   Motor: single dispenser on GPIO5 via transistor/relay
//
// ESP32-specific optimizations applied:
//   - EEPROM.begin() called exactly once at boot, not per read/write.
//   - JSON payloads built into pre-reserved String buffers instead of
//     unbounded chained concatenation, to reduce heap fragmentation.
//
// Ethernet (LAN) support: ported from IOT_Wifi_LAN's coin/Ethernet firmware.
// This machine is Ethernet-ONLY — there is no WiFi fallback. Boot doesn't
// block waiting for the cable/DHCP; it proceeds into loop() regardless and
// keeps retrying Ethernet in the background (checkForEthernetRecovery()).
// UIPEthernet can't do TLS, so all API calls go through the plain-HTTP
// proxy (ETHERNET_SERVER_BASE, port 8080 in dev / lyra-app.co.in:8080 in
// prod). See the ETHERNET_CS comment near the pin definitions for the CS
// pin caveat.
//
// Offline RFID dispensing: since the machine can be Ethernet-only with no
// fallback transport, it keeps a local LittleFS cache of the RFID cards
// valid for it (synced down from GET /api/machine-cards-sync whenever
// connected) so it can keep validating taps and dispensing product while
// the network is down, and queues the resulting transactions
// (/queue.jsonl) to push to POST /api/rfid-payment/offline-sync the moment
// it reconnects. See handleOfflineRfidTap()/syncCardsFromServer()/
// syncQueueToServer() below. Known, accepted limitation: the same prepaid
// card tapped offline on two different machines (or past its credit limit
// twice before either syncs) can overspend past its true balance — there's
// no distributed consensus here, the server just clamps and logs the
// shortfall for admin visibility on reconciliation.

#include <WiFi.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <LittleFS.h>
#include <esp_wifi.h>
#include <esp_random.h>  // esp_random(), used to seed bootId each boot (see queueOfflineTransaction()/syncQueueToServer())
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <esp_task_wdt.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Ethernet — module: HANRUN HR911105A (ENC28J60-based), shares the
// RFID/LCD SPI bus (SCK18/MISO19/MOSI23) via its own CS line. This is the
// machine's only network transport (no WiFi fallback) — USE_ETHERNET stays
// defined unconditionally; the #ifdef scaffolding below is left in place
// only because it was already proven out this way, not because WiFi-only
// builds are a supported option anymore.
#define USE_ETHERNET
#ifdef USE_ETHERNET
// REQUIRES library-side fixes (none of these can be done from the sketch
// with a #define — each lives in a separately-compiled library .cpp/.h, so
// a sketch-level macro never reaches the #ifndef guards below). Reapply all
// three if the UIPEthernet library is ever reinstalled/updated, or this
// firmware WILL go back to hanging at boot on flaky/absent Ethernet:
//   1. utility/Enc28J60Network.cpp, Enc28J60Network::sendPacket(): the
//      `while (((eir = readReg(EIR)) & (EIR_TXIF | EIR_TXERIF)) == 0);`
//      TX-complete wait (and the DMA-complete wait a bit further down) had
//      NO timeout at all — if the chip ever failed to raise either bit
//      (cable pulled mid-send, flaky PHY), the MCU hung forever on the very
//      first packet send (e.g. the first DHCP DISCOVER), freezing the LCD
//      on the boot splash and leaving RFID taps unanswered since loop()
//      never starts. Both now bail out after 1000ms.
//   2. Dhcp.h: DHCP_TIMEOUT defaulted to 60000ms — Ethernet.begin(mac)
//      blocks for up to that long, per attempt, whenever no DHCP server
//      responds. Combined with this sketch's own 2-attempt x 5-outer-retry
//      loop, a dead network could look hung for ~10 minutes. Lowered to
//      5000ms to match the timeout this sketch's own post-begin() IP-check
//      loop already assumes.
//   3. utility/uipethernet-conf.h: UIP_CONNECT_TIMEOUT defaulted to -1,
//      which compiles out UIPClient::connect()'s own bounded wait and lets
//      EthernetClient::connect() spin until uIP's internal TCP retransmit
//      timers close the connection — seen hanging indefinitely on
//      "Connecting to <host>..." with no OK/Failed ever printed. Set to 5
//      (seconds).
#include <UIPEthernet.h>
#endif

// ==================== FIRMWARE VERSION ====================
#define CURRENT_FIRMWARE_VERSION "RFID-SINGLE-V2.0.0"
#define BODY_TYPE "single_motor"

// ==================== WATCHDOG CONFIGURATION ====================
#define WDT_TIMEOUT 1800  // seconds (30 minutes)

// ==================== PIN DEFINITIONS ====================
#define EEPROM_SIZE 256
#define TRANSISTOR_BASE 5
#define BLUE_LED_PIN 2
#define RESET_PIN 13   // GPIO21 is taken by the LCD's I2C SDA

// RFID reader (MFRC522)
#define RFID_SS   27
#define RFID_RST  15
#define SPI_SCK   18
#define SPI_MISO  19
#define SPI_MOSI  23

// LCD (HW-61 1602A over I2C)
#define LCD_SDA      21
#define LCD_SCL      22
#define LCD_I2C_ADDR 0x27   // try 0x3F if blank

// Ethernet module CS line. NOTE: unlike the coin-machine PCB (CS hardwired
// to GPIO22), this RFID board has never carried an Ethernet module before —
// GPIO22 is already taken by the LCD's I2C SCL here, so it can't be reused.
// GPIO17 is free on this variant; verify it matches your actual wiring
// before flashing a board that has the Ethernet module attached (use the
// "scan-eth" serial command to find the right pin if unsure).
#ifdef USE_ETHERNET
#define ETHERNET_CS 17
#endif

// ==================== CAPACITY ====================
#define MAX_STOCK 35   // single-motor body: 35-napkin hopper

// EEPROM: single stock byte at address 64 (see EEPROM FUNCTIONS below for
// why 0-3 are used for something else now)
#define MOTOR1_ADDR 64

MFRC522 rfid(RFID_SS, RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// ==================== GLOBAL VARIABLES ====================
String deviceMacAddress;
String machineId = "UNKNOWN";
String machineName = "UNKNOWN";
String defaultProductId = "";
unsigned long lastPingTime = 0;
bool rfidHardwarePresent = false;
bool rfidFaultLogged = false;
// rfidFaultLogged latches true on the first failure and would otherwise
// silence every message after it (see reinitializeRfidReader()/
// tryReadTapUid() below) — this instead re-announces an ongoing fault every
// few seconds so taps attempted while the reader is down aren't silent.
unsigned long lastRfidFaultPrint = 0;
#define RFID_FAULT_LOG_INTERVAL 5000

// Counts consecutive PICC_ReadCardSerial()/empty-UID failures in
// tryReadTapUid() (see there). A card that was just tapped and is still
// physically resting on the reader can spuriously re-trigger
// PICC_IsNewCardPresent() even though it's halted (REQA occasionally still
// gets a response from some cards/clones despite HALT) — reading it then
// fails because it really is halted. A single such blip is normal and
// harmless; only repeated failures in a row indicate an actual stuck
// reader worth a hard reset. See tryReadTapUid().
uint8_t consecutiveRfidReadFailures = 0;
#define RFID_READ_FAILURE_RESET_THRESHOLD 3

// Throttles how often hitting the threshold above is actually allowed to
// trigger a hard reset (see tryReadTapUid()). Without this, a persistently
// flaky read (weak/marginal antenna signal, EM noise on the shared SPI bus,
// a card left resting right at the edge of range) hits the 3-failure
// threshold again almost immediately after every reset — resets happen at
// the fast 150ms poll rate (RFID_POLL_INTERVAL_HEALTHY; a hard reset alone
// doesn't slow the poll down, only an actual VersionReg failure does), so
// it can spam "resetting RFID" continuously without ever settling. Capping
// resets to at most once per cooldown window still lets a failing card be
// retried every poll in between (via the cheap halt-only branch), just
// without the expensive hard reset hammering the antenna field nonstop.
unsigned long lastRfidReadFailureReset = 0;
#define RFID_READ_FAILURE_RESET_COOLDOWN 3000

// Tap-polling cadence in loop() — two speeds, chosen each cycle from
// rfidHardwarePresent (set by reinitializeRfidReader()/tryReadTapUid()):
// fast while the reader is known-healthy, so a tap registers almost
// immediately instead of waiting up to a second and a half; slow whenever
// it isn't, so a broken/absent reader doesn't get reinitializeRfidReader()
// (a multi-hundred-ms operation with its own internal retries) hammered
// back-to-back every poll.
#define RFID_POLL_INTERVAL_HEALTHY 150
#define RFID_POLL_INTERVAL_UNHEALTHY 1500

// The MFRC522 has been observed to silently stop responding to
// PICC_RequestA (i.e. rfid.PICC_IsNewCardPresent() never returns true
// again for any card) after a long idle period, with no error anywhere —
// SPI communication, networking, and everything else in loop() keeps
// working fine the whole time. PCD_Init() is a cheap soft reset (a handful
// of register writes, no meaningful blocking delay when the reader isn't
// already held in hardware power-down), so re-running it periodically as a
// background "keep-alive" is a safe, standard fix for this MFRC522
// behavior rather than requiring a manual reboot to recover.
unsigned long lastRfidReinit = 0;
#define RFID_REINIT_INTERVAL 300000  // 5 minutes

// Idle-display rotation: while ready and untouched, the LCD alternates
// between the "Tap Card" prompt and the current stock count so an operator
// can see the hopper level at a glance. Driven from loop() via
// updateIdleDisplay(), never via delay(), so it never blocks RFID polling.
enum MachineStatus { STATUS_READY, STATUS_OUT_OF_STOCK, STATUS_NETWORK_ERROR };
MachineStatus currentStatus = STATUS_NETWORK_ERROR;
uint8_t idleScreenIndex = 0;
unsigned long lastIdleScreenChange = 0;
#define IDLE_SCREEN_INTERVAL 3000  // ms each idle screen is shown

bool useEthernet = false;
bool ethernetConnected = false;
#ifdef USE_ETHERNET
// Each ESP32 has a unique factory-assigned WiFi radio MAC, already read
// into deviceMacAddress by getMACAddress() before this is ever used —
// deriveEthernetMAC() (below) copies those same 6 bytes in here instead of
// a hardcoded placeholder that used to be identical on every device (a
// real collision risk once multiple machines share a LAN segment). WiFi
// itself is never started/joined in this Ethernet-only build, so there's
// no risk of both interfaces appearing on the network under the same
// address.
byte ethernetMAC[6] = { 0, 0, 0, 0, 0, 0 };
EthernetClient ethClient;
unsigned long lastEthernetRecoveryCheck = 0;
// Ethernet is this machine's only transport, so while it's down this
// periodically re-probes for it via the same initializeEthernet() used at
// boot, and reconnects automatically the moment it succeeds. Interval is a
// tradeoff: initializeEthernet() blocks for several seconds (hardware
// detect + a real DHCP attempt, the only reliable way to test a LAN since
// the ENC28J60's linkStatus() is known-unreliable — see the comment in
// initializeEthernet()), so checking too often would repeatedly stall RFID
// tap polling for no benefit.
#define ETHERNET_RECOVERY_CHECK_INTERVAL 300000  // 5 minutes
#endif

// UIPEthernet can't do TLS, so all requests go through the plain-HTTP
// proxy instead. TESTING_LOCAL points this at a dev machine's own
// "npm run dev" proxy (scripts/proxy-server.mjs, port 8080) so fixes can be
// tested without needing production server access — only enable it for a
// machine actually being bench-tested against a local server.
#define TESTING_LOCAL
#ifdef TESTING_LOCAL
String ETHERNET_SERVER_BASE = "http://192.168.29.33:8080";
#else
String ETHERNET_SERVER_BASE = "http://lyra-app.co.in:8080";
#endif

// ==================== OFFLINE CARD CACHE / SYNC QUEUE ====================
// See the file-header comment for the overall design. cardsCache mirrors
// /cards.json on LittleFS (synced down from the server whenever connected);
// mutations made offline (credit deductions, postpaid tallies) are applied
// to both the in-RAM doc and the file immediately, so they survive a
// reboot mid-outage. Each queued transaction's tap time is tagged with a
// wall-clock epoch (not a boot-relative millis() value), so it stays
// accurate even across a reboot mid-outage — see the WALL-CLOCK TIME
// section below and syncQueueToServer().
#define CARDS_CACHE_DOC_SIZE 16384
DynamicJsonDocument cardsCache(CARDS_CACHE_DOC_SIZE);
bool cardsCacheLoaded = false;
// Regenerated fresh every boot. tap_epoch (below) is the primary way a
// queued tap's timestamp survives a reboot, but a tap can still happen
// before THIS boot has ever managed to sync time even once (e.g. right at
// boot, before Ethernet finishes connecting) — bootId lets syncQueueToServer()
// recognize "this line was queued in the boot session I'm still in" and
// recover an accurate timestamp via the millis() delta instead, if time
// has since been synced later in that same session. See both functions.
uint32_t bootId = 0;
#define MAX_QUEUE_ENTRIES 50
#define CARD_SYNC_DOWN_INTERVAL 600000  // 10 minutes, while connected

// ==================== WALL-CLOCK TIME (survives reboots) ====================
// ESP32 has no battery-backed RTC, and this machine can't use NTP (UIPEthernet
// implements its own uIP stack, separate from the ESP-IDF LWIP/SNTP subsystem
// configTime()/sntp rely on). So wall-clock time is approximated as an
// "estimated boot epoch" — the Unix epoch that millis()==0 corresponds to for
// THIS boot session — refreshed from GET /api/time on every successful
// (re)connect and persisted to LittleFS so it survives a reboot. A machine
// that reboots mid-outage (the common case — see the file-header comment)
// still has a reasonably accurate anchor carried over from its last known
// connection, instead of losing all sense of time the moment millis() resets.
// currentEpoch() returns 0 until the very first successful sync (e.g. a
// brand new, never-been-online machine) — callers must treat 0 as "unknown".
#define TIME_ANCHOR_FILE "/time_anchor.txt"
long estimatedBootEpoch = 0;  // Unix epoch corresponding to millis()==0 this boot; 0 = unknown

// ==================== FORWARD DECLARATIONS ====================
String fetchMachineInfoFromBackend(const String& mac);
void fetchMachineProducts();
bool dispenseProductByMotor(String productId = "");
void voidRfidPayment(const String& paymentId);
void sendMachineStatusPing();
bool isNetworkConnected();
String extractJsonFromString(const String &s);
void lcdMsg(const String& line0, const String& line1 = "");
void sendStockAwareStatus();
void sendStockAwareErrorStatus();
void updateIdleDisplay();
void initializeWatchdog();
void feedWatchdog();
int makeHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* responseBody = nullptr);
void handleRfidTap(const String& uid);
void handleOfflineRfidTap(const String& uid);
String apiUrl(const String& path);
bool initializeEthernet(bool fastProbe = false);
void rfidRawBitBangTest();
void deriveEthernetMAC();
bool loadCardsCacheFromFS();
bool saveCardsCacheToFS();
void loadDefaultProductFromFS();
void saveDefaultProductToFS();
bool syncCardsFromServer();
void queueOfflineTransaction(const String& uid, const String& productId);
void syncQueueToServer();
void loadTimeAnchorFromFS();
void saveTimeAnchorToFS();
bool syncTimeFromServer();
long currentEpoch();
#ifdef USE_ETHERNET
int makeEthernetHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* outBody = nullptr);
void checkEthernetLinkStatus();
void checkForEthernetRecovery();
void printEthernetDiagnostics();
void scanEthernetPins();
void resetEthernetModule();
#endif

// ==================== HELPER FUNCTIONS ====================

String urlEncode(const String &str) {
    String encoded;
    encoded.reserve(str.length() * 3);
    const char *hex = "0123456789ABCDEF";
    for (size_t i = 0; i < str.length(); ++i) {
        char c = str[i];
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') {
            encoded += c;
        } else {
            encoded += '%';
            encoded += hex[(c >> 4) & 0xF];
            encoded += hex[c & 0xF];
        }
    }
    return encoded;
}

String extractJsonFromString(const String &s) {
    int objStart = s.indexOf('{');
    int objEnd = s.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) return s.substring(objStart, objEnd + 1);
    int arrStart = s.indexOf('[');
    int arrEnd = s.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) return s.substring(arrStart, arrEnd + 1);
    return String("");
}

// UIPEthernet can't do TLS, so every request goes through the plain-HTTP
// proxy — there's only one transport now, so this just prepends it.
String apiUrl(const String& path) {
    return ETHERNET_SERVER_BASE + path;
}

void reinitializeRfidReader() {
    pinMode(RFID_SS, OUTPUT);
    digitalWrite(RFID_SS, HIGH);
    pinMode(RFID_RST, OUTPUT);

#ifdef USE_ETHERNET
    pinMode(ETHERNET_CS, OUTPUT);
    digitalWrite(ETHERNET_CS, HIGH);
#endif

    // A brief 20ms RST pulse only recovers the MFRC522 from a clean soft
    // fault. When the dispense motor's inrush/back-EMF sags the shared
    // 3.3V rail enough to brown out the reader mid-operation, it can come
    // back needing a longer power-down hold and settle time before it
    // responds to SPI again — so retry a few times here with a longer
    // hold/settle instead of relying on the next scheduled call (every
    // 1.5s from tryReadTapUid()) to eventually get lucky with the same
    // too-short pulse.
    byte version = 0xFF;
    for (uint8_t attempt = 0; attempt < 3; attempt++) {
        digitalWrite(RFID_RST, LOW);
        delay(100);
        digitalWrite(RFID_RST, HIGH);
        delay(100);

        SPI.end();
        delay(20);
        SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RFID_SS);
        SPI.setBitOrder(MSBFIRST);
        SPI.setDataMode(SPI_MODE0);
        // Dropped from 500kHz to 250kHz — doubles the per-bit timing margin
        // against electrical noise on the SPI lines. This is a real, if
        // modest, improvement for borderline signal-integrity cases, but it
        // cannot compensate for an actual voltage sag/brownout during a
        // transaction — only a proper power supply fixes that.
        SPI.setFrequency(250000);
        rfid.PCD_Init();
        delay(100);
        rfid.PCD_AntennaOn();
        rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);

        version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
        if (version != 0x00 && version != 0xFF) break;
        feedWatchdog();
        delay(100);
    }

    rfidHardwarePresent = (version != 0x00 && version != 0xFF);
    if (!rfidHardwarePresent) {
        if (millis() - lastRfidFaultPrint > RFID_FAULT_LOG_INTERVAL) {
            Serial.printf("MFRC522 version register after reset: 0x%02X -> no reader attached or SPI bus is conflicted\n", version);
            lastRfidFaultPrint = millis();
        }
        rfidFaultLogged = true;
    } else {
        rfidFaultLogged = false;
    }
}

// Bypasses both the SPI peripheral and the MFRC522 library — drives SCK/SS/
// MOSI by hand with plain digitalWrite() and samples MISO with digitalRead()
// between clock edges. Used only as a "diag" tool from the serial console
// (command "rfid-raw") when the version register never comes back valid
// despite good wiring continuity: it tells us whether MISO is truly dead
// (stuck at one level no matter what) versus alive but returning garbage
// (which points at MOSI/MISO being swapped at the connector, or a damaged
// MFRC522 chip rather than a wiring fault).
void rfidRawBitBangTest() {
    Serial.println("\n=== RAW BIT-BANG SPI TEST (bypasses SPI peripheral + library) ===");

    SPI.end();
    delay(20);

    pinMode(SPI_SCK, OUTPUT);
    pinMode(SPI_MOSI, OUTPUT);
    pinMode(SPI_MISO, INPUT);
    pinMode(RFID_SS, OUTPUT);

    digitalWrite(SPI_SCK, LOW);
    digitalWrite(SPI_MOSI, LOW);
    digitalWrite(RFID_SS, HIGH);
    delay(5);

    // MFRC522 read command for VersionReg (register 0x37):
    // ((0x37 << 1) & 0x7E) | 0x80 = 0xEE
    const byte cmd = 0xEE;
    byte response = 0;
    bool misoToggled = false;
    bool lastMiso = digitalRead(SPI_MISO);

    digitalWrite(RFID_SS, LOW);
    delayMicroseconds(10);

    for (int i = 7; i >= 0; i--) {
        digitalWrite(SPI_MOSI, (cmd >> i) & 0x01);
        delayMicroseconds(10);
        digitalWrite(SPI_SCK, HIGH);
        delayMicroseconds(10);
        digitalWrite(SPI_SCK, LOW);
        delayMicroseconds(10);
    }

    for (int i = 7; i >= 0; i--) {
        digitalWrite(SPI_MOSI, LOW);
        delayMicroseconds(10);
        digitalWrite(SPI_SCK, HIGH);
        delayMicroseconds(5);
        bool bit = digitalRead(SPI_MISO);
        if (bit != lastMiso) misoToggled = true;
        lastMiso = bit;
        response = (response << 1) | (bit ? 1 : 0);
        delayMicroseconds(5);
        digitalWrite(SPI_SCK, LOW);
        delayMicroseconds(10);
    }

    digitalWrite(RFID_SS, HIGH);

    Serial.printf("Sent raw command 0x%02X (read VersionReg), raw MISO response: 0x%02X\n", cmd, response);
    if (!misoToggled) {
        Serial.println("MISO NEVER changed state across 8 clock edges -> the line is stuck, not connected to a live "
                        "chip output. Re-check continuity specifically on the MISO wire end-to-end, and confirm it "
                        "lands on the MFRC522's actual MISO pin (not a mislabeled/adjacent pin on the breakout).");
    } else if (response == 0xFF || response == 0x00) {
        Serial.println("MISO is toggling but the byte still came back all-1s/all-0s -> likely still not talking to a "
                        "real MFRC522 on this line. Double-check SCK/MOSI aren't swapped with each other or with MISO.");
    } else {
        Serial.println("MISO is toggling AND returned a non-boundary byte -> something IS responding on this bus. "
                        "If this doesn't match a known-good MFRC522 version byte (commonly 0x91/0x92/0xB2), suspect "
                        "MOSI/MISO reversed at the connector, or a damaged/counterfeit module.");
    }

    // Hand the bus back to the normal SPI peripheral + library for the rest of the sketch.
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RFID_SS);
    SPI.setBitOrder(MSBFIRST);
    SPI.setDataMode(SPI_MODE0);
    SPI.setFrequency(250000);
    rfid.PCD_Init();
    Serial.println("================================================================\n");
}

// ==================== EEPROM FUNCTIONS ====================
// EEPROM.begin() is called once in setup() — these helpers assume the
// buffer is already resident and only call commit() after a write.
//
// Bytes 0-3: a monotonic counter for generating client_tx_id values for
// offline-queued transactions (see generateClientTxId() below) — this
// address range used to hold WiFi credentials before this machine went
// Ethernet-only, and is free now.

uint32_t readTxCounter() {
    uint32_t v;
    EEPROM.get(0, v);
    if (v == 0xFFFFFFFF) v = 0;  // uninitialized EEPROM
    return v;
}

void writeTxCounter(uint32_t v) {
    EEPROM.put(0, v);
    EEPROM.commit();
}

int readMotorStockFromEEPROM() {
    int count = EEPROM.read(MOTOR1_ADDR);
    // Only treat 0xFF (uninitialized EEPROM) as invalid; 0 is a valid stock level
    if (count == 0xFF || count > MAX_STOCK) count = 0;
    return count;
}

void writeMotorStockToEEPROM(int count) {
    EEPROM.write(MOTOR1_ADDR, count);
    EEPROM.commit();
}

void refillStock() {
    EEPROM.write(MOTOR1_ADDR, MAX_STOCK);
    EEPROM.commit();
}

// Syncs stock to the backend — best-effort, no retry (see the call sites'
// comments for why that's fine: makeHTTPRequest() short-circuits instantly
// when offline, and any drops during an outage get reconciled once the
// offline queue drains — see syncQueueToServer()).
void syncTotalStockToServer(String productId = "") {
    int stock = readMotorStockFromEEPROM();
    Serial.printf("Stock: %d\n", stock);

    if (productId.length() > 0 && machineId != "UNKNOWN" && machineId.length() > 0) {
        String payload;
        payload.reserve(160);
        payload = "{\"machine_id\":\"" + machineId + "\",\"product_id\":\"" + productId +
                  "\",\"quantity\":" + String(stock) + ",\"mode\":\"set\"}";
        makeHTTPRequest(apiUrl("/api/update-product-stock"), "POST", payload);
    }
}

void initializeWatchdog() {
    Serial.println("Initializing Watchdog Timer (" + String(WDT_TIMEOUT / 60) + " min timeout)...");
    esp_task_wdt_deinit();
    delay(100);
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = WDT_TIMEOUT * 1000,
        .idle_core_mask = 0,
        .trigger_panic = true
    };
    esp_task_wdt_init(&wdt_config);
    esp_task_wdt_add(NULL);
    Serial.println("Watchdog Timer active");
}

void feedWatchdog() { esp_task_wdt_reset(); }

// ==================== OFFLINE CARD CACHE / SYNC QUEUE FUNCTIONS ====================
// See the file-header comment and the GLOBAL VARIABLES section above for
// the overall design. cardsCache always mirrors what's on disk (mutations
// are written straight through, never held in RAM-only) so a reboot
// mid-outage never loses a credit deduction that already happened.

JsonObject findCachedCard(const String& uid) {
    if (!cardsCacheLoaded || !cardsCache.containsKey("cards")) return JsonObject();
    JsonArray cards = cardsCache["cards"];
    for (JsonObject c : cards) {
        if (String(c["uid"].as<const char*>()).equalsIgnoreCase(uid)) return c;
    }
    return JsonObject();
}

bool saveCardsCacheToFS() {
    File f = LittleFS.open("/cards.json.tmp", "w");
    if (!f) {
        Serial.println("Failed to open cards.json.tmp for writing");
        return false;
    }
    if (serializeJson(cardsCache, f) == 0) {
        Serial.println("Failed to write card cache");
        f.close();
        LittleFS.remove("/cards.json.tmp");
        return false;
    }
    f.close();
    LittleFS.remove("/cards.json");
    return LittleFS.rename("/cards.json.tmp", "/cards.json");
}

// Persists defaultProductId across boots. Without this, a machine that
// goes offline before its first successful fetchMachineProducts() call in
// a given boot session has no product ID to fall back on for an offline
// tap on a card that isn't itself tied to a specific product — the tap
// still physically dispenses (dispenseProductByMotor() doesn't need a
// product ID), but the queued transaction ends up with an empty
// product_id that the server can never match to a machine_products row,
// so it retries forever and never confirms/drains. Loaded once at boot
// (before Ethernet even comes up) and saved every time a fresh value is
// fetched from the server.
#define DEFAULT_PRODUCT_FILE "/default_product.txt"

void saveDefaultProductToFS() {
    if (defaultProductId.length() == 0) return;
    File f = LittleFS.open(DEFAULT_PRODUCT_FILE, "w");
    if (!f) return;
    f.print(defaultProductId);
    f.close();
}

void loadDefaultProductFromFS() {
    if (!LittleFS.exists(DEFAULT_PRODUCT_FILE)) return;
    File f = LittleFS.open(DEFAULT_PRODUCT_FILE, "r");
    if (!f) return;
    String saved = f.readString();
    f.close();
    saved.trim();
    if (saved.length() > 0) {
        defaultProductId = saved;
        Serial.println("Loaded default product ID from LittleFS: " + defaultProductId);
    }
}

// ---- Time anchor persistence (see WALL-CLOCK TIME section above) ----

void loadTimeAnchorFromFS() {
    if (!LittleFS.exists(TIME_ANCHOR_FILE)) return;
    File f = LittleFS.open(TIME_ANCHOR_FILE, "r");
    if (!f) return;
    String saved = f.readString();
    f.close();
    saved.trim();
    if (saved.length() > 0) {
        estimatedBootEpoch = saved.toInt();
        Serial.println("Loaded time anchor from LittleFS (carried over from a previous boot)");
    }
}

void saveTimeAnchorToFS() {
    File f = LittleFS.open(TIME_ANCHOR_FILE, "w");
    if (!f) return;
    f.print(String(estimatedBootEpoch));
    f.close();
}

// GET /api/time — refreshes estimatedBootEpoch from the server's clock.
// Called on every successful (re)connect (setup() and checkForEthernetRecovery()).
// Cheap/no-auth on the server side; see the endpoint's own comment for why
// NTP isn't an option over UIPEthernet.
bool syncTimeFromServer() {
    String responseBody;
    int code = makeHTTPRequest(apiUrl("/api/time"), "GET", "", &responseBody);
    if (code != 200 || responseBody.length() == 0) {
        Serial.printf("Time sync failed: HTTP %d\n", code);
        return false;
    }

    DynamicJsonDocument doc(256);  // small response, but leave headroom for ArduinoJson's per-key overhead
    DeserializationError err = deserializeJson(doc, responseBody);
    if (err != DeserializationError::Ok || !doc.containsKey("data")) {
        Serial.printf("Time sync: bad response (%s)\n", err.c_str());
        return false;
    }

    long serverEpoch = doc["data"]["epoch"] | 0L;
    if (serverEpoch <= 0) {
        Serial.println("Time sync: server returned no epoch");
        return false;
    }

    estimatedBootEpoch = serverEpoch - (long)(millis() / 1000);
    saveTimeAnchorToFS();
    Serial.println("Time synced from server (epoch " + String(serverEpoch) + ")");
    return true;
}

// Current best-guess Unix epoch, or 0 if this machine has never once
// successfully synced time (e.g. brand new, never been online).
long currentEpoch() {
    if (estimatedBootEpoch == 0) return 0;
    return estimatedBootEpoch + (long)(millis() / 1000);
}

bool loadCardsCacheFromFS() {
    if (!LittleFS.exists("/cards.json")) {
        Serial.println("No local card cache yet (never synced) — offline taps can't be validated until the first successful sync");
        return false;
    }
    File f = LittleFS.open("/cards.json", "r");
    if (!f) return false;
    cardsCache.clear();
    DeserializationError err = deserializeJson(cardsCache, f);
    f.close();
    if (err) {
        Serial.printf("Card cache file corrupt (%s), ignoring until next sync\n", err.c_str());
        cardsCache.clear();
        return false;
    }
    cardsCacheLoaded = true;
    Serial.printf("Loaded %d cached card(s) from LittleFS\n", cardsCache["cards"].as<JsonArray>().size());
    return true;
}

// GET /api/machine-cards-sync — refreshes the local card cache wholesale.
// Called on every successful (re)connect and periodically while connected.
bool syncCardsFromServer() {
    if (!isNetworkConnected() || machineId == "UNKNOWN" || machineId.length() == 0) return false;

    String responseBody;
    int code = makeHTTPRequest(apiUrl("/api/machine-cards-sync?machine_id=" + urlEncode(machineId)), "GET", "", &responseBody);
    if (code != 200 || responseBody.length() == 0) {
        Serial.printf("Card sync-down failed: %d\n", code);
        return false;
    }

    DynamicJsonDocument doc(CARDS_CACHE_DOC_SIZE);
    DeserializationError err = deserializeJson(doc, responseBody);
    if (err || !doc.containsKey("data")) {
        Serial.println("Card sync-down: bad response");
        return false;
    }

    cardsCache.clear();
    JsonArray cards = cardsCache.createNestedArray("cards");
    JsonArray incoming = doc["data"]["cards"];
    for (JsonObject c : incoming) {
        JsonObject dst = cards.createNestedObject();
        dst["uid"] = c["uid"].as<String>();
        dst["credits_remaining"] = c["credits_remaining"] | 0;
        dst["is_active"] = c["is_active"] | true;
        dst["card_type"] = c["card_type"] | "prepaid";
        dst["product_id"] = c["product_id"].isNull() ? "" : c["product_id"].as<String>();
        // Every card is capped at this many taps/month regardless of
        // card_type — server-computed remaining count, refreshed on every
        // sync (see /api/machine-cards-sync). Decremented locally per
        // offline dispense in handleOfflineRfidTap().
        dst["monthly_remaining"] = c["monthly_remaining"] | 0;
    }

    cardsCacheLoaded = true;
    saveCardsCacheToFS();
    Serial.printf("Synced %d card(s) from server\n", cards.size());
    return true;
}

String generateClientTxId() {
    uint32_t counter = readTxCounter() + 1;
    writeTxCounter(counter);
    return deviceMacAddress + "-" + String(counter);
}

int getQueueLineCount() {
    if (!LittleFS.exists("/queue.jsonl")) return 0;
    File f = LittleFS.open("/queue.jsonl", "r");
    if (!f) return 0;
    int count = 0;
    while (f.available()) {
        if (f.readStringUntil('\n').length() > 0) count++;
    }
    f.close();
    return count;
}

// Appends one offline-dispensed tap to the queue for later reconciliation.
// A plain append (not the temp-file-then-rename pattern used for the full
// card cache) is fine here — an interrupted append can only corrupt the
// last line, which syncQueueToServer() already has to tolerate (a queue
// file is inherently written incrementally, unlike cards.json which is
// always replaced wholesale), and we defensively skip any line that fails
// to parse as JSON when reading it back.
void queueOfflineTransaction(const String& uid, const String& productId) {
    if (getQueueLineCount() >= MAX_QUEUE_ENTRIES) {
        Serial.println("Offline queue full — this tap's dispense already happened physically, but it won't be billed until the queue drains and there's room, or a service visit clears it");
        return;
    }

    size_t freeBytes = LittleFS.totalBytes() - LittleFS.usedBytes();
    if (freeBytes < 4096) {
        Serial.println("LittleFS low on space — skipping queue write for this tap");
        return;
    }

    String clientTxId = generateClientTxId();
    // tap_epoch is what makes the tap timestamp survive a reboot mid-outage
    // — see the WALL-CLOCK TIME section above. It can still be 0 here (time
    // never yet synced THIS boot, e.g. a tap right at boot before Ethernet
    // finishes connecting) — tap_millis + boot_id are kept as a same-boot
    // fallback for exactly that case: if time gets synced later in this same
    // boot before the queue syncs, syncQueueToServer() can recover an
    // accurate timestamp from the millis() delta even though tap_epoch was
    // unknown at the moment of the tap.
    String line = "{\"client_tx_id\":\"" + clientTxId + "\",\"uid\":\"" + uid +
                  "\",\"product_id\":\"" + productId + "\"" +
                  ",\"tap_epoch\":" + String(currentEpoch()) +
                  ",\"tap_millis\":" + String(millis()) + ",\"boot_id\":" + String(bootId) + "}\n";

    File f = LittleFS.open("/queue.jsonl", "a");
    if (!f) {
        Serial.println("Failed to open queue.jsonl for append");
        return;
    }
    f.print(line);
    f.close();
    Serial.println("Queued offline transaction: " + clientTxId);
}

// POST /api/rfid-payment/offline-sync — pushes everything queued since the
// last successful sync, then rewrites the queue keeping only what the
// server didn't confirm (network hiccup mid-batch, etc.), to retry next
// reconnect. Called on every successful (re)connect.
void syncQueueToServer() {
    if (!isNetworkConnected() || !LittleFS.exists("/queue.jsonl")) return;
    if (machineId == "UNKNOWN" || machineId.length() == 0) return;

    File f = LittleFS.open("/queue.jsonl", "r");
    if (!f) return;

    static String lines[MAX_QUEUE_ENTRIES];
    static String clientTxIds[MAX_QUEUE_ENTRIES];
    int lineCount = 0;
    while (f.available() && lineCount < MAX_QUEUE_ENTRIES) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) lines[lineCount++] = line;
    }
    f.close();

    if (lineCount == 0) return;

    Serial.printf("Syncing %d queued offline transaction(s)...\n", lineCount);

    String payload;
    payload.reserve(lineCount * 130 + 64);
    payload = "{\"machine_id\":\"" + machineId + "\",\"transactions\":[";

    DynamicJsonDocument lineDoc(512);
    for (int i = 0; i < lineCount; i++) {
        lineDoc.clear();
        if (deserializeJson(lineDoc, lines[i]) != DeserializationError::Ok) {
            clientTxIds[i] = "";  // corrupt line — dropped when the file is rewritten below
            continue;
        }
        clientTxIds[i] = lineDoc["client_tx_id"].as<String>();
        long tapEpoch = lineDoc["tap_epoch"] | 0L;

        if (i > 0) payload += ",";
        payload += "{\"client_tx_id\":\"" + clientTxIds[i] + "\",\"card_uid\":\"" +
                   lineDoc["uid"].as<String>() + "\",\"product_id\":\"" +
                   lineDoc["product_id"].as<String>() + "\"";

        // tap_epoch (see WALL-CLOCK TIME section) survives reboots, unlike
        // a plain millis()-since-boot approach — so this works for taps
        // queued in an earlier boot session too, not just the current one.
        long nowEpoch = currentEpoch();
        long msAgo = -1;
        if (tapEpoch > 0 && nowEpoch > 0) {
            msAgo = (nowEpoch - tapEpoch) * 1000L;
        } else {
            // tap_epoch was 0 — time hadn't synced yet at the moment of this
            // specific tap (e.g. it happened right at boot, before Ethernet
            // finished connecting). If this line was queued in the boot
            // session we're STILL in, and time has since been synced later
            // in that same session, millis() is still valid (it only resets
            // across reboots, not within one) — recover the real tap time
            // from that delta instead of giving up entirely.
            uint32_t lineBootId = lineDoc["boot_id"] | 0UL;
            if (lineBootId == bootId && nowEpoch > 0) {
                unsigned long tapMillis = lineDoc["tap_millis"] | 0UL;
                msAgo = (long)(millis() - tapMillis);
            }
        }
        // Still genuinely unknown (never synced time at all across the
        // whole outage, this line's reboot included) — omit it and let the
        // server fall back to stamping at sync time, same as before.
        if (msAgo >= 0) {
            payload += ",\"offline_ms_ago\":" + String(msAgo);
        }
        payload += "}";
    }
    payload += "]}";

    String responseBody;
    int code = makeHTTPRequest(apiUrl("/api/rfid-payment/offline-sync"), "POST", payload, &responseBody);

    if (code != 200) {
        Serial.printf("Offline sync request failed: %d — will retry next reconnect\n", code);
        return;
    }

    DynamicJsonDocument respDoc(4096);
    if (deserializeJson(respDoc, responseBody) != DeserializationError::Ok || !respDoc.containsKey("data")) {
        Serial.println("Offline sync: bad response, will retry next reconnect");
        return;
    }

    JsonArray results = respDoc["data"]["results"];
    int synced = 0;

    File out = LittleFS.open("/queue.jsonl.tmp", "w");
    if (!out) {
        Serial.println("Failed to open queue.jsonl.tmp for rewrite");
        return;
    }

    for (int i = 0; i < lineCount; i++) {
        if (clientTxIds[i].length() == 0) continue;  // corrupt line, already dropped

        bool confirmed = false;
        bool matched = false;
        for (JsonObject r : results) {
            if (String(r["client_tx_id"].as<const char*>()) == clientTxIds[i]) {
                matched = true;
                String status = r["status"].as<String>();
                if (status == "synced" || status == "already_synced") {
                    confirmed = true;
                } else {
                    // Not confirmed and not going to look like it from the
                    // outside next time either — without this, a
                    // permanently-stuck transaction (e.g. CARD_NOT_FOUND
                    // because the card was deleted, or PRODUCT_NOT_FOUND
                    // because it's no longer assigned to this machine) just
                    // silently occupies a queue slot forever with nothing in
                    // the log to say why. Logging the reason doesn't drop
                    // it — a data-side fix (re-adding the card/product, or a
                    // server bug fix — see the price=0 machine_products
                    // issue) can still let it confirm on a later retry, so
                    // it stays queued rather than being discarded.
                    String errCode = r["error_code"] | "unknown";
                    Serial.println("  " + clientTxIds[i] + " NOT confirmed: " + status + " (" + errCode + ")");
                }
                break;
            }
        }
        if (!matched) {
            Serial.println("  " + clientTxIds[i] + " NOT confirmed: missing from server response");
        }

        if (confirmed) synced++;
        else out.println(lines[i]);
    }
    out.close();

    LittleFS.remove("/queue.jsonl");
    int remaining = lineCount - synced;
    if (remaining == 0) {
        // Nothing left to keep — remove the tmp file instead of renaming
        // it into place as an empty /queue.jsonl, so getQueueLineCount()
        // and loadCardsCacheFromFS()-style existence checks see a clean
        // "no queue" state rather than a stray 0-byte file.
        LittleFS.remove("/queue.jsonl.tmp");
        Serial.println("Offline queue fully synced (0 remaining)");
        // Per-dispense stock pushes during the outage were fire-and-forget
        // (syncTotalStockToServer() inside dispenseProductByMotor() has no
        // retry), so any of those that got dropped while offline are
        // reconciled here with the current, authoritative EEPROM stock now
        // that the connection is confirmed working again.
        syncTotalStockToServer(defaultProductId);
    } else {
        LittleFS.rename("/queue.jsonl.tmp", "/queue.jsonl");
    }

    Serial.printf("Offline sync: %d/%d confirmed, %d remaining queued\n", synced, lineCount, remaining);
}

// ==================== LCD DISPLAY FUNCTIONS ====================

// REQUIRES a library-side addition: LiquidCrystal_I2C::resync4bit() (added
// to the installed library — reapply if it's ever reinstalled/updated).
// The library never checks Wire.endTransmission()'s return value anywhere,
// so a single dropped/NACKed I2C transaction — plausible on this board
// given the motor rail noise already called out in dispenseProductByMotor()
// — permanently desyncs the HD44780's 4-bit nibble counter with no error
// surfaced: the display just silently stops updating forever after that
// point (seen freezing on the boot splash while Serial/network/RFID kept
// working normally). resync4bit() re-sends just the cheap "enter 4-bit
// mode" handshake (~10ms) before every write as a self-healing guard,
// without the slow ~1050ms full reset that lcd.init()/begin() do.
void lcdMsg(const String& line0, const String& line1) {
    lcd.resync4bit();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line0.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(line1.substring(0, 16));
}

// "Ready to serve" now means either actually online, or offline with a
// usable local card cache (offline dispensing works — see
// handleOfflineRfidTap()) — showing "Network Error" in that second case
// would be actively misleading, since a tap right now would work fine.
// Only genuinely no-network-AND-no-cache (e.g. a brand-new machine that's
// never synced even once) falls through to the real error state.
bool canServeTaps() {
    return isNetworkConnected() || cardsCacheLoaded;
}

void sendStockAwareStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        currentStatus = STATUS_OUT_OF_STOCK;
        lcdMsg("Out of Stock", "Please wait...");
        Serial.println("Status: Out of stock");
    } else if (canServeTaps()) {
        currentStatus = STATUS_READY;
        idleScreenIndex = 0;
        lastIdleScreenChange = millis();
        lcdMsg("Lyra Vending", "Tap Card...");
        Serial.println(isNetworkConnected() ? "Status: Ready" : "Status: Ready (offline, cached cards)");
    } else {
        currentStatus = STATUS_NETWORK_ERROR;
        lcdMsg("Network Error", "Reconnecting...");
        Serial.println("Status: Network error");
    }
}

void sendStockAwareErrorStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        currentStatus = STATUS_OUT_OF_STOCK;
        lcdMsg("Out of Stock", "Please wait...");
    } else if (canServeTaps()) {
        currentStatus = STATUS_READY;
        lcdMsg("Lyra Vending", "Tap Card...");
    } else {
        currentStatus = STATUS_NETWORK_ERROR;
        lcdMsg("Network Error", "Reconnecting...");
    }
}

// Rotates the LCD between the "Tap Card" prompt and the current stock
// count while idle and ready. Called every loop() iteration — only acts
// once IDLE_SCREEN_INTERVAL has elapsed, and never uses delay(), so it
// can't stall RFID tap polling or any other loop() work.
void updateIdleDisplay() {
    if (currentStatus != STATUS_READY) return;
    if (millis() - lastIdleScreenChange < IDLE_SCREEN_INTERVAL) return;

    lastIdleScreenChange = millis();
    idleScreenIndex = (idleScreenIndex + 1) % 2;

    if (idleScreenIndex == 0) {
        lcdMsg("Lyra Vending", "Tap Card...");
    } else {
        lcdMsg("Lyra Vending", "Stock: " + String(readMotorStockFromEEPROM()));
    }
}

// ==================== NETWORK FUNCTIONS ====================

bool isNetworkConnected() {
    IPAddress ip = Ethernet.localIP();
    return ethernetConnected && (ip != IPAddress(0,0,0,0));
}

// Ethernet is the only transport now — short-circuit to an instant failure
// if it's down rather than attempting (and blocking on) a doomed
// connection. This matters most for offline dispensing: dispenseProductByMotor()
// still fires its own network call (syncTotalStockToServer()) unconditionally,
// and that needs to fail fast, not eat a multi-second connect timeout, when
// there's nothing to connect to.
int makeHTTPRequest(const String& url, const String& method, const String& payload, String* responseBody) {
    if (!ethernetConnected) return -1;
    return makeEthernetHTTPRequest(url, method, payload, responseBody);
}

#ifdef USE_ETHERNET
int makeEthernetHTTPRequest(const String& url, const String& method, const String& payload, String* outBody) {
    String u = url;
    if (u.startsWith("http://")) {
        u = u.substring(7);
    } else if (u.startsWith("https://")) {
        Serial.println("HTTPS not supported over Ethernet");
        return -1;
    }

    int slashIdx = u.indexOf('/');
    String host = (slashIdx >= 0) ? u.substring(0, slashIdx) : u;
    String path = (slashIdx >= 0) ? u.substring(slashIdx) : "/";

    int colonIdx = host.indexOf(':');
    int port = 80;
    if (colonIdx >= 0) {
        port = host.substring(colonIdx + 1).toInt();
        host = host.substring(0, colonIdx);
    }

    IPAddress ip = Ethernet.localIP();
    if (ip == IPAddress(0,0,0,0) || ip[0] == 0) {
        Serial.println("Ethernet has no valid IP!");
        ethernetConnected = false;
        useEthernet = false;
        sendStockAwareErrorStatus();
        return -1;
    }

    Serial.printf("Connecting to %s:%d... ", host.c_str(), port);
    // 2 attempts, not 3 (each can block up to UIP_CONNECT_TIMEOUT — 5s, set
    // at the library level, see the USE_ETHERNET comment near the top of
    // this file) and not a single attempt either: a single try turned out
    // to be too fragile for the very first request right after
    // Ethernet.begin() completes — the stack (ARP resolution, ENC28J60
    // buffers) can need a moment to settle, so that first connect failing
    // once flipped ethernetConnected false and made makeHTTPRequest()'s
    // short-circuit fail every OTHER boot-time call too (fetchMachineProducts,
    // sendMachineStatusPing), even though Ethernet was genuinely up — 2
    // attempts is enough to ride that out while keeping a truly-unplugged
    // cable's worst case around ~11s instead of ~16s.
    bool connected = false;
    for (int attempt = 0; attempt < 2; attempt++) {
        if (ethClient.connect(host.c_str(), port)) {
            connected = true;
            Serial.println("OK");
            break;
        }
        if (attempt == 0) {
            ethClient.stop();
            delay(200);
        }
    }

    if (!connected) {
        Serial.println("Failed!");
        ethernetConnected = false;
        useEthernet = false;
        sendStockAwareErrorStatus();
        return -1;
    }

    String req = String(method) + " " + path + " HTTP/1.1\r\n";
    req += "Host: " + host + "\r\n";
    req += "Connection: close\r\n";
    req += "X-Machine-ID: " + machineId + "\r\n";
    req += "X-Firmware-Version: " + String(CURRENT_FIRMWARE_VERSION) + "\r\n";

    if (method == "POST") {
        req += "Content-Type: application/json\r\n";
        req += "Content-Length: " + String(payload.length()) + "\r\n\r\n";
        req += payload;
    } else {
        req += "\r\n";
    }

    ethClient.print(req);

    unsigned long timeout = millis() + 5000;
    while (ethClient.available() == 0) {
        if (millis() > timeout) {
            ethClient.stop();
            // Stopping a connection exactly at a response timeout can leave
            // the ENC28J60/uIP stack still mid-teardown of this PCB. A
            // connect() fired immediately after (e.g. the very next call in
            // setup()/loop(), with no other delay in between) can then walk
            // a stale/half-freed connection slot and crash with
            // Guru Meditation Error: StoreProhibited (EXCVADDR 0x10) —
            // observed in the field right after a timed-out offline-sync
            // POST was immediately followed by the status ping's connect().
            delay(250);

            // A connect() that succeeds but then never gets a response
            // within 5s means something downstream of the link is actually
            // broken (proxy down, routing black hole, etc.) even though
            // DHCP/link-state still look fine — Ethernet.linkStatus() and
            // checkEthernetLinkStatus()'s IP check can't see this kind of
            // failure at all. Treat it the same as a connect() failure
            // below: drop ethernetConnected/useEthernet so isNetworkConnected()
            // correctly reports offline (routing the next RFID tap straight
            // to handleOfflineRfidTap() instead of stalling another 5s on a
            // doomed online attempt) and so checkForEthernetRecovery() picks
            // up the reconnect job instead of the machine silently retrying
            // "online" requests that keep timing out forever.
            ethernetConnected = false;
            useEthernet = false;
            sendStockAwareErrorStatus();
            return -1;
        }
    }

    String statusLine = ethClient.readStringUntil('\n');
    statusLine.trim();
    int code = -1;
    int firstSpace = statusLine.indexOf(' ');
    if (firstSpace > 0) {
        int secondSpace = statusLine.indexOf(' ', firstSpace + 1);
        String codeStr = (secondSpace > firstSpace) ?
                        statusLine.substring(firstSpace + 1, secondSpace) :
                        statusLine.substring(firstSpace + 1);
        code = codeStr.toInt();
    }

    bool headersEnded = false;
    String body;
    while (ethClient.available()) {
        String line = ethClient.readStringUntil('\n');
        if (!headersEnded) {
            if (line == "\r" || line.length() == 0) headersEnded = true;
        } else {
            body += line;
        }
    }

    if (outBody != nullptr) {
        String jsonOnly = extractJsonFromString(body);
        *outBody = (jsonOnly.length() > 0) ? jsonOnly : body;
    }

    ethClient.stop();
    // Same settle-time reasoning as the timeout branch above: callers here
    // routinely chain several requests back-to-back with zero gap (e.g.
    // setup()'s fetchMachineInfoFromBackend -> fetchMachineProducts ->
    // syncCardsFromServer -> syncQueueToServer). Each success here still
    // just called stop() on THIS connection microseconds before the caller
    // fires the NEXT connect() — observed in the field as the 3rd or 4th
    // request in such a chain (typically the largest payload) failing to
    // even establish a TCP connection ("Failed!") right after several
    // rapid successful req/response/stop cycles on the same ENC28J60/uIP
    // stack, which apparently needs a moment to fully release each
    // connection's resources before it can reliably open the next one.
    delay(100);
    return code;
}

// ==================== ETHERNET MANAGEMENT FUNCTIONS ====================

bool initializeEthernet(bool fastProbe) {
    unsigned long startTime = millis();
    Serial.println("Initializing Ethernet...");
    Serial.printf("Ethernet Pins - CS:%d, MOSI:%d, MISO:%d, SCK:%d\n",
                 ETHERNET_CS, SPI_MOSI, SPI_MISO, SPI_SCK);

    // fastProbe cuts hardware-detect retries and DHCP attempts/timeout down
    // for the periodic background recovery check (checkForEthernetRecovery(),
    // called from loop() while already running fine offline) — that path
    // repeats forever every ETHERNET_RECOVERY_CHECK_INTERVAL, so its
    // multi-second blocking cost (which stalls RFID tap polling and the LCD
    // for the duration) needs to stay as short as possible. The one-shot
    // boot-time probe in setup() keeps the full, thorough retry budget
    // (fastProbe defaults to false) since it only ever runs once and a
    // flaky first SPI read there shouldn't cost the whole boot its Ethernet
    // connection for the rest of the power cycle.
    const int hwAttempts = fastProbe ? 1 : 3;
    const int dhcpAttempts = fastProbe ? 1 : 2;
    const unsigned long dhcpTimeoutMs = fastProbe ? 2000 : 5000;

    // Hardware detection gets its own retry loop, separate from the DHCP
    // retry below. The ENC28J60 occasionally reads back EthernetNoHardware
    // on the very first SPI probe right after power-up — oscillator not
    // fully settled yet, or a brief SPI bus hiccup — even though the module
    // is physically fine and would detect correctly a moment later.
    uint8_t hwStatus = EthernetNoHardware;
    for (int hwAttempt = 0; hwAttempt < hwAttempts; hwAttempt++) {
        if (hwAttempt > 0) {
            Serial.printf("Hardware detection retry %d/%d...\n", hwAttempt + 1, hwAttempts);
            feedWatchdog();
            delay(300);
        }

        pinMode(ETHERNET_CS, OUTPUT);
        digitalWrite(ETHERNET_CS, LOW);
        delay(10);
        digitalWrite(ETHERNET_CS, HIGH);
        delay(500);

        SPI.end();
        delay(100);
        SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, ETHERNET_CS);
        SPI.setBitOrder(MSBFIRST);
        SPI.setDataMode(SPI_MODE0);
        SPI.setFrequency(4000000);
        delay(200);

        Ethernet.init(ETHERNET_CS);
        delay(200);

        Serial.print("Detecting Ethernet hardware... ");
        hwStatus = Ethernet.hardwareStatus();
        if (hwStatus != EthernetNoHardware) {
            Serial.println("Detected (status " + String(hwStatus) + ")");
            break;
        }
        Serial.println("No hardware detected");
    }

    if (hwStatus == EthernetNoHardware) {
        return false;
    }

    digitalWrite(ETHERNET_CS, LOW);
    delay(50);
    digitalWrite(ETHERNET_CS, HIGH);
    delay(200);
    Ethernet.init(ETHERNET_CS);
    delay(200);

    Serial.println("Checking for Ethernet cable...");
    if (Ethernet.linkStatus() == LinkOFF) {
        // ENC28J60 linkStatus() is unreliable and often reports LinkOFF even
        // with a working cable. Don't bail here — let DHCP be the real test.
        Serial.println("linkStatus reports OFF (unreliable on ENC28J60) - trying DHCP anyway");
    } else {
        Serial.println("Ethernet cable connected");
    }

    Serial.println("Requesting DHCP...");
    for (int attempt = 0; attempt < dhcpAttempts; attempt++) {
        if (attempt > 0) {
            Serial.printf("Retry attempt %d/%d...\n", attempt + 1, dhcpAttempts);
            SPI.end();
            delay(100);
            SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, ETHERNET_CS);
            SPI.setBitOrder(MSBFIRST);
            SPI.setDataMode(SPI_MODE0);
            SPI.setFrequency(4000000);
            delay(100);
            Ethernet.init(ETHERNET_CS);
            delay(200);
        }

        Ethernet.begin(ethernetMAC);

        unsigned long dhcpStart = millis();
        IPAddress checkIP;
        bool gotIP = false;
        while (millis() - dhcpStart < dhcpTimeoutMs) {
            feedWatchdog();
            checkIP = Ethernet.localIP();
            if (checkIP != IPAddress(0,0,0,0) && checkIP[0] != 0) {
                gotIP = true;
                break;
            }
            delay(100);
        }

        if (gotIP) {
            // Empirically, a TCP connect attempted immediately after DHCP
            // completes reliably fails for several seconds even though the
            // link and IP are genuinely fine (the same request succeeds
            // every time once the machine's been up a bit longer) — the
            // ENC28J60/uIP stack seems to need more settle time. This
            // delays the first real request a bit longer at boot/reconnect,
            // which is harmless since setup() doesn't block on it (it
            // proceeds into loop() and dispenses offline either way — see
            // the file-header comment).
            delay(2000);
            IPAddress ip = Ethernet.localIP();
            Serial.println("DHCP OK - IP: " + ip.toString());

            bool validIP = (ip[0] == 10) ||
                          (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) ||
                          (ip[0] == 192 && ip[1] == 168);

            if (validIP && ip != IPAddress(0,0,0,0)) {
                Serial.println("Ethernet ready! Subnet: " + Ethernet.subnetMask().toString());
                ethernetConnected = true;
                useEthernet = true;
                digitalWrite(BLUE_LED_PIN, HIGH);
                Serial.printf("Total time: %lu ms\n", millis() - startTime);
                return true;
            }
            Serial.println("Invalid IP received, retrying");
        }

        delay(1000);
    }

    Serial.println("DHCP failed");
    return false;
}

void checkEthernetLinkStatus() {
    if (!useEthernet) return;

    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 5000) {
        Ethernet.maintain();
        IPAddress ip = Ethernet.localIP();
        if (ip == IPAddress(0,0,0,0) || ip[0] == 0) {
            Serial.println("Ethernet lost IP address!");
            ethernetConnected = false;
            useEthernet = false;
            sendStockAwareErrorStatus();
        }
        lastCheck = millis();
    }
}

// Ethernet is the only transport, so while it's down this periodically
// re-attempts the same boot-time bring-up and reconnects the moment it
// succeeds, without needing a manual "reset-eth" or a reboot.
void checkForEthernetRecovery() {
    if (useEthernet) return;
    if (millis() - lastEthernetRecoveryCheck < ETHERNET_RECOVERY_CHECK_INTERVAL) return;
    lastEthernetRecoveryCheck = millis();

    Serial.println("Probing for LAN recovery...");
    // This probe blocks for several seconds (hardware detect + up to two
    // DHCP attempts) — RFID tap polling in loop() can't run during that
    // window. Without an explicit message here, the LCD just kept showing
    // whatever it displayed before ("Tap Card"), silently misleading
    // anyone who taps mid-probe into thinking the machine was responsive
    // when it was actually busy and not reading the antenna.
    lcdMsg("Checking LAN...", "One moment");
    bool recovered = initializeEthernet(true);  // fastProbe: keep this periodic background check as short as possible

    // initializeEthernet() reconfigures the shared SPI bus for the Ethernet
    // module's CS pin/clock regardless of whether hardware was actually
    // found — so a FAILED probe (the common case whenever there's no
    // cable/module) leaves RFID communication broken until whatever next
    // touches the bus happens to reinit it. reinitializeRfidReader() must
    // run unconditionally here, not just in the success branch below, to
    // hand the bus back to the RFID reader after every probe attempt.
    reinitializeRfidReader();

    if (recovered) {
        Serial.println("LAN recovered");
        syncTimeFromServer();  // before syncQueueToServer() below, so any queued taps' offline_ms_ago is as accurate as possible
        fetchMachineInfoFromBackend(deviceMacAddress);
        if (machineId == "UNKNOWN") {
            // The very first connection right after Ethernet comes back up
            // sometimes still fails even though the link is genuinely fine
            // (the identical request reliably succeeds moments later) — a
            // single failed call here also flips ethernetConnected false,
            // which would otherwise short-circuit every other call below
            // (fetchMachineProducts/syncCardsFromServer/syncQueueToServer)
            // to an instant failure too, even though Ethernet is actually
            // up. One retry after a short pause covers that window instead
            // of leaving the machine on cached data for a full
            // ETHERNET_RECOVERY_CHECK_INTERVAL. Safe to re-affirm the
            // connection flags here since `recovered` is ground truth that
            // DHCP genuinely just succeeded.
            delay(1500);
            ethernetConnected = true;
            useEthernet = true;
            fetchMachineInfoFromBackend(deviceMacAddress);
        }
        if (machineId != "UNKNOWN") {
            fetchMachineProducts();
            syncCardsFromServer();
            syncQueueToServer();
        }
        // sendMachineStatusPing() is the ONLY call that updates
        // asset_online/last_ping in the DB — the dashboards read that, not
        // ethernetConnected. Without pinging here, the server keeps
        // showing this machine offline until the next scheduled 120s
        // ping in loop() happens to fire, even though the machine is
        // genuinely back online and dispensing again right now. Mirrors
        // the same immediate ping setup() does after its initial connect.
        feedWatchdog();
        sendMachineStatusPing();
        lastPingTime = millis();
        sendStockAwareStatus();
    } else {
        // Still offline — clear the "Checking LAN..." message set above and
        // go back to whatever the LCD should actually show (Tap Card /
        // Out of Stock / Network Error), same as any other status refresh.
        sendStockAwareStatus();
    }
}

void printEthernetDiagnostics() {
    Serial.println("\n=== ETHERNET DIAGNOSTICS ===");
    Serial.printf("Hardware status: %d\n", Ethernet.hardwareStatus());
    Serial.printf("Link status: %d\n", Ethernet.linkStatus());
    if (Ethernet.localIP() != IPAddress(0,0,0,0)) {
        Serial.println("IP: " + Ethernet.localIP().toString());
        Serial.println("Subnet: " + Ethernet.subnetMask().toString());
        Serial.println("Gateway: " + Ethernet.gatewayIP().toString());
        Serial.println("DNS: " + Ethernet.dnsServerIP().toString());
    } else {
        Serial.println("IP: Not assigned");
    }
    Serial.printf("Connected: %s\n", ethernetConnected ? "Yes" : "No");
    Serial.printf("Using Ethernet: %s\n", useEthernet ? "Yes" : "No");
    Serial.println("============================\n");
}

void scanEthernetPins() {
    Serial.println("\n=== ETHERNET CS PIN SCANNER ===");
    int testPins[] = {17, 16, 25, 14};
    int numPins = sizeof(testPins) / sizeof(testPins[0]);

    for (int i = 0; i < numPins; i++) {
        int csPin = testPins[i];
        Serial.printf("Testing CS pin %d... ", csPin);
        pinMode(csPin, OUTPUT);
        digitalWrite(csPin, HIGH);
        delay(50);

        SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, csPin);
        SPI.setBitOrder(MSBFIRST);
        SPI.setDataMode(SPI_MODE0);
        SPI.setFrequency(8000000);
        delay(50);

        Ethernet.init(csPin);
        delay(50);

        uint8_t hwStatus = Ethernet.hardwareStatus();
        if (hwStatus != EthernetNoHardware) {
            Serial.printf("FOUND! (status %d) -> set ETHERNET_CS to %d\n", hwStatus, csPin);
        } else {
            Serial.println("no hardware");
        }

        SPI.end();
        delay(100);
    }
    Serial.printf("\nCurrent configuration: CS=%d, SCK=%d, MISO=%d, MOSI=%d\n",
                 ETHERNET_CS, SPI_SCK, SPI_MISO, SPI_MOSI);
    Serial.println("================================\n");
}

void resetEthernetModule() {
    Serial.println("Resetting Ethernet module...");
    digitalWrite(ETHERNET_CS, LOW);
    delay(1);
    digitalWrite(ETHERNET_CS, HIGH);
    delay(100);
    Ethernet.init(ETHERNET_CS);
    delay(500);
    Serial.println("Ethernet module reset complete");
}
#endif

// ==================== MACHINE FUNCTIONS ====================

void getMACAddress() {
    // Reads the chip's factory-assigned WiFi radio MAC without ever calling
    // WiFi.begin() — this machine never joins a WiFi network, but the
    // backend identifies it by this MAC (vending_machines.mac_id), and it
    // doubles as the unique seed for the Ethernet MAC below.
    WiFi.mode(WIFI_STA);
    delay(50);
    String mac = WiFi.macAddress();
    mac.toUpperCase();
    deviceMacAddress = mac;
    Serial.println("MAC: " + deviceMacAddress);
}

// Copies deviceMacAddress's bytes into ethernetMAC[] for Ethernet.begin()
// — see the ethernetMAC[] comment in GLOBAL VARIABLES for why. Must run
// after getMACAddress().
void deriveEthernetMAC() {
    for (int i = 0; i < 6; i++) {
        String byteStr = deviceMacAddress.substring(i * 3, i * 3 + 2);
        ethernetMAC[i] = (byte)strtol(byteStr.c_str(), nullptr, 16);
    }
    Serial.printf("Ethernet MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                  ethernetMAC[0], ethernetMAC[1], ethernetMAC[2], ethernetMAC[3], ethernetMAC[4], ethernetMAC[5]);
}

String fetchMachineInfoFromBackend(const String& mac) {
    String url = apiUrl("/api/get-machine-id-from-mac?mac=" + urlEncode(mac) +
                 "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION));

    String responseBody;
    int code = makeHTTPRequest(url, "GET", "", &responseBody);

    if (code == 200 && responseBody.length() > 0) {
        DynamicJsonDocument doc(512);
        DeserializationError err = deserializeJson(doc, responseBody);
        if (!err) {
            if (doc.containsKey("data") && doc["data"].containsKey("machine_id")) {
                machineId = doc["data"]["machine_id"].as<String>();
                machineName = doc["data"]["machine_name"].as<String>();
            } else if (doc.containsKey("machine_id")) {
                machineId = doc["machine_id"].as<String>();
                machineName = doc["machine_name"].as<String>();
            }
            Serial.println("Machine ID: " + machineId + " / Name: " + machineName);
        }
    }

    return machineId;
}

void fetchMachineProducts() {
    if (machineId == "UNKNOWN" || machineId.length() == 0) {
        Serial.println("Cannot fetch products: machine ID unknown");
        return;
    }

    String url = apiUrl("/api/machine-products?machine_id=" + urlEncode(machineId));
    String responseBody;
    int code = makeHTTPRequest(url, "GET", "", &responseBody);

    if (code == 200 && responseBody.length() > 0) {
        DynamicJsonDocument doc(1024);
        DeserializationError err = deserializeJson(doc, responseBody);
        if (!err && doc.containsKey("data")) {
            JsonObject data = doc["data"];
            if (data.containsKey("default_product")) {
                JsonObject defaultProd = data["default_product"];
                defaultProductId = defaultProd["product_id"] | "";
                Serial.println("Default Product ID: " + defaultProductId);
                saveDefaultProductToFS();
            }
        }
    } else {
        Serial.printf("Failed to fetch products: %d\n", code);
    }
}

void sendMachineStatusPing() {
    int currentStock = readMotorStockFromEEPROM();

    String payload;
    payload.reserve(220);
    payload = "{\"machine_id\":\"" + machineId + "\",";
    payload += "\"firmware_version\":\"" + String(CURRENT_FIRMWARE_VERSION) + "\",";
    payload += "\"body_type\":\"" + String(BODY_TYPE) + "\",";
    payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
    payload += "\"uptime\":" + String(millis()) + ",";
    payload += "\"stock_count\":" + String(currentStock);
    payload += "}";

    int code = makeHTTPRequest(apiUrl("/api/machine-ping"), "POST", payload);

    if (code == 200) Serial.printf("Machine ping successful (Stock: %d)\n", currentStock);
    else Serial.printf("Machine ping failed: %d\n", code);
}

// ==================== DISPENSE FUNCTIONS ====================

// /api/rfid-payment charges/deducts the card BEFORE this machine has
// physically attempted to dispense anything (see dispenseSequence()). If
// this machine's own EEPROM stock is already exhausted, the customer would
// otherwise be charged for nothing with no record anything went wrong.
// Called right after that happens, to refund the card and mark the payment
// undelivered.
void voidRfidPayment(const String& paymentId) {
    if (paymentId.length() == 0) return;
    String payload;
    payload.reserve(64);
    payload = "{\"payment_id\":\"" + paymentId + "\"}";
    int code = makeHTTPRequest(apiUrl("/api/rfid-payment/void"), "POST", payload);
    if (code != 200) Serial.printf("Failed to void RFID payment: %d\n", code);
    else Serial.println("RFID payment voided/refunded (dispense failed)");
}

// Returns true if the motor fired, false if this machine's own EEPROM
// stock is already exhausted.
bool dispenseProductByMotor(String productId) {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial.println("Out of stock!");
        lcdMsg("Out of Stock", "Please wait...");
        return false;
    }

    Serial.printf("Activating motor... (Stock before: %d)\n", stock);
    digitalWrite(TRANSISTOR_BASE, HIGH);
    delay(2110);
    digitalWrite(TRANSISTOR_BASE, LOW);

    // Let the supply rail settle after the motor's turn-off transient before
    // keying up network TX for the stock-sync call below — back-to-back with
    // no gap, the motor's inrush/back-EMF and the radio's current spike can
    // stack and sag the rail enough to corrupt in-flight UART bytes.
    delay(150);

    writeMotorStockToEEPROM(stock - 1);
    Serial.printf("Motor stopped! New stock: %d\n", stock - 1);
    // Stock push to the server happens later, after the "Please Collect"
    // LCD message — see the caller. Nothing here needs it: the product is
    // already physically out, and the authoritative count is already saved
    // to EEPROM on the line above, so there's no reason to make the
    // customer wait through a network round-trip before finding out their
    // item is ready to collect.
    return true;
}

void dispenseSequence(String productId, String paymentId) {
    lcdMsg("Dispensing...", "Please wait");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);

    bool dispensed = dispenseProductByMotor(productId);

    if (dispensed) {
        lcdMsg("Please Collect", "Your Napkin");
        syncTotalStockToServer(productId);
        delay(3000);
        lcdMsg("Thank You!", "");
        delay(3000);
    } else {
        // The backend already charged/deducted this tap before we got here
        // (dispenseProductByMotor() only returns false when this machine's
        // own EEPROM stock is exhausted — a real, detectable failure,
        // distinct from a jam/mechanical fault which no sensor here can
        // catch) — refund it rather than silently keeping the customer's
        // money for a napkin they never got.
        voidRfidPayment(paymentId);
        lcdMsg("Dispense Failed", "Refunded");
        delay(3000);
    }

    sendStockAwareStatus();
}

// ==================== RFID FUNCTIONS ====================

String readRfidUid() {
    String uid;
    uid.reserve(rfid.uid.size * 2);
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    return uid;
}

// WUPA counterpart to rfid.PICC_IsNewCardPresent() (which only sends REQA).
// A HALTed card doesn't respond to REQA per ISO14443-3 — only WUPA wakes it.
// Pure SPI, no RST pin pulse or antenna field power-cycle, so unlike
// reinitializeRfidReader()'s hard reset this can't trigger a brownout —
// safe to try liberally as a cheap first-line recovery for a card that's
// already been read once this session (see the tryReadTapUid() comments).
bool piccWakeupPresent() {
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    MFRC522::StatusCode status = rfid.PICC_WakeupA(bufferATQA, &bufferSize);
    return (status == MFRC522::STATUS_OK || status == MFRC522::STATUS_COLLISION);
}

bool tryReadTapUid(String& uidOut) {
    SPI.setFrequency(250000);

    byte readerVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    if (readerVersion == 0x00 || readerVersion == 0xFF) {
        if (millis() - lastRfidFaultPrint > RFID_FAULT_LOG_INTERVAL) {
            Serial.printf("RFID reader unhealthy (0x%02X), forcing reinit\n", readerVersion);
            Serial.println("Check wiring: 3.3V, GND, SS=27, RST=15, SCK=18, MISO=19, MOSI=23");
            lastRfidFaultPrint = millis();
        }
        rfidFaultLogged = true;
        reinitializeRfidReader();
        return false;
    }

    rfidHardwarePresent = true;
    rfidFaultLogged = false;

    static unsigned long lastAntennaCheck = 0;
    if (millis() - lastAntennaCheck > 10000) {
        rfid.PCD_AntennaOn();
        rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
        lastAntennaCheck = millis();
    }

    if (!rfid.PICC_IsNewCardPresent()) {
        // Nothing on the reader at all right now — whatever caused any
        // recent failures is gone, so don't let old failures bias the next
        // real tap's escalation decision below.
        //
        // Deliberately NOT falling back to piccWakeupPresent() here (unlike
        // the SELECT retry below) — WUPA wakes ANY card in range, including
        // a previous card that's still halted and lingering nearby (not yet
        // fully removed). Calling it on every poll where plain REQA finds
        // nothing risked waking that stale card instead of the new one
        // being presented when switching cards, and having two cards
        // respond during SELECT below made BOTH reads fail. The SELECT
        // retry's WUPA call is safe because it only fires once, right after
        // REQA already found something real in this same poll — not
        // repeatedly across polls where nothing has been detected yet.
        consecutiveRfidReadFailures = 0;
        return false;
    }

    // A single WUPA-based retry before counting this as a real failure —
    // the REQA-based detection above can occasionally get a response even
    // from a HALTed card ("REQA occasionally still gets a response from
    // some cards/clones despite HALT", per the comment on
    // consecutiveRfidReadFailures below) and then fail SELECT here; a plain
    // WUPA retry often clears exactly that case without ever needing
    // reinitializeRfidReader()'s hard reset.
    // Up to 4 total attempts (1 initial + 3 WUPA-gated retries) within this
    // ONE physical tap, before giving up and waiting for the card to be
    // re-presented. Longer-UID cards (7/10-byte UIDs — MIFARE Ultralight,
    // NTAG, etc.) need an extra anti-collision "cascade level" round that
    // 4-byte-UID cards don't, which is one more step that can fail on a
    // marginal read — this gives exactly those cards more chances to
    // complete SELECT before the user has to physically tap again. Each
    // retry is gated on piccWakeupPresent() so a card that's genuinely been
    // removed from the field stops the loop immediately instead of
    // retrying pointlessly against nothing.
    bool selected = rfid.PICC_ReadCardSerial();
    for (uint8_t retry = 0; !selected && retry < 3; retry++) {
        if (!piccWakeupPresent()) break;
        selected = rfid.PICC_ReadCardSerial();
    }

    if (!selected) {
        consecutiveRfidReadFailures++;
        if (consecutiveRfidReadFailures >= RFID_READ_FAILURE_RESET_THRESHOLD &&
            millis() - lastRfidReadFailureReset > RFID_READ_FAILURE_RESET_COOLDOWN) {
            // A card that got partway through anti-collision/selection
            // before this failed can be left in a state where it won't
            // answer a plain REQA anymore (PICC_IsNewCardPresent() uses
            // REQA, not WUPA) — so without cleanup here, THIS SAME card can
            // silently stop being detected on every subsequent tap.
            // reinitializeRfidReader() does a hard RST pulse, which also
            // power-cycles the antenna field; since passive RFID cards are
            // powered by that field, this resets the card's state too, not
            // just the reader's. Only escalate to this after a few misses
            // in a row (see consecutiveRfidReadFailures) — doing it on the
            // very first failure re-powers the field and un-halts whatever
            // card is still resting on the reader from the tap just before
            // this one, making it look "new" again next poll and re-fail
            // the same way forever for as long as the card sits there. The
            // cooldown on top of that stops a persistently flaky read
            // (weak signal, EM noise) from re-hitting the threshold and
            // hard-resetting again every few hundred ms forever.
            Serial.println("Card field present but UID read failed repeatedly — resetting RFID");
            reinitializeRfidReader();
            consecutiveRfidReadFailures = 0;
            lastRfidReadFailureReset = millis();
        } else {
            // Likely just the previous card still resting on the reader,
            // genuinely halted, and spuriously re-detected — re-halt it
            // without touching the antenna field so it stays halted and
            // stops being redetected on the next poll.
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
        }
        return false;
    }

    uidOut = readRfidUid();
    if (uidOut.length() == 0) {
        consecutiveRfidReadFailures++;
        if (consecutiveRfidReadFailures >= RFID_READ_FAILURE_RESET_THRESHOLD &&
            millis() - lastRfidReadFailureReset > RFID_READ_FAILURE_RESET_COOLDOWN) {
            Serial.println("Card detected but UID was empty repeatedly — resetting RFID");
            reinitializeRfidReader();
            consecutiveRfidReadFailures = 0;
            lastRfidReadFailureReset = millis();
        } else {
            Serial.println("Card detected but UID was empty — retrying");
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
        }
        return false;
    }

    consecutiveRfidReadFailures = 0;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return true;
}

// Offline counterpart to handleRfidTap()'s live flow below: validates the
// tap against the local LittleFS card cache (synced down while last
// online) instead of a live server round-trip, dispenses if valid, and
// queues the resulting transaction for POST /api/rfid-payment/offline-sync
// once the machine reconnects. See the file-header comment for the full
// design and its accepted limitations.
void handleOfflineRfidTap(const String& uid) {
    if (!cardsCacheLoaded) {
        // Never successfully synced even once (e.g. a brand-new machine
        // that's never been online) — nothing to validate against.
        lcdMsg("Network Error", "Try again");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    JsonObject card = findCachedCard(uid);
    if (card.isNull()) {
        lcdMsg("Card Not Found", "Unregistered");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    bool active = card["is_active"] | true;
    if (!active) {
        lcdMsg("Card Inactive", "Contact Admin");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    String cardType = card["card_type"] | "prepaid";
    bool isPostpaid = (cardType == "postpaid");
    if (!isPostpaid && (int)(card["credits_remaining"] | 0) <= 0) {
        lcdMsg("No Credits Left", "Please Top Up");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    // Every card is capped at MONTHLY_VEND_LIMIT taps/month regardless of
    // card_type — enforced here too since a machine can be offline for the
    // whole cap, not just re-checked once it reconnects.
    if ((int)(card["monthly_remaining"] | 0) <= 0) {
        lcdMsg("Monthly Limit", "Reached");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        lcdMsg("Out of Stock", "Please wait...");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    String productId = card["product_id"].as<String>();
    if (productId.length() == 0) productId = defaultProductId;

    lcdMsg("Dispensing...", "Please wait");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);

    bool dispensed = dispenseProductByMotor(productId);

    if (dispensed) {
        // Update the local cache and persist immediately — must survive a
        // reboot mid-outage just as reliably as the queue entry does below,
        // or a second offline tap (or the same card after a reboot) could
        // spend credits the cache no longer actually reflects.
        if (!isPostpaid) {
            card["credits_remaining"] = (int)(card["credits_remaining"] | 0) - 1;
        } else {
            card["vend_count"] = (int)(card["vend_count"] | 0) + 1;
        }
        card["monthly_remaining"] = (int)(card["monthly_remaining"] | 0) - 1;
        saveCardsCacheToFS();

        queueOfflineTransaction(uid, productId);

        lcdMsg("Please Collect", "Your Napkin");
        syncTotalStockToServer(productId);  // no-op network-wise while offline — makeHTTPRequest() short-circuits instantly
        delay(3000);
        lcdMsg("Thank You!", "");
        delay(3000);
    } else {
        // Nothing was charged offline (no live server to charge), so
        // there's nothing to refund either, unlike voidRfidPayment() in the
        // online flow below.
        lcdMsg("Dispense Failed", "Please wait...");
        delay(3000);
    }

    sendStockAwareStatus();
}

void handleRfidTap(const String& uid) {
    Serial.println("\nRFID tap detected: " + uid);

    if (!isNetworkConnected()) {
        handleOfflineRfidTap(uid);
        return;
    }

    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        lcdMsg("Out of Stock", "Please wait...");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    String payload;
    payload.reserve(160);
    if (defaultProductId.length() > 0) {
        payload = "{\"machine_id\":\"" + machineId + "\",\"card_uid\":\"" + uid +
                  "\",\"product_id\":\"" + defaultProductId + "\"}";
    } else {
        payload = "{\"machine_id\":\"" + machineId + "\",\"card_uid\":\"" + uid + "\"}";
    }

    String responseBody;
    int code = makeHTTPRequest(apiUrl("/api/rfid-payment"), "POST", payload, &responseBody);
    Serial.printf("RFID payment response code: %d\n", code);
    Serial.println("RFID payment response body: " + responseBody);

    if (code == -1) {
        // isNetworkConnected() said we were online (it only checks the
        // last-known DHCP IP, which doesn't clear just because the cable
        // was physically pulled — see checkEthernetLinkStatus()), but the
        // actual TCP connect just failed, so we really are offline right
        // now. makeEthernetHTTPRequest() already flipped ethernetConnected
        // false for future taps; nothing was charged since the request
        // never completed, so it's safe to retry THIS tap through the
        // offline cache/queue path instead of dropping it.
        Serial.println("Online payment attempt failed at the connection level — retrying this tap offline");
        handleOfflineRfidTap(uid);
        return;
    }

    if (code == 200) {
        DynamicJsonDocument doc(768);
        DeserializationError err = deserializeJson(doc, responseBody);
        String dispenseProductId = defaultProductId;
        String paymentId = "";
        if (!err && doc.containsKey("data")) {
            if (doc["data"].containsKey("product_id")) dispenseProductId = doc["data"]["product_id"].as<String>();
            if (doc["data"].containsKey("payment_id")) paymentId = doc["data"]["payment_id"].as<String>();
        }
        dispenseSequence(dispenseProductId, paymentId);
        return;
    }

    DynamicJsonDocument errDoc(512);
    deserializeJson(errDoc, responseBody);
    String errCode = errDoc["error"]["code"] | "";

    if (errCode == "CARD_NOT_FOUND") lcdMsg("Card Not Found", "Unregistered");
    else if (errCode == "INSUFFICIENT_CREDITS") lcdMsg("No Credits Left", "Please Top Up");
    else if (errCode == "CARD_INACTIVE") lcdMsg("Card Inactive", "Contact Admin");
    else if (errCode == "WRONG_MACHINE") lcdMsg("Card Not Valid", "On This Machine");
    else if (errCode == "MONTHLY_LIMIT_REACHED") lcdMsg("Monthly Limit", "Reached");
    else if (errCode == "OUT_OF_STOCK") lcdMsg("Out of Stock", "Please wait...");
    else lcdMsg("Payment Failed", "Try Again");

    delay(2500);
    sendStockAwareStatus();
}

// ==================== SETUP ====================

void setup() {
    Serial.begin(115200);
    Serial.println("\nLyra RFID Vending Machine (Single Motor) " + String(CURRENT_FIRMWARE_VERSION));

    bootId = esp_random();

    initializeWatchdog();
    EEPROM.begin(EEPROM_SIZE);  // opened once — all helpers assume this is already done

    if (!LittleFS.begin(true)) {  // true = format on mount failure
        Serial.println("LittleFS mount FAILED — offline card cache/queue unavailable this boot. Check the board's partition scheme includes a filesystem region.");
    } else {
        loadCardsCacheFromFS();
        loadDefaultProductFromFS();
        loadTimeAnchorFromFS();
    }

    pinMode(TRANSISTOR_BASE, OUTPUT);
    digitalWrite(TRANSISTOR_BASE, LOW);
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(RESET_PIN, INPUT_PULLUP);

    Wire.begin(LCD_SDA, LCD_SCL);
    lcd.begin(16, 2);
    lcd.backlight();
    lcdMsg("Lyra Vending", String(CURRENT_FIRMWARE_VERSION));
    delay(1000);

    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RFID_SS);
    rfid.PCD_Init();
    delay(50);
    byte rfidVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("RFID reader version: 0x%02X %s\n", rfidVersion,
                  (rfidVersion == 0x00 || rfidVersion == 0xFF) ? "(NOT DETECTED - check wiring)" : "(OK)");

    getMACAddress();   // backend identifies the machine by MAC
    deriveEthernetMAC();

    // Ethernet is the only transport and there's no fallback to give up to
    // — boot never blocks waiting for it. A handful of quick attempts
    // (progress shown on the LCD), then proceed into loop() regardless,
    // dispensing offline from whatever LittleFS card cache survived from a
    // prior sync until it connects in the background
    // (checkForEthernetRecovery() in loop()).
    Serial.println("Attempting Ethernet connection...");
    lcdMsg("Connecting...", "Please wait");
    bool ethernetUp = false;
    for (int ethAttempt = 1; ethAttempt <= 3; ethAttempt++) {
        if (initializeEthernet()) {
            ethernetUp = true;
            break;
        }
        Serial.printf("Ethernet not ready (attempt %d/3) - retrying...\n", ethAttempt);
        lcdMsg("Connecting...", "Check LAN cable");
        feedWatchdog();
        delay(3000);
        feedWatchdog();
    }

    reinitializeRfidReader();

    if (ethernetUp) {
        Serial.println("Using Ethernet");
        syncTimeFromServer();  // before syncQueueToServer() below, so any queued taps' offline_ms_ago is as accurate as possible
        fetchMachineInfoFromBackend(deviceMacAddress);
        if (machineId == "UNKNOWN") {
            // Same first-connection-after-bring-up issue as
            // checkForEthernetRecovery() — see the comment there.
            delay(1500);
            ethernetConnected = true;
            useEthernet = true;
            fetchMachineInfoFromBackend(deviceMacAddress);
        }
        if (machineId != "UNKNOWN") {
            fetchMachineProducts();
            syncCardsFromServer();
            syncQueueToServer();
        }
        feedWatchdog();
        sendMachineStatusPing();
        lastPingTime = millis();
    } else {
        Serial.println("Ethernet not available after 3 attempts — proceeding offline, will keep retrying in the background");
    }

    sendStockAwareStatus();
}

// ==================== MAIN LOOP ====================

void loop() {
    feedWatchdog();

#ifdef USE_ETHERNET
    checkEthernetLinkStatus();
    checkForEthernetRecovery();
#endif

    updateIdleDisplay();

    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command == "ping") sendMachineStatusPing();
        else if (command == "fetch") {
            fetchMachineInfoFromBackend(deviceMacAddress);
            if (machineId != "UNKNOWN") fetchMachineProducts();
        } else if (command == "status") {
            Serial.println("Firmware: " + String(CURRENT_FIRMWARE_VERSION));
            Serial.println("Machine ID: " + machineId);
            Serial.println("Network: " + String(isNetworkConnected() ? "Ethernet (connected)" : "Offline"));
            Serial.println("IP: " + Ethernet.localIP().toString());
            Serial.printf("Cards cached: %s (%d)\n", cardsCacheLoaded ? "yes" : "no",
                          cardsCacheLoaded ? cardsCache["cards"].as<JsonArray>().size() : 0);
            Serial.printf("Queued offline transactions: %d\n", getQueueLineCount());
            Serial.println("Stock: " + String(readMotorStockFromEEPROM()));
        } else if (command == "dispense") {
            if (dispenseProductByMotor(defaultProductId)) syncTotalStockToServer(defaultProductId);
        } else if (command == "rfid-raw") {
            rfidRawBitBangTest();
        } else if (command == "sync-cards") {
            Serial.println(syncCardsFromServer() ? "Card cache synced" : "Card sync failed (offline, or an error)");
        } else if (command == "sync-queue") {
            syncQueueToServer();
#ifdef USE_ETHERNET
        } else if (command == "diag") {
            printEthernetDiagnostics();
        } else if (command == "scan-eth") {
            scanEthernetPins();
        } else if (command == "reset-eth") {
            resetEthernetModule();
            if (initializeEthernet()) Serial.println("Ethernet reinitialized");
            else Serial.println("Ethernet reinit failed");
#endif
        }
    }

    static unsigned long lastResetDebounce = 0;
    if (digitalRead(RESET_PIN) == LOW && millis() - lastResetDebounce > 300) {
        lastResetDebounce = millis();
        refillStock();
        lcdMsg("Stock Refilled", String(MAX_STOCK) + " units");
        delay(1000);
        sendStockAwareStatus();
        syncTotalStockToServer(defaultProductId);
        sendMachineStatusPing();
    }

    if (millis() - lastPingTime > 120000) {
        if (isNetworkConnected()) sendMachineStatusPing();
        lastPingTime = millis();
    }

    static unsigned long lastCardSyncDown = 0;
    if (isNetworkConnected() && millis() - lastCardSyncDown > CARD_SYNC_DOWN_INTERVAL) {
        lastCardSyncDown = millis();
        syncCardsFromServer();
    }

    if (millis() - lastRfidReinit > RFID_REINIT_INTERVAL) {
        lastRfidReinit = millis();
        byte rfidVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
        if (rfidVersion == 0x00 || rfidVersion == 0xFF) {
            Serial.printf("RFID reader unhealthy on periodic health check (0x%02X) — reinit\n", rfidVersion);
            reinitializeRfidReader();
        } else {
            rfid.PCD_Init();
            rfid.PCD_AntennaOn();
            rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
        }
    }

    static unsigned long lastTapMs = 0;
    unsigned long rfidPollInterval = rfidHardwarePresent ? RFID_POLL_INTERVAL_HEALTHY : RFID_POLL_INTERVAL_UNHEALTHY;
    if (millis() - lastTapMs > rfidPollInterval) {
        lastTapMs = millis();
        String uid = "";
        if (tryReadTapUid(uid)) {
            Serial.println("RFID tap detected: " + uid);
            handleRfidTap(uid);
        }
    }
}
