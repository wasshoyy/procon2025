import pickle
import os
import librosa
import soundfile as sf
import numpy as np
from sklearn.preprocessing import StandardScaler
import umap
import hdbscan
from scipy.spatial.distance import cdist

# 入力ファイル
stats_file = "segment_stats.pkl"
clusters_file = "segment_clusters.pkl"
audio_folder = "tmp_audio"

# 出力フォルダ
output_base = "cluster_representatives_audio"
os.makedirs(output_base, exist_ok=True)

n_segments = 5  # セグメント分割数
top_k = 3       # 各クラスタから選ぶ代表音の数

# -----------------------------
# 特徴量読み込み
# -----------------------------
with open(stats_file, "rb") as f:
    data = pickle.load(f)

X = []
keys = []
for key, stats in data.items():
    if stats.ndim > 1:
        for i, row in enumerate(stats):
            X.append(row)
            keys.append((key, i))
    else:
        X.append(stats)
        keys.append(key)

X = np.array(X)

# 標準化 + UMAP
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

umap_reducer = umap.UMAP(
    n_components=15,
    n_neighbors=50,
    min_dist=0.1,
    metric='euclidean',
    random_state=42
)
X_umap = umap_reducer.fit_transform(X_scaled)

# -----------------------------
# クラスタ情報読み込み
# -----------------------------
with open(clusters_file, "rb") as f:
    cluster_dict = pickle.load(f)

cluster_labels = np.array([cluster_dict[k] for k in keys])

# -----------------------------
# フェード処理関数
# -----------------------------
def apply_fade(y, sr, fade_duration=0.1):
    """
    音声データにフェードイン・フェードアウトを適用する
    """
    fade_len = int(sr * fade_duration)
    fade_len = min(fade_len, len(y)//2)  # 音が短すぎる場合の安全対策

    fade_in = np.linspace(0.0, 1.0, fade_len)
    fade_out = np.linspace(1.0, 0.0, fade_len)

    y[:fade_len] *= fade_in
    y[-fade_len:] *= fade_out
    return y

# -----------------------------
# 各クラスタごとに代表音を選ぶ
# -----------------------------
for c in set(cluster_labels):
    if c == -1:
        continue  # ノイズはスキップ

    idxs = np.where(cluster_labels == c)[0]
    cluster_points = X_umap[idxs]

    # 中心
    center = cluster_points.mean(axis=0)

    # 距離計算
    dists = cdist(cluster_points, center[None, :]).flatten()
    nearest_idxs = idxs[np.argsort(dists)[:top_k]]

    # 保存フォルダ
    cluster_dir = os.path.join(output_base, f"cluster_{c}")
    os.makedirs(cluster_dir, exist_ok=True)

    for idx in nearest_idxs:
        audio_name, seg_idx = keys[idx]
        file_path = os.path.join(audio_folder, audio_name + ".wav")
        if not os.path.exists(file_path):
            continue

        y, sr = librosa.load(file_path, sr=None)
        total_len = len(y)

        start = int(total_len * seg_idx / n_segments)
        end = int(total_len * (seg_idx + 1) / n_segments)
        segment = y[start:end]

        # === フェードイン・フェードアウト適用 ===
        segment = apply_fade(segment, sr, fade_duration=0.1)

        out_file = os.path.join(cluster_dir, f"{audio_name}_seg{seg_idx}.wav")
        sf.write(out_file, segment, sr)

print(f"✅ 各クラスタから {top_k} 個の代表音を '{output_base}' に保存しました（フェード処理済み）。")
