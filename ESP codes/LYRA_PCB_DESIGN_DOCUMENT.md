# LYRA VENDING MACHINE — IoT CONTROLLER BOARD
## Complete PCB Design Document v1.0
### Revision: 2026-07-01 | Author: Lyra Engineering

---

# TABLE OF CONTENTS

1. Product Overview
2. System Block Diagram
3. Complete Bill of Materials (BOM)
4. Schematic — Pin-by-Pin Connections
5. Display Board Design
6. PCB Layout Rules & Layer Stack
7. Power Architecture
8. Firmware Flashing Procedure
9. Test Points & Factory Test Plan
10. Mechanical & Enclosure Spec
11. Compliance & Certifications

---

---

# 1. PRODUCT OVERVIEW

## 1.1 Product Name
**Lyra IoT Controller Board — LCB-1.0**

## 1.2 Purpose
Single-board controller for Lyra smart vending machines. Manages:
- Online payment polling (Razorpay)
- Coin acceptor detection and recording
- Product dispensing (single motor)
- WiFi provisioning + Ethernet fallback
- Real-time stock tracking
- OTA firmware updates
- Serial display communication
- Offline transaction queue with auto-sync

## 1.3 Key Specifications

| Parameter        | Value                         |
|------------------|-------------------------------|
| Input Voltage    | 12V DC (from SMPS)            |
| 5V Rail          | 2A max                        |
| 3.3V Rail        | 800mA max                     |
| MCU              | ESP32-WROOM-32E (240MHz dual-core) |
| Connectivity     | WiFi 802.11 b/g/n + Ethernet 10/100 |
| Motor Output     | 12V DC, up to 1A continuous   |
| Operating Temp   | 0°C to 70°C                   |
| PCB Size         | 100mm × 80mm (suggested)      |
| PCB Layers       | 4-layer                       |
| Mounting         | M3 standoffs × 4 corners      |

---

---

# 2. SYSTEM BLOCK DIAGRAM

```
                    12V DC INPUT
                         │
              ┌──────────▼──────────┐
              │   Fuse (2A) + TVS   │
              └──────────┬──────────┘
                         │
           ┌─────────────▼─────────────┐
           │      POWER SECTION        │
           │  MP2307DN (12V→5V Buck)   │
           │  AP2112K-3.3 (5V→3.3V)   │
           └──┬───────────┬────────────┘
              │5V         │3.3V
    ┌─────────▼─────┐  ┌──▼──────────────────────────────────┐
    │  Motor Driver │  │         ESP32-WROOM-32E               │
    │  ULN2003ADR   │  │  WiFi / BLE / Dual-core 240MHz       │
    └─────┬─────────┘  └──┬────┬────┬────┬────┬────┬─────────┘
          │Motor          │SPI │I2C │TX2 │RX2 │GPIO│GPIO
          │               │    │    │    │    │    │
     ┌────▼────┐    ┌─────▼──┐ │   ┌▼────▼──┐ │   │
     │ Motor   │    │ W5500  │ │   │ Serial │ │   │
     │ (12V DC)│    │Ethernet│ │   │Display │ │   │
     └─────────┘    └───┬────┘ │   │ Board  │ │   │
                        │RJ45  │   └────────┘ │   │
                   ┌────▼────┐ │           ┌──▼─┐ │
                   │RJ45 Jack│ │           │Coin│ │
                   │w/ Magnetics│          │Pin │ │
                   └─────────┘ │           └────┘ │
                           ┌───▼────┐         ┌───▼──┐
                           │AT24C256│         │Buttons│
                           │ EEPROM │         │Reset/ │
                           │ (I2C)  │         │WiFi   │
                           └────────┘         └───────┘
```

---

---

# 3. COMPLETE BILL OF MATERIALS (BOM)

## 3.1 Main Components

| Ref  | Component            | Part Number            | Value/Spec           | Package     | Qty | Supplier  | LCSC #    | Est. Unit Price |
|------|----------------------|------------------------|----------------------|-------------|-----|-----------|-----------|-----------------|
| U1   | MCU Module           | ESP32-WROOM-32E-N4     | ESP32, 4MB Flash     | SMD Module  | 1   | LCSC      | C473012   | ₹250            |
| U2   | Ethernet Controller  | W5500                  | 10/100 Mbps, SPI     | LQFP-48     | 1   | LCSC      | C32843    | ₹120            |
| U3   | Buck Converter       | MP2307DN               | 12V→5V, 3A           | SOIC-8      | 1   | LCSC      | C14861    | ₹35             |
| U4   | LDO 3.3V             | AP2112K-3.3TRG1        | 5V→3.3V, 600mA       | SOT-23-5    | 1   | LCSC      | C51118    | ₹8              |
| U5   | Motor Driver         | ULN2003ADR             | 7× Darlington, 500mA | SOIC-16     | 1   | LCSC      | C5440     | ₹15             |
| U6   | EEPROM               | AT24C256C-SSHL-T       | 256Kbit I2C, 32KB    | SOIC-8      | 1   | LCSC      | C6084     | ₹18             |
| U7   | Reset Supervisor     | MCP101T-315I/TT        | 3.15V reset, ACTIVE-LOW | SOT-23  | 1   | LCSC      | C150567   | ₹12             |
| U8   | USB-UART (optional)  | CP2102N-A02-GQFN24R    | USB→UART, for prog   | QFN-24      | 1   | LCSC      | C964632   | ₹55             |

## 3.2 Passive Components — Resistors

| Ref         | Value  | Tolerance | Package | Qty | Notes                             |
|-------------|--------|-----------|---------|-----|-----------------------------------|
| R1          | 10kΩ   | 1%        | 0402    | 1   | GPIO0 pull-up (boot mode)         |
| R2          | 10kΩ   | 1%        | 0402    | 1   | EN pull-up (reset)                |
| R3          | 10kΩ   | 1%        | 0402    | 1   | W5500 SCSn pull-up                |
| R4          | 12.4kΩ | 1%        | 0402    | 1   | MP2307 feedback (output voltage)  |
| R5          | 3.74kΩ | 1%        | 0402    | 1   | MP2307 feedback divider           |
| R6          | 100kΩ  | 1%        | 0402    | 1   | MP2307 frequency set              |
| R7          | 330Ω   | 5%        | 0402    | 1   | Blue status LED current limit     |
| R8          | 330Ω   | 5%        | 0402    | 1   | Green power LED current limit     |
| R9          | 100Ω   | 5%        | 0402    | 1   | Coin pin series protection        |
| R10         | 4.7kΩ  | 1%        | 0402    | 1   | I2C SDA pull-up (AT24C256)        |
| R11         | 4.7kΩ  | 1%        | 0402    | 1   | I2C SCL pull-up (AT24C256)        |
| R12         | 10kΩ   | 1%        | 0402    | 1   | WiFi reset button pull-up         |
| R13         | 10kΩ   | 1%        | 0402    | 1   | Stock reset button pull-up        |
| R14         | 12.4kΩ | 1%        | 0402    | 1   | W5500 REXT (25MHz timing)         |
| R15, R16    | 49.9Ω  | 1%        | 0402    | 2   | W5500 TPTX+/- series termination  |

## 3.3 Passive Components — Capacitors

| Ref            | Value   | Voltage | Type         | Package | Qty | Notes                              |
|----------------|---------|---------|--------------|---------|-----|------------------------------------|
| C1             | 100µF   | 25V     | Electrolytic | SMD-D8  | 1   | 12V input bulk cap                 |
| C2             | 10µF    | 25V     | Ceramic X5R  | 0805    | 1   | 12V input decoupling               |
| C3             | 100nF   | 25V     | Ceramic X7R  | 0402    | 2   | 12V bypass caps                    |
| C4             | 100µF   | 16V     | Electrolytic | SMD-D8  | 1   | 5V output bulk cap                 |
| C5             | 10µF    | 10V     | Ceramic X5R  | 0805    | 2   | 5V decoupling                      |
| C6             | 100nF   | 10V     | Ceramic X7R  | 0402    | 4   | 5V bypass (1 per IC on 5V)         |
| C7             | 100µF   | 10V     | Electrolytic | SMD-D6  | 1   | 3.3V output bulk cap               |
| C8             | 10µF    | 10V     | Ceramic X5R  | 0805    | 2   | 3.3V decoupling                    |
| C9             | 100nF   | 10V     | Ceramic X7R  | 0402    | 8   | 3.3V bypass (1 per IC on 3.3V)     |
| C10            | 22µF    | 10V     | Ceramic X5R  | 0805    | 2   | W5500 VCC decoupling (sensitive)   |
| C11            | 100nF   | 10V     | Ceramic X7R  | 0402    | 1   | W5500 AVDD analog decoupling       |
| C12, C13       | 22pF    | 50V     | Ceramic C0G  | 0402    | 2   | Crystal load caps (25MHz)          |
| C14            | 10µF    | 16V     | Ceramic X5R  | 0805    | 1   | Motor driver bypass                |
| C15            | 100nF   | 50V     | Ceramic X7R  | 0402    | 1   | Coin pin RC filter                 |
| C16            | 4.7µF   | 10V     | Ceramic X5R  | 0805    | 1   | USB 5V bypass (if CP2102 used)     |

## 3.4 Passive Components — Inductors & Transformers

| Ref  | Value  | Current | Package | Qty | Notes                             |
|------|--------|---------|---------|-----|-----------------------------------|
| L1   | 22µH   | 2A      | SMD-6x6 | 1  | MP2307 buck inductor (MATS2520)   |

## 3.5 Semiconductors — Diodes

| Ref   | Part        | Spec           | Package | Qty | Notes                            |
|-------|-------------|----------------|---------|-----|----------------------------------|
| D1    | SS14        | 40V, 1A Schottky | SMA   | 1   | MP2307 catch diode               |
| D2    | SS14        | 40V, 1A Schottky | SMA   | 1   | Motor flyback protection         |
| D3    | BZX84C3V9   | 3.9V Zener, 300mW | SOT-23| 1 | Coin pin overvoltage clamp       |
| D4    | PRTR5V0U2X  | 5V TVS, dual   | SOT-363 | 1  | USB D+/D- ESD protection         |
| D5    | SMAJ12A     | 12V TVS, 400W  | SMA     | 1  | 12V input transient protection   |
| LED1  | LTST-C171KGKT | Green, 20mA | 0603   | 1   | Power-on LED                     |
| LED2  | LTST-C171TBKT | Blue, 20mA  | 0603   | 1   | WiFi/Status LED (GPIO2)          |

## 3.6 Connectors

| Ref   | Component                  | Part Number          | Pins | Qty | Notes                             |
|-------|----------------------------|----------------------|------|-----|-----------------------------------|
| J1    | DC Power Jack (barrel)     | PJ-102AH             | 2    | 1   | 5.5mm/2.1mm, 12V input           |
| J2    | RJ45 MagJack w/ LED        | HR961160C            | 8+2  | 1   | Integrated 10/100 magnetics      |
| J3    | Display UART Header        | —                    | 4    | 1   | 2.54mm, TX/RX/3.3V/GND          |
| J4    | Motor Output Screw Term.   | KF2EDGK-3.81-2P      | 2    | 1   | 3.81mm pitch, 12V motor          |
| J5    | Coin Acceptor Header       | —                    | 3    | 1   | 2.54mm, SIG/5V/GND               |
| J6    | Programming Header (UART)  | —                    | 6    | 1   | 2.54mm, GND/3V3/TX/RX/EN/GPIO0   |
| J7    | WiFi Reset Button          | —                    | 2    | 1   | Tactile switch or header         |
| J8    | Stock Reset Button         | —                    | 2    | 1   | Tactile switch or header         |
| J9    | USB Micro-B (optional)     | Amphenol 10118194    | 5    | 1   | CP2102N USB programming          |
| J10   | JTAG Header (optional)     | —                    | 10   | 1   | 2.54mm, for debug                |

## 3.7 Crystals & Oscillators

| Ref  | Value  | Load Cap | Package | Qty | Notes                        |
|------|--------|----------|---------|-----|------------------------------|
| Y1   | 25MHz  | 20pF     | SMD-3225| 1   | W5500 PHY reference crystal  |

## 3.8 Buttons

| Ref   | Component         | Part Number     | Qty | Notes               |
|-------|-------------------|-----------------|-----|---------------------|
| SW1   | Tactile Switch    | TS-1187A-B-A    | 1   | WiFi reset (GPIO4)  |
| SW2   | Tactile Switch    | TS-1187A-B-A    | 1   | Stock reset (GPIO21)|

---

---

# 4. SCHEMATIC — PIN-BY-PIN CONNECTIONS

## 4.1 ESP32-WROOM-32E Pin Map

```
ESP32 Module Pin      GPIO    Connected To
─────────────────────────────────────────────────────────
GND                   —       GND plane (multiple vias)
3V3                   —       3.3V rail (via C8 bypass)
EN                    —       R2 (10k) → 3.3V + MCP101T output
GPIO0 / BOOT          0       R1 (10k) → 3.3V; J6 pin 6
GPIO2 / BLUE_LED      2       R7 (330Ω) → LED2 (Blue) → GND
GPIO4 / WIFI_RST_BTN  4       R12 (10k) → 3.3V; SW1 → GND
GPIO5 / TRANSISTOR    5       ULN2003 IN1 (motor control)
GPIO16 / UART2_RX     16      J3 pin 3 (Display TX)
GPIO17 / UART2_TX     17      J3 pin 2 (Display RX)
GPIO18 / SPI_SCK      18      W5500 SCLK
GPIO19 / SPI_MISO     19      W5500 MISO
GPIO21 / RESET_BTN    21      R13 (10k) → 3.3V; SW2 → GND
GPIO22 / ETH_CS       22      W5500 SCSn (active low)
GPIO23 / SPI_MOSI     23      W5500 MOSI
GPIO27 / COIN_PIN     27      R9 (100Ω) → Coin SIG; D3 clamp → GND
GPIO33 / W5500_RST    33      W5500 RSTn (active low reset)
GPIO34 / W5500_INT    34      W5500 INTn (interrupt, optional)
TX0                   1       J6 pin 4 (programming)
RX0                   3       J6 pin 3 (programming)
─────────────────────────────────────────────────────────
```

## 4.2 W5500 Ethernet Controller (LQFP-48)

```
W5500 Pin    Name      Connected To
──────────────────────────────────────────────────────────
Pin 1        MOSI      ESP32 GPIO23
Pin 2        MISO      ESP32 GPIO19
Pin 3        SCLK      ESP32 GPIO18
Pin 4        SCSn      ESP32 GPIO22 (R3 10k pull-up to 3.3V)
Pin 5        INTn      ESP32 GPIO34 (R pull-up 10k → 3.3V)
Pin 6        RSTn      ESP32 GPIO33 (R pull-up 10k → 3.3V)
Pin 7        REXT      R14 (12.4kΩ) → GND
Pin 8        AVDD      3.3V (C11 100nF close to pin)
Pin 9        AGND      GND (analog ground — direct, no via)
Pin 10-13    TPTX+/-   RJ45 J2 pins via magnetics
Pin 14-17    TPRX+/-   RJ45 J2 pins via magnetics
Pin 18       LED_LINK  RJ45 LED1 (green, via 330Ω)
Pin 19       LED_SPD   RJ45 LED2 (yellow, via 330Ω)
Pin 36       XTAL1     Y1 crystal pin 1 (+ C12 22pF → GND)
Pin 37       XTAL2     Y1 crystal pin 2 (+ C13 22pF → GND)
Pin 40-48    VCC       3.3V (C10 22µF + 100nF per pair)
Pin 20-28    GND       GND plane
──────────────────────────────────────────────────────────
```

## 4.3 MP2307DN Buck Converter (12V → 5V)

```
MP2307DN Pin   Name     Connected To
────────────────────────────────────────────────────────
Pin 1          BST      C_boost (100nF) → SW pin
Pin 2          VIN      12V input (C1 100µF, C2 10µF, C3 100nF)
Pin 3          SW       L1 (22µH) → 5V output; D1 cathode
Pin 4          GND      Power GND
Pin 5          FB       R4/R5 divider (R4=12.4kΩ top, R5=3.74kΩ bottom)
Pin 6          SD       3.3V (enable always-on); 10k pull-up
Pin 7          RT       R6 (100kΩ) → GND (sets ~350kHz)
Pin 8          COMP     C_comp (100pF + 10kΩ in series) → GND

D1 (SS14):     Cathode → SW node; Anode → GND
L1 (22µH):     Pin A → SW node; Pin B → 5V output
Output:        5V rail with C4 (100µF) + C5 (10µF) + C6 (100nF)

Feedback formula:
  VOUT = 0.925 × (1 + R4/R5)
  5V = 0.925 × (1 + 12400/3740) = 5.0V ✓
────────────────────────────────────────────────────────
```

## 4.4 AP2112K-3.3 LDO (5V → 3.3V)

```
AP2112K Pin   Name     Connected To
────────────────────────────────────────────
Pin 1         GND      GND
Pin 2         VIN      5V rail
Pin 3         EN       5V rail (always enabled)
Pin 4         GND      GND
Pin 5         VOUT     3.3V rail
                       C7 (100µF) + C8 (10µF) output caps
────────────────────────────────────────────
```

## 4.5 ULN2003ADR Motor Driver (SOIC-16)

```
ULN2003 Pin   Name     Connected To
──────────────────────────────────────────────────
Pin 1  (IN1)  IN1      ESP32 GPIO5
Pin 2-7       IN2-7    GND (unused channels)
Pin 8         GND      GND
Pin 9  (COM)  COM      12V rail (motor supply + D2 flyback)
Pin 10 (OUT1) OUT1     Motor terminal B (-); J4 pin 1
Pin 11-16     OUT2-7   Not connected
Motor:        Terminal A (+) → 12V (J4 pin 2)
              Terminal B (−) → OUT1 (J4 pin 1)
D2 (SS14):    Across motor terminals (A=cathode, B=anode)
──────────────────────────────────────────────────
```

## 4.6 AT24C256 EEPROM (I2C)

```
AT24C256 Pin   Name    Connected To
──────────────────────────────────────────────────
Pin 1  (A0)   A0       GND (address 0x50)
Pin 2  (A1)   A1       GND
Pin 3  (A2)   A2       GND
Pin 4  (GND)  GND      GND
Pin 5  (SDA)  SDA      ESP32 GPIO21 (R10 4.7k pull-up to 3.3V)
Pin 6  (SCL)  SCL      ESP32 GPIO22 (R11 4.7k pull-up to 3.3V)
Pin 7  (WP)   WP       GND (write always enabled)
Pin 8  (VCC)  VCC      3.3V + 100nF bypass
──────────────────────────────────────────────────
Note: I2C address = 0x50 (A2=0, A1=0, A0=0)
```

## 4.7 MCP101T Reset Supervisor

```
MCP101T Pin   Name     Connected To
──────────────────────────────────────────
Pin 1         GND      GND
Pin 2         RESET    ESP32 EN pin
Pin 3         VDD      3.3V
──────────────────────────────────────────
Active-LOW output: holds EN low until 3.3V stable.
No external caps needed.
```

## 4.8 Power Connector (J1 — 12V Input)

```
J1 Pin 1 (center/+)  →  D5 (TVS SMAJ12A) → 12V rail
J1 Pin 2 (sleeve/−)  →  Power GND
Fuse F1 (2A, SMD)    →  Series between J1 and 12V rail
```

## 4.9 Programming Header (J6 — 6-pin 2.54mm)

```
J6 Pin   Signal    ESP32 / Purpose
──────────────────────────────────────────────
Pin 1    GND       GND
Pin 2    3V3       3.3V (output, to power programmer)
Pin 3    TX0       ESP32 GPIO1 (connect to programmer RX)
Pin 4    RX0       ESP32 GPIO3 (connect to programmer TX)
Pin 5    EN        ESP32 EN pin (DTR from CP2102N)
Pin 6    GPIO0     ESP32 GPIO0 boot mode (RTS from CP2102N)
──────────────────────────────────────────────
To enter download mode:
  - Pull GPIO0 LOW while pulsing EN LOW→HIGH
  - CP2102N DTR/RTS auto-reset circuit handles this
```

## 4.10 Display Header (J3 — 4-pin 2.54mm)

```
J3 Pin   Signal    Connected To
──────────────────────────────────────────
Pin 1    GND       GND
Pin 2    3V3       3.3V
Pin 3    TX        ESP32 GPIO17 (UART2 TX → Display RX)
Pin 4    RX        ESP32 GPIO16 (UART2 RX ← Display TX)
──────────────────────────────────────────
Baud Rate: 115200, 8N1
```

## 4.11 Coin Acceptor Header (J5 — 3-pin 2.54mm)

```
J5 Pin   Signal    Connected To
──────────────────────────────────────────
Pin 1    5V        5V rail (powers acceptor)
Pin 2    SIG       R9 (100Ω) → ESP32 GPIO27
                   D3 (3.9V Zener) → GND (voltage clamp)
                   C15 (100nF) → GND (debounce)
Pin 3    GND       GND
──────────────────────────────────────────
Coin acceptor outputs 5V pulse when coin detected.
RC + Zener clamp protects ESP32 (max 3.6V on GPIO).
```

## 4.12 RJ45 MagJack (J2 — HR961160C)

```
HR961160C Pin     Connected To
──────────────────────────────────────────────────
TX+               W5500 TPTX+ (via integrated magnetics)
TX-               W5500 TPTX- (via integrated magnetics)
RX+               W5500 TPRX+ (via integrated magnetics)
RX-               W5500 TPRX- (via integrated magnetics)
SHIELD            PCB chassis GND (separate pour)
LED_GREEN (LINK)  W5500 LED_LINK → R (330Ω) → 3.3V
LED_YELLOW (ACT)  W5500 LED_SPD  → R (330Ω) → 3.3V
CT (center tap)   Connect to GND via 75Ω (×2, for RX and TX)
──────────────────────────────────────────────────
Note: HR961160C has INTEGRATED magnetics and LEDs.
No separate Bob Smith termination needed.
```

---

---

# 5. DISPLAY BOARD DESIGN

## 5.1 Display Communication Protocol

The ESP32 sends single ASCII character codes over UART2 (115200 baud, 8N1):

| Code | Screen Shown         | Triggered When                         |
|------|----------------------|----------------------------------------|
| "0"  | Boot / Initializing  | Startup                                |
| "1"  | Thank You!           | After dispense success                 |
| "2"  | Ready / Scan QR      | Network connected, stock > 0           |
| "3"  | Dispensing...        | Motor activating                       |
| "4"  | Coin Received        | Coin pulse detected                    |
| "5"  | Please Take Item     | After motor stops                      |
| "6"  | No Internet          | Network disconnected                   |
| "8"  | Stock Refilled       | Reset button pressed                   |
| "9"  | Out of Stock         | Stock = 0                              |

## 5.2 Display Hardware Options

### Option A — Nextion HMI Display (Recommended)
**Part**: Nextion NX3224T028 (2.8" 320×240 TFT, serial HMI)
- Built-in ARM MCU, handles all graphics
- 4-pin UART connection (TX, RX, 5V, GND)
- Drag-and-drop UI design via Nextion Editor (free)
- No display driver code needed on ESP32
- **UART**: 9600 baud default (configurable)

**Nextion Page Setup** (in Nextion Editor):
```
Page 0: Boot screen        → Show "Lyra" logo
Page 1: Thank You          → Green background, "Thank You!"
Page 2: Ready/QR           → White bg, QR code image + "Scan to Pay"
Page 3: Dispensing         → Animation, "Please Wait..."
Page 4: Coin Received      → "₹5 Coin Received"
Page 5: Please Take        → "Please Take Your Item"
Page 6: No Internet        → Red bg, WiFi icon crossed
Page 8: Refilled           → "Stock Refilled!"
Page 9: Out of Stock       → "Out of Stock" red screen

// In each page's "Preinitialize Event":
// No code needed — ESP32 sends page number over UART
```

**ESP32 code change for Nextion**:
```cpp
// Replace Serial2.print("2") with:
Serial2.print("page 2");  // Nextion command
Serial2.print("\xFF\xFF\xFF");  // Nextion terminator (3x 0xFF)
```

### Option B — 128×64 OLED (I2C) — Lower Cost
**Part**: SSD1306, 0.96" OLED, I2C address 0x3C
- Connect SDA → GPIO21, SCL → GPIO22 (shared with EEPROM, different address)
- Library: `Adafruit_SSD1306`
- Monochrome, good in low light

### Option C — 3.5" ILI9488 SPI TFT (Best Visual)
**Part**: ILI9488 320×480 TFT with touch
- SPI connected (separate CS from W5500)
- Full color, high resolution, touch input for future use
- ESP32 SPI2 bus (separate from Ethernet SPI1 bus)

**For this document we use Option A (Nextion) as the standard.**

## 5.3 Display Board Connector on Main PCB

J3 carries the display connection. Recommended cable: **JST-PH 4-pin** or **Dupont 2.54mm** with locking.

---

---

# 6. PCB LAYOUT RULES & LAYER STACK

## 6.1 Layer Stack (4-layer)

```
Layer 1 (TOP):    Signal + Components
                  ├─ ESP32 module
                  ├─ W5500 + crystal
                  ├─ Power ICs (buck, LDO)
                  └─ Decoupling caps close to IC pins

Layer 2 (GND):    Solid GND plane (no splits except chassis GND under RJ45)
                  ├─ Unbroken copper pour
                  └─ Chassis GND island under RJ45 connector

Layer 3 (PWR):    Power planes
                  ├─ 5V pour (left half)
                  └─ 3.3V pour (right half)

Layer 4 (BOT):    Signal routing (low frequency)
                  ├─ Motor drive traces
                  ├─ Button lines
                  └─ Fill remaining with GND
```

## 6.2 Critical Design Rules

### ESP32 Module
- Keep antenna area (end of module) clear of copper on ALL layers
- Antenna keepout zone: 3mm on each side, extending 5mm from module end
- Use castellated SMD pads — do not use through-hole sockets
- Minimum pad size: 2.0mm × 0.6mm per castellated pad
- Add mounting pads or apply PCB paste under module (thermal pad optional)

### W5500 Ethernet
- Place W5500 as close to RJ45 jack as possible (target < 15mm)
- TX+/TX- and RX+/RX- are differential pairs — route as 100Ω differential impedance traces
  - For 4-layer with 0.2mm prepreg: trace width 0.127mm, gap 0.127mm
- Matching: length-match TX+ and TX- within 0.1mm
- Crystal (Y1) must be within 10mm of W5500 XTAL pins
- C12/C13 (crystal load caps) placed within 3mm of crystal pins
- REXT resistor (R14) within 5mm of pin 7

### Power Section (MP2307DN)
- Buck converter is a noise source — place away from ESP32 antenna
- L1 inductor, D1 diode, and C4 output cap must form a tight triangle
- Keep switching node (SW pin → L1 → D1) trace short and wide (1.5mm min)
- Keep feedback network (R4, R5) away from SW node — route on bottom layer

### Motor Driver (ULN2003)
- Motor traces must be 1.5mm wide (carries up to 1A)
- D2 flyback diode placed directly across J4 motor screw terminal
- Keep motor traces away from SPI traces

### SPI Bus (ESP32 → W5500)
- Route SPI traces direct, no vias if possible
- Target 50Ω single-ended trace impedance
- For FR4, 4-layer, 0.2mm dielectric: width = ~0.36mm
- Keep SCK, MOSI, MISO, CS length-matched within 5mm

### I2C Bus (ESP32 → AT24C256)
- I2C is slow (400kHz max) — not critical, just keep < 50mm
- R10/R11 pull-ups placed near the ESP32 end of traces

### General Rules

| Parameter                  | Value                |
|----------------------------|----------------------|
| Minimum trace width        | 0.127mm (signal)     |
| Power traces               | 0.5mm (3.3V), 1.0mm (5V), 1.5mm (12V/Motor) |
| Minimum clearance          | 0.127mm              |
| Minimum drill (via)        | 0.3mm drill, 0.5mm pad |
| Minimum drill (component)  | 0.8mm                |
| Silkscreen min text height | 0.8mm                |
| Solder mask expansion      | 0.05mm               |
| Copper weight              | 1oz outer, 0.5oz inner |
| Board material             | FR4 Tg 150°C         |
| Board thickness            | 1.6mm                |
| Surface finish             | HASL-LF or ENIG      |

## 6.3 Component Placement Priority

Place in this order to avoid rework:

```
1. RJ45 Jack (J2)          → Fix to board edge first
2. W5500 (U2)              → As close to J2 as possible
3. Crystal Y1              → Adjacent to W5500
4. ESP32 Module (U1)       → Center of board, antenna toward edge
5. Buck Converter (U3)     → Near power input (J1), far from antenna
6. LDO (U4)                → Between buck output and ESP32
7. ULN2003 (U5)            → Near motor connector (J4)
8. AT24C256 (U6)           → Near ESP32 I2C pins
9. MCP101T (U7)            → Near ESP32 EN pin
10. All connectors (J1-J10) → Board edge, aligned to panel
11. Buttons (SW1, SW2)     → Panel-accessible or header
12. LEDs (LED1, LED2)      → Panel-visible or header
```

## 6.4 Silkscreen & Fabrication Notes

- Mark all connector pin 1 with triangle or dot
- Mark J4 motor polarity (+ / −)
- Mark J5 coin pin polarity
- Mark J6 programming header with "PROG" label
- Board name + revision on silkscreen: "LCB-1.0 | 2026"
- Mark test points TP1–TP10
- Mark antenna keepout zone with silkscreen boundary

---

---

# 7. POWER ARCHITECTURE

## 7.1 Power Budget

| Rail   | Consumer              | Current  |
|--------|-----------------------|----------|
| 3.3V   | ESP32 (WiFi TX)       | 350mA peak |
| 3.3V   | W5500                 | 130mA    |
| 3.3V   | AT24C256              | 5mA      |
| 3.3V   | LEDs (×2 @ 10mA)      | 20mA     |
| **3.3V Total**          |          | **~510mA** |
| 5V     | AP2112K input         | 510mA (→3.3V) |
| 5V     | Coin Acceptor         | 50mA     |
| 5V     | CP2102N (if used)     | 30mA     |
| **5V Total**            |          | **~600mA** |
| 12V    | Motor (stall)         | 800mA    |
| 12V    | Buck converter input  | 350mA    |
| **12V Total**           |          | **~1.15A** |

**Recommended SMPS**: 12V 2A (24W) — gives 40% headroom.

## 7.2 Power Sequencing

```
12V ON
  └─> D5 (TVS) clamps transients
  └─> F1 (2A fuse) protects board
  └─> MP2307DN → 5V (within 5ms)
        └─> AP2112K → 3.3V (within 1ms)
              └─> MCP101T monitors 3.3V
                    └─> EN released when 3.3V > 3.15V
                          └─> ESP32 boots (takes ~300ms)
```

---

---

# 8. FIRMWARE FLASHING PROCEDURE

## 8.1 First-Time Flash (via Programming Header J6)

**Hardware needed**: USB-to-UART adapter (CP2102N breakout, 3.3V logic)

```
Programmer   →   PCB J6
─────────────────────────
GND          →   Pin 1 (GND)
3V3          →   Not connected (PCB self-powered)
RXD          →   Pin 3 (ESP32 TX)
TXD          →   Pin 4 (ESP32 RX)
DTR          →   Pin 5 (EN)
RTS          →   Pin 6 (GPIO0)
```

**Steps**:
1. Apply 12V power to J1
2. Connect USB-UART to J6
3. Open Arduino IDE → Select board: `ESP32 Dev Module`
4. Select correct COM port
5. Click Upload — CP2102N auto-resets into bootloader
6. Watch serial monitor at 115200 baud for boot log

## 8.2 OTA Flash (Over WiFi — after first flash)

```cpp
// Already in your code:
ArduinoOTA.setHostname(("Lyra-" + machineName).c_str());
ArduinoOTA.setPassword("lyra2024");
ArduinoOTA.begin();
```

Use Arduino IDE → Ports → Network Ports → Select `Lyra-MachineName`

## 8.3 Arduino IDE Settings

```
Board:           ESP32 Dev Module
Upload Speed:    921600
CPU Frequency:   240MHz (WiFi/BT)
Flash Frequency: 80MHz
Flash Mode:      DIO
Flash Size:      4MB (32Mb)
Partition Scheme: Default 4MB with spiffs
Core Debug Level: None
PSRAM:           Disabled
```

## 8.4 Required Libraries

Install via Arduino Library Manager:

| Library            | Version | Purpose                     |
|--------------------|---------|-----------------------------|
| ArduinoJson        | 6.x     | JSON parsing                |
| Ethernet (Wiznet)  | 2.0.x   | W5500 Ethernet driver       |
| ArduinoOTA         | Built-in| OTA firmware updates        |
| WebServer          | Built-in| WiFi provisioning portal    |
| EEPROM             | Built-in| Flash emulated EEPROM       |
| AT24CX             | 1.0.x   | External EEPROM (AT24C256)  |

---

---

# 9. TEST POINTS & FACTORY TEST PLAN

## 9.1 Test Points (Label on Silkscreen)

| TP   | Net      | Location                   | Expected Value    |
|------|----------|----------------------------|-------------------|
| TP1  | 12V      | Near J1                    | 12.0V ± 5%        |
| TP2  | 5V       | MP2307DN output            | 5.0V ± 2%         |
| TP3  | 3.3V     | AP2112K output             | 3.3V ± 2%         |
| TP4  | ESP32_TX | GPIO1                      | 3.3V UART pulses  |
| TP5  | ESP32_RX | GPIO3                      | 3.3V UART pulses  |
| TP6  | ETH_SCK  | GPIO18 / W5500 SCLK        | SPI clock signal  |
| TP7  | MOTOR_OUT| ULN2003 OUT1               | 0V (off) / 12V (on)|
| TP8  | COIN_SIG | GPIO27 (after R9)          | 3.3V (idle)       |
| TP9  | GND      | Ground reference           | 0V                |
| TP10 | W5500_RST| GPIO33                     | 3.3V (running)    |

## 9.2 Factory Test Sequence

```
Step 1: Visual Inspection
  □ All components populated
  □ No solder bridges
  □ Connectors aligned

Step 2: Power-On Test
  □ Apply 12V → measure TP1 (12V), TP2 (5V), TP3 (3.3V)
  □ Check LED1 (green power LED) lit
  □ No excessive heat on U3, U4

Step 3: Flash Firmware
  □ Connect programmer to J6
  □ Flash LCB-1.0 firmware via Arduino IDE
  □ Verify serial output on COM port

Step 4: WiFi Test
  □ Boot → provisioning mode active
  □ Scan for SSID "ESP32_WIFI" on phone
  □ LED2 (blue) blinks in provisioning

Step 5: Ethernet Test
  □ Connect Ethernet cable to J2
  □ LEDs on RJ45 (green = link, yellow = activity)
  □ Serial log shows: "✅ IP validated - Ethernet ready!"

Step 6: Motor Test
  □ Connect 12V DC motor to J4
  □ Send "dispense" command via serial monitor
  □ Motor runs for 2830ms and stops

Step 7: Coin Test
  □ Short J5 pin 2 to GND momentarily
  □ Serial log shows: "💰 Coin detected"

Step 8: Display Test
  □ Connect Nextion to J3
  □ Verify page changes match serial commands

Step 9: OTA Test
  □ Connect to WiFi
  □ Upload test firmware via OTA
  □ Verify update completes and device reboots
```

---

---

# 10. MECHANICAL & ENCLOSURE SPEC

## 10.1 PCB Dimensions

```
Board size:       100mm × 80mm
Corner radius:    2mm (R2)
Mounting holes:   M3, 3.2mm drill
                  4 corners, 4mm from each edge
Connector clearance: All connectors on left/right/bottom edge
Antenna clearance:   Top-right corner (ESP32 antenna faces top edge)
```

## 10.2 Suggested Enclosure

**Type**: DIN rail mount ABS enclosure
**Dimensions**: 112mm × 90mm × 40mm
**Ventilation**: None required (passively cooled below 70°C ambient)
**IP Rating**: IP40 (inside vending machine — protected from direct moisture)

## 10.3 Panel Cutouts (if mounted to panel)

| Feature              | Cutout Size         |
|----------------------|---------------------|
| DC Power Jack (J1)   | Ø 6.2mm hole        |
| RJ45 (J2)            | 16mm × 13.5mm rect  |
| Display FPC/cable    | 10mm × 3mm slot     |
| Status LEDs          | Ø 3mm × 2 holes     |
| Programming header   | No cutout (internal)|

---

---

# 11. COMPLIANCE & CERTIFICATIONS

## 11.1 Required for India (BIS)

| Standard           | Requirement                         |
|--------------------|-------------------------------------|
| IS 13252 (Part 1)  | IT equipment safety                 |
| IS 616             | Electronic equipment EMC            |
| BIS CRS            | Mandatory for electronic devices    |
| ESP32-WROOM-32E    | Already WPC/TRAI approved (pre-cert)|

## 11.2 EMC Tips to Pass Testing

- Add ferrite bead (600Ω @ 100MHz) on 12V input line before fuse
- Add 4.7µH common-mode choke on RJ45 TX/RX pairs (some MagJacks include this)
- Ground pour stitch vias every 3mm around board perimeter
- Keep switching frequency (350kHz from MP2307) harmonics suppressed with spread-spectrum option or post-filter

## 11.3 Safety

- F1 fuse (2A, 125V) is MANDATORY on 12V input line
- D5 TVS diode (SMAJ12A, 400W) protects against voltage spikes from motor switching
- Motor flyback diode D2 is mandatory — without it, back-EMF destroys the ULN2003

---

---

# APPENDIX A — QUICK REFERENCE PINOUT TABLE

```
ESP32 GPIO    Function              PCB Signal
──────────────────────────────────────────────────
GPIO 0        Boot mode             J6-6, R1→3.3V
GPIO 1        UART0 TX              J6-4 (programming)
GPIO 2        Blue LED              LED2 via R7
GPIO 3        UART0 RX              J6-3 (programming)
GPIO 4        WiFi Reset Button     SW1 → GND, R12→3.3V
GPIO 5        Motor Control         ULN2003 IN1
GPIO 16       UART2 RX              J3-4 (Display TX)
GPIO 17       UART2 TX              J3-3 (Display RX)
GPIO 18       SPI SCK               W5500 SCLK
GPIO 19       SPI MISO              W5500 MISO
GPIO 21       Stock Reset Button    SW2 → GND, R13→3.3V
              I2C SDA               AT24C256 SDA, R10→3.3V
GPIO 22       SPI CS (Ethernet)     W5500 SCSn
              I2C SCL               AT24C256 SCL, R11→3.3V
GPIO 23       SPI MOSI              W5500 MOSI
GPIO 27       Coin Acceptor         J5-2 via R9, D3 clamp
GPIO 33       Ethernet Reset        W5500 RSTn
GPIO 34       Ethernet Interrupt    W5500 INTn (input only)
EN            Enable / Reset        MCP101T, R2→3.3V, J6-5
──────────────────────────────────────────────────
```

---

# APPENDIX B — FIRMWARE CODE CHANGES FOR NEW HARDWARE

## B.1 Switch from ENC28J60 to W5500

```cpp
// OLD — Remove these:
// #define USE_UIPETHERNET
// #include <UIPEthernet.h>

// NEW — Use this:
#include <Ethernet.h>  // Official Wiznet W5500 library

// Add W5500 reset pin:
#define W5500_RST_PIN 33
#define W5500_INT_PIN 34

// In initializeEthernet():
bool initializeEthernet() {
    pinMode(W5500_RST_PIN, OUTPUT);
    digitalWrite(W5500_RST_PIN, LOW);
    delay(10);
    digitalWrite(W5500_RST_PIN, HIGH);
    delay(250);

    Ethernet.init(ETHERNET_CS);  // CS = GPIO22

    Serial.println("Checking W5500 hardware...");
    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
        Serial.println("W5500 not found!");
        return false;
    }

    if (Ethernet.linkStatus() == LinkOFF) {
        Serial.println("No Ethernet cable!");
        return false;
    }

    Serial.println("Starting DHCP...");
    if (Ethernet.begin(ethernetMAC, 10000) == 0) {
        Serial.println("DHCP failed!");
        return false;
    }

    Serial.print("IP: ");
    Serial.println(Ethernet.localIP());
    ethernetConnected = true;
    useEthernet = true;
    return true;
}
```

## B.2 Switch to AT24C256 External EEPROM

```cpp
#include <Wire.h>
#include <AT24CX.h>  // Library: AT24CX by joao-nunes

AT24C256 extEEPROM;

// In setup(), before EEPROM operations:
Wire.begin(21, 22);  // SDA=21, SCL=22
extEEPROM.begin();

// Replace EEPROM.write(addr, val) with:
extEEPROM.write(addr, val);

// Replace EEPROM.read(addr) with:
extEEPROM.read(addr);

// EEPROM.commit() is NOT needed (AT24C256 writes instantly)
```

## B.3 Display Protocol for Nextion

```cpp
void sendDisplay(uint8_t pageNum) {
    // Nextion command: switch to page number
    Serial2.print("page ");
    Serial2.print(pageNum);
    Serial2.write(0xFF);
    Serial2.write(0xFF);
    Serial2.write(0xFF);
}

// Replace all Serial2.print("X") with sendDisplay(X):
// "0" → sendDisplay(0)
// "1" → sendDisplay(1)
// etc.
```

---

# APPENDIX C — ORDERING GUIDE

## C.1 PCB Fabrication (JLCPCB)

| Parameter         | Value         |
|-------------------|---------------|
| Layers            | 4             |
| Dimensions        | 100mm × 80mm  |
| Quantity          | 5 pcs (proto) |
| Material          | FR4           |
| Thickness         | 1.6mm         |
| Copper Weight     | 1oz           |
| Surface Finish    | ENIG          |
| Color             | Black solder mask |
| Min Hole          | 0.3mm         |
| Min Track         | 0.127/0.127mm |
| Impedance Control | Yes (JLC04161H-3313 stackup) |

**Estimated cost (5 pcs)**: ₹1,800–₹2,500

## C.2 Component Sourcing

| Supplier   | Best For                        | Website          |
|------------|---------------------------------|------------------|
| LCSC       | All SMD passives, ICs           | lcsc.com         |
| Mouser     | Espressif modules, Wiznet W5500 | mouser.in        |
| JLCPCB SMT | PCB + assembly combo            | jlcpcb.com       |
| DigiKey    | Connectors, crystals            | digikey.in       |
| Robu.in    | Motors, power supplies (India)  | robu.in          |

## C.3 Total BOM Cost Estimate (per board)

| Category            | Approx Cost |
|---------------------|-------------|
| ESP32-WROOM-32E     | ₹250        |
| W5500               | ₹120        |
| Power ICs (U3+U4)   | ₹45         |
| Passives (all R/C)  | ₹80         |
| Connectors          | ₹120        |
| Motor driver + EEPROM | ₹40       |
| Crystal, diodes, LEDs | ₹50       |
| PCB (per unit @ 5 pcs) | ₹500    |
| **Total**           | **~₹1,205** |

---

*Document End — LYRA LCB-1.0 PCB Design Specification*
*For questions contact Lyra Engineering Team*
