FROM node:18-bullseye

# 基本パッケージ
RUN apt-get update && apt-get install -y ffmpeg \
    python3 python3-pip python3-dev build-essential

# Pythonライブラリをインストール
RUN pip3 install --no-cache-dir pandas librosa numpy

# Node.js の依存関係をインストール
WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm install

COPY . .

# entrypoint.sh に実行権限を付ける
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x /app/node_modules/.bin/ts-node-dev
RUN chmod +x ./docker/entrypoint.sh

CMD ["./docker/entrypoint.sh"]