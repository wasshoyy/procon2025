import os
import librosa
import numpy as np
import pickle

hop_length = 512

def compute_spectral_flux(y, hop_length):
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    flux = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
    flux = np.insert(flux, 0, 0)
    return flux

def compute_high_freq_energy(y, sr, hop_length, cutoff_freq=4000):
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr)
    hf_idx = np.where(freqs >= cutoff_freq)[0]
    hf_energy = np.sum(S[hf_idx, :], axis=0)
    return hf_energy

def extract_framewise_features(y, sr, hop_length=512):
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

    # 時系列特徴量を結合
    features_list = [mfcc, delta_mfcc, zcr, rms, centroid, bandwidth, rolloff, flatness, chroma, onset_env]

    # 各特徴量の長さを揃える
    min_len = min(x.shape[1] for x in features_list)
    features_trimmed = [x[:, :min_len] for x in features_list]

    # 基本特徴量の結合
    feats_time = np.vstack(features_trimmed)

    # delta, 2階微分、スペクトルフラックス、ハイフリケンシーエネルギー
    delta_rms = np.gradient(rms[0, :min_len])
    delta_bandwidth = np.gradient(bandwidth[0, :min_len])
    delta2_rms = np.gradient(delta_rms)
    delta2_bandwidth = np.gradient(delta_bandwidth)
    spectral_flux = compute_spectral_flux(y, hop_length)[:min_len]
    delta2_flux = np.gradient(spectral_flux)
    hf_energy = compute_high_freq_energy(y, sr, hop_length)[:min_len]

    # 全特徴量を横に結合 (T, D)
    final_features = np.column_stack([
        feats_time.T, delta_rms, delta_bandwidth, delta2_rms, delta2_bandwidth, spectral_flux, delta2_flux, hf_energy
    ])
    return final_features

def process_audio_folder(folder="tmp_audio"):
    feature_dict = {}
    for file in os.listdir(folder):
        if file.endswith(".wav"):
            filepath = os.path.join(folder, file)
            y, sr = librosa.load(filepath, sr=None)
            features = extract_framewise_features(y, sr, hop_length)
            key = os.path.splitext(file)[0]
            feature_dict[key] = features
    return feature_dict

if __name__ == "__main__":
    data = process_audio_folder("tmp_audio")
    with open("features.pkl", "wb") as f:
        pickle.dump(data, f)
    print("フレームごとの特徴量を features.pkl に保存しました。")
