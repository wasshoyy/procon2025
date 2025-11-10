import pickle
import pandas as pd
import numpy as np

# --- ファイル読み込み ---
SEGMENT_STATS_PKL = "segment_stats.pkl"
SEGMENT_CLUSTERS_PKL = "segment_clusters.pkl"
CLUSTER_SCORES_PKL = "cluster_scores.pkl"

with open(SEGMENT_STATS_PKL, "rb") as f:
    segment_stats = pickle.load(f)

with open(SEGMENT_CLUSTERS_PKL, "rb") as f:
    segment_clusters = pickle.load(f)

with open(CLUSTER_SCORES_PKL, "rb") as f:
    cluster_scores = pickle.load(f)

# --- 教師データ作成 ---
rows = []

for audio_name, stats_array in segment_stats.items():
    n_segments = stats_array.shape[0]
    for seg_idx in range(n_segments):
        key = (audio_name, seg_idx)
        # クラスタラベルを取得
        cluster_label = segment_clusters.get(key, -1)
        if cluster_label == -1:
            continue  # ノイズはスキップ
        # クラスタスコアを取得
        scores = cluster_scores.get(cluster_label)
        if scores is None:
            continue
        # 行としてまとめる
        feature_vector = stats_array[seg_idx]  # shape=(feature_dim,)
        row = np.concatenate([feature_vector, scores])
        rows.append(row)

if not rows:
    raise ValueError("教師データが1件も作れませんでした。pklの内容を確認してください。")

# --- DataFrame化 ---
feature_dim = segment_stats[list(segment_stats.keys())[0]].shape[1]
columns = [f"feature_{i}" for i in range(feature_dim)] + \
          ["brightness", "smoothness", "thickness", "clarity", "sharpness"]

df_training = pd.DataFrame(rows, columns=columns)

# --- 保存 ---
df_training.to_csv("training_data.csv", index=False, encoding="utf-8-sig")
with open("training_data.pkl", "wb") as f:
    pickle.dump(df_training, f)

print(f"教師データを保存しました (rows={len(df_training)})")
