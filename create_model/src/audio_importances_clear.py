import pandas as pd

# 既存 CSV を読み込む
target_cols = ["brightness", "smoothness", "thickness", "clarity", "sharpness"]

for target in target_cols:
    csv_file = f"feature_importances_{target}.csv"
    df = pd.read_csv(csv_file, index_col=0)  # index に feature_n が入っている想定

    # feature_n の番号を意味のある名前に置換
    base_features = [
        "mfcc1","mfcc2","mfcc3","mfcc4","mfcc5","mfcc6","mfcc7","mfcc8","mfcc9","mfcc10",
        "mfcc11","mfcc12","mfcc13",
        "delta_mfcc1","delta_mfcc2","delta_mfcc3","delta_mfcc4","delta_mfcc5","delta_mfcc6","delta_mfcc7",
        "delta_mfcc8","delta_mfcc9","delta_mfcc10","delta_mfcc11","delta_mfcc12","delta_mfcc13",
        "zcr","rms","centroid","bandwidth","rolloff","flatness",
        "chroma1","chroma2","chroma3","chroma4","chroma5","chroma6","chroma7","chroma8","chroma9",
        "chroma10","chroma11","chroma12",
        "onset_env","delta_rms","delta_bandwidth","delta2_rms","delta2_bandwidth",
        "spectral_flux","delta2_flux","hf_energy"
    ]
    n_segments = 5
    stats = ["mean","var","skew","kurt"]

    # 新しい index リスト作成
    new_index = []
    for seg in range(n_segments):
        for feat in base_features:
            for stat in stats:
                new_index.append(f"{feat}_seg{seg}_{stat}")

    # 元の行数と一致するか確認
    if len(new_index) != len(df):
        print(f"[警告] {csv_file} の行数と新しい名前の数が一致しません。")
        # 足りない場合は feature_extra で補完
        for i in range(len(df) - len(new_index)):
            new_index.append(f"feature_extra_{i}")

    # index を置換
    df.index = new_index[:len(df)]

    # 新しい CSV として保存
    df.to_csv(f"feature_importances_{target}_renamed.csv", index=True)
    print(f"▶ feature_importances_{target}_renamed.csv を出力しました")
