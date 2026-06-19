import os
import librosa
import numpy as np
from scipy.stats import skew, kurtosis
from sklearn.preprocessing import StandardScaler
import joblib  # joblibでモデルを読み込む

# === モデル読み込み ===
model_files = {
    "brightness": "rf_model_brightness.pkl",
    "smoothness": "rf_model_smoothness.pkl",
    "thickness": "rf_model_thickness.pkl",
    "clarity": "rf_model_clarity.pkl",
    "sharpness": "rf_model_sharpness.pkl"
}

models = {}
for k, f in model_files.items():
    models[k] = joblib.load(f)  # joblibで読み込み

# === 特徴量抽出関数（フレーム単位） ===
hop_length = 512

def compute_spectral_flux(S):
    flux = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
    flux = np.insert(flux, 0, 0)
    return flux

def compute_high_freq_energy(S, freqs, cutoff_freq=4000):
    hf_idx = np.where(freqs >= cutoff_freq)[0]
    hf_energy = np.sum(S[hf_idx, :], axis=0)
    return hf_energy

def extract_framewise_features(y, sr):
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr)
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
    spectral_flux = compute_spectral_flux(S[:, :min_len])
    delta2_flux = np.gradient(spectral_flux)
    hf_energy = compute_high_freq_energy(S[:, :min_len], freqs)

    final_features = np.column_stack([
        feats_time.T, delta_rms, delta_bandwidth, delta2_rms, delta2_bandwidth, spectral_flux, delta2_flux, hf_energy
    ])
    return final_features

# === 移動窓で統計量を計算 ===
def compute_window_stats(features, window_size, step_size):
    n_frames, n_features = features.shape
    stats_list = []
    for start in range(0, n_frames - window_size + 1, step_size):
        window = features[start:start+window_size, :]
        means = np.mean(window, axis=0)
        vars_ = np.var(window, axis=0)
        skews = skew(window, axis=0, bias=False, nan_policy='omit')
        kurts = kurtosis(window, axis=0, bias=False, nan_policy='omit')
        stats_vec = np.concatenate([means, vars_, skews, kurts])
        stats_list.append(stats_vec)
    return np.array(stats_list)

# === 音源を読み込み予測 ===
def predict_audio(audio_path, sr=44100, window_sec=1.0, step_sec=0.1):
    y, sr = librosa.load(audio_path, sr=sr)
    features = extract_framewise_features(y, sr)
    frames_per_sec = sr / hop_length
    window_size = int(window_sec * frames_per_sec)
    step_size = int(step_sec * frames_per_sec)
    X = compute_window_stats(features, window_size, step_size)

    # スケーリング（学習時のスケーラーがあれば置き換える）
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    predictions = {}
    for k, model in models.items():
        preds = model.predict(X_scaled)
        predictions[k] = preds
    return predictions, step_sec

# === 使用例 ===
if __name__ == "__main__":
    audio_file = "tmp_audio/624.wav"
    preds, step = predict_audio(audio_file)
    n_steps = len(preds["brightness"])
    for i in range(n_steps):
        t = i * step
        print(f"{t:.2f}s: brightness={preds['brightness'][i]:.2f}, smoothness={preds['smoothness'][i]:.2f}, thickness={preds['thickness'][i]:.2f}, clarity={preds['clarity'][i]:.2f}, sharpness={preds['sharpness'][i]:.2f}")
