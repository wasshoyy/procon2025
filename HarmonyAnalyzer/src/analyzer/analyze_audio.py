import sys
import json
import numpy as np
import librosa
import pickle

def extract_framewise_features(y, sr, hop):
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)
    delta_mfcc = librosa.feature.delta(mfcc)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop)
    rms = librosa.feature.rms(y=y, hop_length=hop)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop)
    flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop).reshape(1, -1)

    features_list = [mfcc, delta_mfcc, zcr, rms, centroid, bandwidth, rolloff, flatness, chroma, onset_env]
    min_len = min(x.shape[1] for x in features_list)

    features = np.vstack([x[:, :min_len] for x in features_list])
    return features.T  # (T, D)

def return_max(arr):
    arr = np.array(arr, dtype=float)
    return np.max(arr)

def return_min(arr):
    arr = np.array(arr, dtype=float)
    return np.min(arr)


def extract_pitch(y, sr, hop):
    # pyinは基音(f0)、voicing、voicing_probを返す
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),  # 下限を設定（楽器に合わせて調整）
        fmax=librosa.note_to_hz('C7'),  # 上限を設定
        sr=sr,
        hop_length=hop
    )
    # NaN（無声音）を0に置き換える
    pitch_series = np.nan_to_num(f0, nan=0.0).tolist()
    return pitch_series

def brightness(features):
    return features[:, 27].tolist()  # centroid

def clarity(features):
    zcr = features[:, 26]
    rms = features[:, 27]
    centroid = features[:, 28]
    flatness = features[:, 31]

    def safe_norm(x): return x/np.max(x) if np.max(x) > 0 else np.zeros_like(x)

    score = 0.4*safe_norm(rms) + 0.3*safe_norm(centroid) - 0.2*safe_norm(zcr) - 0.1*safe_norm(flatness)
    return score.tolist()

def sharpness(features):
    centroid = features[:, 27]
    rolloff = features[:, 28]
    flatness = features[:, 33]
    hf_energy = features[:, -1] if features.shape[1] > 34 else np.zeros_like(centroid)

    def safe_norm(x): return x/np.max(x) if np.max(x) > 0 else np.zeros_like(x)

    score = 0.4*safe_norm(centroid) + 0.3*safe_norm(rolloff) + 0.2*safe_norm(hf_energy) - 0.1*safe_norm(flatness)
    return score.tolist()

def smoothness(features):
    delta_rms = features[:, -6]
    delta_bandwidth = features[:, -5]
    spectral_flux = features[:, -4]
    delta2_rms = features[:, -3]
    delta2_bandwidth = features[:, -2]
    delta2_flux = features[:, -1]

    score = 1.0 - (np.abs(delta_rms) + np.abs(delta_bandwidth) + np.abs(spectral_flux) +
                   np.abs(delta2_rms) + np.abs(delta2_bandwidth) + np.abs(delta2_flux))
    return score.tolist()

def thickness(features):
    rms = features[:, 27]
    bandwidth = features[:, 29]
    flatness = features[:, 31]
    mfcc = features[:, 0:13]
    mfcc_contrast = np.std(mfcc, axis=1)

    def safe_norm(x): return x/np.max(x) if np.max(x) > 0 else np.zeros_like(x)

    score = 0.4*safe_norm(rms) + 0.3*safe_norm(bandwidth) + 0.2*safe_norm(mfcc_contrast) + 0.1*(1 - safe_norm(flatness))
    return score.tolist()

def main(audio_path):
    hop_length = 512
    y, sr = librosa.load(audio_path, sr=None)
    features = extract_framewise_features(y, sr, hop_length)
    pitch_series = extract_pitch(y, sr, hop_length)
    rms_series = librosa.feature.rms(y=y, hop_length=hop_length).flatten().tolist()

    results = {
        "pitch": pitch_series,
        "volume": rms_series,
        "brightness": brightness(features),
        "clarity": clarity(features),
        "sharpness": sharpness(features),
        "smoothness": smoothness(features),
        "thickness": thickness(features)
    }


    print(json.dumps(results, ensure_ascii=False))
    sys.stdout.flush()  # ← これで Node が即座に全出力を受け取れる

    pkl_path = audio_path.replace('.wav', '.pkl', 1)
    with open(pkl_path, "wb") as f:
        pickle.dump(results, f)
    # print("✅ 単位時間ごとの特徴量を framewise_features.pkl に保存しました")

if __name__ == "__main__":
    main(sys.argv[1])
