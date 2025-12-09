// Optimized ESP32 firmware for Lyra vending machine V1.0.0
// Key improvements:
// - Centralized server base URL with /api endpoints
// - Robust EEPROM read/write for strings
// - Button debounce and reduced log spam
// - Firmware version tracking in API calls
// - Fixed Ethernet/WiFi switching logic
// - Memory optimizations

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <EEPROM.h>
#include <WebServer.h>
#include <esp_wifi.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <SPI.h>
#include <esp_task_wdt.h>

// Ethernet library selection
// Comment out to disable Ethernet support
#define USE_ETHERNET
#ifdef USE_ETHERNET
  // For HANRUN HR911105A (ENC28J60), use UIPEthernet
  // For W5x00 chips, use standard Ethernet.h
  #define USE_UIPETHERNET
  #ifdef USE_UIPETHERNET
    #include <UIPEthernet.h>
  #else
    #include <Ethernet.h>
  #endif
#endif

// ==================== FIRMWARE VERSION ====================
#define CURRENT_FIRMWARE_VERSION "V1.0.0"

// ==================== WATCHDOG CONFIGURATION ====================
#define WDT_TIMEOUT 1800  // Watchdog timeout in seconds (30 minutes)

// ==================== PIN DEFINITIONS ====================
#define EEPROM_SIZE 256
#define WIFI_RESET_BUTTON_PIN 4
#define TRANSISTOR_BASE 5
#define COIN_PIN 27
#define BLUE_LED_PIN 2
#define RESET_PIN 21
#define MOTOR1_ADDR 64
#define ETHERNET_CS 22

// ==================== GLOBAL VARIABLES ====================
WebServer server(80);
bool provisioningMode = false;
String deviceMacAddress;
String machineId = "UNKNOWN";
String machineName = "UNKNOWN";
unsigned long lastPingTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long wifiReconnectAttempts = 0;

// Server configuration
String SERVER_BASE = "https://192.168.1.2";  // HTTPS for WiFi
String ETHERNET_SERVER_BASE = "http://192.168.1.2:8080";  // HTTP proxy for Ethernet

// Ethernet globals
#ifdef USE_ETHERNET
bool useEthernet = false;
bool ethernetConnected = false;
byte ethernetMAC[6] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
EthernetClient ethClient;
#endif

// ==================== FORWARD DECLARATIONS ====================
void notifyProductStockUpdate(const String& machine_id, int product_id, int quantity = 1, String mode = "");
String fetchMachineInfoFromBackend(const String& mac);
void dispenseProductByMotor();
void listenForOnlinePayment();
void sendMachineStatusPing();
bool isHTTPS(const String& url);
HTTPClient* getHTTPClient(const String& url);
bool isNetworkConnected();
String extractJsonFromString(const String &s);
void printMemoryStatus(const String& context = "");
void sendStockAwareStatus();
void sendStockAwareErrorStatus();
void resetAllMotorStocks();
bool macStringToBytes(const String &macStr, byte out[6]);
float measureNetworkSpeed();
void initializeWatchdog();
void feedWatchdog();
void maintainWiFiConnection();
void ensureWiFiStability();

// Diagnostic functions
void testHTTPvsHTTPS();
void testSSLConnection();
void testDNSResolution();
void testServerConnection();
void printPartitionInfo();

#ifdef USE_ETHERNET
int makeEthernetHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* outBody = nullptr);
bool initializeEthernet();
void checkEthernetLinkStatus();
void printEthernetDiagnostics();
void resetEthernetModule();
bool downloadFirmwareOverEthernet(const String& firmwareUrl, int expectedSize = 0);
#endif

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
    // Look for JSON object first
    int objStart = s.indexOf('{');
    int objEnd = s.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
        return s.substring(objStart, objEnd + 1);
    }
    // Fallback to array
    int arrStart = s.indexOf('[');
    int arrEnd = s.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
        return s.substring(arrStart, arrEnd + 1);
    }
    return String("");
}

void printMemoryStatus(const String& context) {
    size_t freeHeap = ESP.getFreeHeap();
    size_t totalHeap = ESP.getHeapSize();
    Serial.printf("🧠 [%s] Free: %d KB, Used: %d KB\n", 
                 context.c_str(), 
                 freeHeap/1024,
                 (totalHeap - freeHeap)/1024);
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

String readEEPROM(int start, int length) {
    String value = "";
    EEPROM.begin(EEPROM_SIZE);
    for (int i = start; i < start + length; i++) {
        char c = EEPROM.read(i);
        if (c == '\0') break;
        value += c;
    }
    return value;
}

void saveWiFiCredentials(String ssid, String password) {
    eepromWriteString(0, ssid, 32);
    eepromWriteString(32, password, 64);
}

void saveMotorStockToEEPROM(int count) {
    EEPROM.begin(EEPROM_SIZE);
    EEPROM.write(MOTOR1_ADDR, count);
    EEPROM.commit();
    Serial.printf("📦 Motor stock saved: %d\n", count);
    notifyProductStockUpdate(machineId, 1, count, "set");
}

int readMotorStockFromEEPROM() {
    EEPROM.begin(EEPROM_SIZE);
    int count = EEPROM.read(MOTOR1_ADDR);
    if (count < 0 || count > 30) count = 30;
    return count;
}

String getCurrentFirmwareVersion() {
    return String(CURRENT_FIRMWARE_VERSION);
}

void resetAllMotorStocks() {
    saveMotorStockToEEPROM(30);
    Serial.println("📦 All motor stocks reset to 30!");
}

bool macStringToBytes(const String &macStr, byte out[6]) {
    String s = macStr;
    s.replace(":", "");
    s.replace("-", "");
    s.trim();
    if (s.length() != 12) return false;
    for (int i = 0; i < 6; ++i) {
        String part = s.substring(i * 2, i * 2 + 2);
        char buf[3] = {0};
        part.toCharArray(buf, 3);
        out[i] = (byte) strtol(buf, NULL, 16);
    }
    return true;
}

void initializeWatchdog() {
    Serial.println("🐕 Initializing Watchdog Timer (" + String(WDT_TIMEOUT / 60) + " min timeout)...");
    
    // Deinitialize existing watchdog if already initialized (survives reboots)
    esp_task_wdt_deinit();
    delay(100);
    
    // Configure watchdog for newer ESP32 Arduino core
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = WDT_TIMEOUT * 1000,  // Convert seconds to milliseconds
        .idle_core_mask = 0,               // Watch all cores
        .trigger_panic = true              // Trigger panic on timeout
    };
    
    esp_task_wdt_init(&wdt_config);        // Initialize with config
    esp_task_wdt_add(NULL);                // Add current thread to WDT watch
    
    Serial.println("✅ Watchdog Timer active (" + String(WDT_TIMEOUT / 60) + " minutes)");
}

void feedWatchdog() {
    esp_task_wdt_reset();
}

void ensureWiFiStability() {
    // Disable WiFi power saving to prevent sleep mode
    WiFi.setSleep(false);
    
    // Set WiFi to maximum performance mode
    esp_wifi_set_ps(WIFI_PS_NONE);
    
    // Set aggressive keepalive settings
    WiFi.setAutoReconnect(true);
    
    Serial.println("✅ WiFi stability optimizations applied");
}

void maintainWiFiConnection() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠ WiFi disconnected! Reconnecting...");
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
                Serial.print(".");
                feedWatchdog();  // Feed watchdog during reconnection
                attempts++;
            }
            
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("\n✅ WiFi reconnected! IP: " + WiFi.localIP().toString());
                ensureWiFiStability();
                digitalWrite(BLUE_LED_PIN, HIGH);
                sendStockAwareStatus();
                wifiReconnectAttempts = 0;
            } else {
                Serial.println("\n❌ WiFi reconnection failed");
                sendStockAwareErrorStatus();
                
                // If multiple reconnection failures, restart ESP
                if (wifiReconnectAttempts > 5) {
                    Serial.println("🔄 Multiple WiFi failures, rebooting...");
                    delay(1000);
                    ESP.restart();
                }
            }
        }
    }
}

void printPartitionInfo() {
    Serial.println("📊 Partition Info:");
    Serial.printf("   Flash Size: %d bytes (%.1f MB)\n", 
                 ESP.getFlashChipSize(), 
                 ESP.getFlashChipSize() / (1024.0 * 1024.0));
    Serial.printf("   Sketch Size: %d bytes (%.1f KB)\n", 
                 ESP.getSketchSize(), 
                 ESP.getSketchSize() / 1024.0);
    Serial.printf("   Free Sketch Space: %d bytes (%.1f KB)\n", 
                 ESP.getFreeSketchSpace(), 
                 ESP.getFreeSketchSpace() / 1024.0);
}

// ==================== STOCK-AWARE STATUS FUNCTIONS ====================

void sendStockAwareStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial2.print("9"); // Out of stock - highest priority
        Serial.println("Status: Out of stock (9)");
    } else if (isNetworkConnected()) {
        Serial2.print("2"); // Ready
        Serial.println("Status: Ready (2)");
    } else {
        Serial2.print("6"); // Network error
        Serial.println("Status: Network error (6)");
    }
}

void sendStockAwareErrorStatus() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial2.print("9"); // Out of stock
        Serial.println("Status: Out of stock (9)");
    } else {
        Serial2.print("6"); // Error
        Serial.println("Status: Error (6)");
    }
}

// ==================== NETWORK FUNCTIONS ====================

bool isHTTPS(const String& url) {
    return url.startsWith("https://");
}

bool isNetworkConnected() {
#ifdef USE_ETHERNET
    if (useEthernet) {
        return ethernetConnected && (Ethernet.linkStatus() == LinkON);
    }
#endif
    return WiFi.status() == WL_CONNECTED;
}

HTTPClient* getHTTPClient(const String& url) {
    static HTTPClient http;
    static WiFiClientSecure* secureClient = nullptr;
    
    if (secureClient) {
        delete secureClient;
        secureClient = nullptr;
    }
    
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        return nullptr; // Use Ethernet implementation
    }
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
    http.setUserAgent("ESP32-Lyra/" + String(CURRENT_FIRMWARE_VERSION));
    http.addHeader("Connection", "close");
    http.addHeader("Accept", "application/json");
    http.addHeader("X-Machine-ID", machineId);
    http.addHeader("X-Firmware-Version", CURRENT_FIRMWARE_VERSION);
    
    return &http;
}

#ifdef USE_ETHERNET
int makeEthernetHTTPRequest(const String& url, const String& method, const String& payload, String* outBody) {
    String u = url;
    if (u.startsWith("http://")) {
        u = u.substring(7);
    } else if (u.startsWith("https://")) {
        Serial.println("❌ HTTPS not supported over Ethernet");
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

    if (!ethClient.connect(host.c_str(), port)) {
        Serial.println("❌ Ethernet connection failed");
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
    String body = "";
    while (ethClient.available()) {
        String line = ethClient.readStringUntil('\n');
        if (!headersEnded) {
            if (line == "\r" || line.length() == 0) {
                headersEnded = true;
            }
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
#endif

// ==================== HTTP REQUEST WRAPPER ====================

int makeHTTPRequest(const String& url, const String& method = "GET", const String& payload = "", String* responseBody = nullptr) {
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        return makeEthernetHTTPRequest(url, method, payload, responseBody);
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
    Serial.println("📱 MAC: " + deviceMacAddress);
}

String fetchMachineInfoFromBackend(const String& mac) {
    // Add firmware version to the request
    String url = SERVER_BASE + "/api/get-machine-id-from-mac?mac=" + urlEncode(mac) + 
                 "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION);
    
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/get-machine-id-from-mac?mac=" + urlEncode(mac) +
              "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION);
    }
#endif
    
    String responseBody = "";
    int code = makeHTTPRequest(url, "GET", "", &responseBody);
    
    if (code == 200 && responseBody.length() > 0) {
        DynamicJsonDocument doc(512);
        DeserializationError err = deserializeJson(doc, responseBody);
        if (!err) {
            // Check if response has 'data' wrapper (new API format)
            if (doc.containsKey("data") && doc["data"].containsKey("machine_id")) {
                machineId = doc["data"]["machine_id"].as<String>();
                machineName = doc["data"]["machine_name"].as<String>();
                Serial.println("✅ Machine ID: " + machineId);
                Serial.println("✅ Machine Name: " + machineName);
            }
            // Fallback to old format (direct fields)
            else if (doc.containsKey("machine_id")) {
                machineId = doc["machine_id"].as<String>();
                machineName = doc["machine_name"].as<String>();
                Serial.println("✅ Machine ID: " + machineId);
                Serial.println("✅ Machine Name: " + machineName);
            }
        }
    }
    
    return machineId;
}

float getESP32Temperature() {
    // Read internal temperature sensor (Fahrenheit)
    float tempF = temperatureRead();
    // Convert to Celsius
    float tempC = (tempF - 32.0) * 5.0 / 9.0;
    return tempC;
}

float measureNetworkSpeed() {
    if (!isNetworkConnected()) return 0.0;
    
    // Measure download speed with a lightweight test endpoint
    // Use GET to fetch machine info (doesn't create side effects)
    String testUrl = SERVER_BASE + "/api/get-machine-id-from-mac?mac=" + urlEncode(deviceMacAddress);
    
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        testUrl = ETHERNET_SERVER_BASE + "/api/get-machine-id-from-mac?mac=" + urlEncode(deviceMacAddress);
    }
#endif
    
    unsigned long startTime = millis();
    String responseBody = "";
    int code = makeHTTPRequest(testUrl, "GET", "", &responseBody);
    unsigned long endTime = millis();
    
    if (code <= 0 || responseBody.length() == 0) return 0.0;
    
    // Calculate speed: bytes / time(s) / 1024 = KB/s
    float timeMs = (float)(endTime - startTime);
    if (timeMs == 0) timeMs = 1.0;
    
    float speedKBps = (responseBody.length() / (timeMs / 1000.0)) / 1024.0;
    
    Serial.printf("📊 Network speed: %.2f KB/s (%d bytes in %d ms)\n", 
                 speedKBps, responseBody.length(), (int)timeMs);
    
    return speedKBps; // Returns KB/s
}

void sendMachineStatusPing() {
    // Measure network speed and temperature
    float networkSpeed = measureNetworkSpeed();
    float temperature = getESP32Temperature();
    
    String payload = "{";
    payload += "\"machine_id\":\"" + machineId + "\",";
    payload += "\"firmware_version\":\"" + String(CURRENT_FIRMWARE_VERSION) + "\",";
    payload += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
    payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
    payload += "\"uptime\":" + String(millis()) + ",";
    payload += "\"network_speed_kbps\":" + String(networkSpeed, 2) + ",";
    payload += "\"temperature_celsius\":" + String(temperature, 1);
    payload += "}";

    String url = SERVER_BASE + "/api/machine-ping";
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/machine-ping";
    }
#endif

    int code = makeHTTPRequest(url, "POST", payload);
    
    if (code == 200) {
        Serial.println("✅ Machine ping successful");
    } else {
        Serial.printf("⚠ Machine ping failed: %d\n", code);
    }
}

void notifyProductStockUpdate(const String& machine_id, int product_id, int quantity, String mode) {
    String payload = "{";
    payload += "\"machine_id\":\"" + machine_id + "\",";
    payload += "\"product_id\":" + String(product_id) + ",";
    payload += "\"quantity\":" + String(quantity);
    if (mode.length() > 0) {
        payload += ",\"mode\":\"" + mode + "\"";
    }
    payload += "}";

    String url = SERVER_BASE + "/api/update-product-stock";
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/update-product-stock";
    }
#endif

    makeHTTPRequest(url, "POST", payload);
}

// ==================== DISPENSE FUNCTIONS ====================

void dispenseProductByMotor() {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial.println("❌ Motor out of stock!");
        Serial2.print("9");
        return;
    }
    
    pinMode(TRANSISTOR_BASE, OUTPUT);
    digitalWrite(TRANSISTOR_BASE, HIGH);
    delay(2830);
    digitalWrite(TRANSISTOR_BASE, LOW);
    
    saveMotorStockToEEPROM(stock - 1);
    Serial.printf("✅ Dispensed! Stock: %d\n", stock - 1);
}

void dispenseAsCoinSequence() {
    Serial2.print("3");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);
    
    dispenseProductByMotor();
    
    Serial2.print("1");
    delay(3000);
    Serial2.print("5");
    delay(3000);
    
    sendStockAwareStatus();
}

// ==================== PAYMENT FUNCTIONS ====================

void handlePaymentDocument(JsonObject doc) {
    String status = doc["status"] | "";
    if (status != "success" && status != "ok") return;
    
    String macFromServer = doc["macAddress"] | doc["mac"] | "";
    if (macFromServer.length() > 0 && macFromServer != deviceMacAddress) {
        Serial.println("⚠ MAC mismatch");
        return;
    }
    
    Serial.println("✅ Payment confirmed!");
    
    JsonArray products = doc["products"];
    if (!products.isNull()) {
        for (JsonObject item : products) {
            int quantity = item["quantity"] | 1;
            for (int i = 0; i < quantity; i++) {
                dispenseAsCoinSequence();
                delay(500);
            }
        }
    } else {
        dispenseAsCoinSequence();
    }
}

void listenForOnlinePayment() {
    // Add firmware version to payment check
    String url = SERVER_BASE + "/api/payment_success?mac=" + urlEncode(deviceMacAddress) +
                 "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION);
    
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/payment_success?mac=" + urlEncode(deviceMacAddress) +
              "&firmware=" + urlEncode(CURRENT_FIRMWARE_VERSION);
    }
#endif
    
    String responseBody = "";
    int code = makeHTTPRequest(url, "GET", "", &responseBody);
    
    if (code == 200 && responseBody.length() > 0) {
        DynamicJsonDocument doc(2048);
        DeserializationError err = deserializeJson(doc, responseBody);
        if (!err) {
            handlePaymentDocument(doc.as<JsonObject>());
        }
    }
}

void sendCoinPayment(int productNumber, int coinAmount) {
    String payload = "{";
    payload += "\"machine_id\":\"" + machineId + "\",";
    payload += "\"product_id\":" + String(productNumber) + ",";
    payload += "\"amount_in_paisa\":" + String(coinAmount * 100);
    payload += "}";

    String url = SERVER_BASE + "/api/coin-payment";
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/coin-payment";
    }
#endif

    int code = makeHTTPRequest(url, "POST", payload);
    Serial.printf("💰 Coin payment: %d\n", code);
}

// ==================== DIAGNOSTIC FUNCTIONS ====================

void testDNSResolution() {
    Serial.println("🔍 Testing DNS resolution for server...");
    IPAddress serverIP;
    String host = SERVER_BASE;
    host.replace("https://", "");
    host.replace("http://", "");
    int colonIdx = host.indexOf(':');
    if (colonIdx > 0) host = host.substring(0, colonIdx);
    int slashIdx = host.indexOf('/');
    if (slashIdx > 0) host = host.substring(0, slashIdx);
    
    if (WiFi.hostByName(host.c_str(), serverIP)) {
        Serial.print("✅ DNS resolved to: ");
        Serial.println(serverIP);
    } else {
        Serial.println("❌ DNS resolution failed!");
    }
}

void testSSLConnection() {
    Serial.println("🔐 Testing SSL connection...");
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi not connected!");
        return;
    }
    
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(15000);
    
    String host = SERVER_BASE;
    host.replace("https://", "");
    host.replace("http://", "");
    int colonIdx = host.indexOf(':');
    if (colonIdx > 0) host = host.substring(0, colonIdx);
    
    Serial.println("🔗 Attempting SSL connection to " + host + ":443...");
    if (client.connect(host.c_str(), 443)) {
        Serial.println("✅ SSL connection successful!");
        client.println("GET /api/machine-ping HTTP/1.1");
        client.println("Host: " + host);
        client.println("Connection: close");
        client.println();
        
        unsigned long timeout = millis() + 5000;
        while (client.connected() && millis() < timeout) {
            if (client.available()) {
                String line = client.readStringUntil('\n');
                Serial.print("📄 ");
                Serial.println(line);
                if (line == "\r") break;
            }
        }
        client.stop();
    } else {
        Serial.println("❌ SSL connection failed!");
    }
}

void testHTTPvsHTTPS() {
    Serial.println("🔍 Testing HTTP vs HTTPS connectivity...");
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi not connected!");
        return;
    }
    
    // Test HTTPS
    Serial.println("🔒 Testing HTTPS...");
    String httpsUrl = SERVER_BASE + "/api/machine-ping";
    int httpsCode = makeHTTPRequest(httpsUrl, "GET");
    Serial.printf("HTTPS Response: %d %s\n", httpsCode, httpsCode > 0 ? "✅" : "❌");
    
    // Test HTTP
    Serial.println("🌐 Testing HTTP...");
    String httpUrl = "http://192.168.1.2:80/api/machine-ping";
    HTTPClient http;
    http.begin(httpUrl);
    int httpCode = http.GET();
    Serial.printf("HTTP Response: %d %s\n", httpCode, httpCode > 0 ? "✅" : "❌");
    http.end();
}

void testServerConnection() {
    Serial.println("🧪 Testing server connection...");
    
    if (!isNetworkConnected()) {
        Serial.println("❌ No network connection!");
        return;
    }
    
    String testUrl = SERVER_BASE + "/api/machine-ping";
    String payload = "{\"machine_id\":\"" + machineId + "\",\"test\":true}";
    
    Serial.print("🔗 Testing: ");
    Serial.println(testUrl);
    
    String response = "";
    int code = makeHTTPRequest(testUrl, "POST", payload, &response);
    
    Serial.printf("📡 Response code: %d\n", code);
    if (response.length() > 0) {
        Serial.print("📄 Response: ");
        Serial.println(response);
    }
}

// ==================== PROVISIONING WEB SERVER ====================

void handleRoot() {
    String html = R"rawliteral(
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lyra WiFi Setup</title>
<style>:root{--bg:#0f1724;--card:#0b1220;--accent:#7c3aed;--muted:#9aa4b2;--white:#eef2ff}
html,body{height:100%;margin:0;font-family:Inter,system-ui}
body{background:linear-gradient(180deg,#071022,#07112a);color:var(--white);display:flex;align-items:center;justify-content:center}
.container{width:100%;max-width:920px;padding:28px}.card{background:rgba(255,255,255,0.02);border-radius:12px;padding:20px}
.header{display:flex;align-items:center;gap:12px}.logo{width:56px;height:56px;border-radius:8px;
background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-weight:700}
.title{font-size:18px;font-weight:700}input{flex:1;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);
background:rgba(255,255,255,0.02);color:var(--white)}button{background:var(--accent);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer}
.net{display:flex;justify-content:space-between;padding:10px;border-radius:8px;margin:8px 0;background:rgba(255,255,255,0.01)}
</style>
<script>
async function scan(){document.getElementById('list').innerHTML='Scanning...';
const r=await fetch('/api/scan');const d=await r.json();let h='';
d.forEach(n=>{h+=`<div class="net"><div>${n.ssid} (${n.rssi}dBm)</div><button onclick="connect('${n.ssid}')">Connect</button></div>`});
document.getElementById('list').innerHTML=h;}
async function connect(s){const p=prompt('Password for '+s);if(p){
await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:s,password:p})});
alert('Connecting...');}}
window.onload=scan;
</script>
</head><body><div class="container"><div class="card"><div class="header"><div class="logo">LE</div>
<div><div class="title">Lyra WiFi Setup</div></div></div><div id="list"></div></div></div></body></html>
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
    WiFi.mode(WIFI_AP);
    WiFi.softAP("ESP32_WIFI", "password123");
    Serial.println("📡 Provisioning: http://192.168.4.1");
    
    server.on("/", handleRoot);
    server.on("/api/scan", handleAPIScan);
    server.on("/api/connect", HTTP_POST, handleAPIConnect);
    server.begin();
}

// ==================== SETUP ====================

void setup() {
    Serial.begin(115200);
    Serial2.begin(115200, SERIAL_8N1, 16, 17);
    
    Serial.println("\n🚀 Lyra Vending Machine " + String(CURRENT_FIRMWARE_VERSION));
    
    // Initialize watchdog timer for automatic recovery
    initializeWatchdog();
    
    // ========== DETAILED MEMORY REPORT ==========
    Serial.println("\n🔋 ===== ESP32 MEMORY REPORT =====");
    
    size_t totalHeap = ESP.getHeapSize();
    size_t freeHeap = ESP.getFreeHeap();
    size_t usedHeap = totalHeap - freeHeap;
    size_t maxAllocHeap = ESP.getMaxAllocHeap();
    
    Serial.printf("📊 Total RAM: %d bytes (%.1f KB)\n", totalHeap, totalHeap / 1024.0);
    Serial.printf("✅ Free RAM:  %d bytes (%.1f KB) - %.1f%%\n", 
                 freeHeap, freeHeap / 1024.0, (freeHeap * 100.0) / totalHeap);
    Serial.printf("🔴 Used RAM:  %d bytes (%.1f KB) - %.1f%%\n", 
                 usedHeap, usedHeap / 1024.0, (usedHeap * 100.0) / totalHeap);
    Serial.printf("🎯 Max Alloc: %d bytes (%.1f KB)\n", maxAllocHeap, maxAllocHeap / 1024.0);
    
    size_t flashSize = ESP.getFlashChipSize();
    size_t sketchSize = ESP.getSketchSize();
    size_t freeSketchSpace = ESP.getFreeSketchSpace();
    
    Serial.printf("💾 Flash: %d bytes (%.1f MB)\n", flashSize, flashSize / (1024.0 * 1024.0));
    Serial.printf("📱 Sketch: %d bytes (%.1f KB) - %.1f%%\n", 
                 sketchSize, sketchSize / 1024.0, (sketchSize * 100.0) / flashSize);
    Serial.printf("🆓 Free Flash: %d bytes (%.1f KB)\n", freeSketchSpace, freeSketchSpace / 1024.0);
    
    Serial.printf("🔧 Chip: %s\n", ESP.getChipModel());
    Serial.printf("⚡ CPU: %d MHz\n", ESP.getCpuFreqMHz());
    Serial.printf("🆔 Revision: %d\n", ESP.getChipRevision());
    Serial.printf("📶 SDK: %s\n", ESP.getSdkVersion());
    
    Serial.println("=====================================\n");
    
    printPartitionInfo();
    
    pinMode(WIFI_RESET_BUTTON_PIN, INPUT_PULLUP);
    pinMode(TRANSISTOR_BASE, OUTPUT);
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(RESET_PIN, INPUT_PULLUP);
    pinMode(COIN_PIN, INPUT_PULLUP);
    
    EEPROM.begin(EEPROM_SIZE);
    Serial2.print("0");
    delay(2000);
    
    getMACAddress();
    
    // Try Ethernet first
#ifdef USE_ETHERNET
    Serial.println("🔌 Attempting Ethernet connection (this may take a moment)...");
    feedWatchdog();  // Feed watchdog before slow Ethernet init
    if (initializeEthernet()) {
        Serial.println("✅ Using Ethernet");
        SERVER_BASE = ETHERNET_SERVER_BASE;
        feedWatchdog();  // Feed after Ethernet init
        fetchMachineInfoFromBackend(deviceMacAddress);
        feedWatchdog();
        sendMachineStatusPing();
        lastPingTime = millis();
        return;
    }
    Serial.println("⚠️ Ethernet not available, falling back to WiFi");
    feedWatchdog();  // Feed after Ethernet attempt
#endif
    
    // Fall back to WiFi
    String ssid = eepromReadStringSafe(0, 32);
    String password = eepromReadStringSafe(32, 64);
    if (ssid.length() == 0) ssid = readEEPROM(0, 32);
    if (password.length() == 0) password = readEEPROM(32, 64);
    
    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), password.c_str());
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            feedWatchdog();  // Feed watchdog during WiFi connection
            attempts++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("✅ WiFi Connected");
            ensureWiFiStability();  // Apply WiFi stability optimizations
            digitalWrite(BLUE_LED_PIN, HIGH);
            
            fetchMachineInfoFromBackend(deviceMacAddress);
            
            ArduinoOTA.setHostname(("Lyra-" + machineName).c_str());
            ArduinoOTA.setPassword("lyra2024");
            ArduinoOTA.begin();
            
            sendMachineStatusPing();
            lastPingTime = millis();
            sendStockAwareStatus();
        } else {
            startProvisioning();
        }
    } else {
        startProvisioning();
    }
}

// ==================== MAIN LOOP ====================

void loop() {
    // Feed watchdog timer to prevent auto-reboot
    feedWatchdog();
    
    ArduinoOTA.handle();
    server.handleClient();
    
#ifdef USE_ETHERNET
    checkEthernetLinkStatus();
#endif
    
    // Monitor and maintain WiFi connection every 30 seconds
    if (!provisioningMode && !useEthernet && millis() - lastWiFiCheck > 30000) {
        maintainWiFiConnection();
        lastWiFiCheck = millis();
    }
    
    // LED blink in provisioning mode
    if (provisioningMode) {
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink > 500) {
            digitalWrite(BLUE_LED_PIN, !digitalRead(BLUE_LED_PIN));
            lastBlink = millis();
        }
    }
    
    // Serial command handler for diagnostics
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();
        
        if (command == "test") {
            Serial.println("🧪 Running all tests...");
            testDNSResolution();
            testSSLConnection();
            testHTTPvsHTTPS();
            testServerConnection();
        } else if (command == "dns") {
            testDNSResolution();
        } else if (command == "ssl") {
            testSSLConnection();
        } else if (command == "http") {
            testHTTPvsHTTPS();
        } else if (command == "ping") {
            sendMachineStatusPing();
        } else if (command == "fetch") {
            Serial.println("🔄 Re-fetching machine ID...");
            fetchMachineInfoFromBackend(deviceMacAddress);
            if (machineId != "UNKNOWN") {
                sendMachineStatusPing();
            }
        } else if (command == "switch") {
            if (SERVER_BASE.startsWith("https://")) {
                SERVER_BASE = "http://192.168.1.2:80";
                Serial.println("🔄 Switched to HTTP mode");
            } else {
                SERVER_BASE = "https://192.168.1.2";
                Serial.println("🔄 Switched to HTTPS mode");
            }
            Serial.println("📡 New SERVER_BASE: " + SERVER_BASE);
        } else if (command == "status") {
            Serial.println("\n=== SYSTEM STATUS ===");
            Serial.println("Firmware: " + String(CURRENT_FIRMWARE_VERSION));
            Serial.println("Machine ID: " + machineId);
            Serial.println("MAC: " + deviceMacAddress);
            Serial.println("Network: " + String(isNetworkConnected() ? "Connected" : "Disconnected"));
#ifdef USE_ETHERNET
            Serial.println("Ethernet: " + String(useEthernet ? "Enabled" : "Disabled"));
#endif
            Serial.println("Stock: " + String(readMotorStockFromEEPROM()));
            printMemoryStatus("Status");
            Serial.println("=====================\n");
        } else if (command == "dispense") {
            Serial.println("🎰 Manual dispense triggered");
            dispenseProductByMotor();
#ifdef USE_ETHERNET
        } else if (command == "diag") {
            printEthernetDiagnostics();
        } else if (command == "reset-eth") {
            resetEthernetModule();
            if (initializeEthernet()) {
                Serial.println("✅ Ethernet reinitialized");
            } else {
                Serial.println("❌ Ethernet reinit failed");
            }
#endif
        } else if (command == "help") {
            Serial.println("\n=== AVAILABLE COMMANDS ===");
            Serial.println("test       - Run all diagnostic tests");
            Serial.println("dns        - Test DNS resolution");
            Serial.println("ssl        - Test SSL connection");
            Serial.println("http       - Test HTTP vs HTTPS");
            Serial.println("ping       - Send machine ping");
            Serial.println("fetch      - Re-fetch machine ID");
            Serial.println("switch     - Switch HTTP/HTTPS mode");
            Serial.println("status     - Show system status");
            Serial.println("dispense   - Manual dispense test");
#ifdef USE_ETHERNET
            Serial.println("diag       - Ethernet diagnostics");
            Serial.println("reset-eth  - Reset Ethernet module");
#endif
            Serial.println("help       - Show this help");
            Serial.println("=========================\n");
        }
    }
    
    // Reset button
    static unsigned long lastResetDebounce = 0;
    if (digitalRead(RESET_PIN) == LOW && millis() - lastResetDebounce > 300) {
        lastResetDebounce = millis();
        saveMotorStockToEEPROM(30);
        Serial2.print("8");
        delay(1000);
        sendStockAwareStatus();
    }
    
    // WiFi reset button
    static unsigned long lastWifiResetDebounce = 0;
    if (digitalRead(WIFI_RESET_BUTTON_PIN) == LOW && millis() - lastWifiResetDebounce > 300) {
        lastWifiResetDebounce = millis();
        Serial.println("🔄 WiFi reset");
        EEPROM.begin(EEPROM_SIZE);
        for (int i = 0; i < 64; i++) EEPROM.write(i, 0);
        EEPROM.commit();
        ESP.restart();
    }
    
    // Payment polling
    static unsigned long lastPaymentCheck = 0;
    if (millis() - lastPaymentCheck > 4000) {
        if (isNetworkConnected()) {
            listenForOnlinePayment();
        }
        lastPaymentCheck = millis();
    }
    
    // Status ping every 5 minutes
    if (millis() - lastPingTime > 300000) {
        if (isNetworkConnected()) {
            sendMachineStatusPing();
        }
        lastPingTime = millis();
    }
    
    // Coin detection
    static bool lastCoinState = HIGH;
    bool coinState = digitalRead(COIN_PIN);
    if (coinState == LOW && lastCoinState == HIGH) {
        Serial.println("💰 Coin detected");
        int stock = readMotorStockFromEEPROM();
        
        if (stock <= 0) {
            Serial2.print("9");
            if (isNetworkConnected()) sendCoinPayment(1, 5);
        } else {
            Serial2.print("4");
            digitalWrite(BLUE_LED_PIN, LOW);
            delay(100);
            digitalWrite(BLUE_LED_PIN, HIGH);
            delay(2900);
            
            dispenseProductByMotor();
            if (isNetworkConnected()) sendCoinPayment(1, 5);
            
            Serial2.print("1");
            delay(3000);
            Serial2.print("5");
            delay(3000);
            sendStockAwareStatus();
        }
    }
    lastCoinState = coinState;
}

#ifdef USE_ETHERNET
// ==================== ETHERNET FUNCTIONS ====================

bool initializeEthernet() {
    Serial.println("🔌 Initializing Ethernet...");
    
    pinMode(ETHERNET_CS, OUTPUT);
    digitalWrite(ETHERNET_CS, HIGH);
    
    SPI.begin();
    SPI.setBitOrder(MSBFIRST);
    SPI.setDataMode(SPI_MODE0);
    SPI.setFrequency(8000000);
    
    Ethernet.init(ETHERNET_CS);
    
    Ethernet.begin(ethernetMAC);
    delay(2000);
    
    if (Ethernet.localIP() != IPAddress(0,0,0,0)) {
        Serial.println("✅ Ethernet DHCP: " + Ethernet.localIP().toString());
        ethernetConnected = true;
        useEthernet = true;
        digitalWrite(BLUE_LED_PIN, HIGH);
        return true;
    }
    
    Serial.println("❌ Ethernet failed");
    return false;
}

void checkEthernetLinkStatus() {
    if (!useEthernet) return;
    
    static unsigned long lastCheck = 0;
    static uint8_t lastStatus = Unknown;
    
    if (millis() - lastCheck > 30000) {
        uint8_t status = Ethernet.linkStatus();
        if (status != lastStatus) {
            if (status == LinkOFF) {
                Serial.println("❌ Ethernet disconnected");
                ethernetConnected = false;
                sendStockAwareErrorStatus();
            } else if (status == LinkON) {
                Serial.println("✅ Ethernet reconnected");
                Ethernet.begin(ethernetMAC);
                if (Ethernet.localIP() != IPAddress(0,0,0,0)) {
                    ethernetConnected = true;
                    sendStockAwareStatus();
                }
            }
        }
        lastStatus = status;
        lastCheck = millis();
    }
}

void printEthernetDiagnostics() {
    Serial.println("\n=== ETHERNET DIAGNOSTICS ===");
    Serial.printf("Hardware: ");
    switch (Ethernet.hardwareStatus()) {
        case EthernetNoHardware: Serial.println("No Hardware"); break;
        case EthernetW5100: Serial.println("ENC28J60/W5100"); break;
        case EthernetW5200: Serial.println("W5200"); break;
        case EthernetW5500: Serial.println("W5500"); break;
        default: Serial.println("Unknown"); break;
    }
    
    Serial.printf("Link: ");
    switch (Ethernet.linkStatus()) {
        case Unknown: Serial.println("Unknown"); break;
        case LinkON: Serial.println("Connected"); break;
        case LinkOFF: Serial.println("Disconnected"); break;
        default: Serial.println("Other"); break;
    }
    
    if (Ethernet.localIP() != IPAddress(0,0,0,0)) {
        Serial.printf("IP: %s\n", Ethernet.localIP().toString().c_str());
        Serial.printf("Subnet: %s\n", Ethernet.subnetMask().toString().c_str());
        Serial.printf("Gateway: %s\n", Ethernet.gatewayIP().toString().c_str());
        Serial.printf("DNS: %s\n", Ethernet.dnsServerIP().toString().c_str());
    } else {
        Serial.println("IP: Not assigned");
    }
    
    Serial.printf("Connected: %s\n", ethernetConnected ? "Yes" : "No");
    Serial.printf("Use Ethernet: %s\n", useEthernet ? "Yes" : "No");
    Serial.println("============================\n");
}

void resetEthernetModule() {
    Serial.println("🔄 Resetting Ethernet module...");
    digitalWrite(ETHERNET_CS, LOW);
    delay(1);
    digitalWrite(ETHERNET_CS, HIGH);
    delay(100);
    Ethernet.init(ETHERNET_CS);
    delay(500);
    Serial.println("✅ Ethernet module reset complete");
}

bool downloadFirmwareOverEthernet(const String& firmwareUrl, int expectedSize) {
    Serial.println("🔌 Downloading firmware over Ethernet...");
    Serial.println("📡 URL: " + firmwareUrl);
    
    String url = firmwareUrl;
    if (url.startsWith("https://")) {
        Serial.println("❌ HTTPS not supported over Ethernet");
        return false;
    }
    
    if (!url.startsWith("http://")) {
        url = "http://" + url;
    }
    
    url = url.substring(7); // Remove "http://"
    
    int slashIdx = url.indexOf('/');
    String host = (slashIdx >= 0) ? url.substring(0, slashIdx) : url;
    String path = (slashIdx >= 0) ? url.substring(slashIdx) : "/";
    
    int colonIdx = host.indexOf(':');
    int port = 80;
    if (colonIdx >= 0) {
        port = host.substring(colonIdx + 1).toInt();
        host = host.substring(0, colonIdx);
    }
    
    Serial.printf("🔗 Connecting to %s:%d%s\n", host.c_str(), port, path.c_str());
    
    if (!ethClient.connect(host.c_str(), port)) {
        Serial.println("❌ Connection failed");
        return false;
    }
    
    ethClient.print("GET " + path + " HTTP/1.1\r\n");
    ethClient.print("Host: " + host + "\r\n");
    ethClient.print("Connection: close\r\n\r\n");
    
    unsigned long timeout = millis() + 10000;
    while (ethClient.available() == 0 && millis() < timeout) {
        delay(100);
    }
    
    if (ethClient.available() == 0) {
        Serial.println("❌ Timeout");
        ethClient.stop();
        return false;
    }
    
    // Parse headers
    bool headersEnded = false;
    int contentLength = -1;
    int statusCode = -1;
    
    while (ethClient.available() && !headersEnded) {
        String line = ethClient.readStringUntil('\n');
        line.trim();
        
        if (statusCode == -1 && line.startsWith("HTTP/")) {
            int firstSpace = line.indexOf(' ');
            if (firstSpace > 0) {
                int secondSpace = line.indexOf(' ', firstSpace + 1);
                String codeStr = (secondSpace > firstSpace) ? 
                                line.substring(firstSpace + 1, secondSpace) : 
                                line.substring(firstSpace + 1);
                statusCode = codeStr.toInt();
            }
        }
        
        String lowerLine = line;
        lowerLine.toLowerCase();
        if (lowerLine.startsWith("content-length:")) {
            contentLength = line.substring(15).toInt();
        }
        
        if (line.length() == 0) {
            headersEnded = true;
        }
    }
    
    if (statusCode != 200) {
        Serial.printf("❌ HTTP %d\n", statusCode);
        ethClient.stop();
        return false;
    }
    
    Serial.printf("✅ HTTP 200 - Size: %d bytes\n", contentLength);
    
    if (!Update.begin((contentLength > 0) ? contentLength : UPDATE_SIZE_UNKNOWN)) {
        Serial.println("❌ Update.begin failed");
        Update.printError(Serial);
        ethClient.stop();
        return false;
    }
    
    Serial.println("📥 Downloading firmware...");
    
    int bytesWritten = 0;
    unsigned long lastProgress = 0;
    timeout = millis() + 120000;
    
    while (ethClient.available() || ethClient.connected()) {
        if (ethClient.available()) {
            uint8_t buffer[1024];
            int bytesToRead = min((int)sizeof(buffer), ethClient.available());
            int bytesRead = ethClient.readBytes(buffer, bytesToRead);
            
            if (bytesRead > 0) {
                size_t written = Update.write(buffer, bytesRead);
                if (written != bytesRead) {
                    Serial.println("❌ Write error");
                    Update.end(false);
                    ethClient.stop();
                    return false;
                }
                bytesWritten += written;
                timeout = millis() + 30000;
            }
            
            if (bytesWritten - lastProgress >= 10240) {
                if (contentLength > 0) {
                    Serial.printf("📥 %d%% (%d/%d)\n", 
                                (bytesWritten * 100) / contentLength, 
                                bytesWritten, 
                                contentLength);
                } else {
                    Serial.printf("📥 %d bytes\n", bytesWritten);
                }
                lastProgress = bytesWritten;
            }
        }
        
        if (millis() > timeout) {
            Serial.println("❌ Download timeout");
            Update.end(false);
            ethClient.stop();
            return false;
        }
        
        delay(1);
    }
    
    ethClient.stop();
    
    if (Update.end(true)) {
        Serial.printf("✅ Firmware updated! %d bytes\n", bytesWritten);
        return true;
    } else {
        Serial.println("❌ Update failed");
        Update.printError(Serial);
        return false;
    }
}
#endif
