// Крошечные синтезированные звуки через WebAudio: без файлов, работает офлайн.
// Контекст создаётся лениво при первом воспроизведении (webview Telegram требует жест).
let ctx: AudioContext | null = null
let muted = localStorage.getItem('mgMuted') === '1'

export function isSoundOn(): boolean { return !muted }
export function setSoundOn(on: boolean): void {
  muted = !on
  localStorage.setItem('mgMuted', muted ? '1' : '0')
}

function audioCtx(): AudioContext | null {
  if (muted) return null
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

function blip(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', peak = 0.12): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(c.destination)
  o.start(at); o.stop(at + dur + 0.02)
}

// короткий шумовой всплеск: перестук кубиков / шелест купюр
function noise(c: AudioContext, at: number, dur = 0.16, peak = 0.06, hp = 900): void {
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.setValueAtTime(peak, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const f = c.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  src.connect(f); f.connect(g); g.connect(c.destination)
  src.start(at); src.stop(at + dur)
}

export type Sfx = 'dice' | 'step' | 'buy' | 'rent' | 'cash' | 'card' | 'jail' | 'build' | 'win' | 'lose' | 'tap'

export function playSfx(name: Sfx): void {
  const c = audioCtx()
  if (!c) return
  const t = c.currentTime
  switch (name) {
    case 'dice': noise(c, t, 0.16, 0.08, 1200); noise(c, t + 0.09, 0.12, 0.06, 1500); break
    case 'step': blip(c, 540, t, 0.05, 'triangle', 0.045); break
    case 'tap': blip(c, 660, t, 0.06, 'sine', 0.05); break
    case 'buy': blip(c, 523, t, 0.09, 'triangle', 0.06); blip(c, 784, t + 0.07, 0.12, 'triangle', 0.07); break
    case 'cash': [659, 880, 1046].forEach((f, i) => blip(c, f, t + i * 0.05, 0.14, 'triangle', 0.07)); break
    case 'rent': blip(c, 300, t, 0.14, 'sawtooth', 0.05); blip(c, 240, t + 0.1, 0.16, 'sawtooth', 0.05); break
    case 'card': blip(c, 620, t, 0.08, 'sine', 0.05); blip(c, 930, t + 0.08, 0.14, 'triangle', 0.06); break
    case 'jail': blip(c, 200, t, 0.2, 'square', 0.05); blip(c, 150, t + 0.12, 0.22, 'square', 0.05); break
    case 'build': noise(c, t, 0.1, 0.05, 700); blip(c, 440, t + 0.02, 0.08, 'triangle', 0.05); break
    case 'win': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(c, f, t + i * 0.09, 0.26, 'triangle', 0.1)); break
    case 'lose': [392, 330, 262].forEach((f, i) => blip(c, f, t + i * 0.12, 0.24, 'sine', 0.08)); break
  }
}
