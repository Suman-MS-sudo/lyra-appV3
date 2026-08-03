// ESP32 firmware for Lyra vending machine — RFID-ONLY payment mode
// Derived from IOT_Wifi_LAN (coin + online) but with coin and online/Razorpay
// payment entirely removed and replaced with RFID prepaid-card tap-to-pay,
// synced against the Lyra web app's /api/rfid-payment endpoint.
//
// Hardware additions vs the coin/online firmware:
//   RFID reader: MFRC522, SS=GPIO15, RST=GPIO27, shared SPI bus (SCK18/MISO19/MOSI23)
//   Display: HW-61 1602A LCD (16x2, PCF8574 I2C backpack), SDA=GPIO21, SCL=GPIO22,
//            I2C addr 0x27 (try 0x3F if blank) — wired directly to the ESP32,
//            no separate UNO display board needed.
//   Library: "LiquidCrystal I2C" by Frank de Brabander (install via Library Manager)
//
// Payment flow: tap card -> read UID -> POST /api/rfid-payment {machine_id, card_uid}
// -> server resolves price + deducts card balance (server is source of truth,
// firmware never computes or trusts a price/balance itself) -> on success, dispense.
// Because balance must be verified live, there is no offline queue for RFID taps
// (unlike coin payments, a tap cannot be honored without a network round trip).
//
// Ethernet support was dropped for this variant to keep the firmware focused;
// if a machine needs Ethernet + RFID, port the Ethernet block from IOT_Wifi_LAN.

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

// ==================== FIRMWARE VERSION ====================
#define CURRENT_FIRMWARE_VERSION "RFID-V1.0.0"

// ==================== WATCHDOG CONFIGURATION ====================
#define WDT_TIMEOUT 1800  // seconds (30 minutes)

// ==================== PIN DEFINITIONS ====================
#define EEPROM_SIZE 256
#define WIFI_RESET_BUTTON_PIN 4
#define TRANSISTOR_BASE 5
#define BLUE_LED_PIN 2
#define RESET_PIN 13   // moved off GPIO21 — that pin is now the LCD's I2C SDA
#define MOTOR1_ADDR 64

// RFID reader (MFRC522)
#define RFID_SS   15
#define RFID_RST  27   // moved off GPIO4 to avoid clash with WIFI_RESET_BUTTON_PIN
#define SPI_SCK   18
#define SPI_MISO  19
#define SPI_MOSI  23

// LCD (HW-61 1602A over I2C, shared bus with nothing else)
#define LCD_SDA      21
#define LCD_SCL      22
#define LCD_I2C_ADDR 0x27   // PCF8574 backpack default; try 0x3F if blank

MFRC522 rfid(RFID_SS, RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// ==================== GLOBAL VARIABLES ====================
WebServer server(80);
bool provisioningMode = false;
String deviceMacAddress;
String machineId = "UNKNOWN";
String machineName = "UNKNOWN";
String defaultProductId = "";  // UUID of default product for this machine
unsigned long lastPingTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long wifiReconnectAttempts = 0;

// Server configuration
// Flip this to switch between your local dev machine and production without
// touching anything else. Local testing talks plain HTTP (no TLS handshake
// overhead), production stays HTTPS.
#define TESTING_LOCAL
#ifdef TESTING_LOCAL
String SERVER_BASE = "https://192.168.1.4";  // Local dev server (HTTPS on :443)
#else
String SERVER_BASE = "https://lyra-app.co.in";     // Production HTTPS server
#endif

// ==================== FORWARD DECLARATIONS ====================
String fetchMachineInfoFromBackend(const String& mac);
void fetchMachineProducts();
void dispenseProductByMotor(String productId = "");
void sendMachineStatusPing();
bool isHTTPS(const String& url);
HTTPClient* getHTTPClient(const String& url);
bool isNetworkConnected();
String extractJsonFromString(const String &s);
void lcdMsg(const String& line0, const String& line1 = "");
void sendStockAwareStatus();
void sendStockAwareErrorStatus();
bool macStringToBytes(const String &macStr, byte out[6]);
void initializeWatchdog();
void feedWatchdog();
void maintainWiFiConnection();
void ensureWiFiStability();
int makeHTTPRequest(const String& url, const String& method, const String& payload, String* responseBody);
void handleRfidTap(const String& uid);

// ==================== HELPER FUNCTIONS ====================

String urlEncode(const String &str) {
    String encoded = "";
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
    if (objStart >= 0 && objEnd > objStart) {
        return s.substring(objStart, objEnd + 1);
    }
    int arrStart = s.indexOf('[');
    int arrEnd = s.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
        return s.substring(arrStart, arrEnd + 1);
    }
    return String("");
}

// ==================== EEPROM FUNCTIONS ====================

void eepromWriteString(int addr, const String &value, int maxLen) {
    EEPROM.begin(EEPROM_SIZE);
    int len = min((int)value.length(), maxLen - 1);
    EEPROM.write(addr, len);
    for (int i = 0; i < len; ++i) EEPROM.write(addr + 1 + i, value[i]);
    EEPROM.write(addr + 1 + len, '\0');
    EEPROM.commit();
}

String eepromReadStringSafe(int addr, int maxLen) {
    EEPROM.begin(EEPROM_SIZE);
    int len = EEPROM.read(addr);
    if (len <= 0 || len >= maxLen) return String("");
    String v = "";
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

void saveMotorStockToEEPROM(int count, String productId = "") {
    EEPROM.begin(EEPROM_SIZE);
    EEPROM.write(MOTOR1_ADDR, count);
    EEPROM.commit();
    Serial.printf("Motor stock saved: %d\n", count);

    if (productId.length() > 0 && machineId != "UNKNOWN" && machineId.length() > 0) {
        String payload = "{\"machine_id\":\"" + machineId + "\",\"product_id\":\"" + productId +
                          "\",\"quantity\":" + String(count) + ",\"mode\":\"set\"}";
        makeHTTPRequest(SERVER_BASE + "/api/update-product-stock", "POST", payload);
    }
}

int readMotorStockFromEEPROM() {
    EEPROM.begin(EEPROM_SIZE);
    int count = EEPROM.read(MOTOR1_ADDR);
    if (count < 0 || count > 25) count = 25;
    return count;
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

void feedWatchdog() {
    esp_task_wdt_reset();
}

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
// HW-61 1602A (16x2) over I2C. Both lines are cleared and repadded to 16
// chars every call so stale characters from a longer previous message never
// linger on screen.

void lcdMsg(const String& line0, const String& line1) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line0.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(line1.substring(0, 16));
}

void sendStockAwareStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        lcdMsg("Out of Stock", "Please wait...");
        Serial.println("Status: Out of stock");
    } else if (isNetworkConnected()) {
        lcdMsg("Lyra Vending", "Tap Card...");
        Serial.println("Status: Ready");
    } else {
        lcdMsg("Network Error", "Reconnecting...");
        Serial.println("Status: Network error");
    }
}

void sendStockAwareErrorStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        lcdMsg("Out of Stock", "Please wait...");
    } else {
        lcdMsg("Network Error", "Reconnecting...");
    }
}

// ==================== NETWORK FUNCTIONS ====================

bool isHTTPS(const String& url) {
    return url.startsWith("https://");
}

bool isNetworkConnected() {
    return WiFi.status() == WL_CONNECTED;
}

HTTPClient* getHTTPClient(const String& url) {
    static HTTPClient http;
    static WiFiClientSecure* secureClient = nullptr;

    if (secureClient) {
        delete secureClient;
        secureClient = nullptr;
    }

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
    http.setUserAgent("ESP32-Lyra-RFID/" + String(CURRENT_FIRMWARE_VERSION));
    http.addHeader("Connection", "close");
    http.addHeader("Accept", "application/json");
    http.addHeader("X-Machine-ID", machineId);
    http.addHeader("X-Firmware-Version", CURRENT_FIRMWARE_VERSION);

    return &http;
}

int makeHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* responseBody = nullptr) {
    HTTPClient* http = getHTTPClient(url);
    if (http == nullptr) return -1;

    int code = -1;
    if (method == "POST") {
        http->addHeader("Content-Type", "application/json");
        code = http->POST(payload);
    } else {
        code = http->GET();
    }

    if (responseBody != nullptr && code > 0) {
        *responseBody = http->getString();
    }

    http->end();
    return code;
}

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
    String url = SERVER_BASE + "/api/get-machine-id-from-mac?mac=" + urlEncode(mac) +
                 "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION);

    String responseBody = "";
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

    String url = SERVER_BASE + "/api/machine-products?machine_id=" + urlEncode(machineId);

    Serial.println("Fetching machine products...");
    String responseBody = "";
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
    int currentStock = readMotorStockFromEEPROM();

    String payload = "{";
    payload += "\"machine_id\":\"" + machineId + "\",";
    payload += "\"firmware_version\":\"" + String(CURRENT_FIRMWARE_VERSION) + "\",";
    payload += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
    payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
    payload += "\"uptime\":" + String(millis()) + ",";
    payload += "\"stock_count\":" + String(currentStock);
    payload += "}";

    int code = makeHTTPRequest(SERVER_BASE + "/api/machine-ping", "POST", payload);

    if (code == 200) {
        Serial.printf("Machine ping successful (Stock: %d)\n", currentStock);
    } else {
        Serial.printf("Machine ping failed: %d\n", code);
    }
}

// ==================== DISPENSE FUNCTIONS ====================

void dispenseProductByMotor(String productId) {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial.println("Motor out of stock!");
        lcdMsg("Out of Stock", "Please wait...");
        return;
    }

    Serial.printf("Activating motor... (Stock before: %d)\n", stock);
    pinMode(TRANSISTOR_BASE, OUTPUT);
    digitalWrite(TRANSISTOR_BASE, HIGH);
    delay(2830);
    digitalWrite(TRANSISTOR_BASE, LOW);

    saveMotorStockToEEPROM(stock - 1, productId);
    Serial.printf("Motor stopped! New stock: %d\n", stock - 1);
}

void dispenseSequence(String productId) {
    lcdMsg("Dispensing...", "Please wait");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);

    dispenseProductByMotor(productId);

    lcdMsg("Thank You!", "");
    delay(3000);
    lcdMsg("Please Take", "Your Item");
    delay(3000);

    sendStockAwareStatus();
}

// ==================== RFID FUNCTIONS ====================

String readRfidUid() {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    return uid;
}

// Calls /api/rfid-payment with the tapped card's UID. The server resolves
// the machine's product/price, checks + deducts the card balance, and
// returns what to dispense. The firmware never computes price or balance
// itself — it only acts on the server's verdict.
void handleRfidTap(const String& uid) {
    Serial.println("\n===============================");
    Serial.println("RFID tap detected: " + uid);
    Serial.println("===============================");

    if (!isNetworkConnected()) {
        Serial.println("No network - cannot verify card balance, rejecting tap");
        lcdMsg("Network Error", "Try again");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial.println("Out of stock, rejecting tap");
        lcdMsg("Out of Stock", "Please wait...");
        delay(2000);
        sendStockAwareStatus();
        return;
    }

    String payload = "{\"machine_id\":\"" + machineId + "\",\"card_uid\":\"" + uid + "\"}";
    if (defaultProductId.length() > 0) {
        payload = "{\"machine_id\":\"" + machineId + "\",\"card_uid\":\"" + uid +
                  "\",\"product_id\":\"" + defaultProductId + "\"}";
    }

    String responseBody = "";
    int code = makeHTTPRequest(SERVER_BASE + "/api/rfid-payment", "POST", payload, &responseBody);

    Serial.printf("RFID payment response code: %d\n", code);
    Serial.println("Body: " + responseBody);

    if (code == 200) {
        DynamicJsonDocument doc(768);
        DeserializationError err = deserializeJson(doc, responseBody);
        String dispenseProductId = defaultProductId;
        if (!err && doc.containsKey("data") && doc["data"].containsKey("product_id")) {
            dispenseProductId = doc["data"]["product_id"].as<String>();
        }
        Serial.println("Payment accepted, dispensing");
        dispenseSequence(dispenseProductId);
        return;
    }

    // Payment rejected — decide which error code to show
    DynamicJsonDocument errDoc(512);
    deserializeJson(errDoc, responseBody);
    String errCode = errDoc["error"]["code"] | "";

    if (errCode == "CARD_NOT_FOUND") {
        Serial.println("Card not registered");
        lcdMsg("Card Not Found", "Unregistered");
    } else if (errCode == "INSUFFICIENT_CREDITS") {
        Serial.println("Card declined: " + errCode);
        lcdMsg("No Credits Left", "Please Top Up");
    } else if (errCode == "CARD_INACTIVE") {
        Serial.println("Card declined: " + errCode);
        lcdMsg("Card Inactive", "Contact Admin");
    } else if (errCode == "WRONG_MACHINE") {
        Serial.println("Card declined: " + errCode);
        lcdMsg("Card Not Valid", "On This Machine");
    } else if (errCode == "OUT_OF_STOCK") {
        lcdMsg("Out of Stock", "Please wait...");
    } else {
        Serial.println("RFID payment failed: " + String(code));
        lcdMsg("Payment Failed", "Try Again");
    }

    delay(2500);
    sendStockAwareStatus();
}

// ==================== PROVISIONING WEB SERVER ====================
// Minimal captive-style setup page — identical flow to the coin/online
// firmware's WiFi provisioning (scan networks, tap to connect).

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

    Serial.println("\nLyra RFID Vending Machine " + String(CURRENT_FIRMWARE_VERSION));

    initializeWatchdog();

    pinMode(WIFI_RESET_BUTTON_PIN, INPUT_PULLUP);
    pinMode(TRANSISTOR_BASE, OUTPUT);
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(RESET_PIN, INPUT_PULLUP);

    EEPROM.begin(EEPROM_SIZE);

    // LCD init (HW-61 1602A over I2C)
    Wire.begin(LCD_SDA, LCD_SCL);
    lcd.init();
    lcd.backlight();
    lcdMsg("Lyra Vending", String(CURRENT_FIRMWARE_VERSION));
    delay(1000);

    // RFID reader init (shares SPI bus, own CS/RST)
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, -1);
    rfid.PCD_Init();
    delay(50);
    byte rfidVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("RFID reader version: 0x%02X %s\n", rfidVersion,
                  (rfidVersion == 0x00 || rfidVersion == 0xFF) ? "(NOT DETECTED - check wiring)" : "(OK)");

    getMACAddress();

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
            Serial.println("WiFi connection failed");
            sendStockAwareErrorStatus();
            startProvisioning();
        }
    } else {
        Serial.println("No WiFi credentials saved");
        sendStockAwareErrorStatus();
        startProvisioning();
    }
}

// ==================== MAIN LOOP ====================

void loop() {
    feedWatchdog();
    ArduinoOTA.handle();
    server.handleClient();

    if (!provisioningMode && millis() - lastWiFiCheck > 30000) {
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

    // Serial diagnostics
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command == "ping") {
            sendMachineStatusPing();
        } else if (command == "fetch") {
            fetchMachineInfoFromBackend(deviceMacAddress);
            if (machineId != "UNKNOWN") fetchMachineProducts();
        } else if (command == "status") {
            Serial.println("\n=== SYSTEM STATUS ===");
            Serial.println("Firmware: " + String(CURRENT_FIRMWARE_VERSION));
            Serial.println("Machine ID: " + machineId);
            Serial.println("MAC: " + deviceMacAddress);
            Serial.println("Network: " + String(isNetworkConnected() ? "Connected" : "Disconnected"));
            Serial.println("Stock: " + String(readMotorStockFromEEPROM()));
            Serial.println("=====================\n");
        } else if (command == "dispense") {
            Serial.println("Manual dispense triggered");
            dispenseProductByMotor(defaultProductId);
        }
    }

    // Manual restock button
    static unsigned long lastResetDebounce = 0;
    if (digitalRead(RESET_PIN) == LOW && millis() - lastResetDebounce > 300) {
        lastResetDebounce = millis();
        saveMotorStockToEEPROM(30, defaultProductId);
        lcdMsg("Stock Refilled", "30 units");
        delay(1000);
        sendStockAwareStatus();
        sendMachineStatusPing();
    }

    // WiFi reset button
    static unsigned long lastWifiResetDebounce = 0;
    if (digitalRead(WIFI_RESET_BUTTON_PIN) == LOW && millis() - lastWifiResetDebounce > 300) {
        lastWifiResetDebounce = millis();
        Serial.println("WiFi reset");
        EEPROM.begin(EEPROM_SIZE);
        for (int i = 0; i < 64; i++) EEPROM.write(i, 0);
        EEPROM.commit();
        ESP.restart();
    }

    // Status ping every 2 minutes
    if (millis() - lastPingTime > 120000) {
        if (isNetworkConnected()) {
            sendMachineStatusPing();
        }
        lastPingTime = millis();
    }

    // RFID tap detection
    static unsigned long lastTapMs = 0;
    if (millis() - lastTapMs > 1500) {  // debounce: ignore re-reads of a lingering card
        if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
            String uid = readRfidUid();
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
            lastTapMs = millis();
            handleRfidTap(uid);
        }
    }
}
