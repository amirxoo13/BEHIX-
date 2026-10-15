import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { speakableText, wavDuration } from "./tts.ts";

/** یک WAV واقعی ۱۶ بیتی تک‌کانال با `samples` نمونه. */
function wav(samples: number, rate = 22050): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return buf;
}

describe("Persian text to speech helpers", () => {
  it("UT-TTS-01 stage directions in parentheses are not read aloud", () => {
    assert.equal(speakableText("سلام پهلوان! (خندان، اشاره)"), "سلام پهلوان!");
    assert.equal(speakableText("«دیر کردی.»"), "دیر کردی.");
    assert.equal(speakableText("(فقط حالت)"), "");
  });
  it("UT-TTS-02 WAV length is read from the header", () => {
    assert.equal(wavDuration(wav(22050 * 2)), 2);
    assert.equal(wavDuration(wav(11025)), 0.5);
    assert.equal(wavDuration(new ArrayBuffer(10)), 0);
  });
});
