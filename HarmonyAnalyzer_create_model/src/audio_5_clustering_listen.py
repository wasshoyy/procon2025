import librosa
import soundfile as sf
import pickle
import os

# ファイル読み込み
with open("segment_clusters.pkl", "rb") as f:
    cluster_dict = pickle.load(f)

audio_folder = "tmp_audio"
output_base = "cluster_audio"
os.makedirs(output_base, exist_ok=True)

n_segments = 5  # 1つ目と同じセグメント数

for (audio_name, seg_idx), cluster_label in cluster_dict.items():
    file_path = os.path.join(audio_folder, audio_name + ".wav")
    if not os.path.exists(file_path):
        continue  # 音源がなければスキップ

    y, sr = librosa.load(file_path, sr=None)
    total_len = len(y)
    
    # セグメント開始・終了サンプル
    start = int(total_len * seg_idx / n_segments)
    end = int(total_len * (seg_idx + 1) / n_segments)
    
    segment = y[start:end]
    
    # クラスタ番号ごとのフォルダに保存
    cluster_dir = os.path.join(output_base, f"cluster_{cluster_label}")
    os.makedirs(cluster_dir, exist_ok=True)
    
    # 保存ファイル名
    out_file = os.path.join(cluster_dir, f"{audio_name}_seg{seg_idx}.wav")
    sf.write(out_file, segment, sr)

print(f"クラスタごとのセグメントを '{output_base}' フォルダに保存しました。")
