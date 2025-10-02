import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";
import multer, { Multer } from "multer";

import cookieParser from 'cookie-parser';

const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432
});


// soundsテーブルのレコードを作成
async function createSound(filename: string, userId: number, folderPath: string, organizationName: string) {
  const organizationRes = await pool.query("SELECT id FROM organizations WHERE name = $1", [organizationName]);
  const organizationId = organizationRes.rows[0]?.id ?? null;

  const songRes = await pool.query(
    "INSERT INTO songs (folderpath, organizationid) VALUES ($1, $2) ON CONFLICT (folderpath) DO NOTHING RETURNING id",
    [folderPath, organizationId]
  );

  let songId = songRes.rows[0]?.id;
  if (!songId) {
    // 既存レコードのidを取得
    const existing = await pool.query(
      "SELECT id FROM songs WHERE folderpath = $1",
      [folderPath]
    );
    songId = existing.rows[0]?.id ?? null;
  }

  const result = await pool.query(
    "INSERT INTO sounds (filename, userId, songId, date) VALUES ($1, $2, $3, $4) RETURNING id",
    [filename, userId, songId, new Date()]
  );

  return result.rows[0]?.id ?? null;
}

// test_20250908_132530.webmのようなファイル名を作る(ユーザー名_年月_時分秒.webm)
async function createFilename(userId: number) {
  const res = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
  const name = res.rows[0]?.name ?? null;
  const now = new Date();
  const filename = name + '_' + `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}` + '.webm';
  return filename;
}

// アップロードディレクトリのルートを指定
const UPLOAD_FOLDER = path.join(__dirname, '../../', 'uploads');

router.use(cookieParser());

// ディレクトリがなければ作成する関数
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true }); // 再帰的に作成
  }
}

// Multer 設定
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = req.params.path || 'default'; // URL パラメータから取得
    // const safeFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, ''); // セキュリティ対策
    const uploadDir = path.join(UPLOAD_FOLDER, folder);
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 一旦一意な名前で保存
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload: Multer = multer({ storage: storage });

// WAV 変換関数
function convertWebmToWav(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("wav")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

function formatFilename(input: string): string {
  // 例: "test_20250930_093044"
  const match = input.match(/^(.+?)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);

  if (!match) {
    throw new Error("フォーマットが不正です");
  }

  const [, prefix, year, month, day, hour, minute, second] = match;

  return `${prefix} ${Number(year)}年${Number(month)}月${Number(day)}日 ${Number(hour)}時${Number(minute)}分${Number(second)}秒`;
}

type ParsedInfo = {
  songTitle?: string; // 例: "マーチ"
  bpm?: number; // 例: 70
  beats?: number; // 例: 6（6/8 の分子）
};

export function parseBpmAndMeterOne(filepath: string): ParsedInfo {
  const PATTERN = /^(.+?)_(\d+)_([0-9]+)-([0-9]+)$/;

  let fp = filepath.split('#')[0].split('?')[0];
  const segs = fp.split(/[/\\]/).filter(Boolean).map(s => {
    try { return decodeURIComponent(s); } catch { return s; }
  });

  // 直前のフォルダ名を候補に
  let label = segs.length >= 2 ? segs[segs.length - 2] : '';
  // 万一別の場所にあっても拾えるよう全セグメントを検索
  const hit = segs.find(s => PATTERN.test(s));
  if (hit) label = hit;

  const m = label.match(PATTERN);

  const songTitle = m ? m[1] : undefined;
  const bpm = m ? Number(m[2]) : undefined;
  const beats = m ? Number(m[3]) : undefined;

  return { songTitle, bpm, beats };
}


// Python 実行環境とスクリプトパス
const pythonPath = "/usr/bin/python3";
const scriptPath = path.join(__dirname, "../../analyzer", "analyze_audio.py");

router.post('/upload/:path', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ファイルがありません' });
    }

    const folder = req.params.path || 'default';

    // 団体名を抽出
    const organizationName = folder.split(path.sep)[0];

    // ユーザー情報とファイル名生成
    const token = req.cookies.auth_token;
    const payload = jwt.decode(token) as { userId: number };
    const filename = await createFilename(payload?.userId);

    // 保存先ディレクトリの準備
    const targetDir = path.join(UPLOAD_FOLDER, folder);
    ensureDir(targetDir);

    // ファイル移動
    const targetPath = path.join(targetDir, filename);
    await fs.promises.rename(req.file.path, targetPath);

    // データベース登録
    const soundId = await createSound(filename, payload?.userId, folder, organizationName);

    // wav に変換
    const newFilename = filename.replace('.webm', '.wav');
    const audioPath = path.join(targetDir, newFilename);
    await convertWebmToWav(targetPath, audioPath);

    console.log(`[recording] 保存されたファイルのパス: ${audioPath}`);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: "音声ファイルが存在しません" });
    }


    const pythonProcess = spawn(pythonPath, [scriptPath, audioPath]);

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    pythonProcess.on("exit", (code, signal) => {
      console.log("[recording] Python exited with code", code, "signal", signal);
    });

    const singleResult: any = await new Promise((resolve) => {
      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error(stderrData);
          resolve({ id: soundId, error: "Python(read_pickle) 実行エラー" });
        } else {
          try {
            const result = JSON.parse(stdoutData);
            const length = result.brightness.length;
            const analysis = [];
            for (let i = 0; i < length; i++) {
              analysis.push({
                brightness: result.brightness[i],
                clarity: result.clarity[i],
                sharpness: result.sharpness[i],
                smoothness: result.smoothness[i],
                thickness: result.thickness[i],
                pitch: result.pitch[i],
                volume: result.volume[i],
              });
            }
            const filepath = targetPath;
            const view_name = formatFilename(filename.replace(".webm", ""));
            const option = parseBpmAndMeterOne(targetPath);
            resolve({ id: soundId, analysis, filepath, view_name, option });
          } catch (err) {
            console.error("JSON parse error:", err);
            resolve({ id: soundId, error: "JSON 変換エラー" });
          }
          console.log('[recording] Python 処理完了');
        }
      });
    });

    res.json({ success: true, message: 'pklファイル保存完了', path: targetPath, soundId: soundId, data: singleResult });
  } catch (error) {
    console.error('アップロードエラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー', error: String(error) });
  }
});


module.exports = router;