// Writes the alert sounds in assets/sounds: short beeps made here, so no sound
// file comes from anywhere else. Run: node scripts/make-sounds.mjs
import { writeFileSync } from 'node:fs';

const RATE = 22050;

// Each part: [frequency in Hz (0 = silence), length in ms].
function wav(parts, volume = 0.6) {
  const samples = [];
  for (const [hz, ms] of parts) {
    const n = Math.round((RATE * ms) / 1000);
    const fade = Math.min(Math.round(RATE * 0.006), Math.floor(n / 2));
    for (let i = 0; i < n; i++) {
      const env = hz ? Math.min(1, i / fade, (n - 1 - i) / fade) : 0;
      samples.push(Math.round(Math.sin((2 * Math.PI * hz * i) / RATE) * env * volume * 32767));
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const out = new URL('../assets/sounds/', import.meta.url);
// A value went past its limit: two falling tones.
writeFileSync(new URL('alert.wav', out), wav([[988, 140], [0, 60], [784, 180]]));
// Shift light: one short high beep.
writeFileSync(new URL('shift.wav', out), wav([[1568, 90]], 0.5));
// Knock or DPF regeneration: three short beeps.
writeFileSync(new URL('warn.wav', out), wav([[660, 90], [0, 70], [660, 90], [0, 70], [660, 90]]));
// A long read finished while Pin16 was in the background: three rising tones.
writeFileSync(new URL('done.wav', out), wav([[659, 110], [0, 30], [784, 110], [0, 30], [1047, 220]], 0.5));
console.log('Wrote alert.wav, shift.wav, warn.wav, done.wav');
