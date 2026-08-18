#include <Wire.h>
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  delay(500);
  Serial.println("Scanning I2C...");
  byte found = 0;
  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found device at 0x");
      Serial.println(a, HEX);
      found++;
    }
  }
  if (found == 0) Serial.println("NO device found - check SDA/SCL wiring");
  else Serial.println("Scan done.");
}
void loop() {}