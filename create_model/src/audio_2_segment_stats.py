import pickle
import numpy as np
from scipy.stats import skew, kurtosis

def compute_segment_stats(feature_matrix, n_segments=5):
    n_features, n_frames = feature_matrix.shape
    seg_len = n_frames // n_segments
    stats_list = []
    eps = 1e-10

    for i in range(n_segments):
        start = i * seg_len
        end = (i + 1) * seg_len if i < n_segments - 1 else n_frames
        segment = feature_matrix[:, start:end].astype(np.float64)

        means = np.mean(segment, axis=1)
        vars_ = np.var(segment, axis=1)

        # 数値安定化のために小さい分散の行を除外せずに扱う
        safe_segment = np.where(np.abs(segment - means[:, None]) < eps, means[:, None], segment)

        skews = skew(safe_segment, axis=1, bias=False, nan_policy='omit')
        kurts = kurtosis(safe_segment, axis=1, bias=False, nan_policy='omit')

        # NaN や極端な値を除去
        skews[np.isnan(skews)] = 0
        kurts[np.isnan(kurts)] = 0

        # 分散が小さい場合も安全に0に置換
        skews[vars_ < eps] = 0
        kurts[vars_ < eps] = 0

        stats_vec = np.concatenate([means, vars_, skews, kurts])
        stats_list.append(stats_vec)

    return np.vstack(stats_list)

if __name__ == "__main__":
    with open("features.pkl", "rb") as f:
        feature_dict = pickle.load(f)

    segment_stats_dict = {}
    for key, feature_matrix in feature_dict.items():
        stats = compute_segment_stats(feature_matrix.T, n_segments=5)
        segment_stats_dict[key] = stats

    with open("segment_stats.pkl", "wb") as f:
        pickle.dump(segment_stats_dict, f)
