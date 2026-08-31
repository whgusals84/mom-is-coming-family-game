export type GameTone = 'alert' | 'dash' | 'item' | 'nice' | 'hurt' | 'caught';

let sharedAudioContext: AudioContext | null = null;

type NocturneSession = {
  element: HTMLAudioElement;
};

let nocturneSession: NocturneSession | null = null;
let nocturnePrimed = false;
let nocturneWanted = false;
let primePromise: Promise<void> | null = null;
const NOCTURNE_PATH = 'assets/audio/chopin-nocturne-op9-no2.mp3';

function audioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
}

// iOS Safari requires AudioContext creation/resume inside the user's first tap.
export function unlockGameAudio() {
  const AudioContextClass = audioContextConstructor();
  if (!AudioContextClass) return null;
  try {
    sharedAudioContext ??= new AudioContextClass();
    if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume();
    primeNocturneAudio();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function playGameTone(kind: GameTone, enabled: boolean) {
  if (!enabled) return;
  const audio = unlockGameAudio();
  if (!audio || audio.state === 'closed') return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const tones: Record<GameTone, number> = { alert: 330, dash: 520, item: 720, nice: 880, hurt: 210, caught: 160 };
    osc.type = kind === 'hurt' || kind === 'caught' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(tones[kind], audio.currentTime);
    gain.gain.setValueAtTime(.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .16);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .17);
  } catch {
    // Sound is optional; gameplay remains fully functional when audio is unavailable.
  }
}

function getNocturneAudio() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!nocturneSession) {
    const element = new Audio(NOCTURNE_PATH);
    element.loop = true;
    element.preload = 'none';
    element.volume = .46;
    nocturneSession = { element };
  }
  return nocturneSession.element;
}

// Prime the media element inside the first keyboard/touch gesture. This keeps the
// later proximity-triggered playback working on iOS Safari without autoplay errors.
function primeNocturneAudio() {
  if (nocturnePrimed || primePromise) {
    if (nocturneWanted) void getNocturneAudio()?.play().catch(() => undefined);
    return;
  }
  const element = getNocturneAudio();
  if (!element) return;
  element.muted = true;
  primePromise = element.play()
    .then(() => {
      nocturnePrimed = true;
      element.muted = false;
      if (!nocturneWanted) {
        element.pause();
        element.currentTime = 0;
      }
    })
    .catch(() => undefined)
    .finally(() => { primePromise = null; });
}

export function startNocturne(enabled: boolean) {
  if (!enabled) return;
  nocturneWanted = true;
  const element = getNocturneAudio();
  if (!element || !element.paused) return;
  element.muted = false;
  void element.play().catch(() => undefined);
}

export function stopNocturne() {
  nocturneWanted = false;
  nocturneSession?.element.pause();
}
