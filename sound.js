// 効果音（Web Audio で作る）。音のオン・オフは localStorage の chess-3d.sound に覚える。
let ctx = null;
let on = true;
try { on = localStorage.getItem('chess-3d.sound') !== 'off'; } catch { /* 保存できない環境 */ }

// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。オフのときはほかのアプリの音楽を止めない
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}
setAudioSession(on);

export const isOn = () => on;
export function setOn(v) {
  on = v;
  try { localStorage.setItem('chess-3d.sound', v ? 'on' : 'off'); } catch { /* 保存できない環境 */ }
  setAudioSession(v);
}

// 周波数 f の音を、t 秒後から d 秒、音量 v で
function tone(f, t, d, v = 0.15, type = 'sine', f2 = f) {
  const a = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, a);
  o.frequency.exponentialRampToValueAtTime(f2, a + d);
  g.gain.setValueAtTime(v, a);
  g.gain.exponentialRampToValueAtTime(0.001, a + d);
  o.connect(g).connect(ctx.destination);
  o.start(a);
  o.stop(a + d + 0.02);
}

const SOUNDS = {
  select: () => tone(880, 0, 0.07, 0.08),
  place: () => tone(180, 0, 0.12, 0.25, 'triangle', 90),
  capture: () => { tone(180, 0, 0.14, 0.3, 'triangle', 80); tone(500, 0, 0.05, 0.12, 'square', 200); },
  check: () => { tone(660, 0, 0.1, 0.12); tone(880, 0.1, 0.16, 0.12); },
  ok: () => [660, 880, 1100].forEach((f, i) => tone(f, i * 0.09, 0.16, 0.12)),
  bad: () => tone(200, 0, 0.18, 0.1, 'triangle', 150),
  clear: () => [523, 659, 784, 1047].forEach((f) => tone(f, 0, 0.7, 0.07)),
};

export function sfx(name) {
  if (!on) return;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name]();
  } catch { /* 音が出せなくても遊べる */ }
}
