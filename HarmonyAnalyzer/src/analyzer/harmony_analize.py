import sys
import json
import librosa
import numpy as np
import os
'''
import matplotlib.pyplot as plt
import pandas as pd
'''
from itertools import combinations

files = sys.argv[1:]

sr = 44100
frame_length = 2048
hop_length = 512

def consonance_score(ratio, freq_diff, freq_ave):
    ideal_ratio = [1.0,2.0,1.5,1.333,1.25,1.2,1.6]
    dist = min([abs(ratio - ir) for ir in ideal_ratio])
    # 周波数比と周波数差の両方を考慮した協和度スコア
    return 1 / (1 + dist*freq_ave / (1 + freq_diff ))

mix = None
for path in files:
    y,_=librosa.load(path,sr=sr)
    if mix is None:
        mix = y
    else:
        mix = mix[:len(y)] + y[:len(mix)] if len(y) < len(mix) else mix + y[:len(mix)]

f0s = []
for path in files:
    y,_ = librosa.load(path,sr=sr)
    f0 = librosa.yin(y,fmin=librosa.note_to_hz('C2'),fmax=librosa.note_to_hz('C7'),
                     frame_length=frame_length,hop_length=hop_length)
    f0s.append(f0)

min_len = min(len(f) for f in f0s)
frame_scores = []

for t in range(min_len):
    freqs = [f0[t] for f0 in f0s if not np.isnan(f0[t])]
    if len(freqs) < 2:
        frame_scores.append(np.nan)
        continue
    ratios = [max(a,b)/min(a,b) for a,b in combinations(freqs,2)]
    freq_diffs = [abs(a - b) for a,b in combinations(freqs,2)]
    freq_ave = [(a + b)/2 for a,b in combinations(freqs,2)]
    scores = [consonance_score(r, d, a) for r, d, a in zip(ratios, freq_diffs,freq_ave)]
    frame_scores.append(np.mean(scores))

print(json.dumps(frame_scores, ensure_ascii=False))
sys.stdout.flush()  # ← これで Node が即座に全出力を受け取れる

'''
times = librosa.frames_to_time(np.arange(len(frame_scores)),sr=sr,hop_length=hop_length)

plt.figure(figsize=(12, 4))
plt.plot(times, frame_scores, label="協和度スコア", color="darkgreen")
plt.xlabel("時間 (秒)")
plt.ylabel("協和度スコア")
plt.title("単位時間ごとの協和度推移")
plt.grid(True)
plt.tight_layout()
plt.savefig("consonance_over_time.png")
plt.show() 
'''
