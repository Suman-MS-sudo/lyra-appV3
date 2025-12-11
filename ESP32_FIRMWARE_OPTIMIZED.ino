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

// Ethernet Module Pins - HARDWIRED ON PCB
// Module: HANRUN HR911105A (ENC28J60 based)
// Scanner found hardware (status: Unknown 10) - module is detected but not fully recognized
// PCB configuration - CANNOT BE CHANGED
#define ETHERNET_CS 22     // Chip Select - HARDWIRED ON PCB
#define SPI_SCK 18         // Clock
#define SPI_MISO 19        // Master In Slave Out (SO on HR911105A)
#define SPI_MOSI 23        // Master Out Slave In (SI on HR911105A)

// ==================== OFFLINE TRANSACTION QUEUE ====================
// EEPROM Layout: [0-31: SSID] [32-95: Password] [64: Motor Stock]
//                [100: Queue Count] [101-255: Transaction Queue (15 slots)]
#define QUEUE_COUNT_ADDR 100
#define QUEUE_START_ADDR 101
#define QUEUE_MAX_SIZE 15
#define TRANSACTION_SIZE 10  // product_id index (1) + amount (4) + timestamp (4) + synced flag (1)

struct OfflineTransaction {
    uint8_t productIndex;  // Index in product list (0-255)
    uint32_t amountPaisa;  // Amount in paisa
    uint32_t timestamp;    // Seconds since boot
    bool synced;           // Sync status
};

// ==================== GLOBAL VARIABLES ====================
WebServer server(80);
bool provisioningMode = false;
String deviceMacAddress;
String machineId = "UNKNOWN";
String machineName = "UNKNOWN";
String defaultProductId = "";  // UUID of default product for coin payments
unsigned long lastPingTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long wifiReconnectAttempts = 0;

// Server configuration
String SERVER_BASE = "https://lyra-app.co.in";  // Production HTTPS server
String ETHERNET_SERVER_BASE = "http://lyra-app.co.in:8080";  // Production HTTP proxy for Ethernet

// Ethernet globals
#ifdef USE_ETHERNET
bool useEthernet = false;
bool ethernetConnected = false;
byte ethernetMAC[6] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
EthernetClient ethClient;
#endif

// ==================== FORWARD DECLARATIONS ====================
void notifyProductStockUpdate(const String& machine_id, const String& product_id, int quantity = 1, String mode = "");
String fetchMachineInfoFromBackend(const String& mac);
void fetchMachineProducts();
void dispenseProductByMotor(String productId = "");
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

// Offline queue functions
void saveOfflineTransaction(int amountPaisa);
void syncOfflineTransactions();
int getQueuedTransactionCount();
void clearOfflineQueue();

// HTTP request functions
int makeHTTPRequest(const String& url, const String& method, const String& payload, String* responseBody);

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
void scanEthernetPins();
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

void saveMotorStockToEEPROM(int count, String productId = "") {
    EEPROM.begin(EEPROM_SIZE);
    EEPROM.write(MOTOR1_ADDR, count);
    EEPROM.commit();
    Serial.printf("📦 Motor stock saved: %d\n", count);
    
    // Sync to database if product_id provided and machine_id is known
    if (productId.length() > 0 && machineId != "UNKNOWN" && machineId.length() > 0) {
        notifyProductStockUpdate(machineId, productId, count, "set");
    } else if (productId.length() > 0 && machineId == "UNKNOWN") {
        Serial.println("⚠ Cannot sync stock: machine ID not yet fetched");
    }
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
    saveMotorStockToEEPROM(30, defaultProductId);
    Serial.println("📦 All motor stocks reset to 30!");
    sendMachineStatusPing();  // Sync new stock to database
}

// ==================== OFFLINE TRANSACTION QUEUE ====================

void saveOfflineTransaction(int amountPaisa) {
    EEPROM.begin(EEPROM_SIZE);
    
    int count = EEPROM.read(QUEUE_COUNT_ADDR);
    if (count < 0 || count > QUEUE_MAX_SIZE) count = 0;
    
    if (count >= QUEUE_MAX_SIZE) {
        Serial.println("⚠ Transaction queue full! Overwriting oldest.");
        count = QUEUE_MAX_SIZE - 1;
    }
    
    // Save transaction at queue position
    int addr = QUEUE_START_ADDR + (count * TRANSACTION_SIZE);
    
    OfflineTransaction tx;
    tx.productIndex = 0;  // Default product
    tx.amountPaisa = amountPaisa;
    tx.timestamp = millis() / 1000;  // Seconds since boot
    tx.synced = false;
    
    EEPROM.write(addr, tx.productIndex);
    EEPROM.write(addr + 1, (tx.amountPaisa >> 24) & 0xFF);
    EEPROM.write(addr + 2, (tx.amountPaisa >> 16) & 0xFF);
    EEPROM.write(addr + 3, (tx.amountPaisa >> 8) & 0xFF);
    EEPROM.write(addr + 4, tx.amountPaisa & 0xFF);
    EEPROM.write(addr + 5, (tx.timestamp >> 24) & 0xFF);
    EEPROM.write(addr + 6, (tx.timestamp >> 16) & 0xFF);
    EEPROM.write(addr + 7, (tx.timestamp >> 8) & 0xFF);
    EEPROM.write(addr + 8, tx.timestamp & 0xFF);
    EEPROM.write(addr + 9, tx.synced ? 1 : 0);
    
    EEPROM.write(QUEUE_COUNT_ADDR, count + 1);
    EEPROM.commit();
    
    Serial.printf("💾 Saved offline transaction #%d (₹%.2f) to EEPROM\n", count + 1, amountPaisa / 100.0);
}

int getQueuedTransactionCount() {
    EEPROM.begin(EEPROM_SIZE);
    int count = EEPROM.read(QUEUE_COUNT_ADDR);
    if (count < 0 || count > QUEUE_MAX_SIZE) count = 0;
    return count;
}

void clearOfflineQueue() {
    EEPROM.begin(EEPROM_SIZE);
    EEPROM.write(QUEUE_COUNT_ADDR, 0);
    EEPROM.commit();
    Serial.println("🗑️ Offline queue cleared");
}

void syncOfflineTransactions() {
    if (!isNetworkConnected()) {
        Serial.println("⚠ Cannot sync: no network");
        return;
    }
    
    if (machineId == "UNKNOWN" || machineId.length() == 0) {
        Serial.println("⚠ Cannot sync: machine ID unknown");
        return;
    }
    
    if (defaultProductId.length() == 0) {
        Serial.println("⚠ Cannot sync: no product assigned");
        return;
    }
    
    EEPROM.begin(EEPROM_SIZE);
    int count = EEPROM.read(QUEUE_COUNT_ADDR);
    if (count <= 0 || count > QUEUE_MAX_SIZE) {
        Serial.println("ℹ️ No offline transactions to sync");
        return;
    }
    
    Serial.printf("🔄 Syncing %d offline transactions...\n", count);
    
    int syncedCount = 0;
    for (int i = 0; i < count; i++) {
        int addr = QUEUE_START_ADDR + (i * TRANSACTION_SIZE);
        
        OfflineTransaction tx;
        tx.productIndex = EEPROM.read(addr);
        tx.amountPaisa = ((uint32_t)EEPROM.read(addr + 1) << 24) |
                        ((uint32_t)EEPROM.read(addr + 2) << 16) |
                        ((uint32_t)EEPROM.read(addr + 3) << 8) |
                        ((uint32_t)EEPROM.read(addr + 4));
        tx.timestamp = ((uint32_t)EEPROM.read(addr + 5) << 24) |
                      ((uint32_t)EEPROM.read(addr + 6) << 16) |
                      ((uint32_t)EEPROM.read(addr + 7) << 8) |
                      ((uint32_t)EEPROM.read(addr + 8));
        tx.synced = EEPROM.read(addr + 9) == 1;
        
        if (tx.synced) {
            syncedCount++;
            continue;
        }
        
        // Send coin payment to server
        String payload = "{";
        payload += "\"machine_id\":\"" + machineId + "\",";
        payload += "\"product_id\":\"" + defaultProductId + "\",";
        payload += "\"amount_in_paisa\":" + String(tx.amountPaisa) + ",";
        payload += "\"offline_sync\":true,";
        payload += "\"timestamp\":" + String(tx.timestamp);
        payload += "}";

        String url = SERVER_BASE + "/api/coin-payment";
#ifdef USE_ETHERNET
        if (useEthernet && ethernetConnected) {
            url = ETHERNET_SERVER_BASE + "/api/coin-payment";
        }
#endif

        int code = makeHTTPRequest(url, "POST", payload, nullptr);
        
        if (code == 200) {
            // Mark as synced
            EEPROM.write(addr + 9, 1);
            EEPROM.commit();
            syncedCount++;
            Serial.printf("✅ Synced transaction #%d (₹%.2f)\n", i + 1, tx.amountPaisa / 100.0);
        } else {
            Serial.printf("⚠ Failed to sync transaction #%d: %d\n", i + 1, code);
        }
        
        delay(500);  // Avoid overwhelming server
    }
    
    Serial.printf("✅ Sync complete: %d/%d transactions\n", syncedCount, count);
    
    // Clear queue if all synced
    if (syncedCount == count) {
        clearOfflineQueue();
    }
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
                
                // Sync offline transactions after reconnection
                delay(1000);
                syncOfflineTransactions();
                
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
        // UIPEthernet/ENC28J60 doesn't support linkStatus() - just check if we have an IP
        IPAddress ip = Ethernet.localIP();
        return ethernetConnected && (ip != IPAddress(0,0,0,0));
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

    // Verify Ethernet is still connected
    IPAddress ip = Ethernet.localIP();
    if (ip == IPAddress(0,0,0,0) || ip[0] == 0) {
        Serial.println("❌ Ethernet has no valid IP!");
        ethernetConnected = false;
        useEthernet = false;
        sendStockAwareErrorStatus();  // Update display to show network error
        return -1;
    }
    
    // Skip link status check - UIPEthernet/ENC28J60 doesn't support it
    // The IP check above is sufficient to verify connectivity

    // Try to connect with retries
    Serial.printf("🔌 Connecting to %s:%d... ", host.c_str(), port);
    bool connected = false;
    
    for (int attempt = 0; attempt < 3; attempt++) {
        if (ethClient.connect(host.c_str(), port)) {
            connected = true;
            Serial.println("✅");
            break;
        }
        
        if (attempt < 2) {
            ethClient.stop();
            delay(500);
        }
    }
    
    if (!connected) {
        Serial.println("❌ Failed!");
        Serial.printf("   Host: %s, Port: %d\n", host.c_str(), port);
        Serial.printf("   Local IP: %s\n", Ethernet.localIP().toString().c_str());
        Serial.printf("   Gateway: %s\n", Ethernet.gatewayIP().toString().c_str());
        
        // Mark as disconnected and switch to WiFi
        ethernetConnected = false;
        useEthernet = false;
        Serial.println("   💡 Switching to WiFi...");
        sendStockAwareErrorStatus();  // Update display to show network error
        
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
        int result = makeEthernetHTTPRequest(url, method, payload, responseBody);
        
        // If Ethernet request failed and we're now switched to WiFi, retry with WiFi
        if (result < 0 && !useEthernet) {
            Serial.println("🔄 Retrying with WiFi...");
            // Fall through to WiFi request below
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
    
#ifdef USE_ETHERNET
    // Set Ethernet MAC based on WiFi MAC (slightly modified to avoid conflicts)
    uint8_t wifiMAC[6];
    esp_wifi_get_mac(WIFI_IF_STA, wifiMAC);
    
    // Use WiFi MAC but increment last byte by 1 for Ethernet
    ethernetMAC[0] = wifiMAC[0];
    ethernetMAC[1] = wifiMAC[1];
    ethernetMAC[2] = wifiMAC[2];
    ethernetMAC[3] = wifiMAC[3];
    ethernetMAC[4] = wifiMAC[4];
    ethernetMAC[5] = wifiMAC[5] + 1;
    
    Serial.printf("📡 Ethernet MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                 ethernetMAC[0], ethernetMAC[1], ethernetMAC[2],
                 ethernetMAC[3], ethernetMAC[4], ethernetMAC[5]);
#endif
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

void fetchMachineProducts() {
    if (machineId == "UNKNOWN" || machineId.length() == 0) {
        Serial.println("⚠ Cannot fetch products: machine ID unknown");
        return;
    }
    
    String url = SERVER_BASE + "/api/machine-products?machine_id=" + urlEncode(machineId);
    
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/machine-products?machine_id=" + urlEncode(machineId);
    }
#endif
    
    Serial.println("📦 Fetching machine products...");
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
                String productName = defaultProd["name"] | "Unknown";
                int stock = defaultProd["stock"] | 0;
                
                Serial.println("✅ Default Product ID: " + defaultProductId);
                Serial.println("   Name: " + productName);
                Serial.printf("   Stock (DB): %d\n", stock);
            }
        }
    } else {
        Serial.printf("⚠ Failed to fetch products: %d\n", code);
    }
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
    
    // Read current stock from EEPROM (source of truth)
    int currentStock = readMotorStockFromEEPROM();
    
    String payload = "{";
    payload += "\"machine_id\":\"" + machineId + "\",";
    payload += "\"firmware_version\":\"" + String(CURRENT_FIRMWARE_VERSION) + "\",";
    
    // Only send WiFi RSSI if using WiFi, otherwise send null
#ifdef USE_ETHERNET
    if (useEthernet) {
        payload += "\"wifi_rssi\":null,";
    } else {
        payload += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
    }
#else
    payload += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
#endif
    
    payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
    payload += "\"uptime\":" + String(millis()) + ",";
    payload += "\"network_speed_kbps\":" + String(networkSpeed, 2) + ",";
    payload += "\"temperature_celsius\":" + String(temperature, 1) + ",";
    payload += "\"stock_count\":" + String(currentStock);
    payload += "}";

    String url = SERVER_BASE + "/api/machine-ping";
#ifdef USE_ETHERNET
    if (useEthernet && ethernetConnected) {
        url = ETHERNET_SERVER_BASE + "/api/machine-ping";
    }
#endif

    int code = makeHTTPRequest(url, "POST", payload);
    
    if (code == 200) {
        Serial.printf("✅ Machine ping successful (Stock: %d)\n", currentStock);
    } else {
        Serial.printf("⚠ Machine ping failed: %d\n", code);
    }
}

void notifyProductStockUpdate(const String& machine_id, const String& product_id, int quantity, String mode) {
    String payload = "{";
    payload += "\"machine_id\":\"" + machine_id + "\",";
    payload += "\"product_id\":\"" + product_id + "\",";
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

    int code = makeHTTPRequest(url, "POST", payload);
    if (code == 200) {
        Serial.println("✅ Stock synced to database");
    } else {
        Serial.printf("⚠ Stock sync failed: %d\n", code);
    }
}

// ==================== DISPENSE FUNCTIONS ====================

void dispenseProductByMotor(String productId) {
    int stock = readMotorStockFromEEPROM();
    if (stock <= 0) {
        Serial.println("❌ Motor out of stock!");
        Serial2.print("9");
        return;
    }
    
    Serial.printf("🔄 Activating motor... (Stock before: %d)\n", stock);
    pinMode(TRANSISTOR_BASE, OUTPUT);
    digitalWrite(TRANSISTOR_BASE, HIGH);
    delay(2830);
    digitalWrite(TRANSISTOR_BASE, LOW);
    
    saveMotorStockToEEPROM(stock - 1, productId);
    Serial.printf("✅ Motor stopped! New stock: %d\n", stock - 1);
}

void dispenseAsCoinSequence(String productId = "") {
    Serial.println("📺 Display: Dispensing (3)");
    Serial2.print("3");
    digitalWrite(BLUE_LED_PIN, LOW);
    delay(100);
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(2900);
    
    dispenseProductByMotor(productId);
    
    Serial.println("📺 Display: Thank You (1)");
    Serial2.print("1");
    delay(3000);
    Serial.println("📺 Display: Please Take (5)");
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
    
    // Extract payment details for logging
    String transactionId = doc["transactionId"] | "unknown";
    String razorpayOrderId = doc["razorpayOrderId"] | "unknown";
    String razorpayPaymentId = doc["razorpayPaymentId"] | "unknown";
    float amount = doc["amount"] | 0.0;
    
    Serial.println("\n========================================");
    Serial.println("✅ ONLINE PAYMENT RECEIVED!");
    Serial.println("========================================");
    Serial.printf("💳 Transaction ID: %s\n", transactionId.c_str());
    Serial.printf("🔖 Razorpay Order: %s\n", razorpayOrderId.c_str());
    Serial.printf("💰 Payment ID: %s\n", razorpayPaymentId.c_str());
    Serial.printf("₹  Amount: ₹%.2f\n", amount);
    Serial.println("========================================\n");
    
    JsonArray products = doc["products"];
    if (!products.isNull()) {
        int totalItems = 0;
        Serial.println("📦 Products to dispense:");
        
        for (JsonObject item : products) {
            JsonObject product = item["product"];
            String productId = product["id"] | "";
            String productName = product["name"] | "Unknown";
            int quantity = item["quantity"] | 1;
            float price = item["price"] | 0.0;
            
            Serial.printf("   - %s x%d (₹%.2f each)\n", productName.c_str(), quantity, price);
            Serial.printf("   📋 Product ID: %s\n", productId.c_str());
            totalItems += quantity;
            
            // Dispense each quantity
            for (int i = 0; i < quantity; i++) {
                Serial.printf("\n🎰 Dispensing item %d/%d: %s\n", i + 1, quantity, productName.c_str());
                dispenseAsCoinSequence(productId);
                Serial.println("✅ Item dispensed successfully!");
                delay(500);
            }
        }
        
        Serial.println("\n========================================");
        Serial.printf("🎉 COMPLETED! Dispensed %d item(s)\n", totalItems);
        Serial.println("========================================\n");
    } else {
        Serial.println("📦 Dispensing single item (no product details)");
        dispenseAsCoinSequence("");
        Serial.println("✅ Dispensing completed!\n");
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
    
    Serial.println("🔍 Checking for payments...");
    String responseBody = "";
    int code = makeHTTPRequest(url, "GET", "", &responseBody);
    
    Serial.printf("📡 Payment API response code: %d\n", code);
    
    if (code == 200 && responseBody.length() > 0) {
        Serial.printf("📦 Response body (%d bytes): %s\n", responseBody.length(), responseBody.c_str());
        
        DynamicJsonDocument doc(2048);
        DeserializationError err = deserializeJson(doc, responseBody);
        if (!err) {
            // Check if there's a pending payment
            JsonObject data = doc["data"];
            if (!data.isNull()) {
                String status = data["status"] | "";
                Serial.printf("📊 Payment status: %s\n", status.c_str());
                
                if (status == "success") {
                    Serial.println("💳 Payment detected from server!");
                    handlePaymentDocument(data);
                } else {
                    Serial.println("ℹ️ No pending payments");
                }
            } else {
                Serial.println("⚠ No 'data' field in response");
            }
        } else {
            Serial.printf("⚠ JSON parse error: %s\n", err.c_str());
            Serial.printf("Raw response: %s\n", responseBody.c_str());
        }
    } else if (code < 0) {
        Serial.println("⚠ Payment check failed (network error)");
    } else {
        Serial.printf("⚠ Unexpected response code: %d\n", code);
    }
}

void sendCoinPayment(int coinAmount) {
    int amountPaisa = coinAmount * 100;
    
    // Try online payment first if network available
    if (isNetworkConnected() && machineId != "UNKNOWN" && defaultProductId.length() > 0) {
        String payload = "{";
        payload += "\"machine_id\":\"" + machineId + "\",";
        payload += "\"product_id\":\"" + defaultProductId + "\",";
        payload += "\"amount_in_paisa\":" + String(amountPaisa);
        payload += "}";

        String url = SERVER_BASE + "/api/coin-payment";
#ifdef USE_ETHERNET
        if (useEthernet && ethernetConnected) {
            url = ETHERNET_SERVER_BASE + "/api/coin-payment";
        }
#endif

        Serial.println("💰 Sending coin payment online...");
        String responseBody = "";
        int code = makeHTTPRequest(url, "POST", payload, &responseBody);
        
        if (code == 200) {
            Serial.println("✅ Coin payment recorded online");
            return;
        } else {
            Serial.printf("⚠ Online payment failed: %d, saving offline\n", code);
        }
    }
    
    // Save offline if network unavailable or online failed
    Serial.println("💾 Saving coin payment offline (will sync when connected)");
    saveOfflineTransaction(amountPaisa);
    Serial.printf("📊 Queued transactions: %d/%d\n", getQueuedTransactionCount(), QUEUE_MAX_SIZE);
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
    String httpUrl = "http://lyra-app.co.in/api/machine-ping";
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
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Lyra WiFi Setup</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1724;--card:#0b1220;--accent:#7c3aed;--muted:#9aa4b2;--white:#eef2ff}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;
-webkit-font-smoothing:antialiased;overflow-x:hidden}
body{background:linear-gradient(180deg,#071022,#07112a);color:var(--white);display:flex;flex-direction:column}
.container{width:100%;max-width:500px;margin:0 auto;padding:16px;flex:1;display:flex;flex-direction:column;min-height:100vh}
.header{display:flex;align-items:center;gap:12px;padding:16px 0;flex-shrink:0}
.logo{width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#06b6d4);
display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0}
.title{font-size:20px;font-weight:700;line-height:1.2}
.subtitle{font-size:12px;color:var(--muted);margin-top:2px}
.card{background:rgba(255,255,255,0.02);border-radius:12px;padding:16px;flex:1;display:flex;flex-direction:column;
overflow:hidden;border:1px solid rgba(255,255,255,0.05)}
.list-container{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;margin:0 -16px;padding:0 16px;
scrollbar-width:thin;scrollbar-color:rgba(124,58,237,0.5) transparent}
.list-container::-webkit-scrollbar{width:6px}
.list-container::-webkit-scrollbar-track{background:transparent}
.list-container::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.5);border-radius:3px}
.net{display:flex;justify-content:space-between;align-items:center;padding:14px 12px;border-radius:8px;
margin:6px 0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);
min-height:56px;transition:all 0.2s}
.net:active{background:rgba(255,255,255,0.06);transform:scale(0.98)}
.net-info{flex:1;min-width:0;margin-right:12px}
.net-ssid{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.net-rssi{font-size:12px;color:var(--muted);margin-top:2px}
.signal{display:inline-block;margin-right:4px}
.signal-excellent{color:#10b981}
.signal-good{color:#3b82f6}
.signal-fair{color:#f59e0b}
.signal-weak{color:#ef4444}
button{background:var(--accent);border:none;color:white;padding:10px 16px;border-radius:8px;
cursor:pointer;font-weight:600;font-size:14px;white-space:nowrap;flex-shrink:0;
transition:all 0.2s;-webkit-tap-highlight-color:transparent}
button:active{transform:scale(0.95);background:#6d28d9}
.loading{text-align:center;padding:32px;color:var(--muted);font-size:14px}
.empty{text-align:center;padding:32px;color:var(--muted)}
.empty-icon{font-size:48px;margin-bottom:12px;opacity:0.5}
@media(max-height:600px){.container{padding:12px}.header{padding:12px 0}.card{padding:12px}.net{padding:10px}}
</style>
<script>
function getSignalStrength(rssi){
if(rssi>=-50)return{class:'signal-excellent',bars:'▂▄▆█',label:'Excellent'};
if(rssi>=-60)return{class:'signal-good',bars:'▂▄▆',label:'Good'};
if(rssi>=-70)return{class:'signal-fair',bars:'▂▄',label:'Fair'};
return{class:'signal-weak',bars:'▂',label:'Weak'};}
async function scan(){
const list=document.getElementById('list');
list.innerHTML='<div class="loading">🔍 Scanning for networks...</div>';
try{
const r=await fetch('/api/scan');
const d=await r.json();
if(d.length===0){
list.innerHTML='<div class="empty"><div class="empty-icon">📡</div>No networks found<br><small>Pull down to refresh</small></div>';
return;}
d.sort((a,b)=>b.rssi-a.rssi);
let h='';
d.forEach(n=>{
const sig=getSignalStrength(n.rssi);
h+=`<div class="net" onclick="connect('${n.ssid.replace(/'/g,"\\'")}')">
<div class="net-info">
<div class="net-ssid">${n.ssid}</div>
<div class="net-rssi">
<span class="signal ${sig.class}">${sig.bars}</span>
${n.rssi}dBm · ${sig.label}
</div></div>
<button onclick="event.stopPropagation();connect('${n.ssid.replace(/'/g,"\\'")}')">Connect</button>
</div>`});
list.innerHTML=h;
}catch(e){
list.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div>Scan failed<br><small>'+e.message+'</small></div>';}}
async function connect(s){
const p=prompt('Password for '+s+':');
if(!p&&p!=='')return;
try{
await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({ssid:s,password:p})});
alert('✅ Connecting to '+s+'...\n\nDevice will restart.');
}catch(e){alert('❌ Connection failed: '+e.message);}}
let touchStart=0;
document.addEventListener('touchstart',e=>{touchStart=e.touches[0].clientY});
document.addEventListener('touchmove',e=>{
const list=document.querySelector('.list-container');
if(list&&list.scrollTop===0&&e.touches[0].clientY>touchStart+50){
e.preventDefault();scan();}});
window.onload=scan;
</script>
</head><body><div class="container"><div class="header"><div class="logo">L</div>
<div><div class="title">Lyra WiFi Setup</div><div class="subtitle">Select a network to connect</div></div></div>
<div class="card"><div class="list-container" id="list"></div></div></div></body></html>
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
    sendStockAwareErrorStatus();  // Show "No Internet" on display
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
    Serial.println("✨ Offline Mode Enabled - Works without internet!");
    
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
        fetchMachineProducts();  // Get product_id for coin payments
        feedWatchdog();
        sendMachineStatusPing();
        lastPingTime = millis();
        sendStockAwareStatus();  // Show QR code on display
        return;
    }
    Serial.println("⚠️ Ethernet not available, falling back to WiFi");
    sendStockAwareErrorStatus();  // Show "No Internet" on display
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
            fetchMachineProducts();  // Get product_id for coin payments
            
            // Sync offline transactions on startup
            delay(2000);  // Give server time to be ready
            syncOfflineTransactions();
            
            ArduinoOTA.setHostname(("Lyra-" + machineName).c_str());
            ArduinoOTA.setPassword("lyra2024");
            ArduinoOTA.begin();
            
            sendMachineStatusPing();
            lastPingTime = millis();
            sendStockAwareStatus();
        } else {
            Serial.println("❌ WiFi connection failed");
            sendStockAwareErrorStatus();  // Show "No Internet" on display
            startProvisioning();
        }
    } else {
        Serial.println("❌ No WiFi credentials saved");
        sendStockAwareErrorStatus();  // Show "No Internet" on display
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
                fetchMachineProducts();  // Get product_id for coin payments
                sendMachineStatusPing();
            }
        } else if (command == "switch") {
            if (SERVER_BASE.startsWith("https://")) {
                SERVER_BASE = "http://lyra-app.co.in";
                Serial.println("🔄 Switched to HTTP mode");
            } else {
                SERVER_BASE = "https://lyra-app.co.in";
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
            int queueCount = getQueuedTransactionCount();
            Serial.printf("Offline Queue: %d/%d transactions\n", queueCount, QUEUE_MAX_SIZE);
            printMemoryStatus("Status");
            Serial.println("=====================\n");
        } else if (command == "sync") {
            Serial.println("🔄 Manually syncing offline transactions...");
            syncOfflineTransactions();
        } else if (command == "dispense") {
            Serial.println("🎰 Manual dispense triggered");
            dispenseProductByMotor();
#ifdef USE_ETHERNET
        } else if (command == "diag") {
            printEthernetDiagnostics();
        } else if (command == "scan-eth") {
            scanEthernetPins();
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
            Serial.println("sync       - Sync offline transactions");
#ifdef USE_ETHERNET
            Serial.println("diag       - Ethernet diagnostics");
            Serial.println("scan-eth   - Scan for Ethernet CS pin");
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
        saveMotorStockToEEPROM(30, defaultProductId);
        Serial2.print("8");
        delay(1000);
        sendStockAwareStatus();
        sendMachineStatusPing();  // Sync new stock to database
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
    
    // Payment polling every 4 seconds
    static unsigned long lastPaymentCheck = 0;
    if (millis() - lastPaymentCheck > 4000) {
        if (isNetworkConnected()) {
            Serial.println("\n⏰ [Payment Poll Timer] Checking for payments...");
            listenForOnlinePayment();
        } else {
            Serial.println("⚠ [Payment Poll Timer] Network not connected, skipping payment check");
        }
        lastPaymentCheck = millis();
    }
    
    // Status ping every 2 minutes
    if (millis() - lastPingTime > 120000) {
        if (isNetworkConnected()) {
            Serial.println("\n⏰ [Ping Timer] Sending machine status ping...");
            sendMachineStatusPing();
        } else {
            Serial.println("⚠ [Ping Timer] Network not connected, skipping ping");
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
            if (isNetworkConnected()) sendCoinPayment(5);
        } else {
            Serial2.print("4");
            digitalWrite(BLUE_LED_PIN, LOW);
            delay(100);
            digitalWrite(BLUE_LED_PIN, HIGH);
            delay(2900);
            
            // Dispense and sync stock (uses defaultProductId)
            dispenseProductByMotor(defaultProductId);
            
            // Record coin payment in database
            if (isNetworkConnected()) sendCoinPayment(5);
            
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
    unsigned long startTime = millis();
    Serial.println("🔌 Initializing Ethernet...");
    
    // Print pin configuration
    Serial.printf("📌 Ethernet Pins - CS:%d, MOSI:%d, MISO:%d, SCK:%d\n", 
                 ETHERNET_CS, SPI_MOSI, SPI_MISO, SPI_SCK);
    
    // CRITICAL: Reset module completely first
    pinMode(ETHERNET_CS, OUTPUT);
    digitalWrite(ETHERNET_CS, LOW);
    delay(10);
    digitalWrite(ETHERNET_CS, HIGH);
    delay(500);  // Give module time to reset completely
    
    // End any existing SPI session to clear buffers
    SPI.end();
    delay(100);
    
    // Initialize SPI with explicit pins and CLEAN state
    Serial.println("🔧 Initializing SPI bus...");
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, ETHERNET_CS);
    SPI.setBitOrder(MSBFIRST);
    SPI.setDataMode(SPI_MODE0);
    SPI.setFrequency(4000000);  // Reduce to 4MHz for more reliable communication
    delay(200);
    
    // Initialize Ethernet controller with clean buffers
    Serial.println("🔧 Initializing Ethernet controller...");
    Ethernet.init(ETHERNET_CS);
    delay(200);
    
    // Hardware detection (informational only)
    Serial.print("🔍 Detecting Ethernet hardware... ");
    uint8_t hwStatus = Ethernet.hardwareStatus();
    
    if (hwStatus == EthernetNoHardware) {
        Serial.println("❌ No hardware detected");
        Serial.println("   Check wiring and power (3.3V)");
        return false;
    } else {
        switch (hwStatus) {
            case EthernetW5100:
                Serial.println("✅ ENC28J60 Detected");
                break;
            case EthernetW5200:
                Serial.println("✅ W5200 Detected");
                break;
            case EthernetW5500:
                Serial.println("✅ W5500 Detected");
                break;
            default:
                Serial.printf("⚠️ Unknown chip (status: %d) - Continuing anyway\n", hwStatus);
                break;
        }
    }
    
    // CRITICAL: Clear any stale data in buffers before DHCP
    // Reset the ENC28J60 chip completely
    Serial.println("🧹 Clearing buffers and resetting chip...");
    digitalWrite(ETHERNET_CS, LOW);
    delay(50);
    digitalWrite(ETHERNET_CS, HIGH);
    delay(200);
    
    // Reinitialize after reset
    Ethernet.init(ETHERNET_CS);
    delay(200);
    
    // Check for physical link before attempting DHCP
    Serial.println("🔍 Checking for Ethernet cable...");
    EthernetLinkStatus linkStatus = Ethernet.linkStatus();
    
    if (linkStatus == LinkOFF) {
        Serial.println("❌ No Ethernet cable detected - skipping DHCP");
        Serial.println("📶 Will use WiFi fallback");
        return false;
    }
    
    Serial.println("✅ Ethernet cable connected");
    
    // Start DHCP with LONGER timeouts and CLEAN state
    Serial.println("🌐 Requesting DHCP with extended timeout...");
    
    // Try DHCP with longer timeouts (reduced to 2 attempts to prevent watchdog reset)
    for (int attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            Serial.printf("   Retry attempt %d/2...\n", attempt + 1);
            
            // Full reset between attempts
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
        
        // Start DHCP - UIPEthernet doesn't support timeout params, just MAC
        Ethernet.begin(ethernetMAC);
        
        // Poll for DHCP response with timeout (max 5 seconds)
        unsigned long dhcpStart = millis();
        IPAddress checkIP;
        bool gotIP = false;
        
        while (millis() - dhcpStart < 5000) {
            yield();  // Feed the watchdog
            checkIP = Ethernet.localIP();
            if (checkIP != IPAddress(0,0,0,0) && checkIP[0] != 0) {
                gotIP = true;
                break;
            }
            delay(100);  // Check every 100ms (also feeds watchdog)
        }
        
        if (gotIP) {
            // DHCP succeeded, now validate the IP
            delay(500);  // Let it settle
            IPAddress ip = Ethernet.localIP();
            IPAddress gateway = Ethernet.gatewayIP();
            IPAddress dns = Ethernet.dnsServerIP();
            
            Serial.println("✅ DHCP Response Received!");
            Serial.printf("   IP: %s\n", ip.toString().c_str());
            Serial.printf("   Gateway: %s\n", gateway.toString().c_str());
            Serial.printf("   DNS: %s\n", dns.toString().c_str());
            
            // Validate IP is in private network range
            bool validIP = false;
            if (ip[0] == 10) {
                validIP = true;  // 10.0.0.0/8
            } else if (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) {
                validIP = true;  // 172.16.0.0/12
            } else if (ip[0] == 192 && ip[1] == 168) {
                validIP = true;  // 192.168.0.0/16
            }
            
            if (validIP && ip != IPAddress(0,0,0,0)) {
                Serial.println("✅ IP validated - Ethernet ready!");
                Serial.println("🔧 Subnet: " + Ethernet.subnetMask().toString());
                
                ethernetConnected = true;
                useEthernet = true;
                digitalWrite(BLUE_LED_PIN, HIGH);
                
                Serial.printf("   ⏱️ Total time: %lu ms\n", millis() - startTime);
                return true;
            } else {
                Serial.printf("❌ Invalid IP received: %s\n", ip.toString().c_str());
                Serial.println("   This is corrupted data from DHCP bug");
            }
        }
        
        delay(1000);  // Wait between attempts
    }
    
    Serial.println("❌ DHCP failed after 3 attempts");
    Serial.printf("   ⏱️ Total time: %lu ms\n", millis() - startTime);
    Serial.println("   💡 Falling back to WiFi...");
    
    return false;
    
    // Check link status (reuse variable from earlier)
    Serial.print("🔗 Link Status: ");
    switch (Ethernet.linkStatus()) {
        case Unknown:
            Serial.println("Unknown (module may not support link detection)");
            break;
        case LinkON:
            Serial.println("✅ Cable Connected (but DHCP failed)");
            Serial.println("   Try: Check router/switch DHCP settings");
            break;
        case LinkOFF:
            Serial.println("❌ No Cable Detected");
            Serial.println("   Fix: Connect Ethernet cable");
            break;
        default:
            Serial.printf("Other (status: %d)\n", Ethernet.linkStatus());
            break;
    }
    
    return false;
}

void checkEthernetLinkStatus() {
    if (!useEthernet) {
        // Skip hotplug detection - UIPEthernet doesn't support linkStatus()
        return;
    }
    
    static unsigned long lastCheck = 0;
    
    if (millis() - lastCheck > 5000) {  // Check every 5 seconds
        // Maintain DHCP lease (harmless for static IP)
        Ethernet.maintain();
        
        IPAddress ip = Ethernet.localIP();
        
        // Check if we lost IP address (only reliable check for ENC28J60)
        if (ip == IPAddress(0,0,0,0) || ip[0] == 0) {
            Serial.println("⚠️ Ethernet lost IP address!");
            Serial.println("   🔄 Switching to WiFi...");
            ethernetConnected = false;
            useEthernet = false;
            sendStockAwareErrorStatus();
        }
        
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

void scanEthernetPins() {
    Serial.println("\n🔍 === ETHERNET PIN SCANNER ===");
    Serial.println("Testing common CS pin configurations...\n");
    
    int testPins[] = {5, 15, 22, 33, 4, 16, 17};
    int numPins = sizeof(testPins) / sizeof(testPins[0]);
    
    for (int i = 0; i < numPins; i++) {
        int csPin = testPins[i];
        Serial.printf("📌 Testing CS pin %d... ", csPin);
        
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
            Serial.println("✅ FOUND!");
            Serial.printf("   Hardware: ");
            switch (hwStatus) {
                case EthernetW5100: Serial.println("ENC28J60/W5100"); break;
                case EthernetW5200: Serial.println("W5200"); break;
                case EthernetW5500: Serial.println("W5500"); break;
                default: Serial.printf("Unknown (%d)\n", hwStatus); break;
            }
            Serial.printf("   ⚠️ UPDATE FIRMWARE: #define ETHERNET_CS %d\n", csPin);
        } else {
            Serial.println("❌ No hardware");
        }
        
        SPI.end();
        delay(100);
    }
    
    Serial.println("\n=================================");
    Serial.println("Current configuration:");
    Serial.printf("  CS=%d, SCK=%d, MISO=%d, MOSI=%d\n", 
                 ETHERNET_CS, SPI_SCK, SPI_MISO, SPI_MOSI);
    Serial.println("=================================\n");
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
