# ESP32 Vending Machine - Customer Troubleshooting Guide

## 📱 Quick Help: Serial Monitor Commands

Connect your ESP32 to computer via USB, open Serial Monitor at **115200 baud**, and use these commands:

| Command | What It Does |
|---------|-------------|
| `help` | Show all available commands |
| `status` | Display machine status (WiFi, Ethernet, stock, firmware) |
| `wifi` | Show WiFi connection details |
| `scan-eth` | **Auto-detect Ethernet module** (finds correct CS pin) |
| `diag` | Show Ethernet diagnostics |
| `reset-eth` | Reset Ethernet module |
| `reset-wifi` | Clear WiFi credentials and enter setup mode |
| `reset-stock` | Reset all product stock to 30 units |
| `sync` | Manually sync offline coin payments to cloud |
| `queue` | Show pending offline transactions |
| `test` | Run network connectivity tests |
| `ssl` | Test HTTPS/SSL connection |
| `dns` | Test DNS resolution |
| `server` | Test server connectivity |
| `speed` | Measure network speed |
| `memory` | Show memory usage |
| `ota` | Check for firmware updates |
| `reboot` | Restart ESP32 |

---

## 🚀 Initial Setup Steps

### Step 1: Upload Firmware (First Time Only)

1. **Download Arduino IDE** from https://www.arduino.cc/en/software
2. **Install ESP32 Board Support:**
   - Open Arduino IDE
   - Go to File → Preferences
   - Add to "Additional Board Manager URLs": `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager
   - Search "ESP32" and install "esp32 by Espressif Systems"

3. **Install Required Libraries:**
   - Tools → Manage Libraries
   - Install these:
     - `ArduinoJson` by Benoit Blanchon
     - `UIPEthernet` by UIPEthernet (for Ethernet module)

4. **Open Firmware:**
   - Open `ESP32_FIRMWARE_OPTIMIZED.ino`
   - Select Board: Tools → Board → ESP32 → "ESP32 Dev Module"
   - Select Port: Tools → Port → (your ESP32's COM port)

5. **Upload:**
   - Click Upload button
   - Wait for "Hard resetting via RTS pin..." message

### Step 2: WiFi Configuration

**When ESP32 starts for the first time, it creates a WiFi access point:**

1. **Connect to ESP32's WiFi:**
   - Network name: `Lyra-Setup-XXXXXX`
   - No password required

2. **Open Web Browser:**
   - Go to: `http://192.168.4.1`

3. **Enter Your WiFi Credentials:**
   - WiFi SSID (network name)
   - WiFi Password
   - Click "Save"

4. **ESP32 Will Reboot:**
   - Connects to your WiFi automatically
   - Blue LED turns ON when connected
   - Machine registers with cloud server

**Forgot WiFi password? Reset with:**
- Press and hold RESET button (GPIO 4) for 5+ seconds, OR
- Send `reset-wifi` command via Serial Monitor

---

## 🔧 Common Issues & Solutions

### Issue 1: Blue LED Not Turning On (No WiFi Connection)

**Symptoms:**
- Blue LED stays OFF
- Machine not visible on dashboard

**Solutions:**

1. **Check WiFi credentials:**
   - Make sure SSID and password are correct
   - Special characters in password? Try simpler password first
   - Command: `wifi` to see connection status

2. **Check WiFi signal strength:**
   - Move ESP32 closer to router
   - Avoid metal enclosures that block WiFi
   - Command: `status` shows signal strength (RSSI)

3. **Reset WiFi and try again:**
   ```
   reset-wifi
   ```
   - ESP32 will restart in setup mode
   - Connect to `Lyra-Setup-XXXXXX` again
   - Re-enter credentials

4. **Check router settings:**
   - Router must support 2.4GHz (ESP32 doesn't support 5GHz)
   - Disable MAC filtering temporarily
   - Enable DHCP on router

### Issue 2: Ethernet Not Working

**Symptoms:**
- Serial Monitor shows "No Ethernet hardware detected"
- Network connection fails

**Solutions:**

1. **Run Auto-Detection (EASIEST):**
   ```
   scan-eth
   ```
   - This will test all possible pin configurations
   - If it finds hardware, it will tell you which pin to use
   - Update firmware line 47 with the correct pin number

2. **Check Module Type:**
   - **HANRUN HR911105A** (ENC28J60): Default setup ✅
   - **W5500 Module**: Edit line 27, comment out `#define USE_UIPETHERNET`

3. **Check Power Supply:**
   - **CRITICAL:** HANRUN HR911105A uses **3.3V ONLY**
   - **5V will destroy the module!**
   - Measure voltage at module's VCC pin: should be 3.25-3.35V
   - Use external 3.3V regulator if ESP32's regulator is weak

4. **Verify Wiring:**
   
   **HANRUN HR911105A (ENC28J60) Connections:**
   ```
   Module Pin → ESP32 Pin
   VCC        → 3.3V (NOT 5V!)
   GND        → GND
   CS         → GPIO 5 (or use scan-eth to find)
   SCK        → GPIO 18
   SO (MISO)  → GPIO 19
   SI (MOSI)  → GPIO 23
   ```

5. **Check for Short Wires:**
   - Use wires shorter than 10cm for SPI connections
   - Avoid loose breadboard connections
   - Solder connections for production

6. **Reset Ethernet Module:**
   ```
   reset-eth
   ```

### Issue 3: Coin Sensor Not Working

**Symptoms:**
- Inserting coins doesn't trigger anything
- No LED flash on coin insert

**Solutions:**

1. **Check Coin Sensor Wiring:**
   - Coin sensor → GPIO 27
   - Must be pulled HIGH when no coin
   - Goes LOW when coin detected

2. **Test Coin Detection:**
   - Watch Serial Monitor
   - Insert coin
   - Should see: `🪙 Coin detected! Amount: ₹X`

3. **Check Pull-up Resistor:**
   - Coin pin needs 10kΩ pull-up resistor to 3.3V
   - Or enable internal pull-up in firmware

### Issue 4: Products Not Dispensing

**Symptoms:**
- Payment successful but motor doesn't turn
- Stock count doesn't decrease

**Solutions:**

1. **Check Motor Connection:**
   - Motor driver connected to GPIO 5 (Transistor Base)
   - Verify motor driver power supply

2. **Check Stock Level:**
   ```
   status
   ```
   - Shows current stock count
   - If stock = 0, motor won't run

3. **Reset Stock Manually:**
   ```
   reset-stock
   ```
   - Resets all products to 30 units

4. **Check Motor Timing:**
   - Default: 5 second rotation per product
   - Adjustable in firmware if needed

### Issue 5: Payments Not Syncing (Offline Mode)

**Symptoms:**
- Coin payments work offline
- But not showing on dashboard after WiFi returns

**Solutions:**

1. **Check Offline Queue:**
   ```
   queue
   ```
   - Shows number of pending transactions

2. **Manually Sync:**
   ```
   sync
   ```
   - Forces sync of offline payments to cloud

3. **Check Machine Registration:**
   ```
   status
   ```
   - Machine ID must not be "UNKNOWN"
   - If unknown, machine not registered with server yet

4. **Wait for Auto-Sync:**
   - ESP32 auto-syncs every 5 minutes when online
   - Or after WiFi reconnection

### Issue 6: Machine Showing "UNKNOWN" on Dashboard

**Symptoms:**
- Serial Monitor shows "Machine ID: UNKNOWN"
- Machine not appearing on customer dashboard

**Solutions:**

1. **Check Server Connection:**
   ```
   server
   ```
   - Tests connection to Lyra server
   - Should show "200 OK"

2. **Verify MAC Address:**
   ```
   status
   ```
   - Note the MAC address shown
   - Admin must register this MAC on dashboard first

3. **Check Firewall:**
   - Make sure router allows HTTPS connections (port 443)
   - Test with: `ssl` command

4. **Wait for Registration:**
   - Machine info fetches every 2 minutes
   - Give it a few minutes after admin adds machine

### Issue 7: Watchdog Resets / Random Reboots

**Symptoms:**
- ESP32 restarts unexpectedly
- Serial Monitor shows "Watchdog reset"

**Solutions:**

1. **This is NORMAL for stuck states:**
   - Watchdog timeout = 30 minutes of inactivity
   - Prevents frozen machine
   - If rebooting too often, check for:
     - Network connection issues
     - Blocked HTTP requests
     - Motor jamming

2. **Check Power Supply:**
   - Insufficient power causes brownouts
   - Use 5V 2A+ power adapter
   - Add 470µF capacitor across power pins

3. **Check Network Stability:**
   ```
   wifi
   status
   ```
   - Poor WiFi signal causes reconnection attempts
   - Move closer to router or use Ethernet

---

## 🖼️ Understanding Visual Indicators

### LED Indicators

| LED Color | Status | Meaning |
|-----------|--------|---------|
| **Blue ON** | WiFi Connected | ✅ Online mode |
| **Blue OFF** | No WiFi | ⚠️ Offline mode |
| **Blue BLINK (Fast)** | Connecting | Attempting WiFi connection |
| **Blue BLINK (Slow)** | Setup Mode | Access point active for configuration |

### Serial Monitor Messages

**Successful Startup:**
```
🚀 Lyra Vending Machine Starting...
📡 MAC: AA:BB:CC:DD:EE:FF
📝 Firmware Version: V1.0.0
✅ WiFi Connected: 192.168.1.100
🌐 Server: lyra-app.co.in
✅ Machine Registered: Snacks Machine #1
📦 Stock: 30 units
⏰ Watchdog Timer: 30 minutes
```

**Network Issues:**
```
❌ WiFi connection failed
⚠️ Ethernet not detected
🔄 Entering offline mode
💾 Saving transactions locally
```

**Payment Success:**
```
✅ Payment received for Machine
🎯 Dispensing 2x Lays Chips
⚙️ Motor running... Done!
📦 Stock updated: 28 units
```

**Offline Coin Payment:**
```
🪙 Coin detected! Amount: ₹10
⚠️ Offline mode - saving locally
💾 Saved to queue (Position 1/15)
⚙️ Motor running... Done!
```

---

## 📊 Network Diagnostics

### Testing Network Connection

Run these commands in order:

1. **Test DNS:**
   ```
   dns
   ```
   Expected: Shows IP address of lyra-app.co.in

2. **Test SSL:**
   ```
   ssl
   ```
   Expected: "✅ SSL connection successful"

3. **Test Server:**
   ```
   server
   ```
   Expected: "✅ Server responded: 200 OK"

4. **Test Speed:**
   ```
   speed
   ```
   Expected: Shows download speed in KB/s
   - Good: >20 KB/s
   - Acceptable: 10-20 KB/s
   - Poor: <10 KB/s (may have issues)

### Ethernet vs WiFi

**When to Use Each:**

| Feature | WiFi | Ethernet |
|---------|------|----------|
| Easy Setup | ✅ Yes | ⚠️ Requires wiring |
| Range | ✅ Up to 30m | ❌ Cable length limit |
| Reliability | ⚠️ Can drop signal | ✅ Very stable |
| Speed | Good (2-5 MB/s) | Better (10-100 MB/s) |
| Power | Low | Slightly higher |
| Recommended For | Most installations | Critical/high-traffic locations |

**Auto-Switch Logic:**
- Firmware tries Ethernet first
- Falls back to WiFi if Ethernet unavailable
- Continues trying Ethernet every 5 minutes
- Offline mode if both fail

---

## 🔐 Security Features

### Firmware Version Tracking
- Current version: **V1.0.0**
- Sent with every API request
- Visible on admin dashboard
- Used for remote firmware update compatibility

### Over-The-Air (OTA) Updates
```
ota
```
- Check for firmware updates from server
- Updates can be pushed remotely by admin
- Automatic download and install
- Machine reboots after successful update

### Watchdog Protection
- 30-minute timeout prevents frozen states
- Auto-restart if software hangs
- Network reconnection attempts
- Offline mode fallback

---

## 📞 When to Contact Support

Contact support if:

1. ✅ **You've tried all troubleshooting steps above**
2. ✅ **Serial Monitor shows persistent errors**
3. ✅ **Hardware appears damaged (burnt smell, hot components)**
4. ✅ **Firmware upload fails repeatedly**

**Include This Information:**

1. **Serial Monitor Log:**
   - Copy entire output from startup
   - Include any error messages

2. **Hardware Details:**
   - ESP32 model
   - Ethernet module type (if used)
   - Power supply voltage/amperage

3. **Command Outputs:**
   ```
   status
   diag
   scan-eth
   wifi
   ```

4. **Network Info:**
   - Router model
   - WiFi frequency (2.4GHz/5GHz)
   - Internet speed

5. **Photos (if hardware issue):**
   - Wiring connections
   - Module LEDs
   - Any visible damage

---

## 🎯 Quick Reference Card

**Print and keep near machine:**

### Emergency Commands
| Issue | Command | Action |
|-------|---------|--------|
| No WiFi | `reset-wifi` | Clear WiFi, start setup mode |
| No Products | `reset-stock` | Set all stock to 30 |
| Stuck State | `reboot` | Restart ESP32 |
| Offline Sync | `sync` | Upload queued payments |

### Status Checks
| What to Check | Command |
|---------------|---------|
| Everything | `status` |
| WiFi Only | `wifi` |
| Ethernet Only | `diag` |
| Memory | `memory` |
| Stock | `status` (shows stock) |

### Maintenance Schedule
- **Daily:** Check `status` for any warnings
- **Weekly:** Run `test` for network health
- **Monthly:** Check firmware version with `ota`
- **As Needed:** `reset-stock` when refilling

---

## 📚 Additional Resources

- **Project Documentation:** See README.md files in project folder
- **Ethernet Troubleshooting:** See ETHERNET_TROUBLESHOOTING.md for detailed wiring diagrams
- **Payment Integration:** See ESP32_PAYMENT_INTEGRATION.md for how payments work
- **Firmware Updates:** Latest firmware available from admin dashboard

---

## ✅ Maintenance Checklist

### Weekly:
- [ ] Check blue LED is ON (WiFi connected)
- [ ] Run `status` command - no errors shown
- [ ] Verify stock count is accurate
- [ ] Test coin sensor with actual coin
- [ ] Check motor dispenses correctly

### Monthly:
- [ ] Run `test` - all network tests pass
- [ ] Run `ota` - check for firmware updates
- [ ] Clean coin sensor if needed
- [ ] Check all wire connections are secure
- [ ] Verify Ethernet cable (if used) is not damaged

### As Needed:
- [ ] Refill products and run `reset-stock`
- [ ] Check offline queue with `queue` command
- [ ] Review transaction history on dashboard
- [ ] Update WiFi credentials if network changed

---

**Remember:** The ESP32 is designed to work offline when network is unavailable. It will automatically sync all coin payments when connection returns!
