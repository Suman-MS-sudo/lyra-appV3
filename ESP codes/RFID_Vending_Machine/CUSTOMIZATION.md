# Advanced Configuration & Customization Guide

## 🎨 Web Interface Customization

### Changing Colors & Theme

#### Primary Color (Purple to Blue)
In `handleRoot()` function, find and modify CSS:
```cpp
// Change from purple gradient
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

// To blue gradient
background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

// Other gradient options:
// Green: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
// Orange: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
// Red: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

#### Button Colors
```cpp
.btn-primary {
    background: #667eea;  // Change hex color here
    color: white;
}
```

#### Custom Logo
Replace the emoji in header:
```html
<h1>🏪 Lyra Vending Machine</h1>
<!-- Change to: -->
<h1>Your Company Name</h1>
```

### Adding Company Branding

#### Modify Page Title
```html
<title>Lyra Vending Machine - Dashboard</title>
<!-- Change to: -->
<title>Your Company - Vending Dashboard</title>
```

#### Custom Footer
Add before `</body>` in HTML:
```html
<div style="text-align:center; padding:20px; color:white;">
    <p>&copy; 2026 Your Company Name. All rights reserved.</p>
    <p>Support: support@yourcompany.com</p>
</div>
```

---

## 🔧 Functionality Modifications

### Change Daily Vend Limit

#### Per-User Limit
Modify at top of .ino file:
```cpp
#define DAILY_VEND_LIMIT 10  // Change number here
```

#### Different Limits for Different Tags
Add to RFIDTag structure:
```cpp
struct RFIDTag {
    char uid[32];
    int dailyCount;
    unsigned long lastResetDay;
    bool isActive;
    int customLimit;  // Add this line
};
```

Then modify check in `handleRFIDScan()`:
```cpp
// Instead of:
if (authorizedTags[tagIndex].dailyCount >= DAILY_VEND_LIMIT) {

// Use:
int limit = (authorizedTags[tagIndex].customLimit > 0) 
    ? authorizedTags[tagIndex].customLimit 
    : DAILY_VEND_LIMIT;
if (authorizedTags[tagIndex].dailyCount >= limit) {
```

### Adjust Motor Run Times

#### Same Time for Both Motors
In `vendItem()` function:
```cpp
delay(2850); // Milliseconds
```

#### Different Times per Motor
Replace single delay with:
```cpp
int motorDelay = (motor == 1) ? 2850 : 3500;  // M1=2.85s, M2=3.5s
digitalWrite(relayPin, HIGH);
delay(motorDelay);
digitalWrite(relayPin, LOW);
```

### Add More Motors (3+ Motors)

#### Hardware Changes
1. Add more relay pins
2. Add more selection buttons

#### Code Changes
```cpp
// Add pin definitions
#define RELAY3_PIN D7
#define RELAY4_PIN D0

// Modify showMotorSelection() to include more options
void showMotorSelection(String uid, int tagIndex) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Select Motor:");
    lcd.setCursor(0, 1);
    lcd.print("1/2/3/4: Btns");
    
    unsigned long startTime = millis();
    while (millis() - startTime < 5000) {
        if (digitalRead(D5) == LOW) { vendItem(1, uid, tagIndex); return; }
        if (digitalRead(D6) == LOW) { vendItem(2, uid, tagIndex); return; }
        if (digitalRead(D7) == LOW) { vendItem(3, uid, tagIndex); return; }
        if (digitalRead(D0) == LOW) { vendItem(4, uid, tagIndex); return; }
        delay(50);
    }
}

// Add stock variables
int stock3 = MAX_STOCK;
int stock4 = MAX_STOCK;

// Update vendItem() to handle motors 3 & 4
```

### Price Per Vend (Future: Payment Integration)

#### Add Price Tracking
```cpp
struct Transaction {
    char uid[32];
    int motor;
    unsigned long timestamp;
    float price;  // Add this
};

// In vendItem():
float price = (motor == 1) ? 1.50 : 2.00;  // Motor 1 = $1.50, Motor 2 = $2.00
```

---

## 📊 Enhanced Logging

### Add More Data Fields

#### Track User Names
```cpp
struct RFIDTag {
    char uid[32];
    char userName[32];  // Add this
    int dailyCount;
    unsigned long lastResetDay;
    bool isActive;
};
```

Update web interface to input names:
```html
<input type="text" id="newTagName" placeholder="User Name">
```

#### Log More Events
Create separate log files:
```cpp
const char* ERROR_LOG = "/errors.txt";
const char* ACCESS_LOG = "/access.txt";

void logError(String message) {
    File errorFile = SD.open(ERROR_LOG, FILE_WRITE);
    if (errorFile) {
        errorFile.print(getFormattedDateTime());
        errorFile.print(",");
        errorFile.println(message);
        errorFile.close();
    }
}
```

### Add Timestamps (RTC Module)

#### With DS3231 RTC
Add library:
```cpp
#include <RTClib.h>
RTC_DS3231 rtc;
```

In setup():
```cpp
if (!rtc.begin()) {
    lcd.print("RTC Failed!");
}
```

Replace `getFormattedDateTime()`:
```cpp
String getFormattedDateTime() {
    DateTime now = rtc.now();
    char buf[32];
    sprintf(buf, "%04d-%02d-%02d %02d:%02d:%02d",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second());
    return String(buf);
}
```

---

## 🔐 Security Enhancements

### Add Web Authentication

#### Basic HTTP Authentication
```cpp
// Add at top
const char* www_username = "admin";
const char* www_password = "secure123";

// In setupWebServer()
server.on("/", HTTP_GET, []() {
    if (!server.authenticate(www_username, www_password)) {
        return server.requestAuthentication();
    }
    handleRoot();
});
```

### Encrypted RFID UIDs

#### Hash UIDs Before Storage
```cpp
#include <Hash.h>

String hashUID(String uid) {
    return sha1(uid);  // Returns 40-char hash
}

// Modify storage to save hashed version
```

### API Key Protection

#### Require API Key for Actions
```cpp
const char* API_KEY = "your-secret-key-here";

void handleAddTag() {
    if (server.arg("api_key") != API_KEY) {
        server.send(401, "text/plain", "Unauthorized");
        return;
    }
    // ... rest of function
}
```

---

## 📱 Advanced Features

### SMS Notifications

#### With GSM Module (SIM800L)
```cpp
#include <SoftwareSerial.h>
SoftwareSerial gsmSerial(D9, D10);  // RX, TX

void sendSMS(String message) {
    gsmSerial.println("AT+CMGF=1");
    delay(100);
    gsmSerial.println("AT+CMGS=\"+1234567890\"");
    delay(100);
    gsmSerial.println(message);
    delay(100);
    gsmSerial.write(26);  // Ctrl+Z
}

// Call when stock low:
if (stock1 < 5) {
    sendSMS("Warning: Motor 1 stock low (" + String(stock1) + ")");
}
```

### Email Notifications

#### With ESP8266 SMTP Client
```cpp
#include <ESP_Mail_Client.h>

void sendEmail(String subject, String body) {
    SMTPSession smtp;
    ESP_Mail_Session session;
    session.server.host_name = "smtp.gmail.com";
    session.server.port = 465;
    session.login.email = "your@email.com";
    session.login.password = "yourpassword";
    
    SMTP_Message message;
    message.sender.name = "Vending Machine";
    message.sender.email = "your@email.com";
    message.subject = subject;
    message.addRecipient("admin", "admin@email.com");
    message.text.content = body;
    
    if (!smtp.connect(&session)) return;
    if (!MailClient.sendMail(&smtp, &message)) return;
}
```

### Remote Access via Internet

#### Using ESP8266 Port Forwarding
1. Get your router's public IP
2. Forward port 80 to ESP8266 IP (192.168.4.1)
3. Access via: http://YOUR_PUBLIC_IP

⚠️ **Security Risk**: Use HTTPS and authentication!

#### Using DDNS Service
Sign up for free DDNS (e.g., No-IP, DynDNS):
```cpp
// In setup(), after WiFi connection:
WiFiClient client;
if (client.connect("dynupdate.no-ip.com", 80)) {
    client.println("GET /nic/update?hostname=yourdomain.ddns.net HTTP/1.0");
    client.println("Host: dynupdate.no-ip.com");
    client.println("Authorization: Basic YOUR_BASE64_CREDENTIALS");
    client.println();
}
```

### Cloud Logging

#### Send to Google Sheets
```cpp
#include <HTTPSRedirect.h>

void sendToGoogleSheets(String uid, int motor) {
    HTTPSRedirect* client = new HTTPSRedirect(443);
    client->connect("script.google.com", 443);
    
    String url = "/macros/s/YOUR_SCRIPT_ID/exec?";
    url += "uid=" + uid;
    url += "&motor=" + String(motor);
    url += "&timestamp=" + String(millis());
    
    client->GET(url, "script.google.com");
    delete client;
}
```

---

## 🎮 User Interface Enhancements

### Add Keypad Input

#### 4x4 Keypad for PIN Entry
```cpp
#include <Keypad.h>

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
    {'1','2','3','A'},
    {'4','5','6','B'},
    {'7','8','9','C'},
    {'*','0','#','D'}
};
byte rowPins[ROWS] = {D9, D10, D11, D12};
byte colPins[COLS] = {D13, D14, D15, D16};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String getPIN() {
    String pin = "";
    lcd.clear();
    lcd.print("Enter PIN:");
    
    while (pin.length() < 4) {
        char key = keypad.getKey();
        if (key) {
            pin += key;
            lcd.setCursor(pin.length() - 1, 1);
            lcd.print("*");
        }
    }
    return pin;
}
```

### Add OLED Display

#### Replace LCD with OLED
```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void showIdleMessage() {
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(WHITE);
    display.setCursor(0, 0);
    display.println("Lyra");
    display.println("Vending");
    display.setTextSize(1);
    display.print("M1:");
    display.print(stock1);
    display.print(" M2:");
    display.println(stock2);
    display.display();
}
```

### Voice Feedback

#### With DFPlayer Mini
```cpp
#include <DFRobotDFPlayerMini.h>
SoftwareSerial dfSerial(D9, D10);
DFRobotDFPlayerMini dfPlayer;

void setup() {
    dfSerial.begin(9600);
    dfPlayer.begin(dfSerial);
    dfPlayer.volume(20);
}

void playSound(int track) {
    dfPlayer.play(track);  // Play MP3 file number
}

// In vendItem(), add:
playSound(1);  // "Thank you"
playSound(2);  // "Please collect your item"
```

---

## 📈 Analytics & Reporting

### Generate Reports Automatically

#### Daily Summary Email
```cpp
void sendDailySummary() {
    int todayVends = countTodayTransactions();
    int totalRevenue = todayVends * 2;  // $2 per vend
    
    String report = "Daily Summary\n";
    report += "Total Vends: " + String(todayVends) + "\n";
    report += "Revenue: $" + String(totalRevenue) + "\n";
    report += "Stock M1: " + String(stock1) + "\n";
    report += "Stock M2: " + String(stock2) + "\n";
    
    sendEmail("Daily Vending Report", report);
}

// Call in loop() when it's midnight
if (hour() == 0 && minute() == 0) {
    sendDailySummary();
    delay(60000);  // Wait 1 minute to avoid re-sending
}
```

### Export to Excel-Ready Format

#### Enhanced CSV with Headers
```cpp
void logTransaction(String uid, int motor) {
    File logFile = SD.open(LOG_FILE, FILE_WRITE);
    if (logFile) {
        // Add more columns
        logFile.print(uid);
        logFile.print(",");
        logFile.print(getUserName(uid));  // New
        logFile.print(",");
        logFile.print(motor);
        logFile.print(",");
        logFile.print(millis() / 1000);
        logFile.print(",");
        logFile.print(getFormattedDateTime());
        logFile.print(",");
        logFile.print(getDayOfWeek());  // New
        logFile.print(",");
        logFile.println(getPrice(motor));  // New
        logFile.close();
    }
}
```

---

## 🔄 System Optimization

### Reduce Power Consumption

#### Sleep Mode for ESP8266
```cpp
#include <ESP8266WiFi.h>

void enterSleepMode() {
    WiFi.disconnect();
    WiFi.mode(WIFI_OFF);
    delay(1);
    
    // Wake on button press
    ESP.deepSleep(0);  // Sleep until RST is connected to D0
}

// Call during idle periods
if (millis() - lastActivity > 300000) {  // 5 minutes idle
    enterSleepMode();
}
```

### Improve Response Time

#### Cache Tag Data in RAM
```cpp
// Pre-load frequently used tags into faster lookup
RFIDTag* frequentTags[10];
int frequentCount = 0;

void updateFrequentTags() {
    // Sort by usage count
    // Store top 10 in frequentTags array
}
```

### Optimize SD Card Writes

#### Buffer Writes
```cpp
#define LOG_BUFFER_SIZE 10
Transaction logBuffer[LOG_BUFFER_SIZE];
int bufferIndex = 0;

void bufferTransaction(String uid, int motor) {
    logBuffer[bufferIndex].uid = uid;
    logBuffer[bufferIndex].motor = motor;
    logBuffer[bufferIndex].timestamp = millis();
    bufferIndex++;
    
    if (bufferIndex >= LOG_BUFFER_SIZE) {
        flushLogBuffer();
    }
}

void flushLogBuffer() {
    File logFile = SD.open(LOG_FILE, FILE_WRITE);
    for (int i = 0; i < bufferIndex; i++) {
        // Write all buffered transactions
    }
    logFile.close();
    bufferIndex = 0;
}
```

---

## 🧪 Testing & Debugging

### Enable Debug Mode

#### Serial Debug Output
```cpp
#define DEBUG_MODE true

#define DEBUG_PRINT(x) if(DEBUG_MODE) Serial.print(x)
#define DEBUG_PRINTLN(x) if(DEBUG_MODE) Serial.println(x)

// Usage:
DEBUG_PRINTLN("RFID Detected: " + uid);
DEBUG_PRINT("Stock remaining: ");
DEBUG_PRINTLN(stock1);
```

### Simulate RFID Scans

#### Via Serial Commands
```cpp
void loop() {
    // ... existing code
    
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        if (cmd.startsWith("SCAN:")) {
            String testUID = cmd.substring(5);
            handleRFIDScan(testUID);
        }
    }
}

// Test by sending: SCAN:A1B2C3D4
```

### Performance Monitoring

#### Track Execution Times
```cpp
unsigned long startTime = micros();
// ... code to measure
unsigned long endTime = micros();
Serial.println("Execution time: " + String(endTime - startTime) + " µs");
```

---

## 📦 Backup & Recovery

### Automatic Backup to Second SD Card

```cpp
#define SD2_CS_PIN D10  // Second SD card

void backupToSecondSD() {
    if (!SD.begin(SD2_CS_PIN)) return;
    
    // Copy vendlog.csv
    File source = SD.open(LOG_FILE, FILE_READ);
    File dest = SD.open("/backup_vendlog.csv", FILE_WRITE);
    
    while (source.available()) {
        dest.write(source.read());
    }
    
    source.close();
    dest.close();
}

// Call daily
if (hour() == 2 && minute() == 0) {  // 2 AM backup
    backupToSecondSD();
}
```

---

## 🎓 Learning Resources

### Understanding the Code

#### Key Functions
- `setup()` - Initialization
- `loop()` - Main program loop
- `handleRFIDScan()` - RFID card processing
- `vendItem()` - Dispense logic
- `setupWebServer()` - Web routes
- `handleRoot()` - Main dashboard

#### Libraries Used
- **MFRC522** - RFID communication
- **LiquidCrystal_I2C** - LCD control
- **ESP8266WiFi** - WiFi functionality
- **ESP8266WebServer** - HTTP server
- **SD** - SD card file operations

### Further Customization Ideas
1. Add temperature/humidity sensors
2. Implement coin acceptor
3. Add barcode scanner
4. Create mobile app
5. Multiple language support
6. Receipt printer
7. LED status indicators
8. Buzzer for audio feedback
9. Camera for security
10. Bitcoin/crypto payment

---

**Happy Customizing!** 🚀

For questions, refer to the main README.md or open an issue on GitHub.
