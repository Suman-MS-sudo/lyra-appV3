# Wiring Diagram (ASCII Art)

## Complete System Wiring

```
                     ╔════════════════════════════════╗
                     ║      ESP8266 NodeMCU v3       ║
                     ║                                ║
                     ║  [3.3V] [GND] [RST] [EN]      ║
                     ║                                ║
   RFID RST ─────────║─ D3  (GPIO0)                  ║
   RFID SS ──────────║─ D4  (GPIO2)                  ║
   SPI SCK ──────────║─ D5  (GPIO14) ←───┐           ║
   SPI MOSI ─────────║─ D7  (GPIO13) ←───┼───┐       ║
   SPI MISO ─────────║─ D6  (GPIO12) ←───┼───┼───┐   ║
   SD Card CS ───────║─ D8  (GPIO15)     │   │   │   ║
   Relay 1 ──────────║─ D1  (GPIO5)      │   │   │   ║
   Relay 2 ──────────║─ D2  (GPIO4)      │   │   │   ║
   Reset Button ─────║─ D0  (GPIO16)     │   │   │   ║
   LCD SDA ──────────║─ D2  (GPIO4) *    │   │   │   ║
   LCD SCL ──────────║─ D1  (GPIO5) *    │   │   │   ║
   Select Btn 1 ─────║─ D5  (GPIO14) **  │   │   │   ║
   Select Btn 2 ─────║─ D6  (GPIO12) **  │   │   │   ║
                     ║                    │   │   │   ║
                     ║  [VIN] [GND] [3.3V] [5V]     ║
                     ╚════════════════════════════════╝
                          │     │      │      │
                          │     │      │      └──── 5V to peripherals
                          │     │      └──────────── 3.3V to RFID
                          │     └─────────────────── Common Ground
                          └───────────────────────── 5V Power Input

* Note: I2C pins are shared
** Note: Buttons use shared SPI pins when not in use

═══════════════════════════════════════════════════════════════════

                    MFRC522 RFID Module
               ┌─────────────────────────┐
               │  [SDA] [SCK] [MOSI]     │
               │    │     │      │       │
               │    │     │      │       │
               │  [MISO] [IRQ] [GND]     │
               │    │           │        │
               │    │           │        │
               │  [RST]       [3.3V]     │
               └─────────────────────────┘
                  │              │
                  │              │
        To D3 ────┘              └──── To 3.3V
        
═══════════════════════════════════════════════════════════════════

                    SD Card Module
               ┌─────────────────────────┐
               │  [CS] [SCK] [MOSI]      │
               │   │     │      │        │
               │   │     │      │        │
               │  [MISO] [VCC] [GND]     │
               └─────────────────────────┘
                   │      │     │
        To D8 ─────┘      │     └──── To GND
                          │
        To 5V or 3.3V ────┘

═══════════════════════════════════════════════════════════════════

                    LCD 16x2 I2C Display
               ┌─────────────────────────┐
               │                         │
               │   Lyra Enterprises      │
               │   M1:30  M2:25          │
               │                         │
               └─────────────────────────┘
                 │   │   │   │
               [GND][VCC][SDA][SCL]
                 │   │    │    │
                 │   │    │    └──── To D1 (GPIO5)
                 │   │    └───────── To D2 (GPIO4)
                 │   └────────────── To 5V
                 └────────────────── To GND

═══════════════════════════════════════════════════════════════════

                    2-Channel Relay Module
               ┌─────────────────────────┐
               │  [VCC] [GND] [IN1][IN2] │
               │    │     │     │    │   │
               │                         │
               │  [COM1][NO1][NC1]       │
               │  [COM2][NO2][NC2]       │
               └─────────────────────────┘
                    │     │              │
        To 5V ──────┘     │              └─── To D2 (Motor 2)
        To GND ───────────┘
        To D1 ──────────────── (Motor 1)

        Motor 1 Connection:
        12V+ ──→ COM1
        NO1  ──→ Motor1+
        Motor1- ──→ 12V GND

        Motor 2 Connection:
        12V+ ──→ COM2
        NO2  ──→ Motor2+
        Motor2- ──→ 12V GND

═══════════════════════════════════════════════════════════════════

                    Push Buttons
                    
        Reset Button:
        ┌────┬────┐
        │    │    │
        └────┴────┘
          │    │
          │    └──── To GND
          └───────── To D0

        Select Button 1:
        ┌────┬────┐
        │    │    │
        └────┴────┘
          │    │
          │    └──── To GND
          └───────── To D5

        Select Button 2:
        ┌────┬────┐
        │    │    │
        └────┴────┘
          │    │
          │    └──── To GND
          └───────── To D6

═══════════════════════════════════════════════════════════════════

                    Power Supply System
                    
        Wall Adapter (12V 2A)
              │
              ├──────────→ Buck Converter (12V → 5V, 3A)
              │                   │
              │                   ├──→ ESP8266 VIN (5V)
              │                   ├──→ LCD VCC (5V)
              │                   ├──→ Relay VCC (5V)
              │                   └──→ SD Card VCC (5V)
              │
              ├──────────→ Relay COM pins (12V)
              │
              └──────────→ Common Ground (all components)

        Note: ESP8266 has 3.3V regulator onboard
              3.3V output used for RFID module only

═══════════════════════════════════════════════════════════════════
```

## Pin Connection Table

### ESP8266 NodeMCU to RFID (MFRC522)
| MFRC522 Pin | NodeMCU Pin | GPIO | Notes |
|-------------|-------------|------|-------|
| SDA (SS)    | D4          | GPIO2 | Chip Select |
| SCK         | D5          | GPIO14 | Shared with SD |
| MOSI        | D7          | GPIO13 | Shared with SD |
| MISO        | D6          | GPIO12 | Shared with SD |
| IRQ         | Not connected | - | Optional |
| GND         | GND         | - | Common ground |
| RST         | D3          | GPIO0 | Reset pin |
| 3.3V        | 3.3V        | - | Power from ESP |

### ESP8266 NodeMCU to SD Card Module
| SD Module Pin | NodeMCU Pin | GPIO | Notes |
|---------------|-------------|------|-------|
| CS            | D8          | GPIO15 | Chip Select |
| SCK           | D5          | GPIO14 | Shared with RFID |
| MOSI          | D7          | GPIO13 | Shared with RFID |
| MISO          | D6          | GPIO12 | Shared with RFID |
| VCC           | 5V or 3.3V  | - | Check module specs |
| GND           | GND         | - | Common ground |

### ESP8266 NodeMCU to LCD (I2C)
| LCD Pin | NodeMCU Pin | GPIO | Notes |
|---------|-------------|------|-------|
| SDA     | D2          | GPIO4 | I2C Data |
| SCL     | D1          | GPIO5 | I2C Clock |
| VCC     | 5V          | - | Power |
| GND     | GND         | - | Ground |

### ESP8266 NodeMCU to Relays and Buttons
| Component | NodeMCU Pin | GPIO | Notes |
|-----------|-------------|------|-------|
| Relay 1 IN | D1        | GPIO5 | Motor 1 control |
| Relay 2 IN | D2        | GPIO4 | Motor 2 control |
| Reset Button | D0      | GPIO16 | With pull-up |
| Select Btn 1 | D5      | GPIO14 | With pull-up |
| Select Btn 2 | D6      | GPIO12 | With pull-up |

## SPI Bus Sharing

The RFID and SD Card modules share the SPI bus:
- **MOSI (D7)** - Master Out Slave In - shared
- **MISO (D6)** - Master In Slave Out - shared
- **SCK (D5)** - Serial Clock - shared
- **CS pins** - Separate for each device (D4 for RFID, D8 for SD)

Only one device communicates at a time, controlled by CS (Chip Select).

## Power Distribution Diagram

```
12V 2A Wall Adapter
        │
        ├─────────┬──────────┬──────────┬──────────┐
        │         │          │          │          │
        │    Buck Conv   Motor1    Motor2    Common GND
        │    (12V→5V)      via      via      for all
        │         │      Relay1    Relay2   components
        │         │
        │    ┌────┴────┬─────┬─────┬─────┬─────┐
        │    │         │     │     │     │     │
        │  ESP8266   LCD  Relay  SD   Other  
        │   (5V in)  (5V) Module Card         
        │    3.3V out           Module        
        │      │                              
        │   RFID Module                      
        │   (3.3V)                           
        │                                    
        └──────────────────────────────────→ Motors (12V)
```

## Component Specifications

### ESP8266 NodeMCU
- **Input Voltage:** 5V via micro USB or VIN pin
- **Operating Voltage:** 3.3V (internal regulation)
- **Digital I/O Pins:** 11 (GPIO0-GPIO16)
- **Analog Input:** 1 (A0, 0-3.3V)
- **Flash Memory:** 4MB

### MFRC522 RFID
- **Operating Voltage:** 3.3V
- **Operating Current:** 13-26mA
- **Idle Current:** 10-13mA
- **Frequency:** 13.56MHz
- **Reading Distance:** 0-6cm

### SD Card Module
- **Operating Voltage:** 3.3V-5V (with level shifter)
- **Operating Current:** 20-100mA
- **Interface:** SPI
- **Max Card Size:** 32GB (FAT32)

### 16x2 LCD I2C
- **Operating Voltage:** 5V
- **Operating Current:** 20mA (backlight off), 120mA (backlight on)
- **Interface:** I2C
- **Default Address:** 0x27 (or 0x3F)

### Relay Module (2-Channel)
- **Operating Voltage:** 5V
- **Coil Current:** 70mA per relay
- **Contact Rating:** 10A 250VAC / 10A 30VDC
- **Trigger:** Active HIGH or LOW (check module)

## Wiring Best Practices

### Signal Wires
- **Length:** Keep under 30cm when possible
- **Gauge:** 22-24 AWG for signal wires
- **Type:** Solid core for breadboard, stranded for permanent

### Power Wires
- **5V lines:** 20-22 AWG
- **12V motor lines:** 18-20 AWG
- **Ground:** Use thicker wire (18 AWG) for common ground

### Prevention Tips
1. **Double-check polarity** before powering on
2. **Use color coding**: Red=5V/12V, Black=GND, Others=signals
3. **Label all wires** with masking tape
4. **Test continuity** with multimeter
5. **Secure connections** with solder or screw terminals
6. **Add fuse** in 12V line (2A fast-blow)

## Troubleshooting Wiring Issues

### No Power
- Check 12V adapter output voltage
- Verify buck converter output (should be 5V)
- Measure ESP8266 VIN pin (should be 5V)
- Check all ground connections

### RFID Not Responding
- Verify 3.3V to RFID (NOT 5V!)
- Check all SPI connections (MOSI, MISO, SCK)
- Ensure RST pin connected to D3
- Measure with multimeter: SCK should show activity

### SD Card Fails
- Check CS pin connection (D8)
- Verify card formatted as FAT32
- Try different SD card
- Check module voltage (some need 5V, others 3.3V)

### LCD Not Displaying
- Run I2C scanner to find address (might be 0x3F instead of 0x27)
- Check SDA/SCL connections
- Verify 5V power to LCD
- Adjust contrast potentiometer

### Relays Not Switching
- Check IN1/IN2 connections
- Test relay with LED: Connect LED+resistor from IN pin to GND
- Verify relay type (active HIGH vs LOW)
- Check coil voltage rating (should be 5V)

### Motors Not Running
- Separate issue from relay: Does relay click?
- Check 12V supply to COM pins
- Verify motor connected to NO (Normally Open)
- Test motor directly with 12V

## Safety Warnings

⚠️ **WARNING:** High current can cause fire!
- Never exceed wire current ratings
- Use fuse protection for motors
- Ensure proper wire gauge for load
- No exposed high-current connections

⚠️ **CAUTION:** Wrong voltage damages components!
- RFID: 3.3V ONLY (not 5V)
- ESP8266: 5V to VIN or 3.3V to 3V3
- LCD: 5V required
- Always verify before connecting

⚠️ **NOTICE:** ESD can destroy electronics!
- Ground yourself before handling
- Avoid touching component pins
- Store in anti-static bags

## Testing Procedure

### Step 1: Power Test
1. Connect only power supply to buck converter
2. Measure output: Should be 5V ±0.2V
3. Connect ESP8266 to 5V
4. ESP should show LED when powered

### Step 2: Individual Components
1. Test LCD: Run I2C scanner sketch
2. Test RFID: Run DumpInfo example
3. Test SD: Run CardInfo example
4. Test Relays: Manually set pins HIGH/LOW

### Step 3: Integration
1. Connect all components
2. Upload code
3. Watch serial monitor for errors
4. Test each function systematically

### Step 4: Final Testing
1. Scan RFID card
2. Add card via web interface
3. Test vending cycle
4. Verify logging
5. Check motor operation

---

**For assembly help, take photos at each step for reference!**

**When in doubt, disconnect power before making changes.**

---

Last Updated: February 2026
Version: 1.0
