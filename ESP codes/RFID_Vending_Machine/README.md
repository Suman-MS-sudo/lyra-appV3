# RFID-Based Vending Machine System

## Overview
Complete RFID-based vending machine with web interface, transaction logging, and daily limits per RFID tag.

## Features
- ✅ RFID tag authentication (unlimited tags supported)
- ✅ Daily vending limit (10 per tag per day)
- ✅ Complete transaction logging on SD card
- ✅ Web dashboard at http://192.168.4.1
- ✅ Real-time stock monitoring
- ✅ Download logs as CSV file
- ✅ Add/Remove/Toggle RFID tags via web interface
- ✅ LCD display for user feedback
- ✅ Automatic daily counter reset

## Hardware Requirements

### Components
1. **ESP8266 NodeMCU** (or ESP32)
2. **MFRC522 RFID Reader Module**
3. **SD Card Module** (SPI)
4. **16x2 I2C LCD Display** (0x27 address)
5. **2x Relay Modules** (for motors)
6. **2x DC Motors** (vending mechanism)
7. **Push Buttons** (3x - for motor selection and reset)
8. **12V Power Supply** (for motors)
9. **5V Power Supply** (for ESP8266)
10. **RFID Cards/Tags** (13.56MHz)

### Wiring Diagram

#### MFRC522 RFID Module → ESP8266
```
MFRC522 Pin  →  NodeMCU Pin
SDA (SS)     →  D4
SCK          →  D5 (GPIO14)
MOSI         →  D7 (GPIO13)
MISO         →  D6 (GPIO12)
IRQ          →  Not connected
GND          →  GND
RST          →  D3
3.3V         →  3.3V
```

#### SD Card Module → ESP8266
```
SD Card Pin  →  NodeMCU Pin
CS           →  D8
SCK          →  D5 (GPIO14) - shared with RFID
MOSI         →  D7 (GPIO13) - shared with RFID
MISO         →  D6 (GPIO12) - shared with RFID
VCC          →  5V or 3.3V (check your module)
GND          →  GND
```

#### LCD (I2C) → ESP8266
```
LCD Pin      →  NodeMCU Pin
SDA          →  D2 (GPIO4)
SCL          →  D1 (GPIO5)
VCC          →  5V
GND          →  GND
```

#### Relays & Buttons → ESP8266
```
Component    →  NodeMCU Pin
Relay 1      →  D1 (GPIO5)
Relay 2      →  D2 (GPIO4)
Reset Button →  D0 (GPIO16)
Select Btn 1 →  D5 (GPIO14)
Select Btn 2 →  D6 (GPIO12)
```

**Note:** Connect button pins with pull-up configuration (one side to pin, other to GND).

#### Relay → Motors
```
- Connect motor power supply (12V) through relay contacts
- Relay COM → 12V+
- Relay NO → Motor positive
- Motor negative → 12V GND
- Ensure common ground between ESP8266 and motor power supply
```

## Software Requirements

### Arduino IDE Setup
1. Install **Arduino IDE** (1.8.x or 2.x)
2. Add ESP8266 Board Manager URL:
   - File → Preferences → Additional Board Manager URLs
   - Add: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
3. Install ESP8266 board:
   - Tools → Board → Boards Manager
   - Search "ESP8266" and install

### Required Libraries
Install these via Arduino Library Manager (Sketch → Include Library → Manage Libraries):

1. **MFRC522** by GithubCommunity (v1.4.10 or later)
2. **LiquidCrystal I2C** by Frank de Brabander
3. **ESP8266WiFi** (included with ESP8266 board)
4. **ESP8266WebServer** (included with ESP8266 board)
5. **SD** (built-in Arduino library)

### Board Settings
```
Tools → Board: "NodeMCU 1.0 (ESP-12E Module)"
Tools → Flash Size: "4MB (FS:2MB OTA:~1019KB)"
Tools → Upload Speed: "115200"
Tools → CPU Frequency: "80 MHz"
```

## Installation Steps

### 1. Hardware Assembly
- Connect all components according to the wiring diagram
- Ensure proper power supply connections
- Test individual components before final assembly

### 2. Upload Code
- Open `RFID_Vending_Machine.ino` in Arduino IDE
- Select correct board and port
- Click Upload button
- Wait for compilation and upload to complete

### 3. Format SD Card
- Format SD card as **FAT32**
- Insert into SD card module
- System will auto-create necessary files on first boot

### 4. Initial Setup
- Power on the system
- LCD will show initialization messages
- Wait for "Lyra Enterprises" idle screen

## Web Dashboard Access

### Connecting to WiFi
1. The system creates a WiFi Access Point:
   - **SSID:** `Lyra-Vending-AP`
   - **Password:** `lyra12345`

2. Connect your phone/laptop to this network

3. Open browser and navigate to:
   - **URL:** `http://192.168.4.1`

### Dashboard Features

#### 📊 Statistics Display
- Motor 1 & 2 stock levels
- Total transactions count
- Active RFID tags count

#### 🏷️ RFID Tag Management
- **Add Tag:** Click "Add New RFID Tag" and enter UID
- **Delete Tag:** Remove unwanted tags
- **Toggle Tag:** Enable/disable tags without deleting
- **View Status:** See daily usage count per tag

#### 📝 Transaction Logs
- View all transactions in real-time
- Shows: UID, Motor number, Timestamp
- Auto-refreshes every 10 seconds

#### 💾 Download Logs
- Click "Download Logs (CSV)"
- Opens/downloads `vending_logs.csv`
- Import into Excel or analysis tools

#### ⚙️ System Actions
- Reset stock levels remotely
- Refresh all data manually

## Usage Instructions

### For End Users (Vending)

1. **Scan RFID Card**
   - Place card near RFID reader
   - LCD shows "Card Detected" with UID
   
2. **Authorization Check**
   - System verifies if card is authorized
   - Checks daily limit (10 vends/day)
   
3. **Select Motor**
   - LCD displays "Select Motor: 1:Btn3 2:Btn4"
   - Press button D5 for Motor 1
   - Press button D6 for Motor 2
   - 5 second timeout if no selection
   
4. **Vending**
   - Motor runs for ~2.85 seconds
   - LCD shows "Please Collect The Napkin"
   - Shows remaining daily count
   
5. **Error Messages**
   - "Unauthorized Card" - Card not in system
   - "Daily Limit Reached" - 10 vends already used
   - "Motor X Empty" - Need to refill stock

### For Administrators

#### Adding New RFID Tags
**Method 1: Via Web Dashboard**
1. Connect to WiFi AP
2. Open http://192.168.4.1
3. Click "Add New RFID Tag"
4. Enter UID in HEX format (e.g., A1B2C3D4)
5. Click Add

**Method 2: Scan First**
1. Scan unknown RFID card
2. Note the UID shown on LCD
3. Add it via web dashboard using that UID

#### Refilling Stock
**Physical Button:**
- Press and hold Reset button (D0)
- Both stocks set to 30
- LCD confirms "Stock Refilled"

**Web Dashboard:**
- Click "Reset Both Stocks to 30"
- Instant update

#### Viewing Logs
1. Open web dashboard
2. Scroll to "Recent Transactions"
3. View real-time transaction data
4. Download CSV for detailed analysis

#### Managing Tags
- **Enable/Disable:** Toggle tags without deleting
- **Delete:** Permanently remove tags
- **Monitor Usage:** Check daily vend counts

## File Structure on SD Card

The system creates these files automatically:

```
/vendlog.csv     - Transaction log (UID, Motor, Timestamp, DateTime)
/tags.txt        - Authorized RFID tags database
/config.txt      - System configuration (stock levels)
```

### Log File Format (vendlog.csv)
```csv
UID,Motor,Timestamp,DateTime
A1B2C3D4,1,12345,0d 3h 25m 45s
E5F6A7B8,2,12450,0d 3h 27m 30s
```

### Tags File Format (tags.txt)
```
UID,DailyCount,LastResetDay,IsActive
A1B2C3D4,5,19773,1
E5F6A7B8,2,19773,1
```

## Customization Options

### Adjusting Motor Run Time
Change line in `vendItem()` function:
```cpp
delay(2850); // Milliseconds - adjust as needed
```

### Changing Daily Limit
Modify constant at top of code:
```cpp
#define DAILY_VEND_LIMIT 10  // Change to desired limit
```

### Changing Max Stock
```cpp
#define MAX_STOCK 30  // Change to your capacity
```

### Changing WiFi Credentials
```cpp
const char* ssid = "Lyra-Vending-AP";      // Your AP name
const char* password = "lyra12345";         // Your password
```

### Changing LCD Address
If your LCD uses different I2C address:
```cpp
LiquidCrystal_I2C lcd(0x27, 16, 2);  // Change 0x27 to your address
```

## Troubleshooting

### SD Card Not Detected
- Check wiring connections
- Ensure SD card is formatted as FAT32
- Try different SD card (some are incompatible)
- Check voltage level (some modules need 5V, others 3.3V)

### RFID Not Reading
- Check SPI connections (MOSI, MISO, SCK)
- Ensure RST and SS pins are correct
- Card must be 13.56MHz frequency
- Hold card steady for 1-2 seconds

### WiFi Not Appearing
- Wait 30 seconds after power on
- Check ESP8266 is receiving adequate power (min 500mA)
- Try resetting ESP8266
- Check antenna connection

### LCD Not Displaying
- Check I2C address (use I2C scanner sketch)
- Verify SDA/SCL connections
- Adjust contrast potentiometer on LCD backpack
- Check power supply (5V required)

### Motors Not Running
- Check relay connections
- Verify relay is receiving signal (LED on relay should light)
- Ensure motor power supply is connected
- Check relay type (active HIGH vs active LOW)

### Web Dashboard Not Loading
- Verify connected to correct WiFi network
- Try http://192.168.4.1 (no 'www' or 'https')
- Clear browser cache
- Try different browser

### Daily Counter Not Resetting
- The counter resets based on millis() overflow
- For production, consider adding RTC module
- Current implementation resets every ~49 days

## Security Considerations

1. **Change Default Password**: Modify WiFi password in code
2. **Physical Security**: Secure RFID reader to prevent tampering
3. **Tag Encryption**: Consider using encrypted RFID tags
4. **Access Control**: Keep web dashboard credentials secure
5. **Log Review**: Regularly check logs for suspicious activity

## Advanced Features (Future Enhancements)

- Add RTC module for accurate timekeeping
- Implement tag encryption
- Add email/SMS notifications
- Create smartphone app
- Battery backup for data retention
- Multiple vending machines network
- Cloud backup of logs
- Receipt printer integration

## Support & Maintenance

### Regular Maintenance
- Clear logs monthly (download first)
- Check SD card health
- Clean RFID reader surface
- Verify motor operation
- Test all RFID tags

### Backup Procedure
1. Download logs via web dashboard
2. Remove SD card
3. Copy all files to computer
4. Store backups securely

## Technical Specifications

- **Supported RFID Cards:** ISO14443A (MIFARE)
- **Frequency:** 13.56MHz
- **Operating Voltage:** 5V (ESP8266), 12V (Motors)
- **Current Consumption:** ~200mA (idle), ~2A peak (motors)
- **WiFi Standard:** 802.11 b/g/n
- **Storage:** SD card up to 32GB (FAT32)
- **Temperature Range:** 0°C to 50°C
- **Tag Capacity:** 50 RFID tags
- **Daily Limit:** 10 vends per tag

## License
This project is open-source. Feel free to modify and distribute.

## Credits
**Developed for:** Lyra Enterprises
**Version:** 3.0
**Date:** February 2026

---

For technical support or questions, refer to the code comments or contact your system administrator.
