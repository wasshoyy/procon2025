import os
import re
import moviepy.editor as mpy

# ==== 設定 ====
base_dir = "cluster_representative_audio"  # クラスタフォルダの親ディレクトリ
output_file = "clusters_output.mp4"
video_size = (1280, 720)  # 動画サイズ
font_size = 100           # クラスタ番号の文字サイズ
audio_gap = 2             # 音源間無音秒数
cluster_gap = 3           # クラスタ間無音秒数

# ==== clusterフォルダを取得 ====
cluster_dirs = [d for d in os.listdir(base_dir) if re.match(r"cluster_\d+$", d)]
cluster_dirs = sorted(cluster_dirs, key=lambda x: int(x.split("_")[1]))

all_clips = []

for cluster_dir in cluster_dirs:
    cluster_num = int(cluster_dir.split("_")[1])
    cluster_path = os.path.join(base_dir, cluster_dir)

    # wavファイルだけ取得
    wav_files = [f for f in os.listdir(cluster_path) if f.lower().endswith(".wav")]
    wav_files = sorted(wav_files)[:3]  # 最大3つ

    for i, wav in enumerate(wav_files):
        wav_path = os.path.join(cluster_path, wav)
        audio_clip = mpy.AudioFileClip(wav_path)

        # 文字表示クリップ
        txt_clip = mpy.TextClip(
            f"Cluster {cluster_num}",
            fontsize=font_size,
            color='white',
            bg_color='black',
            size=video_size
        )

        txt_clip = txt_clip.set_duration(audio_clip.duration).set_audio(audio_clip)
        all_clips.append(txt_clip)

        # 音源間の無音（最後の音源はクラスタ間無音）
        gap_duration = audio_gap if i < len(wav_files) - 1 else cluster_gap
        silence_clip = mpy.TextClip(
            "", fontsize=font_size, color='white', bg_color='black', size=video_size
        ).set_duration(gap_duration)
        all_clips.append(silence_clip)

# ==== 全クリップを結合 ====
final_clip = mpy.concatenate_videoclips(all_clips, method="compose")

# ==== 出力 ====
final_clip.write_videofile(output_file, fps=24, codec="libx264", audio_codec="aac")
