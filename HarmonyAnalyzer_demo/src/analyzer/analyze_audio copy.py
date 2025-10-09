import os
import sys
import json
import pickle
import numpy as np
import librosa
import joblib
from scipy.stats import skew, kurtosis
from sklearn.preprocessing import StandardScaler
from numpy.lib.stride_tricks import sliding_window_view

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
    # center=False に統一
    S = np.abs(librosa.stft(y, hop_length=hop_length, center=False))
    # フレーム間差分の二乗和（簡易フラックス）
    flux = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))
    # 先頭の差分なしフレームを0で埋めて整列
    flux = np.insert(flux, 0, 0)
    return flux

def compute_high_freq_energy(y, sr, hop_length, cutoff_freq=4000):
    # center=False に統一
    S = np.abs(librosa.stft(y, hop_length=hop_length, center=False))
    freqs = librosa.fft_frequencies(sr=sr)
    hf_idx = np.where(freqs >= cutoff_freq)[0]
    hf_energy = np.sum(S[hf_idx, :], axis=0)
    return hf_energy

# === フレーム単位特徴量抽出（center=Falseに統一） ===
def extract_framewise_features(y, sr):
    mfcc      = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length, center=False)
    delta_mfcc= librosa.feature.delta(mfcc)
    zcr       = librosa.feature.zero_crossing_rate(y, hop_length=hop_length, center=False)
    rms       = librosa.feature.rms(y=y, hop_length=hop_length, center=False)
    centroid  = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length, center=False)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length, center=False)
    rolloff   = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length, center=False)
    flatness  = librosa.feature.spectral_flatness(y=y, hop_length=hop_length, center=False)
    chroma    = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length, center=False)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, center=False).reshape(1, -1)

    features_list = [mfcc, delta_mfcc, zcr, rms, centroid, bandwidth, rolloff, flatness, chroma, onset_env]
    min_len = min(x.shape[1] for x in features_list)
    features_trimmed = [x[:, :min_len] for x in features_list]
    feats_time = np.vstack(features_trimmed)

    # 追加派生（長さは min_len に合わせる）
    delta_rms        = np.gradient(rms[0, :min_len])
    delta_bandwidth  = np.gradient(bandwidth[0, :min_len])
    delta2_rms       = np.gradient(delta_rms)
    delta2_bandwidth = np.gradient(delta_bandwidth)
    spectral_flux    = compute_spectral_flux(y, hop_length)[:min_len]
    delta2_flux      = np.gradient(spectral_flux)
    hf_energy        = compute_high_freq_energy(y, sr, hop_length)[:min_len]

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
    ])  # shape: (T, D=52想定)
    return final_features  # (T, D)

# === 統計量計算（フレームごと・ステップ=1フレーム：補間不要） ===
def compute_window_stats_sliding(features, window_frames=43, mode="center"):

    T, D = features.shape
    w = int(max(1, window_frames))

    if mode == "center":
        if w % 2 == 0:
            left = w // 2 - 1
            right = w - 1 - left
        else:
            left = right = w // 2
    elif mode == "causal":
        left, right = w - 1, 0
    elif mode == "trailing":
        left, right = 0, w - 1
    else:
        raise ValueError("mode must be 'center'|'causal'|'trailing'")

    # 端はエッジ複製でパディング
    pad_left  = np.repeat(features[[0], :], left, axis=0)
    pad_right = np.repeat(features[[-1], :], right, axis=0)
    padded = np.vstack([pad_left, features, pad_right])  # (T+left+right, D)

    # (T, w, D) のスライディング窓
    # sliding_window_view(padded, (w, D)) -> shape (T+left+right-w+1, 1, 1, w, D)
    # ここでは T 個の開始点が得られるように切り出し
    windows = sliding_window_view(padded, (w, D))[:, 0, 0, :]  # (T, w, D)

    # 統計量（窓軸=1）
    means = windows.mean(axis=1)                  # (T, D)
    vars_ = windows.var(axis=1)                   # (T, D)
    skews = skew(windows, axis=1, bias=False)     # (T, D)
    kurts = kurtosis(windows, axis=1, bias=False) # (T, D)

    X = np.concatenate([means, vars_, skews, kurts], axis=1)  # (T, 4D)
    idx = np.arange(T, dtype=float)
    return X, idx

# === pitch / volume 抽出（center=Falseに統一） ===
def extract_pitch(y, sr):
    f0, _, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        hop_length=hop_length,
        center=False
    )
    return np.nan_to_num(f0, nan=0.0)

def extract_volume(y):
    return librosa.feature.rms(y=y, hop_length=hop_length, center=False).flatten()

# === メイン処理 ===
def main(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    features = extract_framewise_features(y, sr)     # (T, D)
    T = features.shape[0]

    # ≈1秒窓を sr/hop からフレーム数で算出（出力は T 本）
    frames_per_sec = sr / hop_length
    window_frames = max(1, int(round(frames_per_sec * 1.0)))  # 約1.0秒
    X, frame_idx = compute_window_stats_sliding(features, window_frames, mode="center")  # (T, 4D), (T,)

    try:
        scaler = joblib.load(here("scaler.pkl"))
        X_scaled = scaler.transform(X)
    except Exception:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

    preds = {k: models[k].predict(X_scaled).astype(float).tolist() for k in models}

    # pitch / volume と長さを合わせる（保険）
    pitch  = extract_pitch(y, sr)
    volume = extract_volume(y)
    T_final = min(T, len(pitch), len(volume))

    # 時刻（秒）が必要ならこちらを返す
    times_sec = (frame_idx[:T_final] * (hop_length / sr)).tolist()

    results = {
        "time": times_sec,
        "pitch":  pitch[:T_final].tolist(),
        "volume": volume[:T_final].tolist(),
        **{k: v[:T_final] for k, v in preds.items()}
    }

    print(json.dumps(results, ensure_ascii=False))
    sys.stdout.flush()

    pkl_path = audio_path.replace('.wav', '.pkl', 1)
    with open(pkl_path, "wb") as f:
        pickle.dump(results, f)

if __name__ == "__main__":
    main(sys.argv[1])
