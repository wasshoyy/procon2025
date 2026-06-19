import pandas as pd
import numpy as np
import pickle

# === 入力ファイル ===
input_file = "音楽分析.xlsx"

# === 読み込み ===
df = pd.read_excel(input_file)

# === 不要列を削除 ===
drop_cols = [c for c in df.columns if any(k in str(c) for k in ["開始時刻", "完了時刻", "メール", "名前","最終変更時刻","名前2"])]
df = df.drop(columns=drop_cols, errors="ignore")

# === 評価者ID列名統一 ===
df = df.rename(columns={df.columns[0]: "rater_id"})

# === クラスタ列を特定（7列目以降をすべて採用）===
cluster_cols = df.columns[1:]  # 2列目以降すべて

records = []
for _, row in df.iterrows():
    rater = row["rater_id"]
    for idx, c in enumerate(cluster_cols):
        cluster_id = idx  # 0, 1, 2, ...と順に割り当て

        cell_value = row[c]

        # NaNや空文字をスキップ
        if pd.isna(cell_value):
            print(f"[警告] cluster_{cluster_id} のセルが空です (rater_id={rater})")
            continue

        # 区切り文字を統一

        vals_raw = str(cell_value).replace("、", ",").replace("，", ",").replace("。", ",").replace(" ", "").replace("．", ".").replace("明るさ:","").replace("滑らかさ:","").replace("厚さ:","").replace("明瞭さ:","").replace("鋭さ:","")
        # 区切りがカンマでない場合も一応補う
        if "," not in vals_raw and "." in vals_raw:
            # 例: 65.55.15.30.15 → 65,55,15,30,15
            vals_raw = vals_raw.replace(".", ",")

        vals = [v for v in vals_raw.split(",") if v not in ["", "nan", "None"]]

        if len(vals) != 5:
            print(f"[警告] cluster_{cluster_id} の値数が不正: {vals} (rater_id={rater})")
            continue

        try:
            brightness, smoothness, thickness, clarity, sharpness = map(float, vals)
        except ValueError:
            print(f"[警告] 数値変換できない値: {vals} (rater_id={rater})")
            continue

        records.append({
            "rater_id": rater,
            "cluster_label": cluster_id,
            "brightness": brightness,
            "smoothness": smoothness,
            "thickness": thickness,
            "clarity": clarity,
            "sharpness": sharpness
        })

# === 長形式DataFrame ===
df_long = pd.DataFrame(records)
df_long.to_csv("cluster_ratings_raw.csv", index=False, encoding="utf-8-sig")

print(f"▶ cluster_ratings_raw.csv に {len(df_long)} 件のデータを出力しました。")

# === クラスタごとの平均 ===
cluster_means = df_long.groupby("cluster_label")[["brightness", "smoothness", "thickness", "clarity", "sharpness"]].mean()
cluster_means.to_csv("cluster_scores.csv", encoding="utf-8-sig")

# === pklとしても保存 ===
cluster_score_dict = {int(idx): cluster_means.loc[idx].values.tolist() for idx in cluster_means.index}
with open("cluster_scores.pkl", "wb") as f:
    pickle.dump(cluster_score_dict, f)

print("▶ cluster_scores.csv / cluster_scores.pkl を出力しました。")
print("処理完了。")
