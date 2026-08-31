export type GameTone = 'alert' | 'dash' | 'item' | 'nice' | 'hurt' | 'caught';

let sharedAudioContext: AudioContext | null = null;

type NocturneSession = {
  audio: AudioContext;
  master: GainNode;
  nextPhraseAt: number;
  timer: number;
};

let nocturneSession: NocturneSession | null = null;

const NOCTURNE_EIGHTH = .28;
const NOCTURNE_MEASURES = [
  { bass: [39, 46, 51, 55], melody: [[70, 2], [79, 2], [77, 1], [79, 1], [77, 2], [75, 2], [74, 2]] },
  { bass: [38, 46, 50, 56], melody: [[75, 2], [77, 1], [79, 1], [82, 2], [84, 2], [82, 2], [79, 2]] },
  { bass: [44, 51, 56, 60], melody: [[77, 2], [75, 2], [74, 2], [75, 1], [77, 1], [79, 2], [77, 2]] },
  { bass: [39, 46, 51, 55], melody: [[75, 2], [74, 2], [72, 2], [70, 2], [72, 2], [75, 2]] },
] as const;
const NOCTURNE_PHRASE_DURATION = NOCTURNE_EIGHTH * 12 * NOCTURNE_MEASURES.length;

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

function midiFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function schedulePianoNote(audio: AudioContext, output: AudioNode, note: number, start: number, duration: number, volume: number) {
  const envelope = audio.createGain();
  const fundamental = audio.createOscillator();
  const overtone = audio.createOscillator();
  fundamental.type = 'triangle';
  overtone.type = 'sine';
  fundamental.frequency.setValueAtTime(midiFrequency(note), start);
  overtone.frequency.setValueAtTime(midiFrequency(note) * 2, start);
  envelope.gain.setValueAtTime(.0001, start);
  envelope.gain.linearRampToValueAtTime(volume, start + .018);
  envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
  fundamental.connect(envelope);
  overtone.connect(envelope);
  envelope.connect(output);
  fundamental.start(start);
  overtone.start(start);
  fundamental.stop(start + duration + .05);
  overtone.stop(start + duration + .05);
}

function scheduleNocturnePhrase(session: NocturneSession, start: number) {
  for (let measureIndex = 0; measureIndex < NOCTURNE_MEASURES.length; measureIndex += 1) {
    const measure = NOCTURNE_MEASURES[measureIndex];
    const measureAt = start + measureIndex * 12 * NOCTURNE_EIGHTH;
    for (let beat = 0; beat < 12; beat += 1) {
      const note = measure.bass[beat % measure.bass.length];
      schedulePianoNote(session.audio, session.master, note, measureAt + beat * NOCTURNE_EIGHTH, NOCTURNE_EIGHTH * 1.8, .022);
    }
    let melodyBeat = 0;
    for (const [note, beats] of measure.melody) {
      schedulePianoNote(session.audio, session.master, note, measureAt + melodyBeat * NOCTURNE_EIGHTH, beats * NOCTURNE_EIGHTH * 1.35, .052);
      melodyBeat += beats;
    }
  }
}

function pumpNocturne(session: NocturneSession) {
  if (nocturneSession !== session) return;
  while (session.nextPhraseAt < session.audio.currentTime + 2.2) {
    scheduleNocturnePhrase(session, session.nextPhraseAt);
    session.nextPhraseAt += NOCTURNE_PHRASE_DURATION;
  }
  session.timer = window.setTimeout(() => pumpNocturne(session), 900);
}

export function startNocturne(enabled: boolean) {
  if (!enabled || nocturneSession) return;
  const audio = unlockGameAudio();
  if (!audio || audio.state === 'closed') return;
  try {
    const master = audio.createGain();
    master.gain.setValueAtTime(.0001, audio.currentTime);
    master.gain.exponentialRampToValueAtTime(.55, audio.currentTime + .4);
    master.connect(audio.destination);
    const session: NocturneSession = { audio, master, nextPhraseAt: audio.currentTime + .08, timer: 0 };
    nocturneSession = session;
    pumpNocturne(session);
  } catch {
    nocturneSession = null;
  }
}

export function stopNocturne() {
  const session = nocturneSession;
  if (!session) return;
  nocturneSession = null;
  window.clearTimeout(session.timer);
  try {
    const now = session.audio.currentTime;
    session.master.gain.cancelScheduledValues(now);
    session.master.gain.setValueAtTime(Math.max(.0001, session.master.gain.value), now);
    session.master.gain.exponentialRampToValueAtTime(.0001, now + .45);
    window.setTimeout(() => session.master.disconnect(), 650);
  } catch {
    // The shared context may already be closing while the page unmounts.
  }
}
