import os
import numpy as np
import librosa
import soundfile as sf

# ===== 設定 =====
input_base = "cluster_representatives_audio"
output_file = "all_clusters_combined.wav"

# クラスタ番号の範囲（例：cluster_0 ～ cluster_17）
cluster_range = range(18)

# 音源間の間隔（秒）
gap_within_cluster = 1.0   # 同一クラスタ内の間隔
gap_between_clusters = 3.0 # クラスタ間の間隔

# ===== 処理 =====
combined_audio = []
sr_global = None

for c in cluster_range:
    cluster_dir = os.path.join(input_base, f"cluster_{c}")
    if not os.path.exists(cluster_dir):
        print(f"⚠️ cluster_{c} が見つかりません。スキップします。")
        continue

    print(f"🎧 cluster_{c} を処理中...")

    # クラスタ内の全wavファイルを取得（ソートして安定順に）
    wav_files = sorted([
        os.path.join(cluster_dir, f) for f in os.listdir(cluster_dir)
        if f.lower().endswith(".wav")
    ])

    cluster_audio = []

    for wav_path in wav_files:
        y, sr = librosa.load(wav_path, sr=None)
        if sr_global is None:
            sr_global = sr
        elif sr != sr_global:
            y = librosa.resample(y, orig_sr=sr, target_sr=sr_global)

        cluster_audio.append(y)

        # 同クラスタ内では1秒の無音を追加
        silence = np.zeros(int(sr_global * gap_within_cluster))
        cluster_audio.append(silence)

    # クラスタを結合
    if cluster_audio:
        cluster_audio_concat = np.concatenate(cluster_audio)

        # 各クラスタの後に3秒の無音を追加
        silence_between = np.zeros(int(sr_global * gap_between_clusters))
        combined_audio.append(cluster_audio_concat)
        combined_audio.append(silence_between)

# ===== 出力 =====
if combined_audio:
    final_audio = np.concatenate(combined_audio)
    sf.write(output_file, final_audio, sr_global)
    print(f"✅ すべてのクラスタを結合し、'{output_file}' に保存しました。")
else:
    print("❌ 結合対象の音源が見つかりませんでした。")
