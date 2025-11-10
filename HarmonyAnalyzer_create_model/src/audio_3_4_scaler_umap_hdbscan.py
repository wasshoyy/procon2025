import pickle
import numpy as np
from sklearn.preprocessing import StandardScaler
import umap
import hdbscan

# 入力・出力ファイル
input_file = "segment_stats.pkl"
output_file = "segment_clusters.pkl"

# データ読み込み
with open(input_file, "rb") as f:
    data = pickle.load(f)

# (audio_name, seg_idx) をキーにした flat な特徴ベクトルを作成
X = []
keys = []
for key, stats in data.items():
    # stats.shape = (n_segments, n_features*4) ではなく
    # すでに (5, feature_dim) になっているはず → flatten 1次元ベクトルに
    if stats.ndim > 1:
        for i, row in enumerate(stats):
            X.append(row)
            keys.append((key, i))
    else:
        X.append(stats)
        keys.append(key)

X = np.array(X)
print(f"元の次元数: {X.shape[1]}")

# -----------------------------
# 標準化
# -----------------------------
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# -----------------------------
# UMAP による次元削減
# -----------------------------
umap_reducer = umap.UMAP(
    n_components=15,
    n_neighbors=50,
    min_dist=0.1,
    metric='euclidean',
    random_state=42
)
X_umap = umap_reducer.fit_transform(X_scaled)

print(f"UMAP圧縮後の次元数: {X_umap.shape[1]}")

# -----------------------------
# HDBSCAN クラスタリング
# -----------------------------
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=60,
    min_samples=10,
    metric='euclidean'
)
cluster_labels = clusterer.fit_predict(X_umap)

# 結果を辞書に保存
cluster_dict = {keys[i]: cluster_labels[i] for i in range(len(keys))}

with open(output_file, "wb") as f:
    pickle.dump(cluster_dict, f)

# -----------------------------
# 結果確認
# -----------------------------
n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
n_noise = (cluster_labels == -1).sum()

print(f"クラスタ数（ノイズ除く）: {n_clusters}")
print(f"ノイズと判定されたサンプル数: {n_noise}")
