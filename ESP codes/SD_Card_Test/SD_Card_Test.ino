// HW-125 SD Card Library Test -- CS=GPIO26
// Tries multiple SPI init strategies + frequencies
//
// HW-125  ->  ESP32
// VCC     ->  VIN (5V)
// GND     ->  GND
// MISO    ->  GPIO 19
// MOSI    ->  GPIO 23
// SCK     ->  GPIO 18
// CS      ->  GPIO 26
//
// Serial Monitor: 115200 baud

#include <SD.h>
#include <SPI.h>

#define SD_CS_PIN  26
#define PIN_SCK    18
#define PIN_MISO   19
#define PIN_MOSI   23

void sep() { Serial.println("============================================"); }

void setup() {
    Serial.begin(115200);
    delay(2000);
    sep();
    Serial.println("  HW-125 Library Test (CS=GPIO26)");
    sep();

    bool ok = false;
    uint32_t goodFreq = 0;
    uint32_t freqs[] = { 400000, 1000000, 4000000, 8000000 };

    // Strategy A: no explicit SPI.begin, let SD handle it
    const char* labA[] = { "NO SPI.begin + 400kHz", "NO SPI.begin + 1MHz",
                            "NO SPI.begin + 4MHz",   "NO SPI.begin + 8MHz" };
    for (int i = 0; i < 4 && !ok; i++) {
        SD.end(); delay(200);
        pinMode(SD_CS_PIN, OUTPUT);
        digitalWrite(SD_CS_PIN, HIGH);
        delay(100);
        Serial.printf("  %-36s ... ", labA[i]); Serial.flush();
        ok = SD.begin(SD_CS_PIN, SPI, freqs[i]);
        Serial.println(ok ? "PASSED" : "failed");
        if (ok) goodFreq = freqs[i];
    }

    // Strategy B: explicit SPI.begin(SCK,MISO,MOSI) -- NO CS arg
    const char* labB[] = { "SPI.begin(18,19,23) + 400kHz", "SPI.begin(18,19,23) + 1MHz",
                            "SPI.begin(18,19,23) + 4MHz",   "SPI.begin(18,19,23) + 8MHz" };
    for (int i = 0; i < 4 && !ok; i++) {
        SD.end(); delay(100);
        SPI.end(); delay(50);
        SPI.begin(18, 19, 23);  // SCK, MISO, MOSI -- no CS
        delay(100);
        pinMode(SD_CS_PIN, OUTPUT);
        digitalWrite(SD_CS_PIN, HIGH);
        delay(100);
        Serial.printf("  %-36s ... ", labB[i]); Serial.flush();
        ok = SD.begin(SD_CS_PIN, SPI, freqs[i]);
        Serial.println(ok ? "PASSED" : "failed");
        if (ok) goodFreq = freqs[i];
    }

    sep();
    if (!ok) {
        Serial.println("ALL STRATEGIES FAILED.");
        Serial.println("Paste this full output so we can debug further.");
        while (true) delay(1000);
    }

    Serial.printf("SD.begin() PASSED at %lu Hz!\n", goodFreq);
    sep();

    Serial.print("[A] Card type ....... ");
    switch (SD.cardType()) {
        case CARD_MMC:  Serial.println("MMC");    break;
        case CARD_SD:   Serial.println("SDSC");   break;
        case CARD_SDHC: Serial.println("SDHC");   break;
        default:        Serial.println("UNKNOWN"); break;
    }

    uint64_t sz = SD.cardSize();
    Serial.printf("[B] Card size ....... %lu MB\n", (unsigned long)(sz / (1024*1024)));
    Serial.printf("[C] Total space ..... %lu MB\n", (unsigned long)(SD.totalBytes() / (1024*1024)));
    Serial.printf("    Used space ...... %lu KB\n", (unsigned long)(SD.usedBytes() / 1024));

    Serial.print("[D] Write test ...... ");
    SD.remove("/test.txt");
    File f = SD.open("/test.txt", FILE_WRITE);
    if (!f) { Serial.println("FAILED"); }
    else { f.println("HW-125 OK"); f.close(); Serial.println("PASSED"); }

    Serial.print("[E] Read  test ...... ");
    f = SD.open("/test.txt", FILE_READ);
    if (!f) { Serial.println("FAILED"); }
    else {
        String s = f.readStringUntil('\n'); f.close();
        Serial.println("PASSED -> " + s);
    }
    SD.remove("/test.txt");

    sep();
    Serial.println("ALL DONE. SD ready for vending machine firmware.");
    sep();
}

void loop() {}