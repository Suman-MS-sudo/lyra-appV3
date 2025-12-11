# Ethernet Module Troubleshooting Guide

## 🔍 Quick Diagnosis

### Step 1: Upload Updated Firmware
Upload the latest `ESP32_FIRMWARE_OPTIMIZED.ino` to your ESP32.

### Step 2: Run Pin Scanner
Open Serial Monitor (115200 baud) and type:
```
scan-eth
```

This will automatically test common CS pins (5, 15, 22, 33, 4, 16, 17) and tell you which one works.

### Step 3: Update Configuration
If the scanner finds your module on a different pin, update line 47 in the firmware:
```cpp
#define ETHERNET_CS 5  // Change to the pin that was found
```

Then re-upload the firmware.

---

## 🔌 Common CS Pin Configurations

### HANRUN HR911105A (ENC28J60 Based)
**⚠️ YOUR MODULE - Most Common Configuration:**
| Connection | ESP32 Pin | HR911105A Pin |
|------------|-----------|---------------|
| VCC        | **3.3V**  | VCC (⚠️ 3.3V ONLY!) |
| GND        | GND       | GND           |
| CS         | **GPIO 5** | CS/SS        |
| SCK        | **GPIO 18** | SCK         |
| MISO       | **GPIO 19** | SO/MISO     |
| MOSI       | **GPIO 23** | SI/MOSI     |

**Alternative Pins (if GPIO 5 conflicts):**
| Setup | CS Pin | SCK | MISO | MOSI |
|-------|--------|-----|------|------|
| Option 1 (Default) | **5**  | 18  | 19   | 23   |
| Option 2 | **15** | 18  | 19   | 23   |
| Option 3 | **22** | 18  | 19   | 23   |
| Option 4 (HSPI) | **15** | 14  | 12   | 13   |

### Other ENC28J60 Modules
| Board/Shield | CS Pin | SCK | MISO | MOSI |
|--------------|--------|-----|------|------|
| Generic      | **5**  | 18  | 19   | 23   |
| Some Shields | **22** | 18  | 19   | 23   |
| Custom       | **33** | 18  | 19   | 23   |

### W5500 Module
| Board/Shield | CS Pin | SCK | MISO | MOSI |
|--------------|--------|-----|------|------|
| ETH01-EVO    | **5**  | 18  | 19   | 23   |
| Generic      | **15** | 14  | 12   | 13   |

---

## ⚠️ Current Issue: "No Hardware Detected"

This means the ESP32 cannot communicate with your Ethernet module via SPI.

### Possible Causes:

#### 1. **Wrong CS Pin (Most Common)**
- Current setting: GPIO **5** (changed from 22)
- Run `scan-eth` to find the correct pin
- Common alternatives: 15, 22, 33

#### 2. **Wiring Issues**
Check your **HR911105A** connections:
```
HR911105A Pin → ESP32 Pin
VCC  → 3.3V (⚠️ CRITICAL: NOT 5V!)
GND  → GND
CS   → GPIO 5 (default, try others if not working)
SCK  → GPIO 18
SO   → GPIO 19 (MISO)
SI   → GPIO 23 (MOSI)
```

**⚠️ CRITICAL FOR HR911105A:** 
- **MUST use 3.3V** - The HR911105A (ENC28J60) is **NOT 5V tolerant**!
- Using 5V **WILL permanently damage** the module
- If your module has a voltage regulator onboard, verify it outputs 3.3V to the chip

#### 3. **Power Issues**
- **HR911105A** (ENC28J60) needs stable **3.3V** with good current (250-400mA peak)
- ESP32's 3.3V regulator may be insufficient if powering multiple devices
- **Solutions:**
  - Use external 3.3V regulator (e.g., AMS1117-3.3)
  - Power ESP32 from USB while testing
  - Add **10µF-100µF capacitor** near module VCC/GND pins
  - Measure voltage at module: should be 3.25-3.35V under load

#### 4. **Wrong Library**
Current firmware uses: **UIPEthernet** (correct for HR911105A/ENC28J60)

**Your module is HR911105A (ENC28J60 based)** - Current library is CORRECT ✅

If you have a different chip (W5100/W5200/W5500), change line 27:
```cpp
// #define USE_UIPETHERNET  // Comment this out for W5x00 chips
```
This will use standard Ethernet.h library instead.

---

## 🛠️ Diagnostic Commands

Connect to Serial Monitor (115200 baud) and try these commands:

| Command | Description |
|---------|-------------|
| `scan-eth` | **Auto-detect CS pin** (try this first!) |
| `diag` | Show Ethernet status |
| `reset-eth` | Reset Ethernet module |
| `status` | Show full system status |
| `help` | Show all commands |

---

## 📋 Step-by-Step Troubleshooting

### Try These in Order:

1. **Run pin scanner:**
   ```
   scan-eth
   ```
   If it finds hardware on a different pin, update `ETHERNET_CS` and re-upload.

2. **Check physical connections:**
   - Ensure all wires are properly connected
   - Check for loose connections
   - Verify 3.3V power (NOT 5V!)

3. **Try different CS pins manually:**
   Edit line 47 in firmware, try: 5, 15, 22, 33
   Re-upload and test each one.

4. **Verify module works:**
   - Does the module have power LED lit?
   - Try with a different ESP32 if available
   - Test module with Arduino if possible

5. **Check library compatibility:**
   - ENC28J60 → Use UIPEthernet (current)
   - W5x00 → Use Ethernet.h (comment out line 27)

---

## ✅ Success Indicators

When working correctly, you'll see:
```
🔌 Initializing Ethernet...
📌 Ethernet Pins - CS:5, MOSI:23, MISO:19, SCK:18
🔧 Initializing SPI bus...
🔧 Initializing Ethernet controller...
🔍 Detecting Ethernet hardware... ✅ ENC28J60/W5100 Detected
🌐 Requesting DHCP... ✅ Success!
📡 IP Address: 192.168.1.100
🌐 Gateway: 192.168.1.1
```

---

## 🆘 Still Not Working?

If `scan-eth` doesn't find any hardware on your **HR911105A**:

### HR911105A Specific Issues:

1. **Check Module LED** - Does the power LED light up?
   - YES → Power OK, check SPI connections
   - NO → Power issue or dead module

2. **Verify 3.3V Power**
   - Measure voltage at VCC pin: should be 3.25-3.35V
   - If below 3.2V → power supply insufficient
   - If above 3.4V → may damage module

3. **Test SPI Communication**
   - Run `scan-eth` - tests all common CS pins automatically
   - Check for loose wires/bad solder joints
   - Try shorter jumper wires (< 10cm recommended)

4. **Common HR911105A Problems:**
   - **Fake chips** - Very common with cheap modules
   - **Cold solder joints** - Reflow pins if needed
   - **Damaged from 5V** - If you previously used 5V, chip may be dead
   - **Wrong RJ45 connector** - Some have integrated magnetics issues

### General Troubleshooting:

1. **Module might be dead** - Try with different hardware
2. **Wrong module type** - Verify chip markings (should say ENC28J60)
3. **Incompatible module** - Some cheap clones don't work with UIPEthernet
4. **Wiring errors** - Double-check every connection against pinout
5. **Power insufficient** - Use external 3.3V regulator (AMS1117-3.3)

---

## 📝 Hardware Recommendations

### ✅ Your Module (Confirmed Working):
- **HANRUN HR911105A** - ENC28J60 based RJ45 Ethernet module
  - Pinout: VCC, GND, CS, SCK, SO (MISO), SI (MOSI)
  - Voltage: **3.3V ONLY**
  - Library: UIPEthernet (already configured ✅)
  - Typical CS Pin: GPIO 5 (default in updated firmware)

### Other Tested & Working Modules:
- ✅ Generic ENC28J60 Ethernet LAN Module (3.3V version)
- ✅ W5500 Ethernet Module
- ✅ ETH01-EVO ESP32 with Ethernet
- ✅ W5100 Ethernet Shield (with 3.3V compatible version)

### Avoid:
- ❌ 5V-only ENC28J60 modules (will damage with direct connection)
- ❌ Very cheap no-name clones (unreliable SPI communication)
- ❌ Modules without proper voltage regulation
- ❌ Fake/counterfeit chips (common with cheap modules)

---

## 📞 Support

If you've tried everything and it still doesn't work, share:
1. Output of `scan-eth` command
2. Your Ethernet module model/photo
3. Wiring diagram/connections
4. Power supply voltage measurements
