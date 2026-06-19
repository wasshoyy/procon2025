// feedback/dataManager.js
import { DURATION_MS, RESOLUTION_MS, HOP_LENGTH, SAMPLERATE } from './utils.js';

export class DataManager {
  constructor(externalData = null, bpm = 120, beatsPerBar = 4, baseA = 442) {
    this.bpm = bpm; this.beatsPerBar = beatsPerBar; this.baseA = baseA;
    this.totalPoints = externalData?.[0]?.pitchArray?.length || Math.floor(DURATION_MS / RESOLUTION_MS);
    this.updateBeatParams();

    if (externalData && Array.isArray(externalData) && externalData.length) {
      this.players = externalData.map(p => ({
        name: p.name || 'Player',
        color: p.color || '#888888',
        pitchArray: p.pitchArray || Array(this.totalPoints).fill(0),
        volumeArray: p.volumeArray || Array(this.totalPoints).fill(0),
        featuresArray: p.featuresArray || Array.from({ length: this.totalPoints }, () => Array(5).fill(0))
      }));
    } else {
      this.players = [{
        name: 'Player',
        color: '#3b82f6',
        pitchArray: Array.from({ length: this.totalPoints }, () => 300 + Math.random() * 80),
        volumeArray: Array.from({ length: this.totalPoints }, () => Math.random()),
        featuresArray: Array.from({ length: this.totalPoints }, () => Array(5).fill(0))
      }];
    }
  }

  updateSettings(bpm, beatsPerBar, baseA) {
    this.bpm = bpm; this.beatsPerBar = beatsPerBar; this.baseA = baseA;
    this.updateBeatParams();
  }

  updateBeatParams() {
    const secPerPoint = HOP_LENGTH / SAMPLERATE;
    this.pointsPerBeat = Math.max(1, Math.round((60 / this.bpm) / secPerPoint));
  }

  getYRange() {
    let min = Infinity, max = -Infinity;
    this.players.forEach(p => p.pitchArray.forEach(v => { if (v > 0) { min = Math.min(min, v); max = Math.max(max, v); } }));
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    const padding = Math.max(1, (max - min) * 0.1);
    return { min: min - padding, max: max + padding };
  }
}
