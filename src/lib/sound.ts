// The Hermora sound: a bright rising "ding-ding-ding-DING" made from bell tones (no audio file needed).
// Loud but not harsh: all notes pass through a limiter. Browsers only allow sound after the person has touched the app once.
let ctx: AudioContext | null = null, last = 0
const KEY = 'hermora-sound'
export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* ignore */ } }
function get(): AudioContext | null {
  try { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return null; if (!ctx) ctx = new AC(); return ctx } catch { return null }
}
// Call once from a tap/click so later alerts are allowed to make sound.
export function unlockSound() { const c = get(); if (c && c.state === 'suspended') c.resume().catch(() => {}) }
function bell(c: AudioContext, out: AudioNode, freq: number, t: number, len: number, vol: number) {
  // a struck bell: fundamental plus bright overtones, sharp attack, long ring
  for (const [mult, v, decay] of [[1, 1, 1], [2.01, 0.55, 0.7], [3.02, 0.3, 0.5], [4.2, 0.15, 0.35]] as number[][]) {
    const o = c.createOscillator(), g = c.createGain()
    o.type = 'sine'; o.frequency.value = freq * mult
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len * decay)
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len * decay + 0.05)
  }
}
export function playHermora(force = false) {
  if (!force && !soundOn()) return
  const c = get(); if (!c) return
  const now = Date.now(); if (now - last < 2500) return; last = now
  if (c.state === 'suspended') c.resume().catch(() => {})
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.2
  const master = c.createGain(); master.gain.value = 1.0; lim.connect(master); master.connect(c.destination)
  const t0 = c.currentTime + 0.03
  // C6 - E6 - G6 - high C7, the last note rings out; then the same figure again a little higher for urgency
  const seq = [1046.5, 1318.5, 1568, 2093], gap = 0.17
  seq.forEach((f, i) => bell(c, lim, f, t0 + i * gap, i === seq.length - 1 ? 1.3 : 0.7, 0.55))
  const t1 = t0 + 0.95
  ;[1174.7, 1480, 1760, 2349.3].forEach((f, i) => bell(c, lim, f, t1 + i * gap, i === 3 ? 1.5 : 0.7, 0.6))
}
// Repeats the sound every few seconds (for urgent alerts) until stop() is called.
export function startAlarm(everyMs = 8000, max = 10) {
  let n = 0; playHermora()
  const id = setInterval(() => { if (++n >= max) return clearInterval(id); playHermora() }, everyMs)
  return () => clearInterval(id)
}
