import os
import sys
import json
import pickle
import numpy as np
import librosa
import joblib
from scipy.stats import skew, kurtosis
from sklearn.preprocessing import StandardScaler

hop_length = 512  # フレーム長さ

# --- スクリプトのあるフォルダを基準にパス解決 ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
def here(*names):
    return os.path.join(BASE_DIR, *names)

# --- モデル読み込み ---
model_files = {
    "brightness": here("rf_model_brightness.pkl"),
    "smoothness": here("rf_model_smoothness.pkl"),
    "thickness": here("rf_model_thickness.pkl"),
    "clarity": here("rf_model_clarity.pkl"),
    "sharpness": here("rf_model_sharpness.pkl")
}

# 事前チェック（見つからない時は場所を出力して落とす）
missing = [p for p in model_files.values() if not os.path.exists(p)]
if missing:
    sys.stderr.write(
        "[analyze_audio] Missing model files:\n  " + "\n  ".join(missing) + "\n"
        f"BASE_DIR={BASE_DIR}\n"
        "Dir listing:\n  " + "\n  ".join(os.listdir(BASE_DIR)) + "\n"
    )
    sys.exit(1)

models = {k: joblib.load(f) for k, f in model_files.items()}

def compute_spectral_flux(y, hop_length):
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    flux = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))
    flux = np.insert(flux, 0, 0)
    return flux


def compute_high_freq_energy(y, sr, hop_length, cutoff_freq=4000):
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr)
    hf_idx = np.where(freqs >= cutoff_freq)[0]
    hf_energy = np.sum(S[hf_idx, :], axis=0)
    return hf_energy


# === フレーム単位特徴量抽出 ===
def extract_framewise_features(y, sr):
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    delta_mfcc = librosa.feature.delta(mfcc)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop_length)
    rms = librosa.feature.rms(y=y, hop_length=hop_length)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)
    flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop_length)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length).reshape(1, -1)

    features_list = [mfcc, delta_mfcc, zcr, rms, centroid, bandwidth, rolloff, flatness, chroma, onset_env]
    min_len = min(x.shape[1] for x in features_list)
    features_trimmed = [x[:, :min_len] for x in features_list]
    feats_time = np.vstack(features_trimmed)

    delta_rms = np.gradient(rms[0, :min_len])
    delta_bandwidth = np.gradient(bandwidth[0, :min_len])
    delta2_rms = np.gradient(delta_rms)
    delta2_bandwidth = np.gradient(delta_bandwidth)

    spectral_flux = compute_spectral_flux(y, hop_length)[:min_len]
    delta2_flux = np.gradient(spectral_flux)
    hf_energy = compute_high_freq_energy(y, sr, hop_length)[:min_len]

    # --- すべて結合 ---
    final_features = np.column_stack([
        feats_time.T,
        delta_rms,
        delta_bandwidth,
        delta2_rms,
        delta2_bandwidth,
        spectral_flux,
        delta2_flux,
        hf_energy
    ])

    return final_features  # shape: (T, D)


# === 統計量計算（フレーム指定） ===
def compute_window_stats_frames(features, window_frames=43, step_frames=10, include_last='short'):
    T, D = features.shape
    w = int(window_frames)
    s = int(step_frames)
    if w <= 0 or s <= 0:
        raise ValueError("window_frames と step_frames は正の整数にしてください")

    stats_list, times_frames = [], []
    start = 0
    while start < T:
        end = start + w
        if end <= T:
            window = features[start:end, :]
        else:
            if include_last == 'drop':
                break
            elif include_last == 'pad':
                pad_len = end - T
                window = np.pad(features[start:T, :],
                                ((0, pad_len), (0, 0)),
                                mode='constant', constant_values=0.0)
            else:  # 'short'
                window = features[start:T, :]

        # 統計量
        means = np.mean(window, axis=0)
        vars_  = np.var(window, axis=0)
        skews  = skew(window, axis=0, bias=False, nan_policy='omit')
        kurts  = kurtosis(window, axis=0, bias=False, nan_policy='omit')

        stats_list.append(np.concatenate([means, vars_, skews, kurts]))

        # 中心フレーム（短窓のときも実際の長さに合わせる）
        center = start + window.shape[0] / 2
        times_frames.append(center)

        start += s

    return np.asarray(stats_list), np.asarray(times_frames)


# === pitch / volume 抽出 ===
def extract_pitch(y, sr):
    f0, _, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        hop_length=hop_length
    )
    return np.nan_to_num(f0, nan=0.0)


def extract_volume(y):
    rms = librosa.feature.rms(y=y, hop_length=hop_length).flatten()
    return rms


def upsample_series_to_frames(series, times_frames, n_frames):
    """
    series:  窓ごとの値 (Nwin,)
    times_frames: 各窓の中心フレーム番号 (Nwin,)  ※compute_window_stats_frames の戻り値
    n_frames: 目標フレーム数（pitch/volume/features と合わせる）
    戻り値: (n_frames,) のフレーム列
    """
    y = np.asarray(series, dtype=float)
    x = np.asarray(times_frames, dtype=float)
    new_x = np.arange(n_frames, dtype=float)

    if len(x) == 0:
        return np.zeros(n_frames, dtype=float)
    if len(x) == 1:
        return np.full(n_frames, y[0], dtype=float)

    # 端は一定値で外挿（左端=先頭値/右端=末尾値）
    return np.interp(new_x, x, y, left=y[0], right=y[-1])


# === メイン処理 ===
def main(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    features = extract_framewise_features(y, sr)

    frames_per_sec = sr / hop_length
    window_frames = max(1, int(round(frames_per_sec * 1.0)))   # ≈1.0秒窓
    step_frames   = max(1, int(round(frames_per_sec * 0.1)))   # ≈0.1秒ステップ

    # 窓統計（低レート）
    X, times_frames = compute_window_stats_frames(features, window_frames, step_frames, include_last='short')

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    preds_window = {k: models[k].predict(X_scaled).astype(float) for k in models}

    pitch  = extract_pitch(y, sr)
    volume = extract_volume(y)
    T = min(features.shape[0], len(pitch), len(volume))

    predictions = {
        k: upsample_series_to_frames(v, times_frames, T).tolist()
        for k, v in preds_window.items()
    }

    pitch  = pitch[:T].tolist()
    volume = volume[:T].tolist()

    results = {
        "pitch": pitch,
        "volume": volume,
        **predictions
    }

    print(json.dumps(results, ensure_ascii=False))
    sys.stdout.flush()

    pkl_path = audio_path.replace('.wav', '.pkl', 1)
    with open(pkl_path, "wb") as f:
        pickle.dump(results, f)

if __name__ == "__main__":
    main(sys.argv[1])
