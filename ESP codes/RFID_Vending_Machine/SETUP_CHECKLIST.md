# Setup Checklist & Installation Steps

**Complete this checklist step-by-step for successful installation.**

---

## 📋 Pre-Installation Checklist

### Hardware Acquisition
- [ ] ESP8266 NodeMCU purchased
- [ ] MFRC522 RFID reader module acquired
- [ ] SD Card module obtained
- [ ] 16x2 I2C LCD display ready
- [ ] 2-channel relay module available
- [ ] 2x DC motors (12V) acquired
- [ ] 3x push buttons obtained
- [ ] 10-20 RFID cards/tags (13.56MHz) purchased
- [ ] MicroSD card (4-32GB, Class 10) ready
- [ ] 12V 2A power adapter available
- [ ] Buck converter (12V to 5V) ready
- [ ] Jumper wires (20-30 pieces) available
- [ ] Optional: Breadboard for testing

**Total Components:** _____ / 14 items ✓

### Tools Ready
- [ ] Computer with Arduino IDE installed
- [ ] USB cable (micro USB for NodeMCU)
- [ ] Multimeter for testing
- [ ] Wire strippers/cutters
- [ ] Soldering iron (optional but recommended)
- [ ] Screwdrivers
- [ ] Label maker or tape for marking wires

**Total Tools:** _____ / 7 items ✓

### Software Preparation
- [ ] Arduino IDE installed (1.8.19+ or 2.x)
- [ ] ESP8266 board package installed
- [ ] USB drivers installed (CH340G or CP2102)
- [ ] Libraries downloaded/ready to install
- [ ] Code files downloaded

**Total Software:** _____ / 5 items ✓

---

## 🔧 Installation Steps

### Phase 1: Software Setup

#### Step 1.1: Install Arduino IDE
- [ ] Download from arduino.cc
- [ ] Install on computer
- [ ] Launch and verify it opens
- **Time:** 10 minutes

#### Step 1.2: Add ESP8266 Board Support
- [ ] Open File → Preferences
- [ ] Add URL: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
- [ ] Open Tools → Board → Boards Manager
- [ ] Search "ESP8266" and install
- [ ] Wait for installation to complete
- **Time:** 5-10 minutes

#### Step 1.3: Install Libraries
Install via Sketch → Include Library → Manage Libraries

- [ ] Search and install: **MFRC522** by GithubCommunity
- [ ] Search and install: **LiquidCrystal I2C** by Frank de Brabander
- [ ] Built-in: **ESP8266WiFi** (comes with board package)
- [ ] Built-in: **ESP8266WebServer** (comes with board package)
- [ ] Built-in: **SD** (built into Arduino IDE)
- [ ] Built-in: **Wire** (built into Arduino IDE)
- [ ] Built-in: **SPI** (built into Arduino IDE)
- **Time:** 5 minutes

#### Step 1.4: Configure Board Settings
- [ ] Tools → Board → ESP8266 Boards → NodeMCU 1.0 (ESP-12E Module)
- [ ] Tools → Flash Size → 4MB (FS:2MB OTA:~1019KB)
- [ ] Tools → Upload Speed → 115200
- [ ] Tools → CPU Frequency → 80 MHz
- **Time:** 2 minutes

**Phase 1 Complete:** _____ minutes total

---

### Phase 2: Hardware Assembly

#### Step 2.1: Workspace Setup
- [ ] Clear work area
- [ ] Good lighting arranged
- [ ] Components laid out
- [ ] Wiring diagram printed or on second screen
- [ ] Label maker/tape ready
- **Time:** 5 minutes

#### Step 2.2: Power Supply Assembly
- [ ] Connect 12V adapter to buck converter input
- [ ] Set buck converter output to 5V (use multimeter)
- [ ] Test: Measure output voltage = 5V ±0.2V
- [ ] Mark polarity with red/black wire or tape
- **Time:** 10 minutes

#### Step 2.3: Connect LCD Display
- [ ] Wire LCD VCC to 5V
- [ ] Wire LCD GND to GND
- [ ] Wire LCD SDA to NodeMCU D2
- [ ] Wire LCD SCL to NodeMCU D1
- [ ] Test: Upload I2C scanner sketch (optional)
- **Time:** 10 minutes

#### Step 2.4: Connect RFID Reader
- [ ] Wire RFID 3.3V to NodeMCU 3.3V
- [ ] Wire RFID GND to NodeMCU GND
- [ ] Wire RFID RST to NodeMCU D3
- [ ] Wire RFID SDA(SS) to NodeMCU D4
- [ ] Wire RFID MOSI to NodeMCU D7
- [ ] Wire RFID MISO to NodeMCU D6
- [ ] Wire RFID SCK to NodeMCU D5
- [ ] ⚠️ Check: RFID uses 3.3V NOT 5V!
- **Time:** 15 minutes

#### Step 2.5: Connect SD Card Module
- [ ] Wire SD VCC to 5V (or 3.3V, check module specs)
- [ ] Wire SD GND to GND
- [ ] Wire SD CS to NodeMCU D8
- [ ] Wire SD MOSI to NodeMCU D7 (shared with RFID)
- [ ] Wire SD MISO to NodeMCU D6 (shared with RFID)
- [ ] Wire SD SCK to NodeMCU D5 (shared with RFID)
- **Time:** 10 minutes

#### Step 2.6: Connect Relay Module
- [ ] Wire Relay VCC to 5V
- [ ] Wire Relay GND to GND
- [ ] Wire Relay IN1 to NodeMCU D1
- [ ] Wire Relay IN2 to NodeMCU D2
- [ ] Note relay LED positions for testing
- **Time:** 10 minutes

#### Step 2.7: Connect Push Buttons
- [ ] Wire Reset Button: One side to D0, other to GND
- [ ] Wire Select Button 1: One side to D5, other to GND
- [ ] Wire Select Button 2: One side to D6, other to GND
- [ ] Optional: Add 10kΩ pull-up resistors
- **Time:** 10 minutes

#### Step 2.8: Connect Motors to Relays
- [ ] Wire 12V+ to Relay 1 COM
- [ ] Wire Relay 1 NO to Motor 1 positive
- [ ] Wire Motor 1 negative to 12V GND
- [ ] Wire 12V+ to Relay 2 COM
- [ ] Wire Relay 2 NO to Motor 2 positive
- [ ] Wire Motor 2 negative to 12V GND
- [ ] ⚠️ Warning: High current - use proper wire gauge
- **Time:** 15 minutes

#### Step 2.9: Final Power Connections
- [ ] Connect NodeMCU VIN to 5V from buck converter
- [ ] Connect NodeMCU GND to common ground
- [ ] Verify all components have power and ground
- [ ] Double-check polarity (red = positive, black = ground)
- [ ] Label all connections
- **Time:** 10 minutes

#### Step 2.10: Visual Inspection
- [ ] All connections tight and secure
- [ ] No exposed wire touching other wires
- [ ] Polarity correct on all components
- [ ] SPI wires connected correctly
- [ ] No shorts between power and ground
- [ ] Take photos for reference
- **Time:** 5 minutes

**Phase 2 Complete:** _____ minutes total (Est: 110 min = 1h 50min)

---

### Phase 3: Software Upload

#### Step 3.1: Prepare SD Card
- [ ] Format SD card as FAT32
- [ ] Safely eject from computer
- [ ] Insert into SD card module
- **Time:** 5 minutes

#### Step 3.2: Open Code
- [ ] Navigate to downloaded files
- [ ] Open `RFID_Vending_Machine.ino` in Arduino IDE
- [ ] Review code briefly
- [ ] Check WiFi credentials (lines 21-22)
- **Time:** 3 minutes

#### Step 3.3: Configure Settings (Optional)
Edit these if needed:
- [ ] WiFi SSID (line 21): `const char* ssid = "Lyra-Vending-AP";`
- [ ] WiFi Password (line 22): `const char* password = "lyra12345";`
- [ ] LCD Address (line 34): `LiquidCrystal_I2C lcd(0x27, 16, 2);`
- [ ] Daily vend limit (line 16): `#define DAILY_VEND_LIMIT 10`
- [ ] Motor run time (in vendItem function): `delay(2850);`
- **Time:** 5 minutes

#### Step 3.4: Connect ESP8266
- [ ] Plug USB cable into NodeMCU
- [ ] Plug other end into computer
- [ ] Wait for drivers to install (if first time)
- [ ] Check Tools → Port → Select COM port (Windows) or /dev/... (Mac/Linux)
- **Time:** 3 minutes

#### Step 3.5: Verify Code
- [ ] Click Verify button (checkmark icon)
- [ ] Wait for compilation
- [ ] Check for errors in output window
- [ ] If errors: Check libraries installed correctly
- [ ] Fix any errors and verify again
- **Time:** 2-5 minutes

#### Step 3.6: Upload Code
- [ ] Click Upload button (right arrow icon)
- [ ] Wait for "Connecting..." message
- [ ] Should see upload progress
- [ ] Wait for "Done uploading" message
- [ ] If fails: Try pressing FLASH button on NodeMCU during upload
- **Time:** 1-2 minutes

#### Step 3.7: Open Serial Monitor
- [ ] Tools → Serial Monitor
- [ ] Set baud rate to 115200
- [ ] Press Reset button on NodeMCU
- [ ] Watch for startup messages
- [ ] Note any error messages
- **Time:** 2 minutes

**Phase 3 Complete:** _____ minutes total (Est: 21-27 min)

---

### Phase 4: Initial Testing

#### Step 4.1: Power On Test
- [ ] Apply 12V power to system
- [ ] LCD should light up
- [ ] LCD shows "Initializing..."
- [ ] Wait for boot sequence
- [ ] LCD should show "Lyra Enterprises" with stock levels
- [ ] If no display: Check LCD wiring and address
- **Status:** _____ (Pass/Fail)

#### Step 4.2: SD Card Test
- [ ] Look for "SD Card Ready" message on LCD
- [ ] If "SD Card Failed": Check wiring, reformat card
- [ ] Remove SD card and check files created:
  - [ ] vendlog.csv exists
  - [ ] tags.txt exists
  - [ ] config.txt exists
- [ ] Re-insert SD card
- **Status:** _____ (Pass/Fail)

#### Step 4.3: WiFi Test
- [ ] On phone/laptop, scan for WiFi networks
- [ ] Look for SSID: "Lyra-Vending-AP"
- [ ] Connect using password: "lyra12345"
- [ ] Should connect successfully
- [ ] Open web browser
- [ ] Navigate to: http://192.168.4.1
- [ ] Dashboard should load
- [ ] If not loading: Wait 30 seconds and retry
- **Status:** _____ (Pass/Fail)

#### Step 4.4: RFID Test
- [ ] Place RFID card near reader
- [ ] LCD should show "Card Detected"
- [ ] LCD displays UID of card
- [ ] Note down UID: _______________________
- [ ] If no detection:
  - [ ] Check RFID wiring (especially SPI pins)
  - [ ] Try different card
  - [ ] Verify 3.3V power to RFID
- **Status:** _____ (Pass/Fail)

#### Step 4.5: Web Dashboard Test
- [ ] Open http://192.168.4.1 in browser
- [ ] Verify stock levels shown (should be 30/30)
- [ ] Click "Add New RFID Tag"
- [ ] Enter the UID from Step 4.4
- [ ] Click "Add"
- [ ] Should see success message
- [ ] Tag appears in tag list
- **Status:** _____ (Pass/Fail)

#### Step 4.6: Button Test
- [ ] Press Reset Button (D0)
- [ ] LCD should show "Stock Refilled"
- [ ] Press Select Button 1 (D5)
- [ ] Should detect press (for motor selection later)
- [ ] Press Select Button 2 (D6)
- [ ] Should detect press (for motor selection later)
- **Status:** _____ (Pass/Fail)

#### Step 4.7: Relay Test
- [ ] Do NOT connect motors for this test
- [ ] Scan authorized RFID card
- [ ] LCD shows "Select Motor"
- [ ] Press button D5 for Motor 1
- [ ] Listen for relay click
- [ ] Relay 1 LED should light for ~2.85 seconds
- [ ] Repeat for Motor 2 (button D6)
- [ ] Relay 2 LED should light for ~2.85 seconds
- **Status:** _____ (Pass/Fail)

#### Step 4.8: Motor Test (CAUTION)
⚠️ **WARNING: Motors can spin unexpectedly!**
- [ ] Secure motors so they don't move
- [ ] Reconnect motors to relays
- [ ] Have emergency power disconnect ready
- [ ] Scan RFID card
- [ ] Select Motor 1 (button D5)
- [ ] Motor 1 should run for ~2.85 seconds
- [ ] Motor stops automatically
- [ ] Repeat for Motor 2
- [ ] If motor doesn't stop: DISCONNECT POWER IMMEDIATELY
- **Status:** _____ (Pass/Fail)

#### Step 4.9: Logging Test
- [ ] After vending test above
- [ ] Go to web dashboard
- [ ] Scroll to "Recent Transactions"
- [ ] Should see your test vend logged
- [ ] Click "Download Logs (CSV)"
- [ ] File should download
- [ ] Open file - verify data present
- **Status:** _____ (Pass/Fail)

#### Step 4.10: Full Cycle Test
- [ ] Scan authorized RFID card
- [ ] LCD: "Card Detected" + UID
- [ ] LCD: "Select Motor"
- [ ] Press button for motor choice
- [ ] LCD: "Vending from MX"
- [ ] Motor runs
- [ ] LCD: "Please Collect The Napkin"
- [ ] LCD: "Remaining Today Count: 9"
- [ ] LCD: Returns to idle "Lyra Enterprises"
- [ ] Check web dashboard - transaction logged
- [ ] Stock decreased by 1
- **Status:** _____ (Pass/Fail)

**Phase 4 Complete:** All tests _____ (Passed/Failed)

---

## ✅ Post-Installation Checklist

### Documentation
- [ ] All wiring documented/photographed
- [ ] Settings recorded (WiFi password, etc.)
- [ ] RFID UIDs documented with owner names
- [ ] Pin assignments noted for future reference

### Security
- [ ] WiFi password changed from default (optional)
- [ ] Physical access to system restricted
- [ ] Reset button protected from accidental press
- [ ] RFID reader positioned to prevent tampering

### Operation
- [ ] Add all authorized RFID tags via web interface
- [ ] Test each tag works correctly
- [ ] Verify daily limits are working
- [ ] Instruct users on operation
- [ ] Post usage instructions near machine

### Maintenance
- [ ] Schedule regular log downloads (weekly)
- [ ] Plan stock refill schedule
- [ ] Arrange motor maintenance
- [ ] Set up backup routine for SD card

---

## 📊 Test Results Summary

### Hardware Tests
| Component | Status | Notes |
|-----------|--------|-------|
| Power Supply | ⬜ Pass / ⬜ Fail | _____________ |
| LCD Display | ⬜ Pass / ⬜ Fail | _____________ |
| RFID Reader | ⬜ Pass / ⬜ Fail | _____________ |
| SD Card | ⬜ Pass / ⬜ Fail | _____________ |
| WiFi | ⬜ Pass / ⬜ Fail | _____________ |
| Relay 1 | ⬜ Pass / ⬜ Fail | _____________ |
| Relay 2 | ⬜ Pass / ⬜ Fail | _____________ |
| Motor 1 | ⬜ Pass / ⬜ Fail | _____________ |
| Motor 2 | ⬜ Pass / ⬜ Fail | _____________ |
| Buttons | ⬜ Pass / ⬜ Fail | _____________ |

### Software Tests
| Feature | Status | Notes |
|---------|--------|-------|
| Code Upload | ⬜ Pass / ⬜ Fail | _____________ |
| Boot Sequence | ⬜ Pass / ⬜ Fail | _____________ |
| Web Dashboard | ⬜ Pass / ⬜ Fail | _____________ |
| RFID Auth | ⬜ Pass / ⬜ Fail | _____________ |
| Transaction Log | ⬜ Pass / ⬜ Fail | _____________ |
| Stock Tracking | ⬜ Pass / ⬜ Fail | _____________ |
| Daily Limits | ⬜ Pass / ⬜ Fail | _____________ |

### Overall Result
- [ ] ✅ **SYSTEM OPERATIONAL** - All tests passed
- [ ] ⚠️ **PARTIAL** - Some issues, see notes above
- [ ] ❌ **NOT OPERATIONAL** - Major issues, review troubleshooting

---

## 🔧 Troubleshooting Quick Reference

| Problem | Check | Solution |
|---------|-------|----------|
| No LCD display | Wiring, address | Try address 0x3F, check connections |
| RFID not reading | Power, wiring | Verify 3.3V, check SPI connections |
| SD card failed | Format, card | Reformat FAT32, try different card |
| WiFi not visible | Antenna, power | Wait longer, check power supply |
| Motors not running | Relays, power | Check relay activation, verify 12V |
| Web won't load | Connection, IP | Ensure connected to AP, use http:// |

For detailed troubleshooting, see README.md.

---

## 📝 Installation Notes

**Installation Date:** _______________

**Installer Name:** _______________

**Installation Time:** _____ hours

**Issues Encountered:**
```
_________________________________________
_________________________________________
_________________________________________
```

**Modifications Made:**
```
_________________________________________
_________________________________________
_________________________________________
```

**Authorized RFID Tags Added:**
| # | UID | Owner | Added Date |
|---|-----|-------|------------|
| 1 | _____________ | _____________ | __________ |
| 2 | _____________ | _____________ | __________ |
| 3 | _____________ | _____________ | __________ |
| 4 | _____________ | _____________ | __________ |
| 5 | _____________ | _____________ | __________ |

---

## ✨ Installation Complete!

Congratulations! Your RFID Vending Machine is now operational.

### Next Steps:
1. Train users on how to use the system
2. Monitor first few days of operation
3. Download logs regularly
4. Schedule maintenance
5. Enjoy automated vending!

### Quick Access Info:
```
WiFi SSID: Lyra-Vending-AP
Password: lyra12345
Dashboard: http://192.168.4.1
Daily Limit: 10 vends per tag
Max Stock: 30 per motor
```

### Support Resources:
- **README.md** - Complete documentation
- **QUICK_GUIDE.md** - Quick reference
- **TROUBLESHOOTING** - In README.md
- **CUSTOMIZATION.md** - Advanced features

---

**System Status:** ⬜ Operational ⬜ Testing ⬜ Issues

**Sign-off:** _____________________________ Date: __________

---

**Keep this checklist for future reference and maintenance!**
