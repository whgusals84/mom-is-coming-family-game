export type GameTone = 'alert' | 'dash' | 'item' | 'nice' | 'hurt' | 'caught';

let sharedAudioContext: AudioContext | null = null;

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
