# Parts List & Shopping Guide

## Required Components

### Main Components
| # | Component | Specification | Quantity | Est. Price (USD) |
|---|-----------|---------------|----------|------------------|
| 1 | ESP8266 NodeMCU | V3 or ESP-12E | 1 | $5-8 |
| 2 | MFRC522 RFID Reader | 13.56MHz with antenna | 1 | $3-5 |
| 3 | SD Card Module | SPI interface | 1 | $2-3 |
| 4 | LCD Display | 16x2 I2C (0x27) | 1 | $4-6 |
| 5 | Relay Module | 5V, 2-Channel | 1 | $3-5 |
| 6 | DC Motor | 12V with gearbox | 2 | $10-15 |
| 7 | Push Buttons | Momentary switch | 3 | $1-2 |
| 8 | RFID Cards/Tags | 13.56MHz ISO14443A | 10-20 | $5-10 |
| 9 | MicroSD Card | 4GB-32GB, Class 10 | 1 | $5-8 |
| 10 | Power Supply | 12V 2A adapter | 1 | $8-12 |
| 11 | Buck Converter | 12V to 5V, 3A | 1 | $3-5 |

### Accessories
| # | Component | Specification | Quantity |
|---|-----------|---------------|----------|
| 12 | Jumper Wires | Male-Female, 20cm | 20-30 |
| 13 | Breadboard | 830 points (optional) | 1 |
| 14 | Resistors | 10kΩ (pull-up) | 3 |
| 15 | Capacitors | 100µF, 25V (power filtering) | 2 |
| 16 | Enclosure | Plastic box, 20x15x8cm | 1 |
| 17 | PCB Board | Prototype board (optional) | 1 |
| 18 | Terminal Blocks | Screw terminals | 5-10 |
| 19 | Heat Shrink Tubing | Various sizes | 1 set |
| 20 | Zip Ties | Cable management | 10-20 |

**Total Estimated Cost:** $60-100 USD (depending on quality and location)

## Where to Buy

### Online Retailers
- **AliExpress** - Cheapest, longer shipping
- **Amazon** - Fast shipping, higher cost
- **eBay** - Good deals, varies by seller
- **Banggood** - Good selection
- **Local Electronics Store** - Immediate availability

### Specific Recommendations

#### RFID Module
- Look for: "MFRC522 RFID Kit with antenna"
- Should include: Reader + antenna + 2 cards + 1 key fob
- Frequency: 13.56MHz (NOT 125kHz)

#### SD Card Module
- Look for: "Micro SD Card Module SPI"
- Should support: 3.3V and 5V logic levels
- Includes level shifter for safety

#### ESP8266 NodeMCU
- Recommended: V3 or "CP2102" version
- Avoid: CH340G if you have driver issues
- Must have: USB port for programming

#### Motors
- Type: DC geared motor
- Voltage: 12V DC
- Speed: 60-100 RPM
- Torque: Depends on your vending mechanism

## Tools Required

### Essential Tools
- Soldering iron (40W or higher)
- Solder wire (lead-free recommended)
- Wire stripper/cutter
- Multimeter (for testing)
- Screwdriver set
- Hot glue gun

### Optional Tools
- Helping hands/PCB holder
- Desoldering pump
- Wire crimper
- Heat gun
- Label maker

## Assembly Tips

### Before You Start
1. ✅ Test each component individually
2. ✅ Install all software/libraries first
3. ✅ Have wiring diagram printed or on second screen
4. ✅ Organize workspace
5. ✅ Label all wires

### Component Testing Order
1. Upload basic sketch to ESP8266
2. Test LCD display (I2C scanner)
3. Test RFID reader (example sketch)
4. Test SD card module (CardInfo sketch)
5. Test relays with LED
6. Test motors with power supply
7. Combine all components

### Power Supply Considerations

#### Power Budget
```
Component         Current Draw
ESP8266           ~80-170mA (WiFi active)
LCD Display       ~20mA (backlight on)
RFID Reader       ~13-26mA (reading)
SD Card Module    ~20-100mA (writing)
Relays            ~70mA each
Motors            ~500mA-1A each

Total Peak: ~2.5A at 12V
```

#### Recommended Setup
```
Main Power: 12V 2A adapter
    ↓
    ├→ Buck Converter (12V → 5V)
    │     ↓
    │     ├→ ESP8266 (5V via USB)
    │     ├→ LCD Display (5V)
    │     ├→ RFID Reader (3.3V from ESP)
    │     ├→ SD Card Module (5V)
    │     └→ Relay Module (5V)
    │
    └→ Motors (12V direct from adapter)
```

## Alternative Components

### If Components Unavailable

#### ESP32 Instead of ESP8266
- More powerful, more pins
- Same code with minor changes:
  - Change `ESP8266WiFi.h` to `WiFi.h`
  - Change `ESP8266WebServer.h` to `WebServer.h`
  - Adjust pin numbers

#### 20x4 LCD Instead of 16x2
- More display space
- Change LCD initialization:
  ```cpp
  LiquidCrystal_I2C lcd(0x27, 20, 4);
  ```

#### Separate Relays
- Use 2x single channel relays
- Wire individually
- Same control logic

#### PN532 Instead of MFRC522
- Better performance
- Different library required
- Code modifications needed

## Component Quality Tips

### What to Check When Buying

#### ESP8266
- ✅ Should have USB port (not bare module)
- ✅ Includes CH340G or CP2102 chip
- ✅ Has voltage regulator onboard
- ❌ Avoid bare ESP-12E/F modules (needs external components)

#### RFID Reader
- ✅ Comes with cards/tags for testing
- ✅ Includes antenna (coil)
- ✅ Pin headers pre-soldered or included
- ❌ Check frequency matches (13.56MHz)

#### SD Card Module
- ✅ Has voltage regulator (3.3V/5V compatible)
- ✅ Includes level shifters
- ✅ Supports up to 32GB
- ❌ Some cheap modules fail with large cards

#### Relays
- ✅ Rated for your motor current
- ✅ Has LED indicators
- ✅ Optocoupler isolation
- ✅ Screw terminals (easier wiring)
- ❌ Check if active HIGH or LOW

## Safety Warnings

### Electrical Safety
⚠️ **DANGER: 12V motors can draw high current**
- Use proper wire gauge (18-22 AWG)
- Include fuse in motor circuit
- Ensure adequate ventilation
- Don't leave running unattended during testing

### Component Safety
⚠️ **CAUTION: Static can damage electronics**
- Ground yourself before handling
- Store in anti-static bags
- Don't touch component pins unnecessarily

### Mechanical Safety
⚠️ **WARNING: Moving parts can cause injury**
- Test motors in secured enclosure
- Keep fingers away from mechanism
- Use emergency stop button

## Quality Checklist

Before finalizing purchase:
- [ ] All components from reliable sellers
- [ ] Read reviews (4+ stars)
- [ ] Check return/warranty policy
- [ ] Verify specifications match requirements
- [ ] Compare prices across sellers
- [ ] Bundle purchases to save shipping
- [ ] Buy extra components (2-3 RFID readers, etc.)

## Storage & Organization

### Component Storage
- Use compartment box for small parts
- Label everything
- Keep anti-static bags
- Store in dry environment
- Organize by project

### Spare Parts Recommendation
Keep extras of:
- RFID reader (1 spare)
- Buttons (5 spares)
- Jumper wires (extra set)
- SD cards (1-2 spares)
- Fuses (5-10 spares)

## Next Steps After Purchase

1. **Verify Components**
   - Check all items received
   - Visual inspection for damage
   - Test with multimeter

2. **Organize Workspace**
   - Clear work area
   - Good lighting
   - Power nearby
   - Ventilation for soldering

3. **Install Software**
   - Arduino IDE
   - USB drivers
   - Required libraries

4. **Start Building**
   - Follow wiring diagram
   - Test each step
   - Document changes
   - Take photos

---

**Happy Building!** 🛠️

For questions or issues, refer to the main README.md file.
