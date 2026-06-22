# procon2025
宇部工業高等専門学校の第36回全国高等専門学校プログラミングコンテスト自由部門提出用のリポジトリです。

---

## ディレクトリ構成
```text
procon2025
├── HarmonyAnalyzer  # アプリ本体
├── create_model  # モデル作成プログラム
├── materials  # 資料置き場
└── README.md
```

---

## 作品について
私たちは「Harmony Analyzer -ハーモニーを科学するAI-」を開発しました。  
Harmony Analyzerは、吹奏楽団体向けに設計された、合奏の「ハーモニー」を可視化・定量化する解析支援システムです。

より詳しく知りたい方は [資料](./materials) をご確認ください。

---

## 環境
※ 様々な環境で動作確認をしているわけではないことをご了承ください。

本アプリの実行には、DockerおよびDocker Compose v2がインストールされている必要があります。

以下の環境で動作確認を行いました。

- WSL2
- Ubuntu 24.04

---

## アプリの起動方法
HarmonyAnalyzerディレクトリへ移動します。
```bash
cd HarmonyAnalyzer
```

### ビルド
```bash
docker compose build
```

### コンテナを起動
```bash
docker compose up -d
```

### ログの確認
```bash
docker compose logs -f
```

### ログインページへアクセス
ブラウザで以下のURLを開いてください。  
http://localhost:3000/login

### コンテナを停止
```bash
docker compose down
```

### データベースを全消去
```bash
docker compose down -v
```

---
## 補足
作品名は「Harmony Analyzer」ですが、ソースコード上のディレクトリ名は「HarmonyAnalyzer」としていることに注意してください。
