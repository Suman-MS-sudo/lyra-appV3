// ESP32 firmware for Lyra vending machine — RFID-ONLY payment mode
// BODY TYPE: QUAD MOTOR — 100 napkin capacity (4 dispensers x 25 each)
//
// Same payment flow and architecture as the single-motor variant, extended
// to drive 4 independent dispenser motors that all vend the same product
// (this machine's assigned product/price is still a single machine_products
// row — the 4 motors are just 4 physical hoppers refilling from one SKU).
// Each tap fires whichever motor still has stock, round-robin, so wear and
// hopper depletion stay balanced across all 4 rather than draining motor 1
// first every time.
//
// Hardware:
//   RFID reader: MFRC522, SS=GPIO15, RST=GPIO27, shared SPI bus (SCK18/MISO19/MOSI23)
//   Display: HW-61 1602A LCD (16x2, PCF8574 I2C backpack), SDA=GPIO21, SCL=GPIO22,
//            I2C addr 0x27 (try 0x3F if blank)
//   Library: "LiquidCrystal I2C" by Frank de Brabander (install via Library Manager)
//   Motors: 4 dispensers on GPIO5 / GPIO32 / GPIO33 / GPIO26 via transistors/relays
//           (GPIO12 deliberately avoided — it's a flash-voltage strapping pin,
//           unsafe to use for anything that could float HIGH during boot)
//
// ESP32-specific optimizations applied:
//   - EEPROM.begin() called exactly once at boot, not per read/write.
//   - JSON payloads built into pre-reserved String buffers instead of
//     unbounded chained concatenation, to reduce heap fragmentation.
//   - Per-motor stock stored as 4 separate EEPROM bytes so a single motor
//     jam/miscount never corrupts the other 3 hoppers' counts.
//
// Ethernet (LAN) support: ported from IOT_Wifi_LAN's coin/Ethernet firmware.
// Tried first at boot; if no ENC28J60 module/cable is detected it falls back
// to WiFi automatically. UIPEthernet can't do TLS, so while on Ethernet all
// API calls go through the plain-HTTP proxy (ETHERNET_SERVER_BASE, port 8080
// in dev / lyra-app.co.in:8080 in prod) instead of the HTTPS SERVER_BASE.
// See the ETHERNET_CS comment near the pin definitions for the CS pin caveat.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <EEPROM.h>
#include <WebServer.h>
#include <esp_wifi.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <SPI.h>
#include <MFRC522.h>
#include <esp_task_wdt.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Ethernet support (optional) — module: HANRUN HR911105A (ENC28J60-based),
// shares the RFID/LCD SPI bus (SCK18/MISO19/MOSI23) via its own CS line.
// Comment out USE_ETHERNET to build WiFi-only. When enabled, Ethernet is
// tried first at boot; if no hardware/cable is detected it falls back to
// WiFi automatically, so this is safe to leave on for WiFi-only machines too.
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
#define CURRENT_FIRMWARE_VERSION "RFID-QUAD-V1.0.0"
#define BODY_TYPE "quad_motor"

// ==================== WATCHDOG CONFIGURATION ====================
#define WDT_TIMEOUT 1800  // seconds (30 minutes)

// ==================== PIN DEFINITIONS ====================
#define EEPROM_SIZE 256
#define WIFI_RESET_BUTTON_PIN 4
#define BLUE_LED_PIN 2
#define RESET_PIN 13   // GPIO21 is taken by the LCD's I2C SDA

// RFID reader (MFRC522)
#define RFID_SS   15
#define RFID_RST  27
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

// ==================== MOTOR / CAPACITY CONFIG ====================
#define MOTOR_COUNT 4
const uint8_t MOTOR_PINS[MOTOR_COUNT] = { 5, 32, 33, 26 };
#define MAX_STOCK_PER_MOTOR 25
#define MAX_STOCK_TOTAL (MAX_STOCK_PER_MOTOR * MOTOR_COUNT)  // 100

// EEPROM: one byte per motor at addresses 64..67
#define MOTOR_STOCK_BASE_ADDR 64

// Which motor to try first on the next tap (round-robin cursor), persisted
// so a power cut mid-cycle doesn't reset the machine back to always firing
// M1 first — see readNextMotorIndex()/writeNextMotorIndex() below.
#define NEXT_MOTOR_ADDR 68

MFRC522 rfid(RFID_SS, RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// ==================== GLOBAL VARIABLES ====================
WebServer server(80);
bool provisioningMode = false;
String deviceMacAddress;
String machineId = "UNKNOWN";
String machineName = "UNKNOWN";
String defaultProductId = "";
unsigned long lastPingTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long wifiReconnectAttempts = 0;
uint8_t nextMotorIndex = 0;  // round-robin cursor across taps; overwritten from EEPROM in setup()

// Idle-display rotation: while ready and untouched, the LCD alternates
// between the "Tap Card" prompt and a per-motor stock breakdown so an
// operator can see hopper levels at a glance. Driven from loop() via
// updateIdleDisplay(), never via delay(), so it never blocks RFID polling.
enum MachineStatus { STATUS_READY, STATUS_OUT_OF_STOCK, STATUS_NETWORK_ERROR };
MachineStatus currentStatus = STATUS_NETWORK_ERROR;
uint8_t idleScreenIndex = 0;
unsigned long lastIdleScreenChange = 0;
#define IDLE_SCREEN_INTERVAL 3000  // ms each idle screen is shown

bool useEthernet = false;
bool ethernetConnected = false;
#ifdef USE_ETHERNET
byte ethernetMAC[6] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
EthernetClient ethClient;
unsigned long lastEthernetRecoveryCheck = 0;
// LAN is preferred over WiFi whenever both are viable, so while running on
// WiFi (LAN previously lost, or never came up at boot) this periodically
// re-probes for it via the same initializeEthernet() used at boot, and
// switches back automatically the moment it succeeds. Interval is a
// tradeoff: initializeEthernet() blocks for several seconds (hardware
// detect + a real DHCP attempt, the only reliable way to test a LAN since
// the ENC28J60's linkStatus() is known-unreliable — see the comment in
// initializeEthernet()), so checking too often would repeatedly stall RFID
// tap polling for no benefit.
#define ETHERNET_RECOVERY_CHECK_INTERVAL 60000
#endif

#define TESTING_LOCAL
#ifdef TESTING_LOCAL
String SERVER_BASE = "https://192.168.29.33";
// UIPEthernet can't do TLS, so Ethernet requests go through the plain-HTTP
// proxy instead (npm run dev starts this alongside the HTTPS server on :8080).
String ETHERNET_SERVER_BASE = "http://192.168.29.33:8080";
#else
String SERVER_BASE = "https://lyra-app.co.in";
String ETHERNET_SERVER_BASE = "http://lyra-app.co.in:8080";
#endif

// ==================== FORWARD DECLARATIONS ====================
String fetchMachineInfoFromBackend(const String& mac);
void fetchMachineProducts();
bool dispenseFromNextAvailableMotor(String productId = "", String paymentId = "");
void reportDispenseMotor(const String& paymentId, uint8_t motorIndex);
void voidRfidPayment(const String& paymentId);
void sendMachineStatusPing();
bool isHTTPS(const String& url);
HTTPClient* getHTTPClient(const String& url);
bool isNetworkConnected();
String extractJsonFromString(const String &s);
void lcdMsg(const String& line0, const String& line1 = "");
void sendStockAwareStatus();
void sendStockAwareErrorStatus();
void updateIdleDisplay();
void initializeWatchdog();
void feedWatchdog();
void maintainWiFiConnection();
void ensureWiFiStability();
int makeHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* responseBody = nullptr);
void handleRfidTap(const String& uid);
String apiUrl(const String& path);
#ifdef USE_ETHERNET
int makeEthernetHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* outBody = nullptr);
bool initializeEthernet();
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

// Builds a request URL for whichever transport is currently active.
// UIPEthernet can't do TLS, so while on Ethernet requests are routed
// through the plain-HTTP proxy (ETHERNET_SERVER_BASE) instead of the
// HTTPS SERVER_BASE used over WiFi.
String apiUrl(const String& path) {
    if (useEthernet && ethernetConnected) return ETHERNET_SERVER_BASE + path;
    return SERVER_BASE + path;
}

// ==================== EEPROM FUNCTIONS ====================
// EEPROM.begin() is called once in setup() — these helpers assume the
// buffer is already resident and only call commit() after a write.

void eepromWriteString(int addr, const String &value, int maxLen) {
    int len = min((int)value.length(), maxLen - 1);
    EEPROM.write(addr, len);
    for (int i = 0; i < len; ++i) EEPROM.write(addr + 1 + i, value[i]);
    EEPROM.write(addr + 1 + len, '\0');
    EEPROM.commit();
}

String eepromReadStringSafe(int addr, int maxLen) {
    int len = EEPROM.read(addr);
    if (len <= 0 || len >= maxLen) return String("");
    String v;
    v.reserve(len);
    for (int i = 0; i < len; ++i) {
        char c = EEPROM.read(addr + 1 + i);
        if (c == '\0') break;
        v += c;
    }
    return v;
}

void saveWiFiCredentials(String ssid, String password) {
    eepromWriteString(0, ssid, 32);
    eepromWriteString(32, password, 64);
}

// ---- Per-motor stock helpers ----

int readMotorStock(uint8_t motorIndex) {
    int count = EEPROM.read(MOTOR_STOCK_BASE_ADDR + motorIndex);
    if (count < 0 || count > MAX_STOCK_PER_MOTOR) count = MAX_STOCK_PER_MOTOR;
    return count;
}

void writeMotorStock(uint8_t motorIndex, int count) {
    EEPROM.write(MOTOR_STOCK_BASE_ADDR + motorIndex, count);
    EEPROM.commit();
}

int readTotalStockFromEEPROM() {
    int total = 0;
    for (uint8_t i = 0; i < MOTOR_COUNT; i++) total += readMotorStock(i);
    return total;
}

void refillAllMotors() {
    for (uint8_t i = 0; i < MOTOR_COUNT; i++) EEPROM.write(MOTOR_STOCK_BASE_ADDR + i, MAX_STOCK_PER_MOTOR);
    EEPROM.write(NEXT_MOTOR_ADDR, 0);
    EEPROM.commit();
    nextMotorIndex = 0;
}

// ---- Round-robin cursor persistence ----
// Survives power loss: without this, a reboot right after (say) M1 fires
// would forget that M2 is next and start the cycle over at M1 again, even
// though M1's own stock count (which IS persisted) correctly shows one used.

uint8_t readNextMotorIndex() {
    int idx = EEPROM.read(NEXT_MOTOR_ADDR);
    if (idx < 0 || idx >= MOTOR_COUNT) idx = 0;
    return (uint8_t)idx;
}

void writeNextMotorIndex(uint8_t idx) {
    EEPROM.write(NEXT_MOTOR_ADDR, idx);
    EEPROM.commit();
}

// Syncs the combined total stock to the backend — the web app only tracks
// one stock number per machine_products row regardless of how many motors
// physically hold that product.
void syncTotalStockToServer(String productId = "") {
    int total = readTotalStockFromEEPROM();
    Serial.printf("Total stock across %d motors: %d\n", MOTOR_COUNT, total);

    if (productId.length() > 0 && machineId != "UNKNOWN" && machineId.length() > 0) {
        String payload;
        payload.reserve(220);
        payload = "{\"machine_id\":\"" + machineId + "\",\"product_id\":\"" + productId +
                  "\",\"quantity\":" + String(total) + ",\"mode\":\"set\",\"motor_stock\":[" +
                  String(readMotorStock(0)) + "," + String(readMotorStock(1)) + "," +
                  String(readMotorStock(2)) + "," + String(readMotorStock(3)) + "]}";
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

void ensureWiFiStability() {
    WiFi.setSleep(false);
    esp_wifi_set_ps(WIFI_PS_NONE);
    WiFi.setAutoReconnect(true);
}

void maintainWiFiConnection() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected! Reconnecting...");
        wifiReconnectAttempts++;

        String ssid = eepromReadStringSafe(0, 32);
        String password = eepromReadStringSafe(32, 64);

        if (ssid.length() > 0) {
            WiFi.disconnect();
            delay(1000);
            WiFi.begin(ssid.c_str(), password.c_str());

            int attempts = 0;
            while (WiFi.status() != WL_CONNECTED && attempts < 20) {
                delay(500);
                feedWatchdog();
                attempts++;
            }

            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("WiFi reconnected! IP: " + WiFi.localIP().toString());
                ensureWiFiStability();
                digitalWrite(BLUE_LED_PIN, HIGH);
                sendStockAwareStatus();
                wifiReconnectAttempts = 0;
            } else {
                Serial.println("WiFi reconnection failed");
                sendStockAwareErrorStatus();
                if (wifiReconnectAttempts > 5) {
                    Serial.println("Multiple WiFi failures, rebooting...");
                    delay(1000);
                    ESP.restart();
                }
            }
        }
    }
}

// ==================== LCD DISPLAY FUNCTIONS ====================

// REQUIRES a library-side addition: LiquidCrystal_I2C::resync4bit() (added
// to the installed library — reapply if it's ever reinstalled/updated).
// The library never checks Wire.endTransmission()'s return value anywhere,
// so a single dropped/NACKed I2C transaction — plausible on this board
// given the motor rail noise already called out in dispenseFromNextAvailableMotor()
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

void sendStockAwareStatus() {
    int stock = readTotalStockFromEEPROM();
    if (stock <= 0) {
        currentStatus = STATUS_OUT_OF_STOCK;
        lcdMsg("Out of Stock", "Please wait...");
        Serial.println("Status: Out of stock");
    } else if (isNetworkConnected()) {
        currentStatus = STATUS_READY;
        idleScreenIndex = 0;
        lastIdleScreenChange = millis();
        lcdMsg("Lyra Vending", "Tap Card...");
        Serial.println("Status: Ready");
    } else {
        currentStatus = STATUS_NETWORK_ERROR;
        lcdMsg("Network Error", "Reconnecting...");
        Serial.println("Status: Network error");
    }
}

void sendStockAwareErrorStatus() {
    int stock = readTotalStockFromEEPROM();
    if (stock <= 0) {
        currentStatus = STATUS_OUT_OF_STOCK;
        lcdMsg("Out of Stock", "Please wait...");
    } else {
        currentStatus = STATUS_NETWORK_ERROR;
        lcdMsg("Network Error", "Reconnecting...");
    }
}

// Rotates the LCD between the "Tap Card" prompt and a per-motor stock
// breakdown while idle and ready. Called every loop() iteration — only
// acts once IDLE_SCREEN_INTERVAL has elapsed, and never uses delay(), so
// it can't stall RFID tap polling or any other loop() work.
void updateIdleDisplay() {
    if (currentStatus != STATUS_READY) return;
    if (millis() - lastIdleScreenChange < IDLE_SCREEN_INTERVAL) return;

    lastIdleScreenChange = millis();
    idleScreenIndex = (idleScreenIndex + 1) % 2;

    if (idleScreenIndex == 0) {
        lcdMsg("Lyra Vending", "Tap Card...");
    } else {
        String line0 = "M1:" + String(readMotorStock(0)) + " M2:" + String(readMotorStock(1));
        String line1 = "M3:" + String(readMotorStock(2)) + " M4:" + String(readMotorStock(3));
        lcdMsg(line0, line1);
    }
}

// ==================== NETWORK FUNCTIONS ====================

bool isHTTPS(const String& url) { return url.startsWith("https://"); }

bool isNetworkConnected() {
#ifdef USE_ETHERNET
    if (useEthernet) {
        IPAddress ip = Ethernet.localIP();
        return ethernetConnected && (ip != IPAddress(0,0,0,0));
    }
#endif
    return WiFi.status() == WL_CONNECTED;
}

HTTPClient* getHTTPClient(const String& url) {
    static HTTPClient http;
    static WiFiClientSecure* secureClient = nullptr;

    if (secureClient) { delete secureClient; secureClient = nullptr; }

#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) return nullptr; // caller routes through makeEthernetHTTPRequest instead
#endif

    if (isHTTPS(url)) {
        secureClient = new WiFiClientSecure;
        secureClient->setInsecure();
        secureClient->setTimeout(45000);
        secureClient->setHandshakeTimeout(30000);
        http.setReuse(false);
        http.begin(*secureClient, url);
    } else {
        http.begin(url);
    }

    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setTimeout(20000);
    http.setUserAgent("ESP32-Lyra-RFID-Quad/" + String(CURRENT_FIRMWARE_VERSION));
    http.addHeader("Connection", "close");
    http.addHeader("Accept", "application/json");
    http.addHeader("X-Machine-ID", machineId);
    http.addHeader("X-Firmware-Version", CURRENT_FIRMWARE_VERSION);

    return &http;
}

int makeHTTPRequest(const String& url, const String& method, const String& payload, String* responseBody) {
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        int result = makeEthernetHTTPRequest(url, method, payload, responseBody);
        if (result < 0 && !useEthernet) {
            Serial.println("Ethernet request failed, retrying over WiFi...");
            // fall through to the WiFi path below
        } else {
            return result;
        }
    }
#endif

    HTTPClient* http = getHTTPClient(url);
    if (http == nullptr) return -1;

    int code = -1;
    if (method == "POST") {
        http->addHeader("Content-Type", "application/json");
        code = http->POST(payload);
    } else {
        code = http->GET();
    }

    if (responseBody != nullptr && code > 0) *responseBody = http->getString();

    http->end();
    return code;
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
    bool connected = false;
    for (int attempt = 0; attempt < 3; attempt++) {
        if (ethClient.connect(host.c_str(), port)) {
            connected = true;
            Serial.println("OK");
            break;
        }
        if (attempt < 2) {
            ethClient.stop();
            delay(500);
        }
    }

    if (!connected) {
        Serial.println("Failed!");
        ethernetConnected = false;
        useEthernet = false;
        Serial.println("Switching to WiFi...");
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
    return code;
}

// ==================== ETHERNET MANAGEMENT FUNCTIONS ====================

bool initializeEthernet() {
    unsigned long startTime = millis();
    Serial.println("Initializing Ethernet...");
    Serial.printf("Ethernet Pins - CS:%d, MOSI:%d, MISO:%d, SCK:%d\n",
                 ETHERNET_CS, SPI_MOSI, SPI_MISO, SPI_SCK);

    // Hardware detection gets its own retry loop, separate from the DHCP
    // retry below. The ENC28J60 occasionally reads back EthernetNoHardware
    // on the very first SPI probe right after power-up — oscillator not
    // fully settled yet, or a brief SPI bus hiccup — even though the module
    // is physically fine and would detect correctly a moment later. Without
    // this, one transient misread was enough to make the machine give up on
    // Ethernet entirely for the rest of the boot (and, on machines with no
    // WiFi credentials saved, drop straight into AP provisioning — fully
    // offline until manually power-cycled).
    uint8_t hwStatus = EthernetNoHardware;
    for (int hwAttempt = 0; hwAttempt < 3; hwAttempt++) {
        if (hwAttempt > 0) {
            Serial.printf("Hardware detection retry %d/3...\n", hwAttempt + 1);
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
    for (int attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            Serial.printf("Retry attempt %d/2...\n", attempt + 1);
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
        while (millis() - dhcpStart < 5000) {
            feedWatchdog();
            checkIP = Ethernet.localIP();
            if (checkIP != IPAddress(0,0,0,0) && checkIP[0] != 0) {
                gotIP = true;
                break;
            }
            delay(100);
        }

        if (gotIP) {
            delay(500);
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

    Serial.println("DHCP failed - falling back to WiFi");
    return false;
}

void checkEthernetLinkStatus() {
    if (!useEthernet) return;

    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 5000) {
        Ethernet.maintain();
        IPAddress ip = Ethernet.localIP();
        if (ip == IPAddress(0,0,0,0) || ip[0] == 0) {
            Serial.println("Ethernet lost IP address! Switching to WiFi...");
            ethernetConnected = false;
            useEthernet = false;
            sendStockAwareErrorStatus();
            lastWiFiCheck = 0; // force an immediate WiFi reconnect attempt on the next loop() iteration instead of waiting up to 30s
        }
        lastCheck = millis();
    }
}

// LAN-recovery counterpart to checkEthernetLinkStatus() above: LAN is this
// machine's actual preferred transport (WiFi/provisioning are only ever a
// fallback for when LAN isn't up), so this periodically re-attempts the
// same boot-time Ethernet bring-up regardless of what it's currently
// running on — WiFi, or even still sitting in setup-AP provisioning mode
// with no network at all — and switches back the moment it succeeds,
// without needing a manual "reset-eth" or a reboot.
void checkForEthernetRecovery() {
    if (useEthernet) return;
    if (millis() - lastEthernetRecoveryCheck < ETHERNET_RECOVERY_CHECK_INTERVAL) return;
    lastEthernetRecoveryCheck = millis();

    Serial.println("Probing for LAN recovery...");
    if (initializeEthernet()) {
        Serial.println("LAN recovered - switching to Ethernet");

        if (provisioningMode) {
            // Was sitting in WiFi setup mode (its own AP, waiting to be
            // configured) because LAN wasn't up at boot and no WiFi
            // credentials were saved either. LAN coming up makes that
            // moot — tear down the setup AP/web server and resume as a
            // normal Ethernet-connected machine instead of waiting
            // indefinitely for someone to finish WiFi setup by hand.
            Serial.println("Exiting WiFi provisioning mode - LAN took over");
            server.stop();
            WiFi.softAPdisconnect(true);
            provisioningMode = false;
        }

        fetchMachineInfoFromBackend(deviceMacAddress);
        fetchMachineProducts();
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
    WiFi.mode(WIFI_STA);
    delay(50);
    String mac = WiFi.macAddress();
    mac.toUpperCase();
    deviceMacAddress = mac;
    Serial.println("MAC: " + deviceMacAddress);
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
            }
        }
    } else {
        Serial.printf("Failed to fetch products: %d\n", code);
    }
}

void sendMachineStatusPing() {
    int currentStock = readTotalStockFromEEPROM();

    String payload;
    payload.reserve(220);
    payload = "{\"machine_id\":\"" + machineId + "\",";
    payload += "\"firmware_version\":\"" + String(CURRENT_FIRMWARE_VERSION) + "\",";
    payload += "\"body_type\":\"" + String(BODY_TYPE) + "\",";
    payload += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
    payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
    payload += "\"uptime\":" + String(millis()) + ",";
    payload += "\"stock_count\":" + String(currentStock);
    payload += "}";

    int code = makeHTTPRequest(apiUrl("/api/machine-ping"), "POST", payload);

    if (code == 200) Serial.printf("Machine ping successful (Stock: %d)\n", currentStock);
    else Serial.printf("Machine ping failed: %d\n", code);
}

// ==================== DISPENSE FUNCTIONS ====================

// Tells the backend which physical motor served a given RFID payment, so
// the customer-facing report can show "M1".."M4" per transaction instead of
// just the aggregate stock number. Best-effort: a failure here doesn't
// affect the dispense itself, which has already physically happened.
void reportDispenseMotor(const String& paymentId, uint8_t motorIndex) {
    if (paymentId.length() == 0) return;
    String payload;
    payload.reserve(96);
    payload = "{\"payment_id\":\"" + paymentId + "\",\"motor_index\":" + String(motorIndex) + "}";
    int code = makeHTTPRequest(apiUrl("/api/rfid-payment/motor"), "POST", payload);
    if (code != 200) Serial.printf("Failed to report dispense motor: %d\n", code);
}

// /api/rfid-payment charges/deducts the card BEFORE this machine has
// physically attempted to dispense anything (see dispenseSequence()). If
// every motor turns out to be empty, the customer would otherwise be
// charged for nothing with no record anything went wrong. Called right
// after that happens, to refund the card and mark the payment undelivered.
void voidRfidPayment(const String& paymentId) {
    if (paymentId.length() == 0) return;
    String payload;
    payload.reserve(64);
    payload = "{\"payment_id\":\"" + paymentId + "\"}";
    int code = makeHTTPRequest(apiUrl("/api/rfid-payment/void"), "POST", payload);
    if (code != 200) Serial.printf("Failed to void RFID payment: %d\n", code);
    else Serial.println("RFID payment voided/refunded (dispense failed)");
}

// Round-robin across the 4 motors, skipping any that are already empty.
// Returns true if a motor fired, false if every hopper is empty.
bool dispenseFromNextAvailableMotor(String productId, String paymentId) {
    for (uint8_t attempt = 0; attempt < MOTOR_COUNT; attempt++) {
        uint8_t idx = (nextMotorIndex + attempt) % MOTOR_COUNT;
        int stock = readMotorStock(idx);
        if (stock > 0) {
            Serial.printf("Firing motor %d (stock before: %d)\n", idx, stock);
            digitalWrite(MOTOR_PINS[idx], HIGH);
            delay(2830);
            digitalWrite(MOTOR_PINS[idx], LOW);

            // Let the supply rail settle after the motor's turn-off transient before
            // keying up network TX for the stock-sync call below — back-to-back with
            // no gap, the motor's inrush/back-EMF and the radio's current spike can
            // stack and sag the rail enough to corrupt in-flight UART bytes.
            delay(150);

            writeMotorStock(idx, stock - 1);
            nextMotorIndex = (idx + 1) % MOTOR_COUNT;
            writeNextMotorIndex(nextMotorIndex);

            syncTotalStockToServer(productId);
            reportDispenseMotor(paymentId, idx);
            Serial.printf("Motor %d stopped. New motor stock: %d, total: %d\n", idx, stock - 1, readTotalStockFromEEPROM());
            return true;
        }
    }

    Serial.println("All 4 motors empty!");
    lcdMsg("Out of Stock", "Please wait...");
    return false;
}

void dispenseSequence(String productId, String paymentId) {
    lcdMsg("Dispensing...", "Please wait");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);

    bool dispensed = dispenseFromNextAvailableMotor(productId, paymentId);

    if (dispensed) {
        lcdMsg("Please Collect", "Your Napkin");
        delay(3000);
        lcdMsg("Thank You!", "");
        delay(3000);
    } else {
        // The backend already charged/deducted this tap before we got here
        // (dispenseFromNextAvailableMotor() only returns false when this
        // machine's own EEPROM stock is exhausted — a real, detectable
        // failure, distinct from a jam/mechanical fault which no sensor
        // here can catch) — refund it rather than silently keeping the
        // customer's money for a napkin they never got.
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

void handleRfidTap(const String& uid) {
    Serial.println("\nRFID tap detected: " + uid);

    if (!isNetworkConnected()) {
        lcdMsg("Network Error", "Try again");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    int stock = readTotalStockFromEEPROM();
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
    else if (errCode == "OUT_OF_STOCK") lcdMsg("Out of Stock", "Please wait...");
    else lcdMsg("Payment Failed", "Try Again");

    delay(2500);
    sendStockAwareStatus();
}

// ==================== PROVISIONING WEB SERVER ====================

void handleRoot() {
    String html = R"rawliteral(
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lyra WiFi Setup</title>
<style>body{font-family:sans-serif;background:#0f1724;color:#eef2ff;padding:16px}
.net{padding:12px;margin:6px 0;background:#131f33;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
button{background:#7c3aed;border:none;color:#fff;padding:8px 14px;border-radius:6px}</style>
<script>
async function scan(){
  const list=document.getElementById('list');
  list.innerHTML='Scanning...';
  const r=await fetch('/api/scan');const d=await r.json();
  list.innerHTML=d.map(n=>`<div class="net"><span>${n.ssid} (${n.rssi}dBm)</span><button onclick="connect('${n.ssid.replace(/'/g,"\\'")}')">Connect</button></div>`).join('');
}
async function connect(s){
  const p=prompt('Password for '+s+':');
  if(p===null)return;
  await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:s,password:p})});
  alert('Connecting... device will restart.');
}
window.onload=scan;
</script></head><body><h2>Lyra RFID Vending — WiFi Setup</h2><div id="list"></div></body></html>
)rawliteral";
    server.send(200, "text/html", html);
}

void handleAPIScan() {
    WiFi.scanNetworks(true, true);
    delay(100);
    while (WiFi.scanComplete() == WIFI_SCAN_RUNNING) delay(200);

    int n = WiFi.scanComplete();
    String json = "[";
    for (int i = 0; i < n; i++) {
        if (i > 0) json += ",";
        json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
    }
    json += "]";

    server.send(200, "application/json", json);
    WiFi.scanDelete();
}

void handleAPIConnect() {
    String body = server.arg("plain");
    DynamicJsonDocument doc(512);
    deserializeJson(doc, body);
    String ssid = doc["ssid"] | "";
    String password = doc["password"] | "";

    if (ssid.length() > 0) {
        saveWiFiCredentials(ssid, password);
        server.send(200, "application/json", "{\"ok\":true}");
        delay(1000);
        ESP.restart();
    } else {
        server.send(400, "application/json", "{\"ok\":false}");
    }
}

void startProvisioning() {
    provisioningMode = true;
    lcdMsg("WiFi Setup Mode", "Connect to AP");
    WiFi.mode(WIFI_AP);
    WiFi.softAP("ESP32_WIFI_RFID", "password123");
    Serial.println("Provisioning: http://192.168.4.1");

    server.on("/", handleRoot);
    server.on("/api/scan", handleAPIScan);
    server.on("/api/connect", HTTP_POST, handleAPIConnect);
    server.begin();
}

// ==================== SETUP ====================

void setup() {
    Serial.begin(115200);
    Serial.println("\nLyra RFID Vending Machine (Quad Motor) " + String(CURRENT_FIRMWARE_VERSION));

    initializeWatchdog();
    EEPROM.begin(EEPROM_SIZE);  // opened once — all helpers assume this is already done
    nextMotorIndex = readNextMotorIndex();  // resume round-robin where it left off before any power loss/reboot

    pinMode(WIFI_RESET_BUTTON_PIN, INPUT_PULLUP);
    for (uint8_t i = 0; i < MOTOR_COUNT; i++) {
        pinMode(MOTOR_PINS[i], OUTPUT);
        digitalWrite(MOTOR_PINS[i], LOW);
    }
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(RESET_PIN, INPUT_PULLUP);

    Wire.begin(LCD_SDA, LCD_SCL);
    lcd.begin(16, 2);
    lcd.backlight();
    lcdMsg("Lyra Vending", String(CURRENT_FIRMWARE_VERSION));
    delay(1000);

    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, -1);
    rfid.PCD_Init();
    delay(50);
    byte rfidVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("RFID reader version: 0x%02X %s\n", rfidVersion,
                  (rfidVersion == 0x00 || rfidVersion == 0xFF) ? "(NOT DETECTED - check wiring)" : "(OK)");

    getMACAddress();   // still needed — backend identifies the machine by MAC

    // ---- ETHERNET-ONLY: keep trying until the cable/network is up. ----
    // Ethernet gets 5 attempts, showing progress on the LCD. If it still
    // isn't up after that, fall back to WiFi (saved credentials, or
    // provisioning mode if none are saved) instead of giving up entirely.
    Serial.println("Attempting Ethernet connection...");
    lcdMsg("Connecting...", "Please wait");
    bool ethernetUp = false;
    for (int ethAttempt = 1; ethAttempt <= 5; ethAttempt++) {
        if (initializeEthernet()) {
            ethernetUp = true;
            break;
        }
        Serial.printf("Ethernet not ready (attempt %d/5) - retrying...\n", ethAttempt);
        lcdMsg("Connecting...", "Check LAN cable");
        feedWatchdog();
        delay(3000);
        feedWatchdog();
    }

    if (ethernetUp) {
        Serial.println("Using Ethernet");
        fetchMachineInfoFromBackend(deviceMacAddress);
        fetchMachineProducts();
        feedWatchdog();
        sendMachineStatusPing();
        lastPingTime = millis();
        sendStockAwareStatus();
        return;
    }

    Serial.println("Ethernet not available after 5 attempts, falling back to WiFi");
    feedWatchdog();

    String ssid = eepromReadStringSafe(0, 32);
    String password = eepromReadStringSafe(32, 64);

    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), password.c_str());
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            feedWatchdog();
            attempts++;
        }

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("WiFi Connected: " + WiFi.localIP().toString());
            ensureWiFiStability();
            digitalWrite(BLUE_LED_PIN, HIGH);

            fetchMachineInfoFromBackend(deviceMacAddress);
            fetchMachineProducts();

            ArduinoOTA.setHostname(("Lyra-RFID-" + machineName).c_str());
            ArduinoOTA.setPassword("lyra2024");
            ArduinoOTA.begin();

            sendMachineStatusPing();
            lastPingTime = millis();
            sendStockAwareStatus();
        } else {
            sendStockAwareErrorStatus();
            startProvisioning();
        }
    } else {
        sendStockAwareErrorStatus();
        startProvisioning();
    }
}

// ==================== MAIN LOOP ====================

void loop() {
    feedWatchdog();
    ArduinoOTA.handle();
    server.handleClient();

#ifdef USE_ETHERNET
    checkEthernetLinkStatus();
    checkForEthernetRecovery();
#endif

    if (!provisioningMode && !useEthernet && millis() - lastWiFiCheck > 30000) {
        maintainWiFiConnection();
        lastWiFiCheck = millis();
    }

    if (provisioningMode) {
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink > 500) {
            digitalWrite(BLUE_LED_PIN, !digitalRead(BLUE_LED_PIN));
            lastBlink = millis();
        }
    }

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
            Serial.println("Network: " + String(useEthernet ? "Ethernet" : "WiFi"));
            for (uint8_t i = 0; i < MOTOR_COUNT; i++) {
                Serial.printf("  Motor %d stock: %d\n", i, readMotorStock(i));
            }
            Serial.println("Total stock: " + String(readTotalStockFromEEPROM()));
        } else if (command == "dispense") {
            dispenseFromNextAvailableMotor(defaultProductId);
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
        refillAllMotors();
        lcdMsg("Stock Refilled", String(MAX_STOCK_TOTAL) + " units");
        delay(1000);
        sendStockAwareStatus();
        syncTotalStockToServer(defaultProductId);
        sendMachineStatusPing();
    }

    static unsigned long lastWifiResetDebounce = 0;
    if (digitalRead(WIFI_RESET_BUTTON_PIN) == LOW && millis() - lastWifiResetDebounce > 300) {
        lastWifiResetDebounce = millis();
        for (int i = 0; i < 64; i++) EEPROM.write(i, 0);
        EEPROM.commit();
        ESP.restart();
    }

    if (millis() - lastPingTime > 120000) {
        if (isNetworkConnected()) sendMachineStatusPing();
        lastPingTime = millis();
    }

    static unsigned long lastTapMs = 0;
    if (millis() - lastTapMs > 1500) {
        if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
            String uid = readRfidUid();
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
            lastTapMs = millis();
            handleRfidTap(uid);
        }
    }
}
