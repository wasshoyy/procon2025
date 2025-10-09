// feedback/utils.js
export const DURATION_MS = 5000;
export const RESOLUTION_MS = 5;
export const A4_MIDI = 69;
export const SEMITONES_PER_OCTAVE = 12;
export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const HOP_LENGTH = 512;
export const SAMPLERATE = 48000;

export function getCSS(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

export const THEME = {
  get ticks() { return getCSS('--muted-text', '#6b7280'); },
  get grid() { return getCSS('--panel-border', '#dbeedb'); },
  redBar: '#ff4d4f',
  miniVisibleShade: 'rgba(62,112,62,0.08)'
};

export const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

export function toRGBA(colorHex) {
  if (!/^#([0-9a-f]{6})$/i.test(colorHex)) return 'rgba(0,0,0,0.15)';
  const r = parseInt(colorHex.slice(1,3),16);
  const g = parseInt(colorHex.slice(3,5),16);
  const b = parseInt(colorHex.slice(5,7),16);
  return `rgba(${r},${g},${b},0.25)`;
}

export const freqToMidi = (freq, baseA) => A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(freq / baseA);
export const midiToFreq = (midi, baseA) => baseA * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);

export function freqToNoteNameWithOctave(freq, baseA) {
  if (!freq || freq <= 0) return '';
  const midi = Math.round(freqToMidi(freq, baseA));
  const noteIndex = (midi % SEMITONES_PER_OCTAVE + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/** 半音単位の Tick を生成（最大本数を超えないように間引き） */
export function computeNoteTicks(yMin, yMax, baseA, maxTickCount = 24) {
  if (!(isFinite(yMin) && isFinite(yMax)) || yMax <= 0) return [];
  const low = Math.max(1e-6, Math.min(yMin, yMax));
  const high = Math.max(yMin, yMax);

  const midiMin = Math.floor(freqToMidi(low, baseA));
  const midiMax = Math.ceil(freqToMidi(high, baseA));
  const rawCount = Math.max(1, midiMax - midiMin + 1);
  const step = Math.max(1, Math.ceil(rawCount / maxTickCount));

  const ticks = [];
  for (let m = midiMin; m <= midiMax; m += step) {
    const f = midiToFreq(m, baseA);
    if (f >= low && f <= high) ticks.push(f);
  }
  return ticks;
}
