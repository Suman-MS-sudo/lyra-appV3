"""
Converts text messages into voice_clips.h for the ESP32 built-in DAC,
using fully offline text-to-speech (Windows SAPI5 via pyttsx3 - no internet needed).

Setup (one time):
    pip install pyttsx3 pydub
    (pydub also needs ffmpeg installed and on PATH)

Usage:
    1. Edit the PHRASES dict below with whatever messages you want spoken.
    2. Run: python convert_audio.py
    3. Copy the printed output into voice_clips.h, replacing the placeholder arrays.

To use your own recordings instead of TTS, skip this script's synthesize step -
just drop WAV files named to match the keys below and set USE_TTS = False.
"""

import pyttsx3
from pydub import AudioSegment

SAMPLE_RATE = 8000  # must match AUDIO_SAMPLE_RATE in the .ino
USE_TTS = True

PHRASES = {
    "clip_vend_success_data": "Please collect your napkin",
    "clip_empty_data": "Out of stock. Please refill",
    "clip_refilled_data": "Stock refilled",
    "clip_jam_data": "Machine error. Please check the dispenser",
}

def synthesize(text, out_wav):
    engine = pyttsx3.init()
    engine.setProperty("rate", 150)  # words per minute, slower = clearer over a small speaker
    engine.save_to_file(text, out_wav)
    engine.runAndWait()

def convert_to_pcm(path):
    audio = AudioSegment.from_file(path)
    audio = audio.set_channels(1).set_frame_rate(SAMPLE_RATE).set_sample_width(1)
    return audio.raw_data

def emit(name, raw_bytes):
    print(f"const uint8_t {name}[] PROGMEM = {{")
    for i in range(0, len(raw_bytes), 20):
        chunk = raw_bytes[i:i+20]
        print("    " + ", ".join(str(b) for b in chunk) + ",")
    print("};")
    print(f"// {len(raw_bytes)} bytes (~{len(raw_bytes)/SAMPLE_RATE:.1f} sec)\n")

if __name__ == "__main__":
    for name, text in PHRASES.items():
        wav_path = f"{name}.wav"
        if USE_TTS:
            print(f"// Synthesizing: \"{text}\"")
            synthesize(text, wav_path)
        try:
            data = convert_to_pcm(wav_path)
            emit(name, data)
        except FileNotFoundError:
            print(f"// SKIPPED: {wav_path} not found\n")
