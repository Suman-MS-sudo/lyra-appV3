# Quick Reference Guide

## 🚀 Quick Start (5 Minutes)

### First Time Setup
1. **Power On** → LCD shows "Initializing..."
2. **Wait** → System creates SD files
3. **Connect WiFi** → SSID: "Lyra-Vending-AP", Password: "lyra12345"
4. **Open Browser** → http://192.168.4.1
5. **Add RFID Tags** → Click "Add New RFID Tag"
6. **Ready to Use** → Scan card and vend!

---

## 📱 Web Dashboard Quick Actions

### Access Dashboard
```
1. Connect to: Lyra-Vending-AP (password: lyra12345)
2. Navigate to: http://192.168.4.1
```

### Common Tasks
| Task | Steps |
|------|-------|
| **Add Tag** | Click "Add New RFID Tag" → Enter UID → Add |
| **View Logs** | Scroll to "Recent Transactions" section |
| **Download Logs** | Click "Download Logs (CSV)" button |
| **Reset Stock** | Click "Reset Both Stocks to 30" button |
| **Disable Tag** | Find tag → Click "Toggle" button |
| **Delete Tag** | Find tag → Click "Delete" → Confirm |

---

## 🏷️ RFID Tag Operations

### Getting Tag UID
**Method 1: Scan Unknown Card**
1. Place card on reader
2. LCD shows UID for 1 second
3. Note the UID displayed

**Method 2: Serial Monitor**
1. Open Arduino IDE
2. Tools → Serial Monitor
3. Set baud to 115200
4. Scan card
5. UID printed to serial

### Adding Tag to System
1. Get UID from scanning
2. Open web dashboard
3. Click "Add New RFID Tag"
4. Enter UID (e.g., A1B2C3D4)
5. Click "Add"

### Daily Limit Reset
- Automatic every 24 hours (based on system uptime)
- Manual: Power cycle the device
- Per tag: Individual counters

---

## 🎮 User Vending Process

### Step-by-Step
```
1. SCAN CARD
   └→ LCD: "Card Detected" + UID
   
2. AUTHORIZATION CHECK
   ├→ Authorized: Continue
   └→ Unauthorized: "Unauthorized Card!" → END
   
3. DAILY LIMIT CHECK
   ├→ Under limit: Continue
   └→ Limit reached: "Daily Limit Reached!" → END
   
4. MOTOR SELECTION (5 sec timeout)
   ├→ Button D5: Motor 1
   ├→ Button D6: Motor 2
   └→ No selection: "Timeout!" → END
   
5. STOCK CHECK
   ├→ In stock: Continue
   └→ Empty: "Motor X Empty!" → END
   
6. VENDING
   └→ Motor runs 2.85 seconds
   
7. COLLECTION
   └→ LCD: "Please Collect The Napkin"
   
8. CONFIRMATION
   └→ LCD: "Remaining Today Count: X"
   
9. RETURN TO IDLE
   └→ LCD: "Lyra Enterprises" + Stock levels
```

---

## 🔧 Admin Operations

### Refill Stock

#### Physical Button Method
```
1. Press and HOLD reset button (D0)
2. LCD shows "Stock Refilled"
3. LCD shows "M1:30 M2:30"
4. Release button
```

#### Web Dashboard Method
```
1. Open http://192.168.4.1
2. Scroll to "System Actions"
3. Click "Reset Both Stocks to 30"
4. Confirm alert
```

### Manage Stock Manually
Edit `/config.txt` on SD card:
```
stock1=25
stock2=18
```
Restart device to apply.

### Export Data

#### Via Web (Recommended)
1. Open dashboard
2. Click "Download Logs (CSV)"
3. File saves as `vending_logs.csv`

#### Via SD Card
1. Power off device
2. Remove SD card
3. Insert into computer
4. Copy `/vendlog.csv`

### Backup Everything
**Complete Backup:**
```
1. Power OFF
2. Remove SD card
3. Insert into computer
4. Copy all files:
   - vendlog.csv
   - tags.txt
   - config.txt
5. Store securely
```

---

## ⚡ Keyboard Shortcuts (Web Dashboard)

| Key | Action |
|-----|--------|
| `F5` or `Ctrl+R` | Refresh page |
| `Ctrl+F` | Search in logs |
| `Ctrl+S` | Save page (download) |
| `Ctrl+P` | Print logs |

---

## 🔍 Reading the LCD

### Idle Screen
```
┌────────────────┐
│Lyra Enterprises│
│M1:30  M2:25    │
└────────────────┘
    ↑      ↑
Motor 1  Motor 2
Stock    Stock
```

### During Scan
```
┌────────────────┐
│Card Detected   │
│A1B2C3D4E5F6    │
└────────────────┘
     ↑
   Card UID
```

### Error Messages
```
┌────────────────┐
│Unauthorized    │
│Card!           │
└────────────────┘

┌────────────────┐
│Daily Limit     │
│Reached!        │
└────────────────┘

┌────────────────┐
│Motor 1 Empty!  │
│Please Refill   │
└────────────────┘
```

---

## 📊 Understanding Logs

### CSV Format
```csv
UID,Motor,Timestamp,DateTime
A1B2C3D4,1,12345,0d 3h 25m 45s
E5F6A7B8,2,12450,0d 3h 27m 30s
```

### Fields Explained
- **UID**: RFID card unique identifier
- **Motor**: Which motor was used (1 or 2)
- **Timestamp**: Seconds since boot
- **DateTime**: Human readable format

### Import to Excel
1. Download logs as CSV
2. Open Excel
3. File → Open → Select CSV
4. Data imports automatically

### Analyze in Excel
**Total vends per tag:**
```excel
=COUNTIF(A:A, "SPECIFIC_UID")
```

**Most used motor:**
```excel
=MODE(B:B)
```

**Busiest time:** Sort by timestamp

---

## 🚨 Common Error Messages

| LCD Message | Meaning | Solution |
|-------------|---------|----------|
| "SD Card Failed!" | SD card not detected | Check wiring, reformat card (FAT32) |
| "Unauthorized Card!" | RFID tag not in system | Add tag via web dashboard |
| "Daily Limit Reached!" | User hit 10 vends today | Wait for daily reset (next day) |
| "Motor X Empty!" | No stock remaining | Refill stock (reset button) |
| "Timeout!" | No motor selected | Rescan card and select faster |
| "Refill Motor X" | Stock depleted | Press reset button or use web |

---

## 🔐 Daily Use Checklist

### Morning Startup
- [ ] Power on device
- [ ] Check LCD shows stock correctly
- [ ] Verify WiFi is broadcasting
- [ ] Test one RFID card
- [ ] Check web dashboard accessible

### During Operation
- [ ] Monitor stock levels
- [ ] Check for error messages
- [ ] Respond to user issues
- [ ] Note any unusual behavior

### Evening Shutdown
- [ ] Download transaction logs
- [ ] Check remaining stock
- [ ] Note refill requirements
- [ ] Backup important data
- [ ] Power off safely (optional)

---

## 📈 Statistics & Reporting

### Daily Report Template
```
Date: __________

Opening Stock:
- Motor 1: ___
- Motor 2: ___

Closing Stock:
- Motor 1: ___
- Motor 2: ___

Total Vends: ___
Unique Users: ___
Most Active User: ___
Most Used Motor: ___

Issues: _______________
Notes: ________________
```

### Weekly Review
1. Download all logs
2. Count total transactions
3. Identify popular motor
4. Check for inactive tags
5. Plan maintenance

---

## 🛠️ Maintenance Schedule

### Daily
- Visual inspection
- Check stock levels
- Test RFID reader
- Verify motors working

### Weekly
- Download and backup logs
- Clean RFID reader surface
- Check all connections
- Test all buttons
- Verify relay operation

### Monthly
- Check SD card space
- Test all RFID tags
- Lubricate motor mechanism
- Clean LCD screen
- Review inactive tags
- Clear old logs (after backup)

### Quarterly
- Full system backup
- Replace worn components
- Update firmware (if available)
- Review user feedback
- Optimize settings

---

## 🎯 Performance Tips

### Faster Response
- Keep SD card under 50% full
- Limit logs to 1000 entries
- Disable auto-refresh if not needed
- Use quality SD card (Class 10)

### Better Reliability
- Use dedicated power supply
- Keep connections tight
- Protect from moisture
- Provide adequate cooling
- Use quality RFID tags

### Extended Lifespan
- Don't overload motors
- Use surge protector
- Regular cleaning
- Backup critical data
- Replace batteries (if used)

---

## 📞 Quick Troubleshooting

### Device Won't Start
1. Check power connections
2. Verify voltage (5V for ESP, 12V for motors)
3. Look for LED on ESP8266
4. Check USB connection

### RFID Not Working
1. Hold card steady 1-2 seconds
2. Try different card
3. Check reader LED
4. Verify wiring (especially SPI)

### Web Dashboard Not Loading
1. Confirm WiFi connection
2. Type IP exactly: http://192.168.4.1
3. Wait 30 seconds after power-on
4. Try different browser
5. Clear cache

### Motor Runs But Doesn't Stop
1. Power off immediately
2. Check relay connections
3. Inspect code delays
4. Test relay independently

### SD Card Errors
1. Reformat as FAT32
2. Try different card
3. Check wiring
4. Test with computer

---

## 🔢 Configuration Quick Reference

### Default Values
```cpp
WiFi SSID: "Lyra-Vending-AP"
Password: "lyra12345"
IP Address: 192.168.4.1
LCD Address: 0x27
Max Stock: 30 per motor
Daily Limit: 10 vends per tag
Motor Run Time: 2850ms (2.85 sec)
Max RFID Tags: 50
Selection Timeout: 5 seconds
```

### Pin Assignments
```
RFID RST: D3
RFID SS: D4
SD Card CS: D8
Relay 1: D1
Relay 2: D2
Reset Button: D0
Select Button 1: D5
Select Button 2: D6
LCD SDA: D2 (GPIO4)
LCD SCL: D1 (GPIO5)
SPI MOSI: D7 (GPIO13)
SPI MISO: D6 (GPIO12)
SPI SCK: D5 (GPIO14)
```

---

## 📝 Quick Notes Area

Use this space for your installation-specific notes:

```
Installation Date: ___________
Location: ___________
Admin Contact: ___________
WiFi Password Changed to: ___________
Motor 1 Dispenses: ___________
Motor 2 Dispenses: ___________
Special Instructions: 
_________________________
_________________________
_________________________
```

---

**For detailed information, see README.md**

**For parts list, see PARTS_LIST.md**

**For wiring, see wiring diagrams in README.md**
