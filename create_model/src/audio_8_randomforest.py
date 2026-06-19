import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import joblib  # モデル保存用

# -----------------------------
# データ読み込み
# -----------------------------
with open("training_data.pkl", "rb") as f:
    data = pickle.load(f)

feature_cols = [c for c in data.columns if c.startswith("feature_")]
target_cols = ["brightness", "smoothness", "thickness", "clarity", "sharpness"]

X = data[feature_cols].values

# -----------------------------
# 指標ごとに個別モデル学習
# -----------------------------
for target in target_cols:
    print(f"\n=== {target} ===")
    y = data[target].values

    # データ分割
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # モデル学習
    rf = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    # 予測と評価
    y_pred = rf.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    print(f"MSE: {mse:.3f}")

    # 特徴量重要度を CSV に保存
    importances = rf.feature_importances_
    df_importance = pd.DataFrame({
        "feature": feature_cols,
        "importance": importances
    }).sort_values(by="importance", ascending=False)
    csv_filename = f"feature_importances_{target}.csv"
    df_importance.to_csv(csv_filename, index=False, encoding="utf-8-sig")
    print(f"▶ 重要度を {csv_filename} に保存しました。")

    # モデル保存
    model_filename = f"rf_model_{target}.pkl"
    joblib.dump(rf, model_filename)
    print(f"▶ モデルを {model_filename} に保存しました。")
