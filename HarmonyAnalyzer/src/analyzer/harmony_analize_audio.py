import librosa
import numpy as np
import soundfile as sf

files = [
    "./harmonic_inputs/111.wav",
    "./harmonic_inputs/222.wav",
    "./harmonic_inputs/333.wav",
]

audio_signals = []
min_length = float('inf')
sr = None

for f in files:
    y,sr = librosa.load(f,sr=None)
    min_length = min(min_length,len(y))
    audio_signals.append(y)

trimmed_signals = [y[:min_length] for y in audio_signals]
combined = np.sum(trimmed_signals,axis=0)

combined /= np.max(np.abs(combined))

sf.write("harmonic_inputs/combined_harmony.wav",combined,sr)