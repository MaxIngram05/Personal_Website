// All sound is synthesized with Web Audio: no audio files.
// Dialogue blips respect the SOUND toggle (off by default); the guitar is an
// explicit instrument, so plucking it always plays.

const STORE_KEY = "mi-sound";
let ctx = null;
let muted = true;
try {
  muted = localStorage.getItem(STORE_KEY) !== "on";
} catch {}

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(STORE_KEY, muted ? "off" : "on");
  } catch {}
  if (!muted) context();
}

// Call from a user gesture so the context is allowed to start.
export function unlock() {
  if (!muted) context();
}

let lastBlip = 0;
export function blip(pitch = 1) {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - lastBlip < 0.035) return; // don't stack blips on fast text
  lastBlip = now;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.value = (430 + Math.random() * 40) * pitch;
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function chime() {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  [784, 1047, 1319].forEach((f, i) => {
    const t = ac.currentTime + i * 0.07;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

// --- Guitar: Karplus-Strong plucked string ---------------------------------
// A burst of noise circulates through a delay line one period long; averaging
// neighbouring samples each pass acts as a low-pass filter, so the bright
// attack mellows and decays the way a real string does.

export const STRINGS = [
  { note: "E", freq: 82.41 },
  { note: "A", freq: 110.0 },
  { note: "D", freq: 146.83 },
  { note: "G", freq: 196.0 },
  { note: "B", freq: 246.94 },
  { note: "e", freq: 329.63 },
];

const pluckCache = new Map();

function karplusStrong(ac, freq, seconds = 2.6) {
  const rate = ac.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ac.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  const period = Math.round(rate / freq);
  const decay = 0.996 + Math.min(freq, 330) / 330 * 0.0025;
  for (let i = 0; i < period; i++) out[i] = Math.random() * 2 - 1;
  for (let i = period; i < length; i++) {
    out[i] = decay * 0.5 * (out[i - period] + out[i - period + 1]);
  }
  // Short fade-in on the noise burst avoids a click.
  for (let i = 0; i < 64; i++) out[i] *= i / 64;
  return buffer;
}

export function pluck(index) {
  const ac = context();
  if (!ac) return;
  const s = STRINGS[index];
  if (!s) return;
  if (!pluckCache.has(index)) pluckCache.set(index, karplusStrong(ac, s.freq));
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = pluckCache.get(index);
  gain.gain.value = 0.38;
  src.connect(gain).connect(ac.destination);
  src.start();
}
