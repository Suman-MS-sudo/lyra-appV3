// ================================================================
// Lyra RFID Napkin Vending Machine v4  --  ESP32
// ================================================================
// RFID RC522  : SS=GPIO15  RST=GPIO4
// Storage     : LittleFS (internal flash — no SD card needed)
// LCD 1602A   : HW-61 (I2C via PCF8574 backpack)
//               SDA=GPIO21  SCL=GPIO22  I2C addr=0x27  VCC=5V
//               Library: "LiquidCrystal I2C" by Frank de Brabander
// RELAY       : GPIO25
// STOCK BTN   : GPIO27  (refill -- active LOW)
// WIFI BTN    : GPIO32  (enable AP -- active LOW)
// SPI (shared): SCK=18  MISO=19  MOSI=23
// DS1307 RTC  : SDA=GPIO21  SCL=GPIO22  VCC=5V  GND=GND
//               (HW-084 module — CR2032 coin cell keeps time when powered off)
//               Library: "RTClib" by Adafruit (install via Library Manager)
//               Set time ONCE via web UI -> Settings -> Set RTC Time.
// WiFi AP     : Lyra-Vending-AP / lyra12345  -> 192.168.4.1
//               (ONLY active while WiFi button held / 5-min timeout)
// Flash data  : /tags.txt  /vendlog.csv  /config.txt  (LittleFS)
// ================================================================

#include <SPI.h>
#include <Wire.h>
#include <RTClib.h>            // Adafruit RTClib — install via Library Manager
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h> // Frank de Brabander — install via Library Manager
#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include "soc/soc.h"           // brownout disable
#include "soc/rtc_cntl_reg.h"  // brownout disable

// -------- Pins --------
#define RFID_SS     15
#define RFID_RST     4
#define RELAY_PIN   25
#define STOCK_BTN   27
#define WIFI_BTN    32

// -------- LCD (HW-61 1602A over I2C) --------
#define LCD_I2C_ADDR 0x27   // PCF8574 backpack default; try 0x3F if blank

// -------- Tunables --------
#define MAX_STOCK         25
#define MAX_RFID_TAGS    500
#define WIFI_TIMEOUT_MS  300000UL   // 5 minutes
#define IST_OFFSET_SEC   19800UL   // UTC+5:30 (Indian Standard Time)

// -------- Objects --------
MFRC522  rfid(RFID_SS, RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);
WebServer server(80);

// -------- WiFi --------
const char* WIFI_SSID = "Lyra-Vending-AP";
const char* WIFI_PASS = "lyra12345";
bool  wifiActive     = false;
unsigned long wifiStartMs     = 0;
unsigned long lastConnectedMs = 0;  // reset each time a station is seen

// -------- Tag store --------
struct Tag {
    char uid[20];
    char name[40];      // employee display name
    char empId[20];     // employee / badge ID
    int  dailyCount;
    unsigned long lastDay;
    bool active;
};
Tag    tags[MAX_RFID_TAGS];
int    tagCount    = 0;
int    stock       = MAX_STOCK;
int    dailyLimit  = 3;          // configurable from web UI
unsigned long today = 0;

// -------- SD files --------
const char* F_TAGS   = "/tags.txt";
const char* F_LOG    = "/vendlog.csv";
const char* F_CFG    = "/config.txt";

// -------- RFID reader info --------
uint8_t rfidVersion = 0;
// -------- Machine identity --------
char machineName[40]     = "Lyra Vending 1";
char machineId[20]       = "LVM-001";
char machineLocation[60] = "Unset";

// -------- DS1307 RTC (HW-084 module) --------
RTC_DS1307  rtc;
bool        rtcOK = false;

// -------- Fallback software time (used if RTC not wired yet) --------
// Set via web UI once; millis() drift is fine for logging when RTC absent.
unsigned long baseEpoch  = 0;   // Unix epoch seconds at last web-set
unsigned long baseMs     = 0;   // millis() captured at that moment

// -------- Transaction counter --------
int txCounter = 0;   // persisted in config.txt

// -------- Scan-to-add state --------
bool   waitingForScan = false;
String scannedUID     = "";

// -------- Forward decls --------
void showImage(uint8_t n);
void lcdMsg(const char* l0, const char* l1 = "");
void showIdle();
int  findTag(const String& uid);
void handleScan(const String& uid);
void vend(const String& uid, int idx);
void initFS();
void loadCfg();
void saveCfg();
void loadTags();
void saveTags();
void logTx(const String& uid, int tagIdx);
String uptime();
void startWifi();
void stopWifi();
void activeDelay(unsigned long ms);
void setupRoutes();
void handleRoot();
void handleHealth();
void handleGetTags();
void handleAddTag();
void handleDeleteTag();
void handleToggleTag();
void handleSetLimit();
void handleResetStock();
void handleDownloadReport();
void handleStartScan();
void handlePollScan();
void handleSetMachineInfo();
void handleSetTime();
void handleSetup();
void handleEditTag();
void handleRecentLog();
void handleChart7();

// -------- DateTime helpers --------
// Priority: DS3231 RTC > web-set epoch offset > uptime fallback
unsigned long nowEpoch() {
    if (rtcOK) return rtc.now().unixtime();
    if (baseEpoch > 0) return baseEpoch + (millis() - baseMs) / 1000;
    return millis() / 1000;   // raw uptime as last resort
}
String getDateStr() {
    if (!rtcOK && baseEpoch == 0) return "N/A";
    DateTime dt(nowEpoch());
    char b[12]; snprintf(b, sizeof(b), "%04d-%02d-%02d", dt.year(), dt.month(), dt.day());
    return String(b);
}
String getTimeStr() {
    if (!rtcOK && baseEpoch == 0) return uptime();
    DateTime dt(nowEpoch());
    char b[9]; snprintf(b, sizeof(b), "%02d:%02d:%02d", dt.hour(), dt.minute(), dt.second());
    return String(b);
}

// ================================================================
// WEB UI — served directly from PROGMEM (internal flash)
// ================================================================
static const char HTML_PAGE[] PROGMEM = R"rawhtml(<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lyra Vending — Control Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pri:#7c6fff;--sec:#9b59f5;--acc:#ff6b8a;--teal:#43e97b;--bg:#0c0b18;--bg2:#13112a;--bg3:#1a1735;--card:rgba(255,255,255,.045);--text:#e8e6fb;--muted:#7a779a;--border:rgba(255,255,255,.075);--danger:#ff4d6d;--success:#43e97b;--warn:#ffbe0b;--glow:rgba(124,111,255,.4)}
html{scroll-behavior:smooth}
body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;min-height:100vh;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 70% 60% at 15% 55%,rgba(124,111,255,.14) 0%,transparent 60%),radial-gradient(ellipse 55% 50% at 85% 20%,rgba(155,89,245,.1) 0%,transparent 55%),radial-gradient(ellipse 50% 45% at 55% 85%,rgba(67,233,123,.06) 0%,transparent 45%);pointer-events:none;z-index:0;animation:bgPulse 10s ease-in-out infinite alternate}
@keyframes bgPulse{from{opacity:.75}to{opacity:1}}

/* ── Sidebar ── */
#sb{width:235px;min-height:100vh;background:linear-gradient(180deg,rgba(20,17,45,.97),rgba(11,9,28,.98));border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
#sb .brand{padding:22px 20px 16px;border-bottom:1px solid var(--border)}
#sb .brand .logo-row{display:flex;align-items:center;gap:11px;margin-bottom:7px}
#sb .brand .logo-icon{width:38px;height:38px;background:linear-gradient(135deg,var(--pri),var(--sec));border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.25em;flex-shrink:0;animation:logoPulse 3s ease-in-out infinite;box-shadow:0 4px 20px var(--glow)}
@keyframes logoPulse{0%,100%{box-shadow:0 4px 20px var(--glow)}50%{box-shadow:0 6px 35px rgba(124,111,255,.65)}}
#sb .brand h2{font-size:1.03em;font-weight:800;background:linear-gradient(135deg,#fff 40%,#b3adff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
#sb .brand p{font-size:.7em;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sb nav{flex:1;padding:12px 10px}
#sb nav a{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;font-size:.87em;color:var(--muted);border-radius:11px;transition:all .22s;user-select:none;margin-bottom:3px;position:relative;overflow:hidden}
#sb nav a .icon{font-size:1.05em;width:20px;text-align:center;flex-shrink:0;transition:transform .22s}
#sb nav a::after{content:'';position:absolute;left:0;top:50%;width:0;height:60%;background:linear-gradient(var(--pri),var(--sec));border-radius:3px;transform:translateY(-50%);transition:width .22s}
#sb nav a:hover{background:rgba(255,255,255,.054);color:var(--text)}
#sb nav a.active{background:linear-gradient(135deg,rgba(124,111,255,.18),rgba(155,89,245,.09));color:#fff}
#sb nav a.active::after{width:3px}
#sb nav a.active .icon{transform:scale(1.15)}
.nav-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(67,233,123,.4);animation:sonarPulse 2.2s infinite;margin-left:auto;flex-shrink:0}
@keyframes sonarPulse{0%{box-shadow:0 0 0 0 rgba(67,233,123,.55)}70%{box-shadow:0 0 0 8px rgba(67,233,123,0)}100%{box-shadow:0 0 0 0 rgba(67,233,123,0)}}
.nav-dot.bad{background:var(--danger);animation:none;box-shadow:0 0 6px var(--danger)}
#sb .clkbox{padding:14px 20px;border-top:1px solid var(--border)}
#sb .clkbox .ck-lbl{font-size:.64em;text-transform:uppercase;letter-spacing:1.6px;color:var(--muted);margin-bottom:3px}
#sb .clkbox #clk{font-size:1.6em;font-weight:900;letter-spacing:2px;font-variant-numeric:tabular-nums;background:linear-gradient(135deg,#fff,#b3adff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
#sb .clkbox #clkDate{font-size:.7em;color:var(--muted);margin-top:1px}

/* ── Main ── */
#main{margin-left:235px;flex:1;min-width:0;overflow-x:hidden;padding:28px 26px 44px;position:relative;z-index:1}
.ph{margin-bottom:22px}
.ph h1{font-size:1.65em;font-weight:800;background:linear-gradient(135deg,#fff 25%,#b3adff 80%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:flex;align-items:center;gap:9px}
.ph p{color:var(--muted);font-size:.86em;margin-top:5px}

/* ── Stat cards ── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:20px 20px 16px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);position:relative;overflow:hidden;transition:transform .28s,box-shadow .28s;cursor:default}
.sc:hover{transform:translateY(-5px);box-shadow:0 16px 50px rgba(0,0,0,.35)}
.sc::before{content:'';position:absolute;inset:0;background:linear-gradient(145deg,rgba(255,255,255,.05),transparent);pointer-events:none;border-radius:18px}
.sc .bg-icon{position:absolute;top:14px;right:16px;font-size:2em;opacity:.12;pointer-events:none;transition:opacity .28s}
.sc:hover .bg-icon{opacity:.22}
.sc .lbl{font-size:.69em;text-transform:uppercase;letter-spacing:1.1px;color:var(--muted);margin-bottom:7px;font-weight:700}
.sc .val{font-size:2.3em;font-weight:900;color:#fff;line-height:1;font-variant-numeric:tabular-nums}
.sc .sub{font-size:.73em;color:var(--muted);margin-top:6px}
.sc .prog{height:3px;background:rgba(255,255,255,.07);border-radius:4px;margin-top:12px;overflow:hidden}
.sc .prog-bar{height:100%;border-radius:4px;transition:width 1.4s cubic-bezier(.23,1,.32,1) .1s}
.sc.g .prog-bar{background:linear-gradient(90deg,#43e97b,#6aff9e)}
.sc.o .prog-bar{background:linear-gradient(90deg,#f7971e,#ffbe0b)}
.sc.p .prog-bar{background:linear-gradient(90deg,var(--pri),var(--sec))}
.sc.r .prog-bar{background:linear-gradient(90deg,var(--danger),#ff8fa3)}

/* ── Glass box ── */
.box{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:22px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin-bottom:18px;position:relative;overflow:visible;transition:box-shadow .28s}
.box:hover{box-shadow:0 8px 32px rgba(0,0,0,.22)}
.bh{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.bh h3{font-size:.94em;font-weight:700;color:#e5e3fa;display:flex;align-items:center;gap:7px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}

/* ── Tables ── */
table{width:100%;border-collapse:collapse;font-size:.85em}
thead tr{background:rgba(255,255,255,.025)}
th{padding:9px 13px;text-align:left;color:var(--muted);font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap;font-size:.76em;text-transform:uppercase;letter-spacing:.7px}
td{padding:9px 13px;border-bottom:1px solid rgba(255,255,255,.038);vertical-align:middle;color:var(--text)}
tr:last-child td{border-bottom:0}
tbody tr{transition:background .15s}
tbody tr:hover td{background:rgba(124,111,255,.07)}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;font-size:.74em;font-weight:700;white-space:nowrap}
.badge.on{background:rgba(67,233,123,.14);color:#43e97b;border:1px solid rgba(67,233,123,.28)}
.badge.off{background:rgba(255,77,109,.11);color:#ff4d6d;border:1px solid rgba(255,77,109,.22)}
.badge.info{background:rgba(124,111,255,.17);color:#b3adff;border:1px solid rgba(124,111,255,.28)}
.badge.warn{background:rgba(255,190,11,.12);color:#ffbe0b;border:1px solid rgba(255,190,11,.22)}

/* ── Buttons ── */
.btn{padding:9px 17px;border:none;border-radius:10px;cursor:pointer;font-size:.84em;font-weight:700;transition:transform .2s,box-shadow .2s,filter .2s;display:inline-flex;align-items:center;gap:6px;position:relative;overflow:hidden;letter-spacing:.25px;user-select:none;touch-action:manipulation;min-height:38px}
.btn:hover{transform:translateY(-2px)}
.btn:active{transform:translateY(0) scale(.96)}
.pri{background:linear-gradient(135deg,var(--pri),var(--sec));color:#fff;box-shadow:0 4px 18px rgba(124,111,255,.38)}
.pri:hover{box-shadow:0 6px 28px rgba(124,111,255,.55);filter:brightness(1.08)}
.suc{background:linear-gradient(135deg,#2ed87a,#43e97b);color:#071a10;box-shadow:0 4px 18px rgba(67,233,123,.25)}
.suc:hover{filter:brightness(1.1)}
.dan{background:linear-gradient(135deg,#ff4d6d,#c9184a);color:#fff;box-shadow:0 4px 18px rgba(255,77,109,.3)}
.dan:hover{filter:brightness(1.1)}
.war{background:linear-gradient(135deg,#ffbe0b,#f7971e);color:#160a00;box-shadow:0 4px 18px rgba(255,190,11,.25)}
.ghost{background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--border)}
.ghost:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.15)}
.sm{padding:5px 11px;font-size:.77em;border-radius:8px}
/* Ripple */
.ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.22);transform:scale(0);animation:rippleAnim .55s linear forwards;pointer-events:none}
@keyframes rippleAnim{to{transform:scale(5);opacity:0}}

/* ── Form ── */
.fg{margin-bottom:13px}
.fg label{display:block;font-size:.74em;font-weight:700;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
.fg input,.fg select{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:.9em;background:rgba(255,255,255,.04);color:var(--text);transition:all .22s;outline:none;-webkit-appearance:none;appearance:none}
.fg input:focus,.fg select:focus{border-color:var(--pri);background:rgba(124,111,255,.08);box-shadow:0 0 0 3px rgba(124,111,255,.18)}
.fg input::placeholder{color:var(--muted)}
.fg select option{background:#1a1735;color:var(--text)}

/* ── Search ── */
.sg{position:relative;margin-bottom:14px}
.sg .si{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.sg input{width:100%;padding:10px 12px 10px 36px;border:1.5px solid var(--border);border-radius:10px;font-size:.87em;background:rgba(255,255,255,.04);color:var(--text);outline:none;transition:all .22s}
.sg input:focus{border-color:var(--pri);background:rgba(124,111,255,.08);box-shadow:0 0 0 3px rgba(124,111,255,.18)}
.sg input::placeholder{color:var(--muted)}

/* ── Chart ── */
.chart-wrap{padding:4px 0}
.chart{display:flex;align-items:flex-end;gap:7px;height:105px}
.cb{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.cb .bar{width:100%;background:linear-gradient(to top,var(--sec),var(--pri));border-radius:7px 7px 0 0;transition:height .9s cubic-bezier(.23,1,.32,1);min-height:3px;position:relative;cursor:default}
.cb .bar::after{content:attr(data-v);position:absolute;top:-19px;left:50%;transform:translateX(-50%);font-size:.64em;font-weight:800;color:#b3adff;white-space:nowrap;opacity:0;transition:opacity .15s}
.cb .bar:hover::after{opacity:1}
.cb .bar:hover{filter:brightness(1.35)}
.cb .cl{font-size:.62em;color:var(--muted)}

/* ── Modal ── */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(5,3,18,.72);z-index:300;justify-content:center;align-items:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.modal-bg.show{display:flex}
.modal{background:linear-gradient(150deg,#1c1937,#141130);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;width:92%;max-width:450px;box-shadow:0 32px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04);animation:modalIn .28s cubic-bezier(.34,1.56,.64,1)}
@keyframes modalIn{from{transform:translateY(45px) scale(.92);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.modal h3{font-size:1.08em;font-weight:800;color:#fff;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.mf{display:flex;gap:9px;margin-top:18px;flex-wrap:wrap}
.mf .btn{flex:1}

/* ── Scan box ── */
.scan-box{background:rgba(124,111,255,.07);border:2px dashed rgba(124,111,255,.28);border-radius:12px;padding:13px 14px;margin:10px 0;transition:all .25s}
.scan-box.live{border-color:var(--success);background:rgba(67,233,123,.06);animation:scanGlow 1.6s ease-in-out infinite}
.scan-box.done{border-color:var(--success);border-style:solid;background:rgba(67,233,123,.06)}
.scan-box .scan-lbl{font-size:.73em;color:var(--muted);margin-bottom:5px}
.scan-box .scan-uid{font-size:.9em;font-weight:700;font-family:monospace;color:#b3adff;min-height:20px}
@keyframes scanGlow{0%,100%{box-shadow:0 0 0 0 rgba(67,233,123,0)}50%{box-shadow:0 0 18px rgba(67,233,123,.22)}}

/* ── Toast ── */
#toast-c{position:fixed;bottom:20px;right:20px;z-index:500;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.toast{background:rgba(22,19,45,.96);color:#fff;padding:12px 16px;border-radius:13px;font-size:.84em;box-shadow:0 10px 36px rgba(0,0,0,.38);animation:toastIn .32s cubic-bezier(.34,1.56,.64,1);display:flex;align-items:center;gap:10px;max-width:300px;border:1px solid var(--border);backdrop-filter:blur(12px)}
.toast .ti{width:23px;height:23px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82em;flex-shrink:0;font-weight:700}
.toast.suc .ti{background:rgba(67,233,123,.18);color:var(--success)}
.toast.err .ti{background:rgba(255,77,109,.18);color:var(--danger)}
.toast.war .ti{background:rgba(255,190,11,.18);color:var(--warn)}
@keyframes toastIn{from{transform:translateX(130%) scale(.8);opacity:0}to{transform:translateX(0) scale(1);opacity:1}}

/* ── Pages ── */
.page{display:none}
.page.active{display:block;animation:pageIn .3s ease}
@keyframes pageIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

/* ── Inline health rows ── */
.ht-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.ht-row:last-child{border-bottom:0}
.ht-key{font-size:.8em;color:var(--muted);font-weight:600}
.ht-val{font-size:.82em;color:var(--text);font-weight:600}

/* ── Mini progress bar (in table) ── */
.mprog{flex:1;max-width:48px;height:4px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden}
.mprog-bar{height:100%;border-radius:4px;transition:width .8s cubic-bezier(.23,1,.32,1) .2s}

/* ── Pagination ── */
.pgn{display:flex;gap:5px;align-items:center;margin-top:13px;flex-wrap:wrap}
.pgn button{padding:5px 11px;border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:7px;cursor:pointer;font-size:.78em;font-weight:700;color:var(--muted);transition:all .15s}
.pgn button:hover,.pgn button.cur{background:var(--pri);color:#fff;border-color:var(--pri)}
.pgn .pi{font-size:.76em;color:var(--muted);margin-left:auto}

/* ── Spinner ── */
.spinner{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Pulse dot ── */
.pls{display:inline-block;width:8px;height:8px;background:var(--pri);border-radius:50%;animation:plsAnim 1s ease-in-out infinite}
@keyframes plsAnim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.9)}}

/* ── Tag action buttons row ── */
.tag-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.set-g{display:grid;grid-template-columns:1fr 1fr;gap:14px}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(124,111,255,.35);border-radius:6px}
::-webkit-scrollbar-thumb:hover{background:var(--pri)}

/* ── Number roll ── */
@keyframes numRoll{from{transform:translateY(-14px);opacity:0}to{transform:translateY(0);opacity:1}}
.rolled{animation:numRoll .35s ease}

/* ── Responsive ── */
@media(max-width:720px){
  /* ── Bottom navigation bar ── */
  #sb{width:100%;min-height:auto;flex-direction:row;position:fixed;bottom:0;top:auto;left:0;right:0;z-index:200;background:rgba(8,6,20,.97);border-right:none;border-top:1px solid var(--border);border-bottom:none;padding-bottom:env(safe-area-inset-bottom,0px)}
  #sb .brand,#sb .clkbox{display:none}
  #sb nav{display:flex;flex-direction:row;padding:0;flex:1;overflow:visible}
  #sb nav a{flex:1;flex-direction:column;padding:10px 4px 8px;border-radius:0;margin-bottom:0;text-align:center;gap:2px;font-size:.65em;justify-content:center;border-bottom:none;border-top:3px solid transparent;white-space:nowrap;min-height:54px}
  #sb nav a::after{display:none}
  #sb nav a.active{background:rgba(124,111,255,.1);border-top-color:var(--pri);color:var(--pri)}
  #sb nav a:hover{background:rgba(255,255,255,.05)}
  #sb nav a .icon{font-size:1.35em;transform:none!important}
  .nav-dot{display:none}

  /* ── Main content — adds bottom padding for nav bar ── */
  #main{margin-left:0;min-width:0;overflow-x:hidden;padding:16px 14px calc(68px + env(safe-area-inset-bottom,0px)) 14px;margin-top:0}

  /* ── Page header ── */
  .ph{margin-bottom:16px}
  .ph h1{font-size:1.28em}
  .ph p{font-size:.8em}

  /* ── Stat cards ── */
  .stats{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
  .sc{padding:14px 13px 12px;border-radius:14px}
  .sc .val{font-size:1.85em}
  .sc .bg-icon{font-size:1.6em;top:12px;right:12px}
  .sc .lbl{font-size:.65em}

  /* ── Layout ── */
  .row2,.set-g{grid-template-columns:1fr}
  .box{padding:16px 14px;border-radius:13px;margin-bottom:14px}
  .bh{flex-direction:row;align-items:center}

  /* ── Tables ── */
  table{font-size:.79em}
  th,td{padding:8px 9px}
  th{font-size:.7em}

  /* ── Inputs — font-size:16px prevents iOS auto-zoom ── */
  .fg input,.fg select,.sg input{font-size:16px!important;padding:12px 14px}
  .sg input{padding:12px 14px 12px 38px}

  /* ── Buttons ── */
  .tag-btns{gap:7px}
  .btn.sm{min-height:34px;padding:6px 12px}

  /* ── Modal — slides up from bottom ── */
  .modal-bg{align-items:flex-end}
  .modal{width:100%;max-width:100%;border-radius:22px 22px 0 0;padding:20px 18px calc(24px + env(safe-area-inset-bottom,0px));max-height:92vh;overflow-y:auto;animation:modalSlideUp .32s cubic-bezier(.34,1.15,.64,1)}
  @keyframes modalSlideUp{from{transform:translateY(100%);opacity:.5}to{transform:translateY(0);opacity:1}}
  .mf .btn{min-height:46px;font-size:.88em}

  /* ── Modal drag indicator ── */
  .modal::before{content:'';display:block;width:38px;height:4px;background:rgba(255,255,255,.18);border-radius:4px;margin:-6px auto 16px}

  /* ── Chart ── */
  .chart-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .chart{min-width:260px}

  /* ── Health rows ── */
  .ht-key{font-size:.76em}
  .ht-val{font-size:.78em}

  /* ── Toast — bottom-left on mobile so nav bar doesn't cover it ── */
  #toast-c{bottom:calc(76px + env(safe-area-inset-bottom,0px));right:12px;left:12px;align-items:stretch}
  .toast{max-width:100%}
}
@media(max-width:420px){
  .stats{grid-template-columns:1fr 1fr}
  .sc .val{font-size:1.55em}
  .ph h1{font-size:1.1em}
  /* Hide badge-ID column in transactions table on very small screens */
  #rt td:nth-child(3),#rt th:nth-child(3){display:none}
}
</style>
</head>
<body>
<aside id="sb">
  <div class="brand">
    <div class="logo-row">
      <div class="logo-icon">&#129531;</div>
      <div><h2>Lyra Vending</h2></div>
    </div>
    <p id="machSub">Loading...</p>
  </div>
  <nav>
    <a onclick="tab('dash')" id="nav-dash" class="active">
      <span class="icon">&#128200;</span>Dashboard<span class="nav-dot" id="nd"></span>
    </a>
    <a onclick="tab('cards')" id="nav-cards">
      <span class="icon">&#128179;</span>RFID Cards
    </a>
    <a onclick="tab('settings')" id="nav-settings">
      <span class="icon">&#9881;&#65039;</span>Settings
    </a>
  </nav>
  <div class="clkbox">
    <div class="ck-lbl">Current Time</div>
    <div id="clk">--:--:--</div>
    <div id="clkDate"></div>
  </div>
</aside>

<main id="main">

<!-- ═══ DASHBOARD ═══ -->
<div class="page active" id="page-dash">
  <div class="ph">
    <h1>&#128200; Dashboard</h1>
    <p id="upt">Connecting to machine...</p>
  </div>
  <div class="stats">
    <div class="sc g">
      <div class="bg-icon">&#128230;</div>
      <div class="lbl">Stock Level</div>
      <div class="val" id="d-stock">--</div>
      <div class="sub" id="d-stock-s">of -- max</div>
      <div class="prog"><div class="prog-bar" id="d-stock-bar" style="width:0%"></div></div>
    </div>
    <div class="sc p">
      <div class="bg-icon">&#128260;</div>
      <div class="lbl">Total Dispensed</div>
      <div class="val" id="d-tx">--</div>
      <div class="sub">all-time transactions</div>
    </div>
    <div class="sc" style="border-left:3px solid var(--pri)">
      <div class="bg-icon">&#128100;</div>
      <div class="lbl">Active Cards</div>
      <div class="val" id="d-tags">--</div>
      <div class="sub" id="d-tags-s">registered</div>
    </div>
    <div class="sc o">
      <div class="bg-icon">&#128204;</div>
      <div class="lbl">Daily Limit</div>
      <div class="val" id="d-lim">--</div>
      <div class="sub">vends per card/day</div>
    </div>
  </div>
  <div class="row2">
    <div class="box">
      <div class="bh">
        <h3>&#9889; System Health</h3>
        <button class="btn ghost sm" onclick="loadHealth()">&#8635;</button>
      </div>
      <div id="ht"><div class="ht-row"><span class="ht-key">Loading...</span><span class="spinner"></span></div></div>
    </div>
    <div class="box">
      <div class="bh">
        <h3>&#128202; 7-Day Activity</h3>
        <span id="c7tot" class="badge info"></span>
      </div>
      <div class="chart-wrap">
        <div class="chart" id="c7"><p style="color:var(--muted);font-size:.8em;margin:auto">Loading...</p></div>
      </div>
    </div>
  </div>
  <div class="box">
    <div class="bh">
      <h3>&#128338; Recent Transactions</h3>
      <button class="btn ghost sm" onclick="loadRecent()">&#8635; Refresh</button>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#TxID</th><th>Employee</th><th>Badge ID</th><th>Card UID</th><th>Date</th><th>Time</th></tr></thead>
        <tbody id="rt"><tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px"><span class="spinner"></span></td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ═══ CARDS ═══ -->
<div class="page" id="page-cards">
  <div class="ph">
    <h1>&#128179; RFID Cards</h1>
    <p>Manage employee access cards</p>
  </div>
  <div class="box">
    <div class="tag-btns">
      <button class="btn pri" onclick="openAdd()">&#43; Add Card</button>
      <button class="btn ghost" onclick="loadTags()">&#8635; Refresh</button>
      <button class="btn ghost sm" onclick="exportCards()">&#8595; Export CSV</button>
      <span id="tc-badge" class="badge info" style="margin-left:auto"></span>
    </div>
    <div class="sg">
      <span class="si">&#128269;</span>
      <input id="ts" placeholder="Search by name, badge ID, or UID..." oninput="filterTags()">
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>UID</th><th>Name</th><th>Badge ID</th><th>Usage Today</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="tb"><tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px"><span class="spinner"></span></td></tr></tbody>
      </table>
    </div>
    <div class="pgn" id="pgn"></div>
  </div>
</div>

<!-- ═══ SETTINGS ═══ -->
<div class="page" id="page-settings">
  <div class="ph">
    <h1>&#9881;&#65039; Settings</h1>
    <p>Configure machine parameters</p>
  </div>
  <div class="set-g" style="margin-bottom:16px">
    <div class="box">
      <div class="bh"><h3>&#127922; Vend Settings</h3></div>
      <div class="fg">
        <label>Daily Limit Per Card</label>
        <input type="number" id="s-lim" min="1" max="50" placeholder="3">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn pri" onclick="saveLimit()">&#128190; Save Limit</button>
        <button class="btn dan" onclick="doReset()">&#128260; Reset Stock</button>
      </div>
    </div>
    <div class="box">
      <div class="bh"><h3>&#128336; RTC / Time</h3></div>
      <p style="font-size:.81em;color:var(--muted);margin-bottom:10px">DS3231 RTC module keeps time permanently via coin cell battery.<br>Set time once below — it survives power-off.</p>
      <div id="ct" style="font-size:.92em;font-weight:700;color:#b3adff;margin-bottom:8px;font-family:monospace">--</div>
      <div id="rtc-status" class="badge" style="margin-bottom:11px"></div>
      <div id="sync-stat" class="badge on" style="margin-bottom:11px;display:none"></div>
      <button class="btn pri" onclick="syncTime()">&#128336; Set RTC to Browser Time</button>
    </div>
  </div>
  <div class="box">
    <div class="bh"><h3>&#128295; Machine Identity</h3></div>
    <div class="set-g">
      <div class="fg"><label>Machine Name</label><input type="text" id="s-mn" placeholder="Lyra Vending 1"></div>
      <div class="fg"><label>Machine ID</label><input type="text" id="s-mi" placeholder="LVM-001"></div>
      <div class="fg" style="grid-column:1/-1"><label>Location / Department</label><input type="text" id="s-ml" placeholder="e.g. 2nd Floor, HR Wing"></div>
    </div>
    <button class="btn pri" onclick="saveMachInfo()">&#128190; Save Machine Info</button>
  </div>
  <div class="box">
    <div class="bh"><h3>&#128196; Reports</h3></div>
    <p style="font-size:.81em;color:var(--muted);margin-bottom:12px">Full CSV export: TxID, UID, Emp ID, Name, Machine, Location, Date, Time, Uptime</p>
    <button class="btn suc" onclick="location='/download/report'">&#8595; Download Full Report</button>
  </div>
</div>

</main>

<!-- ═══ Add/Edit Modal ═══ -->
<div class="modal-bg" id="mod-card">
  <div class="modal">
    <h3 id="mod-title">&#43; Add Card</h3>
    <input type="hidden" id="eu">
    <div class="fg">
      <label>Employee Name</label>
      <input type="text" id="mn" placeholder="e.g. John Smith">
    </div>
    <div class="fg">
      <label>Badge / Employee ID</label>
      <input type="text" id="me" placeholder="e.g. EMP-001">
    </div>
    <div class="fg">
      <label>Card UID (hex)</label>
      <input type="text" id="mu" placeholder="Type hex or tap card below">
    </div>
    <div class="scan-box" id="scanBox">
      <div class="scan-lbl">RFID Reader Status</div>
      <div class="scan-uid" id="sst">&#8680; Click button below to scan</div>
    </div>
    <button class="btn suc" id="tapBtn" style="width:100%;margin-bottom:2px" onclick="tapCard()">
      &#128273; Tap Card on Reader
    </button>
    <div class="mf">
      <button class="btn pri" id="mod-ok" onclick="submitCard()">&#10003; Add Card</button>
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
    </div>
  </div>
</div>

<div id="toast-c"></div>

<script>
var allTags=[],filtered=[],tagPage=1,PS=15,editMode=false,scanTimer=null;

// Ripple effect
document.addEventListener('click',function(e){
  var btn=e.target.closest('.btn');
  if(!btn)return;
  var r=document.createElement('span');
  r.className='ripple';
  var rect=btn.getBoundingClientRect();
  var sz=Math.max(rect.width,rect.height);
  r.style.cssText='left:'+(e.clientX-rect.left-sz/2)+'px;top:'+(e.clientY-rect.top-sz/2)+'px;width:'+sz+'px;height:'+sz+'px';
  btn.appendChild(r);
  setTimeout(function(){r.remove();},560);
});

// Page transition
function tab(t){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('#sb nav a').forEach(function(a){a.classList.remove('active');});
  document.getElementById('page-'+t).classList.add('active');
  document.getElementById('nav-'+t).classList.add('active');
  if(t==='dash')loadDash();
  if(t==='cards')loadTags();
  if(t==='settings')loadSettings();
}

// Toast
function toast(msg,type,dur){
  dur=dur||3400;
  var c=document.getElementById('toast-c');
  var d=document.createElement('div');
  d.className='toast '+(type||'');
  var icons={suc:'&#10003;',err:'&#10005;',war:'&#9888;'};
  d.innerHTML='<div class="ti">'+(icons[type]||'&#8505;')+'</div><span>'+msg+'</span>';
  c.appendChild(d);
  setTimeout(function(){
    d.style.animation='toastIn .26s ease reverse';
    setTimeout(function(){d.remove();},240);
  },dur);
}

// POST helper
function post(url,data){
  var body=Object.entries(data).map(function(kv){return encodeURIComponent(kv[0])+'='+encodeURIComponent(kv[1]);}).join('&');
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body});
}

// Animated count-up
function animCount(el,to,dur){
  dur=dur||900;
  var from=parseInt(el.textContent)||0;
  if(from===to){el.classList.remove('rolled');void el.offsetWidth;el.classList.add('rolled');setTimeout(function(){el.classList.remove('rolled');},380);return;}
  var start=Date.now(),diff=to-from;
  function upd(){
    var p=Math.min((Date.now()-start)/dur,1);
    var ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+diff*ease);
    if(p<1){requestAnimationFrame(upd);}else{el.textContent=to;el.classList.add('rolled');setTimeout(function(){el.classList.remove('rolled');},380);}
  }
  requestAnimationFrame(upd);
}

// Clock
function tickClock(){
  var n=new Date();
  document.getElementById('clk').textContent=n.toLocaleTimeString('en-GB',{hour12:false});
  document.getElementById('clkDate').textContent=n.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  var ct=document.getElementById('ct');
  if(ct)ct.textContent=n.toLocaleString();
}
setInterval(tickClock,1000);tickClock();

// Dashboard
function loadDash(){loadHealth();loadRecent();loadChart();}

function loadHealth(){
  var nd=document.getElementById('nd');
  nd.className='nav-dot';
  fetch('/health').then(function(r){return r.json();}).then(function(d){
    nd.className='nav-dot';
    animCount(document.getElementById('d-stock'),d.stock);
    document.getElementById('d-stock-s').textContent='of '+d.maxStock+' max';
    var sp=Math.round((d.stock/d.maxStock)*100);
    document.getElementById('d-stock-bar').style.width=sp+'%';
    animCount(document.getElementById('d-tx'),d.totalTx);
    animCount(document.getElementById('d-tags'),d.activeTags);
    document.getElementById('d-tags-s').textContent='of '+d.totalTags+' registered';
    animCount(document.getElementById('d-lim'),d.dailyLimit);
    var upt=document.getElementById('upt');
    upt.textContent='Uptime: '+d.uptime+(d.date&&d.date!='N/A'?' \u2014 '+d.date+' '+d.time:'');
    document.getElementById('machSub').textContent=(d.machineName||'Lyra Vending')+(d.machineLocation?' \u2014 '+d.machineLocation:'');
    var rows=[
      {k:'Flash FS',v:'<span class="badge on">&#10004; OK</span>'},
      {k:'RTC Clock',v:d.rtcOK?'<span class="badge on">&#10004; DS3231 OK</span>':'<span class="badge warn">&#9651; Not connected</span>'},
      {k:'RFID Reader',v:'<span class="badge on">Ver 0x'+d.rfidVer+'</span>'},
      {k:'WiFi AP',v:'<span class="badge on">192.168.4.1</span>'},
      {k:'Uptime',v:'<span class="badge info">'+d.uptime+'</span>'},
      {k:'Date / Time',v:(d.date!='N/A'?d.date+' '+d.time:'<span class="badge warn">&#9711; Not set — use Settings</span>')}
    ];
    document.getElementById('ht').innerHTML=rows.map(function(r){return '<div class="ht-row"><span class="ht-key">'+r.k+'</span><span class="ht-val">'+r.v+'</span></div>';}).join('');
    // update RTC status badge on Settings page
    var rs=document.getElementById('rtc-status');
    if(rs){
      rs.className='badge '+(d.rtcOK?'on':'warn');
      rs.textContent=d.rtcOK?'\u2714 DS3231 RTC connected':'\u26a0 No RTC — set time below (survives session only)';
      rs.style.display='inline-flex';
    }
  }).catch(function(){
    nd.className='nav-dot bad';
    toast('Health check failed','err');
  });
}

function loadRecent(){
  fetch('/api/log/recent?n=15').then(function(r){return r.json();}).then(function(rows){
    var tb=document.getElementById('rt');
    if(!rows.length){
      tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No transactions recorded yet</td></tr>';
      return;
    }
    tb.innerHTML=rows.map(function(r,i){
      return '<tr style="animation:pageIn .28s '+( i*0.04)+'s both">'
        +'<td><span class="badge info">#'+r.id+'</span></td>'
        +'<td><strong style="color:#e5e3fa">'+r.name+'</strong></td>'
        +'<td><span class="badge warn">'+r.empid+'</span></td>'
        +'<td style="font-family:monospace;font-size:.79em;color:#b3adff">'+r.uid+'</td>'
        +'<td style="color:var(--muted)">'+r.date+'</td>'
        +'<td style="color:var(--muted)">'+r.time+'</td></tr>';
    }).join('');
  }).catch(function(){
    document.getElementById('rt').innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted)">Unable to load transactions</td></tr>';
  });
}

function loadChart(){
  fetch('/api/stats/chart').then(function(r){return r.json();}).then(function(data){
    var c7=document.getElementById('c7');
    if(!data.length){c7.innerHTML='<p style="color:var(--muted);font-size:.8em;margin:auto">No data yet</p>';return;}
    var mx=Math.max.apply(null,data.map(function(d){return d.count;}));
    if(mx<1)mx=1;
    var tot=data.reduce(function(a,d){return a+d.count;},0);
    document.getElementById('c7tot').textContent=tot+' dispensed';
    c7.innerHTML=data.map(function(d,i){
      var pct=Math.max(Math.round((d.count/mx)*100),3);
      var delay=(i*0.07).toFixed(2);
      return '<div class="cb"><div class="bar" data-v="'+d.count+'" style="height:0%;transition-delay:'+delay+'s" data-h="'+pct+'%"></div><div class="cl">'+d.label+'</div></div>';
    }).join('');
    setTimeout(function(){
      c7.querySelectorAll('.bar').forEach(function(b){b.style.height=b.dataset.h;});
    },100);
  }).catch(function(){});
}

// Settings
function loadSettings(){
  fetch('/health').then(function(r){return r.json();}).then(function(d){
    document.getElementById('s-lim').value=d.dailyLimit;
    document.getElementById('s-mn').value=d.machineName||'';
    document.getElementById('s-mi').value=d.machineId||'';
    document.getElementById('s-ml').value=d.machineLocation||'';
  }).catch(function(){});
}

function saveLimit(){
  var v=parseInt(document.getElementById('s-lim').value);
  if(isNaN(v)||v<1){toast('Enter a valid number','err');return;}
  post('/api/set-limit',{limit:v}).then(function(r){return r.text();}).then(function(m){
    toast(m,'suc');
    animCount(document.getElementById('d-lim'),v);
  }).catch(function(){toast('Failed to save limit','err');});
}

function doReset(){
  if(!confirm('Reset stock to 25 units?'))return;
  post('/api/reset-stock',{}).then(function(r){return r.text();}).then(function(m){
    toast(m,'suc');
    animCount(document.getElementById('d-stock'),25);
    document.getElementById('d-stock-bar').style.width='100%';
  }).catch(function(){toast('Failed','err');});
}

function syncTime(){
  var ep=Math.floor(Date.now()/1000);
  post('/api/set-time',{epoch:ep}).then(function(r){return r.text();}).then(function(m){
    toast(m,'suc');
    var s=document.getElementById('sync-stat');
    s.textContent='\u2713 '+m;
    s.style.display='inline-flex';
    loadHealth();  // refresh RTC badge and date/time display
  }).catch(function(){toast('Sync failed','err');});
}

function saveMachInfo(){
  post('/api/set-machine-info',{
    mname:document.getElementById('s-mn').value.trim(),
    mid:document.getElementById('s-mi').value.trim(),
    mloc:document.getElementById('s-ml').value.trim()
  }).then(function(r){return r.text();}).then(function(m){
    toast(m,'suc');loadHealth();
  }).catch(function(){toast('Failed','err');});
}

// Tags
function loadTags(){
  fetch('/api/tags').then(function(r){return r.json();}).then(function(d){
    allTags=d;tagPage=1;
    document.getElementById('tc-badge').textContent=d.filter(function(t){return t.a;}).length+' active / '+d.length+' total';
    filterTags();
  }).catch(function(){toast('Failed to load cards','err');});
}

function filterTags(){
  var q=document.getElementById('ts').value.toLowerCase();
  filtered=allTags.filter(function(t){
    return t.u.toLowerCase().indexOf(q)>=0||t.n.toLowerCase().indexOf(q)>=0||t.e.toLowerCase().indexOf(q)>=0;
  });
  tagPage=1;renderTags();
}

function renderTags(){
  var s=(tagPage-1)*PS,pg=filtered.slice(s,s+PS);
  var tb=document.getElementById('tb');
  if(!filtered.length){
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No cards found</td></tr>';
    document.getElementById('pgn').innerHTML='';
    return;
  }
  tb.innerHTML=pg.map(function(t,i){
    var usePct=Math.min(100,Math.round(t.c/t.l*100));
    var barColor=t.c>=t.l?'var(--danger)':'var(--pri)';
    return '<tr style="animation:pageIn .25s '+(i*0.035)+'s both">'
      +'<td style="font-family:monospace;font-size:.79em;color:#b3adff">'+t.u+'</td>'
      +'<td><strong style="color:#e5e3fa">'+t.n+'</strong></td>'
      +'<td><span class="badge warn">'+t.e+'</span></td>'
      +'<td><div style="display:flex;align-items:center;gap:7px"><span style="white-space:nowrap">'+t.c+'/'+t.l+'</span>'
        +'<div class="mprog"><div class="mprog-bar" style="width:'+usePct+'%;background:'+barColor+'"></div></div></div></td>'
      +'<td><span class="badge '+(t.a?'on':'off')+'">'+(t.a?'&#9679; Active':'&#9675; Inactive')+'</span></td>'
      +'<td><div style="display:flex;gap:5px">'
        +'<button class="btn ghost sm" onclick="openEdit(\''+t.u+'\')">&#9998;</button>'
        +'<button class="btn '+(t.a?'war':'suc')+' sm" onclick="doToggle(\''+t.u+'\')">'+(t.a?'Off':'On')+'</button>'
        +'<button class="btn dan sm" onclick="doDel(\''+t.u+'\')">&#128465;</button>'
      +'</div></td></tr>';
  }).join('');
  var pages=Math.ceil(filtered.length/PS);
  var pHtml='';
  if(pages>1){for(var i=1;i<=pages;i++)pHtml+='<button class="'+(i===tagPage?'cur':'')+'" onclick="tagPage='+i+';renderTags()">'+i+'</button>';}
  pHtml+='<span class="pi">'+filtered.length+' cards</span>';
  document.getElementById('pgn').innerHTML=pHtml;
}

function exportCards(){
  var csv='UID,Name,EmpID,UsedToday,Limit,Status\n';
  allTags.forEach(function(t){csv+=t.u+',"'+t.n+'",'+t.e+','+t.c+','+t.l+','+(t.a?'Active':'Inactive')+'\n';});
  var a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='lyra_cards_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

// Modal
function openAdd(){
  editMode=false;
  document.getElementById('mod-title').innerHTML='&#43; Add RFID Card';
  document.getElementById('mod-ok').textContent='Add Card';
  document.getElementById('mn').value='';
  document.getElementById('me').value='';
  document.getElementById('mu').value='';
  document.getElementById('mu').readOnly=false;
  document.getElementById('tapBtn').style.display='';
  document.getElementById('scanBox').className='scan-box';
  document.getElementById('sst').innerHTML='&#8680; Click button below to scan';
  document.getElementById('eu').value='';
  document.getElementById('mod-card').classList.add('show');
  setTimeout(function(){document.getElementById('mn').focus();},120);
}

function openEdit(uid){
  var t=allTags.filter(function(x){return x.u===uid;})[0];
  if(!t)return;
  editMode=true;
  document.getElementById('mod-title').innerHTML='&#9998; Edit Card';
  document.getElementById('mod-ok').textContent='Save Changes';
  document.getElementById('mn').value=t.n;
  document.getElementById('me').value=t.e;
  document.getElementById('mu').value=t.u;
  document.getElementById('mu').readOnly=true;
  document.getElementById('tapBtn').style.display='none';
  document.getElementById('scanBox').className='scan-box';
  document.getElementById('sst').textContent='UID is locked during edit';
  document.getElementById('eu').value=uid;
  document.getElementById('mod-card').classList.add('show');
}

function closeModal(){
  document.getElementById('mod-card').classList.remove('show');
  if(scanTimer){clearInterval(scanTimer);scanTimer=null;}
}

document.getElementById('mod-card').addEventListener('click',function(e){
  if(e.target===e.currentTarget)closeModal();
});

function submitCard(){
  var u=document.getElementById('mu').value.trim().toUpperCase();
  var n=document.getElementById('mn').value.trim()||'Unknown';
  var e=document.getElementById('me').value.trim()||'N/A';
  if(!u){toast('Enter or scan a card UID','err');return;}
  var ep=editMode?'edit':'add';
  post('/api/tags/'+ep,{uid:u,name:n,empid:e})
    .then(function(r){return r.text();})
    .then(function(m){toast(m,'suc');closeModal();loadTags();})
    .catch(function(){toast('Request failed','err');});
}

function doDel(u){
  if(!confirm('Delete card '+u+'?\nThis cannot be undone.'))return;
  post('/api/tags/delete',{uid:u})
    .then(function(r){return r.text();})
    .then(function(m){toast(m,'suc');loadTags();})
    .catch(function(){toast('Failed','err');});
}

function doToggle(u){
  post('/api/tags/toggle',{uid:u})
    .then(function(r){return r.text();})
    .then(function(m){toast(m,'suc');loadTags();})
    .catch(function(){toast('Failed','err');});
}

function tapCard(){
  var sb=document.getElementById('scanBox');
  var st=document.getElementById('sst');
  sb.className='scan-box live';
  st.innerHTML='<span class="pls"></span>&nbsp;Waiting for card tap...';
  fetch('/api/start-scan');
  var tries=0;
  if(scanTimer)clearInterval(scanTimer);
  scanTimer=setInterval(function(){
    fetch('/api/poll-scan').then(function(r){return r.json();}).then(function(d){
      if(d.uid){
        clearInterval(scanTimer);scanTimer=null;
        document.getElementById('mu').value=d.uid;
        sb.className='scan-box done';
        st.innerHTML='&#10003; Scanned: <strong style="color:var(--success)">'+d.uid+'</strong>';
        toast('Card detected: '+d.uid,'suc');
      }else if(++tries>=30){
        clearInterval(scanTimer);scanTimer=null;
        sb.className='scan-box';
        st.textContent='Timeout. Try again.';
      }
    });
  },500);
}

// Init
syncTime();
loadDash();
setInterval(function(){
  if(document.getElementById('page-dash').classList.contains('active'))loadDash();
},30000);
</script>
</body>
</html>)rawhtml";



// ================================================================
// SETUP
// ================================================================
void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout detector
    Serial.begin(115200);
    pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, LOW);
    pinMode(STOCK_BTN, INPUT_PULLUP);
    pinMode(WIFI_BTN,  INPUT_PULLUP);

    // ── Step 1: SPI CS pins HIGH ──
    pinMode(RFID_SS, OUTPUT); digitalWrite(RFID_SS, HIGH);
    delay(100);  // let power-rails stabilise

    // ── Step 2: LCD + RTC over I2C (independent of SPI) ──
    Wire.begin(21, 22);  // SDA=21, SCL=22  (shared by LCD & RTC)
    lcd.begin(16, 2);
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Lyra Vending v4");

    rtcOK = rtc.begin();
    if (rtcOK) {
        if (!rtc.isrunning()) {
            // RTC oscillator not running (first use or dead battery) — time is unknown
            Serial.println("RTC not running — please set time via web UI");
            rtcOK = false;  // treat as unset until synced
        } else {
            DateTime now = rtc.now();
            // Populate software fallback too (used when WiFi handlers call nowEpoch)
            baseEpoch = now.unixtime();
            baseMs    = millis();
            Serial.printf("RTC OK: %04d-%02d-%02d %02d:%02d:%02d\n",
                now.year(), now.month(), now.day(),
                now.hour(), now.minute(), now.second());
        }
    } else {
        Serial.println("DS3231 not found — check SDA/SCL wiring");
    }

    // ── Step 3: SPI init (for RFID) ──
    SPI.begin(18, 19, 23, -1);
    delay(10);

    // ── Step 4: LittleFS init (internal flash storage) ──
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS mount failed — formatting...");
        LittleFS.format();
        LittleFS.begin(false);
    }
    initFS(); loadCfg(); loadTags();
    Serial.println("Storage OK (LittleFS)");
    lcdMsg("Storage OK", "");

    // ── Step 6: RFID ──
    rfid.PCD_Init(); delay(100);
    rfidVersion = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("RFID ver: 0x%02X\n", rfidVersion);

    // Use RTC-based day counter for daily-limit tracking if available
    today = (unsigned long)(nowEpoch() / 86400UL);
    showImage(0);
    showIdle();
    Serial.println("Boot complete.");
}

// ================================================================
// LOOP
// ================================================================
void loop() {
    // WiFi button -- 1st press = ON, 2nd press = OFF
    if (digitalRead(WIFI_BTN) == LOW) {
        delay(50);
        if (digitalRead(WIFI_BTN) == LOW) {
            if (!wifiActive) { startWifi(); }
            else             { stopWifi();  }
            while (digitalRead(WIFI_BTN) == LOW) delay(50);
        }
    }

    // WiFi auto-off: 5 min with no device connected
    if (wifiActive) {
        if (WiFi.softAPgetStationNum() > 0) lastConnectedMs = millis();
        if (millis() - lastConnectedMs > WIFI_TIMEOUT_MS) stopWifi();
    }

    if (wifiActive) server.handleClient();

    // Refresh clock in status bar every 30 seconds while idle
    static unsigned long idleClockMs = 0;
    if (millis() - idleClockMs > 30000UL) {
        idleClockMs = millis();
        lcdMsg(machineName, (String("Napkins: ") + stock).c_str());
    }

    // Stock refill button
    if (digitalRead(STOCK_BTN) == LOW) {
        delay(50);
        if (digitalRead(STOCK_BTN) == LOW) {
            stock = MAX_STOCK; saveCfg();
            lcdMsg("Refilled!", "Stock: 25");
            showImage(0);
            delay(2000);
            showIdle();
            while (digitalRead(STOCK_BTN) == LOW) delay(50);
        }
    }

    // RFID — assert RFID_SS before using SPI
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
        String uid = "";
        for (byte i = 0; i < rfid.uid.size; i++) {
            if (rfid.uid.uidByte[i] < 0x10) uid += "0";
            uid += String(rfid.uid.uidByte[i], HEX);
        }
        uid.toUpperCase();
        Serial.print("Card: "); Serial.println(uid);
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();   // release RC522 SPI bus cleanly
        digitalWrite(RFID_SS, HIGH);
        if (waitingForScan) {
            // capture UID for web add-card flow
            scannedUID     = uid;
            waitingForScan = false;
            lcdMsg("Card Captured!", uid.substring(0,16).c_str());
            delay(800);
            showIdle();
        } else {
            handleScan(uid);
            delay(1500);
        }
    }
}
// ================================================================
// LCD DISPLAY (HW-61 — 1602A 16×2 over I2C)
// ================================================================

// Per-state messages for showImage() — index matches image number 0-9
static const char* const LCD_ROW0[] = {
    "",               // 0 idle  (handled by showIdle)
    "Card Detected",  // 1 card
    "Authorized",     // 2 auth
    "Dispensing...",  // 3 dispense
    "Collect Napkin!",// 4 collect
    "Unauthorized",   // 5 deny
    "Daily Limit",    // 6 limit
    "Out of Stock!",  // 7 empty
    "System Error",   // 8 error
    "WiFi Active"     // 9 wifi
};
static const char* const LCD_ROW1[] = {
    "",               // 0 idle
    "",               // 1 card
    "OK",             // 2 auth
    "Please wait",    // 3 dispense
    "",               // 4 collect
    "Access Denied",  // 5 deny
    "Reached!",       // 6 limit
    "Refill needed",  // 7 empty
    "",               // 8 error
    "192.168.4.1"     // 9 wifi
};

void showImage(uint8_t n) {
    if (n == 0) { showIdle(); return; }
    if (n >= 10) n = 8;
    lcdMsg(LCD_ROW0[n], LCD_ROW1[n]);
}

// ================================================================
// RFID SCAN HANDLING
// ================================================================
int findTag(const String& uid) {
    for (int i = 0; i < tagCount; i++)
        if (tags[i].active && String(tags[i].uid) == uid) return i;
    return -1;
}

void handleScan(const String& uid) {
    Serial.printf("[handleScan] uid=%s wifiActive=%d\n", uid.c_str(), (int)wifiActive);
    showImage(1);
    lcdMsg("Card Detected", uid.substring(0,16).c_str());
    activeDelay(3000);

    int idx = findTag(uid);
    Serial.printf("[handleScan] findTag=%d\n", idx);
    if (idx == -1) {
        showImage(5);
        lcdMsg("Unauthorized", "Card!");
        activeDelay(3000);
        showImage(0); showIdle();
        return;
    }

    // Daily reset
    unsigned long nowDay = millis() / 86400000UL;
    Serial.printf("[handleScan] nowDay=%lu lastDay=%lu dailyCount=%d limit=%d\n",
        nowDay, tags[idx].lastDay, tags[idx].dailyCount, dailyLimit);
    if (nowDay != tags[idx].lastDay) {
        Serial.println("[handleScan] daily reset, calling saveTags");
        tags[idx].dailyCount = 0;
        tags[idx].lastDay    = nowDay;
        saveTags();
    }

    if (tags[idx].dailyCount >= dailyLimit) {
        showImage(6);
        lcdMsg("Daily Limit", "Reached!");
        activeDelay(3000);
        showImage(0); showIdle();
        return;
    }

    Serial.println("[handleScan] calling vend");
    vend(uid, idx);
}

void vend(const String& uid, int idx) {
    Serial.printf("[vend] stock=%d\n", stock);
    if (stock <= 0) {
        showImage(7);
        lcdMsg("Out of Stock!", "Refill needed");
        activeDelay(3000);
        showImage(0); showIdle();
        return;
    }

    showImage(3);
    lcdMsg("Dispensing...", "Please wait");
    activeDelay(150);

    digitalWrite(RELAY_PIN, HIGH);
    activeDelay(2850);
    digitalWrite(RELAY_PIN, LOW);
    Serial.println("[vend] relay done, saving");

    stock--;
    tags[idx].dailyCount++;
    Serial.printf("[vend] stock now=%d dailyCount=%d, calling saveCfg\n", stock, tags[idx].dailyCount);
    saveCfg();
    Serial.println("[vend] calling saveTags");
    saveTags();
    Serial.println("[vend] calling logTx");
    logTx(uid, idx);

    showImage(4);
    char line2[17];
    snprintf(line2, sizeof(line2), "Used:%d/%d Stk:%d", tags[idx].dailyCount, dailyLimit, stock);
    lcdMsg("Collect Napkin!", line2);
    activeDelay(3000);
    showImage(0); showIdle();
}

// ================================================================
// LITTLEFS  --  Config / Tags / Log
// ================================================================
void initFS() {
    if (!LittleFS.exists(F_LOG)) {
        File f = LittleFS.open(F_LOG, "w");
        if (f) { f.println("TxID,UID,EmpID,Name,Machine,MachineID,Location,Date,Time,UptimeSec,Uptime"); f.close(); }
    }
    if (!LittleFS.exists(F_TAGS)) { File f = LittleFS.open(F_TAGS, "w"); if (f) f.close(); }
    if (!LittleFS.exists(F_CFG)) {
        File f = LittleFS.open(F_CFG, "w");
        if (f) {
            f.printf("stock=%d\ndailylimit=%d\nmachinename=%s\nmachineid=%s\nmachilelocation=%s\nbaseepoch=0\nbasems=0\ntxcounter=0\n",
                     MAX_STOCK, dailyLimit, machineName, machineId, machineLocation);
            f.close();
        }
    }
}

void loadCfg() {
    File f = LittleFS.open(F_CFG, "r"); if (!f) return;
    while (f.available()) {
        String line = f.readStringUntil('\n'); line.trim();
        if      (line.startsWith("stock="))          stock      = line.substring(6).toInt();
        else if (line.startsWith("dailylimit="))     dailyLimit = line.substring(11).toInt();
        else if (line.startsWith("machinename="))    line.substring(12).toCharArray(machineName, 40);
        else if (line.startsWith("machineid="))      line.substring(10).toCharArray(machineId, 20);
        else if (line.startsWith("machilelocation="))line.substring(16).toCharArray(machineLocation, 60);
        else if (line.startsWith("baseepoch="))      baseEpoch  = (unsigned long)line.substring(10).toInt();
        else if (line.startsWith("basems="))         baseMs     = millis(); // recalibrate on load
        else if (line.startsWith("txcounter="))      txCounter  = line.substring(10).toInt();
    }
    f.close();
}

void saveCfg() {
    LittleFS.remove(F_CFG);
    File f = LittleFS.open(F_CFG, "w");
    if (!f) { Serial.println("[saveCfg] open failed"); return; }
    f.printf("stock=%d\ndailylimit=%d\nmachinename=%s\nmachineid=%s\nmachilelocation=%s\nbaseepoch=%lu\nbasems=%lu\ntxcounter=%d\n",
             stock, dailyLimit, machineName, machineId, machineLocation, baseEpoch, baseMs, txCounter);
    f.close();
    Serial.println("[saveCfg] done");
}

void loadTags() {
    tagCount = 0;
    File f = LittleFS.open(F_TAGS, "r"); if (!f) return;
    while (f.available() && tagCount < MAX_RFID_TAGS) {
        String line = f.readStringUntil('\n'); line.trim();
        if (line.length() == 0) continue;
        // Format: uid,name,empId,dailyCount,lastDay,active
        // Legacy (4 fields): uid,dailyCount,lastDay,active — handled gracefully
        int c1=line.indexOf(','), c2=line.indexOf(',',c1+1),
            c3=line.indexOf(',',c2+1), c4=line.indexOf(',',c3+1),
            c5=line.indexOf(',',c4+1);
        if (c1 < 1) continue;
        line.substring(0,c1).toCharArray(tags[tagCount].uid, 20);
        if (c5 > 0) {
            // new 6-field format
            line.substring(c1+1,c2).toCharArray(tags[tagCount].name,  40);
            line.substring(c2+1,c3).toCharArray(tags[tagCount].empId, 20);
            tags[tagCount].dailyCount = line.substring(c3+1,c4).toInt();
            tags[tagCount].lastDay    = (unsigned long)line.substring(c4+1,c5).toInt();
            tags[tagCount].active     = line.substring(c5+1).toInt() == 1;
        } else {
            // legacy 4-field format
            strcpy(tags[tagCount].name,  "Unknown");
            strcpy(tags[tagCount].empId, "N/A");
            tags[tagCount].dailyCount = line.substring(c1+1,c2).toInt();
            tags[tagCount].lastDay    = (unsigned long)line.substring(c2+1,c3).toInt();
            tags[tagCount].active     = line.substring(c3+1).toInt() == 1;
        }
        tagCount++;
    }
    f.close();
    Serial.printf("Loaded %d tags\n", tagCount);
}

void saveTags() {
    LittleFS.remove(F_TAGS);
    File f = LittleFS.open(F_TAGS, "w");
    if (!f) { Serial.println("[saveTags] open failed"); return; }
    for (int i = 0; i < tagCount; i++) {
        f.printf("%s,%s,%s,%d,%lu,%d\n",
                 tags[i].uid, tags[i].name, tags[i].empId,
                 tags[i].dailyCount, tags[i].lastDay, tags[i].active ? 1 : 0);
    }
    f.close();
    Serial.println("[saveTags] done");
}

void logTx(const String& uid, int tagIdx) {
    txCounter++;
    saveCfg();
    const char* empId = (tagIdx >= 0) ? tags[tagIdx].empId : "N/A";
    const char* name  = (tagIdx >= 0) ? tags[tagIdx].name  : "Unknown";
    File f = LittleFS.open(F_LOG, "a");
    if (!f) f = LittleFS.open(F_LOG, "w");
    if (f) {
        f.printf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%lu,%s\n",
                 txCounter, uid.c_str(), empId, name,
                 machineName, machineId, machineLocation,
                 getDateStr().c_str(), getTimeStr().c_str(),
                 millis()/1000, uptime().c_str());
        f.close();
    }
}

// ================================================================
// HELPERS
// ================================================================
String uptime() {
    unsigned long s = millis() / 1000;
    return String(s/86400)+"d "+String((s%86400)/3600)+"h "+String((s%3600)/60)+"m "+String(s%60)+"s";
}

// Use instead of delay() during vend/scan sequences so the web server
// stays responsive while images are on screen.
void activeDelay(unsigned long ms) {
    unsigned long end = millis() + ms;
    while (millis() < end) {
        if (wifiActive) server.handleClient();
        yield();
        delay(10);
    }
}

// Write two lines to the 16x2 LCD, padding each to 16 chars to clear stale chars.
void lcdMsg(const char* l0, const char* l1) {
    char row[17];
    lcd.setCursor(0, 0);
    snprintf(row, sizeof(row), "%-16s", l0 ? l0 : "");
    lcd.print(row);
    lcd.setCursor(0, 1);
    snprintf(row, sizeof(row), "%-16s", l1 ? l1 : "");
    lcd.print(row);
}

void showIdle() {
    char line0[17], line1[17];
    snprintf(line0, sizeof(line0), "%-16s", machineName);
    snprintf(line1, sizeof(line1), "Napkins: %-6d", stock);
    lcdMsg(line0, line1);
}

// ================================================================
// WIFI MANAGEMENT
// ================================================================
void startWifi() {
    WiFi.mode(WIFI_AP);
    WiFi.softAP(WIFI_SSID, WIFI_PASS);
    delay(300);

    wifiActive      = true;
    wifiStartMs     = millis();
    lastConnectedMs = millis();   // give 5 min from startup before auto-off kicks in
    setupRoutes();
    server.begin();
    showImage(9);
    lcdMsg("WiFi ON", "192.168.4.1");
    Serial.println("WiFi AP started");
    activeDelay(5000);        // show WiFi-ON screen 5 s; handles web clients + stays responsive
    showImage(0); showIdle(); // clear WiFi screen
}

void stopWifi() {
    server.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_OFF);
    wifiActive = false;
    delay(200);
    lcdMsg("WiFi OFF", "");
    delay(1000);
    showImage(0); showIdle();
    Serial.println("WiFi AP stopped");
}

// ================================================================
// WEB SERVER
// ================================================================
void setupRoutes() {
    server.on("/",                    HTTP_GET,  handleRoot);
    server.on("/health",              HTTP_GET,  handleHealth);
    server.on("/api/tags",            HTTP_GET,  handleGetTags);
    server.on("/api/tags/add",        HTTP_POST, handleAddTag);
    server.on("/api/tags/delete",     HTTP_POST, handleDeleteTag);
    server.on("/api/tags/toggle",     HTTP_POST, handleToggleTag);
    server.on("/api/set-limit",       HTTP_POST, handleSetLimit);
    server.on("/api/reset-stock",     HTTP_POST, handleResetStock);
    server.on("/download/report",     HTTP_GET,  handleDownloadReport);
    server.on("/api/start-scan",      HTTP_GET,  handleStartScan);
    server.on("/api/poll-scan",       HTTP_GET,  handlePollScan);
    server.on("/api/set-machine-info",HTTP_POST, handleSetMachineInfo);
    server.on("/api/set-time",        HTTP_POST, handleSetTime);
    server.on("/setup",               HTTP_GET,  handleSetup);
    server.on("/api/tags/edit",       HTTP_POST, handleEditTag);
    server.on("/api/log/recent",      HTTP_GET,  handleRecentLog);
    server.on("/api/stats/chart",     HTTP_GET,  handleChart7);
}

// ---- Root: always serve from PROGMEM so SD is never held open during page load ----
// Serving 40 KB from SD over WiFi takes several seconds and leaves SPI busy;
// PROGMEM is faster and avoids all SD-bus conflicts.
void handleRoot() {
    server.send_P(200, "text/html", HTML_PAGE);
}

// ---- Machine health JSON ----
void handleHealth() {
    int active = 0;
    for (int i = 0; i < tagCount; i++) if (tags[i].active) active++;
    // txCounter is kept in RAM — no SD read needed here
    char json[520];
    snprintf(json, sizeof(json),
        "{\"stock\":%d,\"maxStock\":%d,\"totalTx\":%lu,"
        "\"activeTags\":%d,\"totalTags\":%d,\"dailyLimit\":%d,"
        "\"fsOK\":true,\"rtcOK\":%s,\"rfidVer\":\"%s\",\"uptime\":\"%s\","
        "\"date\":\"%s\",\"time\":\"%s\","
        "\"machineName\":\"%s\",\"machineId\":\"%s\",\"machineLocation\":\"%s\"}",
        stock, MAX_STOCK, txCounter,
        active, tagCount, dailyLimit,
        rtcOK ? "true" : "false",
        String(rfidVersion, HEX).c_str(), uptime().c_str(),
        getDateStr().c_str(), getTimeStr().c_str(),
        machineName, machineId, machineLocation);
    server.send(200, "application/json", json);
}

// ---- Tags JSON — chunked to avoid large heap String allocations ----
void handleGetTags() {
    server.setContentLength(CONTENT_LENGTH_UNKNOWN);
    server.send(200, "application/json", "");
    server.sendContent("[");
    char buf[160];
    for (int i = 0; i < tagCount; i++) {
        snprintf(buf, sizeof(buf),
            "%s{\"u\":\"%s\",\"n\":\"%s\",\"e\":\"%s\",\"c\":%d,\"l\":%d,\"a\":%s}",
            i > 0 ? "," : "",
            tags[i].uid, tags[i].name, tags[i].empId,
            tags[i].dailyCount, dailyLimit,
            tags[i].active ? "true" : "false");
        server.sendContent(buf);
        yield();  // feed watchdog between items
    }
    server.sendContent("]");
    server.sendContent("");
}

void handleAddTag() {
    if (!server.hasArg("uid")) { server.send(400, "text/plain", "Missing UID"); return; }
    String uid   = server.arg("uid");   uid.toUpperCase(); uid.trim();
    String name  = server.hasArg("name")  ? server.arg("name")  : "Unknown";
    String empId = server.hasArg("empid") ? server.arg("empid") : "N/A";
    name.trim(); empId.trim();
    if (uid.length() == 0) { server.send(400, "text/plain", "Empty UID"); return; }
    // Check duplicate (search all, not just active)
    for (int i = 0; i < tagCount; i++) if (String(tags[i].uid) == uid) { server.send(400, "text/plain", "Tag already exists!"); return; }
    if (tagCount >= MAX_RFID_TAGS) { server.send(400, "text/plain", "Tag list full (500)!"); return; }
    uid.toCharArray(tags[tagCount].uid, 20);
    name.toCharArray(tags[tagCount].name, 40);
    empId.toCharArray(tags[tagCount].empId, 20);
    tags[tagCount].dailyCount = 0;
    tags[tagCount].lastDay    = millis() / 86400000UL;
    tags[tagCount].active     = true;
    tagCount++;
    saveTags();
    server.send(200, "text/plain", "Tag added! Total: " + String(tagCount));
}

void handleDeleteTag() {
    if (!server.hasArg("uid")) { server.send(400, "text/plain", "Missing UID"); return; }
    String uid = server.arg("uid"); uid.toUpperCase();
    for (int i = 0; i < tagCount; i++) {
        if (String(tags[i].uid) == uid) {
            for (int j = i; j < tagCount - 1; j++) tags[j] = tags[j+1];
            tagCount--;
            saveTags();
            server.send(200, "text/plain", "Deleted. Remaining: " + String(tagCount));
            return;
        }
    }
    server.send(400, "text/plain", "Tag not found!");
}

void handleToggleTag() {
    if (!server.hasArg("uid")) { server.send(400, "text/plain", "Missing UID"); return; }
    String uid = server.arg("uid"); uid.toUpperCase();
    for (int i = 0; i < tagCount; i++) {
        if (String(tags[i].uid) == uid) {
            tags[i].active = !tags[i].active;
            saveTags();
            server.send(200, "text/plain", uid + (tags[i].active ? " activated" : " deactivated"));
            return;
        }
    }
    server.send(400, "text/plain", "Tag not found!");
}

void handleSetLimit() {
    if (!server.hasArg("limit")) { server.send(400, "text/plain", "Missing limit"); return; }
    int v = server.arg("limit").toInt();
    if (v < 1 || v > 100) { server.send(400, "text/plain", "Limit must be 1-100"); return; }
    dailyLimit = v;
    saveCfg();
    server.send(200, "text/plain", "Daily limit set to " + String(dailyLimit) + " for all cards.");
}

void handleResetStock() {
    stock = MAX_STOCK;
    saveCfg();
    server.send(200, "text/plain", "Stock reset to 25.");
}

// ---- Scan-to-add: start scan mode ----
void handleStartScan() {
    waitingForScan = true;
    scannedUID     = "";
    lcdMsg("Tap RFID Card", "to add it...");
    server.send(200, "application/json", "{\"ok\":true}");
}

// ---- Scan-to-add: poll for result ----
void handlePollScan() {
    if (scannedUID.length() > 0) {
        String uid = scannedUID;
        scannedUID = "";
        server.send(200, "application/json", "{\"uid\":\"" + uid + "\"}");
    } else {
        server.send(200, "application/json", "{\"uid\":\"\"}");
    }
}

// ---- Update machine identity info ----
void handleSetMachineInfo() {
    if (server.hasArg("mname")) server.arg("mname").toCharArray(machineName,     40);
    if (server.hasArg("mid"))   server.arg("mid").toCharArray(machineId,         20);
    if (server.hasArg("mloc"))  server.arg("mloc").toCharArray(machineLocation,  60);
    saveCfg();
    server.send(200, "text/plain", "Machine info saved.");
}

// ---- Sync real-world time from browser ----
void handleSetTime() {
    if (!server.hasArg("epoch")) { server.send(400, "text/plain", "Missing epoch"); return; }
    // Browser sends UTC epoch; convert to IST (UTC+5:30) before storing
    unsigned long ep = (unsigned long)server.arg("epoch").toInt() + IST_OFFSET_SEC;
    // Write IST time to DS1307 hardware RTC if present
    if (rtc.begin()) {                    // re-check in case wired after boot
        rtc.adjust(DateTime((uint32_t)ep));
        rtcOK = true;
        Serial.printf("RTC adjusted to IST epoch %lu\n", ep);
    }
    // Always update software fallback too
    baseEpoch = ep;
    baseMs    = millis();
    saveCfg();
    String msg = rtcOK ? "RTC set (IST): " : "Software clock set (IST, no RTC): ";
    server.send(200, "text/plain", msg + getDateStr() + " " + getTimeStr());
}

// ---- (Re)write index.html to SD from PROGMEM ----
void handleSetup() {
    server.sendHeader("Location", "/");
    server.send(302, "text/plain", "Redirecting...");
}

// ---- Edit existing tag name / empId ----
void handleEditTag() {
    if (!server.hasArg("uid")) { server.send(400, "text/plain", "Missing UID"); return; }
    String uid   = server.arg("uid"); uid.toUpperCase(); uid.trim();
    String name  = server.hasArg("name")  ? server.arg("name")  : "";
    String empId = server.hasArg("empid") ? server.arg("empid") : "";
    name.trim(); empId.trim();
    for (int i = 0; i < tagCount; i++) {
        if (String(tags[i].uid) == uid) {
            if (name.length()  > 0) name.toCharArray(tags[i].name,  40);
            if (empId.length() > 0) empId.toCharArray(tags[i].empId, 20);
            saveTags();
            server.send(200, "text/plain", "Card updated: " + uid);
            return;
        }
    }
    server.send(400, "text/plain", "Tag not found!");
}

// ---- Recent transactions JSON ----
void handleRecentLog() {
    int n = 15;
    if (server.hasArg("n")) n = constrain(server.arg("n").toInt(), 1, 50);
    File f = LittleFS.open(F_LOG, "r");
    if (!f) { server.send(200, "application/json", "[]"); return; }

    // Collect last n data lines
    const int MAXN = 50;
    String buf[MAXN];
    int total = 0;
    bool hdr = true;
    while (f.available()) {
        String line = f.readStringUntil('\n'); line.trim();
        if (hdr) { hdr = false; continue; }
        if (line.length() == 0) continue;
        buf[total % MAXN] = line;
        total++;
        yield();  // feed watchdog — log can be large
    }
    f.close();

    int actual = min(total, MAXN);
    // Build JSON — newest first
    String json = "[";
    bool first = true;
    for (int i = actual - 1; i >= 0 && (actual - 1 - i) < n; i--) {
        int idx = (total <= MAXN) ? i : (total + i) % MAXN;
        String& ln = buf[idx % MAXN];
        // Parse fields: 0=TxID 1=UID 2=EmpID 3=Name 7=Date 8=Time
        int pos[12]; int pcount = 0; pos[0] = 0;
        for (int c = 0; c < (int)ln.length() && pcount < 11; c++)
            if (ln[c] == ',') pos[++pcount] = c + 1;
        if (!first) json += ",";
        first = false;
        auto fld = [&](int fi) -> String {
            if (fi >= pcount + 1) return "N/A";
            int s = pos[fi];
            int e = (fi < pcount) ? pos[fi+1] - 1 : ln.length();
            return ln.substring(s, e);
        };
        json += "{\"id\":\"" + fld(0) + "\",\"uid\":\"" + fld(1) + "\","
                "\"empid\":\"" + fld(2) + "\",\"name\":\"" + fld(3) + "\","
                "\"date\":\"" + fld(7) + "\",\"time\":\"" + fld(8) + "\"}";
    }
    json += "]";
    server.send(200, "application/json", json);
}

// ---- 7-day vend chart data ----
void handleChart7() {
    struct DS { char date[12]; int count; };
    DS days[7] = {};
    int dc = 0;

    File f = LittleFS.open(F_LOG, "r");
    if (f) {
        bool hdr = true;
        while (f.available()) {
            String line = f.readStringUntil('\n'); line.trim();
            if (hdr) { hdr = false; continue; }
            if (line.length() == 0) continue;
            // Date is field 7
            int pos = 0;
            for (int fi = 0; fi < 7; fi++) { int nx = line.indexOf(',', pos); if (nx < 0) { pos = -1; break; } pos = nx + 1; }
            if (pos < 0) continue;
            int end = line.indexOf(',', pos);
            String date = (end < 0) ? line.substring(pos) : line.substring(pos, end);
            if (date.length() < 8 || date == "N/A") continue;
            bool found = false;
            for (int i = 0; i < dc; i++) { if (String(days[i].date) == date) { days[i].count++; found = true; break; } }
            if (!found && dc < 7) { date.toCharArray(days[dc].date, 12); days[dc].count = 1; dc++; }
            yield();  // feed watchdog
        }
        f.close();
    }

    String json = "[";
    for (int i = 0; i < dc; i++) {
        if (i > 0) json += ",";
        String d = String(days[i].date);          // YYYY-MM-DD
        String lbl = d.length() >= 10 ? d.substring(5) : d;   // MM-DD
        json += "{\"label\":\"" + lbl + "\",\"count\":" + String(days[i].count) + "}";
    }
    json += "]";
    server.send(200, "application/json", json);
}

// ---- Download full report: machine status header + full transaction log ----
void handleDownloadReport() {
    int active = 0;
    for (int i = 0; i < tagCount; i++) if (tags[i].active) active++;
    // Use txCounter from RAM — no need to open SD just to count lines

    server.sendHeader("Content-Disposition", "attachment; filename=lyra_report.csv");
    server.setContentLength(CONTENT_LENGTH_UNKNOWN);
    server.send(200, "text/csv", "");

    // Machine status header — use sendContent() to stay inside chunked framing
    server.sendContent("# LYRA VENDING MACHINE REPORT\r\n");
    server.sendContent("# Generated: " + getDateStr() + " " + getTimeStr() + " (Uptime: " + uptime() + ")\r\n");
    server.sendContent("# Machine Name: " + String(machineName) + "\r\n");
    server.sendContent("# Machine ID: "   + String(machineId)   + "\r\n");
    server.sendContent("# Location: "     + String(machineLocation) + "\r\n");
    server.sendContent("# Stock: " + String(stock) + " / " + String(MAX_STOCK) + "\r\n");
    server.sendContent("# Total Transactions: " + String(txCounter) + "\r\n");
    yield();
    server.sendContent("# Active Tags: " + String(active) + " / " + String(tagCount) + "\r\n");
    server.sendContent("# Daily Limit Per Card: " + String(dailyLimit) + "\r\n");
    server.sendContent("# RFID Version: 0x" + String(rfidVersion, HEX) + "\r\n");
    server.sendContent("# Storage: LittleFS (internal flash)\r\n");
    server.sendContent("#\r\n");
    server.sendContent("# TRANSACTION LOG\r\n");
    // Stream the full log (first line is the column header already in the file)
    File lf = LittleFS.open(F_LOG, "r");
    if (lf) {
        while (lf.available()) {
            String line = lf.readStringUntil('\n'); line.trim();
            if (line.length() > 0) server.sendContent(line + "\r\n");
            yield();  // feed watchdog during long stream
        }
        lf.close();
    }

    server.sendContent("");   // terminate chunked response
}