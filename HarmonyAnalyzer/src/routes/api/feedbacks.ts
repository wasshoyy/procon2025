import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { Pool } from 'pg';
import { spawn } from "child_process";

const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432
});


// soundIdからfilePathを取得(データベース)
async function getFilePaths(ids: number | number[]) {
  // 配列で統一して処理
  const idsArray = Array.isArray(ids) ? ids : [ids];

  if (idsArray.length === 0) return [];

  const res = await pool.query(`
    SELECT s.id, songs.folderPath || '/' || s.filename AS filepath
    FROM sounds s
    LEFT JOIN songs ON s.songId = songs.id
    WHERE s.id = ANY($1);
  `, [idsArray]);

  // 取得結果を [ { id, filepath }, ... ] の形で返す
  return res.rows;
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


router.use(express.static(path.join(__dirname, '../frontend/private')));

// アップロードディレクトリのルートを指定
const UPLOAD_FOLDER = path.join(__dirname, '../../', 'uploads');

// Python 実行環境とスクリプトパス
const pythonPath = "/usr/bin/python3";

// -------------------------------
//このコードはJSON を返します
// -------------------------------
router.get('/items', async (req: Request, res: Response) => {

  const idsParam = req.query.ids;
  let ids: number[] = [];
  if (typeof idsParam === "string") {
    // /items?ids=1,2,3
    ids = idsParam.split(",").map(Number).filter(n => !isNaN(n));
  }

  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: "解析する音源が選択されていません" });
  }

  // DBから filePath を取得
  const soundFiles = await getFilePaths(ids);

  if (soundFiles.length === 0) {
    return res.status(404).json({ error: "音声ファイルが存在しません" });
  }

  const results = [];
  // それぞれの録音データのpklファイルを読む
  const readscriptPath = path.join(__dirname, "../../analyzer", "read_pickle.py");

  for (const { id, filepath } of soundFiles) {
    console.log(`[feedback] 表示するファイルのパス: ${filepath}`);
    const audioPath = path.join(UPLOAD_FOLDER, filepath).replace(".webm", ".pkl");

    if (!fs.existsSync(audioPath)) {
      results.push({ id, error: "音声ファイルが存在しません" });
      continue;
    }

    const pythonProcess = spawn(pythonPath, [readscriptPath, audioPath]);

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    // Promise で待機
    const singleResult: any = await new Promise((resolve) => {
      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error(stderrData);
          resolve({ id, error: "Python(read_pickle) 実行エラー" });
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
            const filename = path.parse(filepath).name;
            const view_name = formatFilename(filename);
            const option = parseBpmAndMeterOne(filepath);
            console.log(`option.bpm: ${option.bpm}`);
            resolve({ id, analysis, filepath, view_name, option });
          } catch (err) {
            console.error("JSON parse error:", err);
            resolve({ id, error: "JSON 変換エラー" });
          }
          console.log('[recording] Python 処理完了');
        }
      });
    });

    results.push(singleResult);
  }

  // 協調度を受け取る
  const harmonyscriptPath = path.join(__dirname, "../../analyzer", "harmony_analize.py");

  if (soundFiles.length > 1) {
    let files = []
    for (const { filepath } of soundFiles) {
      files.push(UPLOAD_FOLDER + '/' + filepath.replace("webm", "wav"));
    }
    const args = [harmonyscriptPath, ...files];
    const pythonProcess = spawn(pythonPath, args);

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    const harmony: any = await new Promise((resolve) => {
      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error(stderrData);
          resolve({ error: "Python(harmony_analize) 実行エラー" });
        } else {
          try {
            const result = JSON.parse(stdoutData);
            const length = Array.isArray(result) ? result.length : 0;
            const arrayData = [];
            for (let i = 0; i < length; i++) {
              arrayData.push({
                degree: result[i],
              });
            }
            resolve({ harmony: arrayData });
          } catch (err) {
            console.error("JSON parse error:", err);
            resolve({ error: "JSON 変換エラー" });
          }
        }
      });
    });
    results.push(harmony);
  }

  // 複数ファイル分の解析結果を返す
  return res.json(results);
});

// 拡張子→MIME の簡易マップ（必要に応じて追加）
const MIME_MAP: Record<string, string> = {
  ".wav":  "audio/wav",
  ".webm": "audio/webm",
  ".mp3":  "audio/mpeg",
  ".ogg":  "audio/ogg",
  ".m4a":  "audio/mp4",
};

// パストラバーサル対策：AUDIO_ROOT 配下かチェック
function isUnderRoot(fullPath: string) {
  const rel = path.relative(UPLOAD_FOLDER, fullPath);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// Range レスポンス送信
function sendWithRange(req: Request, res: Response, fullPath: string, mime: string) {
  const stat = fs.statSync(fullPath);
  const totalSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    // Range 無し → 全体返却
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": totalSize,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    });
    fs.createReadStream(fullPath).pipe(res);
    return;
  }

  // 例: "bytes=0-1023"
  const bytesPrefix = "bytes=";
  if (!range.startsWith(bytesPrefix)) {
    res.status(416).end();
    return;
  }

  const parts = range.replace(bytesPrefix, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

  // 範囲妥当性
  if (isNaN(start) || isNaN(end) || start > end || start >= totalSize) {
    res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${totalSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": mime,
    "Cache-Control": "public, max-age=3600",
  });
  fs.createReadStream(fullPath, { start, end }).pipe(res);
}

// 例: /api/feedback/server/aa高校/フルート/untitled_120_4-4/test_20250930_093044.wav
router.get("/server/:subpath(*)", (req: express.Request<{ subpath?: string }>, res) => {
  try {
    // 「*」にマッチしたサブパスを取得
    // Express は URL デコード後の文字列を渡すので日本語OK
    const subPath = req.params.subpath ?? ''; // ← 型付きで取れる

    // サブパスからフルパスを作成
    const requestedPath = path.join(UPLOAD_FOLDER, subPath);
    const fullPath = path.resolve(requestedPath);

    // ルート配下チェック
    if (!isUnderRoot(fullPath)) {
      return res.status(403).json({ error: "Forbidden path" });
    }

    // ファイル存在チェック
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: "File not found" });
    }

    // MIME 決定
    const ext = path.extname(fullPath).toLowerCase();
    const mime = MIME_MAP[ext] ?? "application/octet-stream";

    // HEAD ならヘッダのみ
    if (req.method === "HEAD") {
      const size = fs.statSync(fullPath).size;
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      });
      return res.end();
    }

    // Range 対応で送信
    sendWithRange(req, res, fullPath, mime);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;