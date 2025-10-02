import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import fs from "fs";
import path from "path";

const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432
});

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

async function getSoundId(filePath: string) {
  const res = await pool.query(`
    SELECT s.id
    FROM sounds s
    JOIN songs song ON s.songId = song.id
    WHERE song.folderPath || '/' || s.filename = $1;
  `, [filePath]);

  if (res.rowCount === 0) return null;

  return res.rows[0].id;
}



// フォルダ内のファイル一覧を返す
router.get("/list-files/:folderPath(*)", async (req: Request, res: Response) => {
  // 団体名を取得
  const orgName = decodeURIComponent(req.headers["x-org-name"] as string);
  if (!orgName) {
    return res.status(400).send({ error: "Organization name missing in header" });
  }


  const requestPath = req.params.folderPath;

  // 団体名で始まっているか確認
  if (!requestPath.startsWith(orgName)) {
    return res.status(403).send({ error: "Access denied" });
  }


  const subPath = requestPath.replace(orgName, "").replace(/^\/+/, "");
  const fullFolderPath = path.join(UPLOAD_ROOT, orgName, subPath);

  console.log("[folder] アクセスしようとしているパス:", fullFolderPath);

  // フォルダの存在確認
  if (
    !fs.existsSync(fullFolderPath) ||
    !fs.statSync(fullFolderPath).isDirectory()
  ) {
    return res
      .status(404)
      .send({ error: `Folder not found at ${fullFolderPath}` });
  }

  try {
    const items = fs.readdirSync(fullFolderPath);

    // Promiseの配列を作成
    const itemPromises = items.map(async (item) => {
      const fullPath = path.join(fullFolderPath, item);
      const soundPath = fullPath.replace("/app/src/uploads/", "");
      const soundId = await getSoundId(soundPath)
      return {
        name: item,
        is_directory: fs.statSync(fullPath).isDirectory(),
        soundId: soundId
      };
    });

    // Promise.allで全て完了するまで待つ
    const itemsList = await Promise.all(itemPromises);

    return res.json(itemsList);
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .send({ error: err.message || "Failed to list files" });
  }

});



//ADD
// 選択された音源を削除する
router.post("/delete-files", async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send({ error: "Invalid sound IDs provided" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. データベースからファイルパスを取得
    const resDb = await client.query(`
      SELECT s.id, songs.folderPath || '/' || s.filename AS filepath
      FROM sounds s
      LEFT JOIN songs ON s.songId = songs.id
      WHERE s.id = ANY($1);
    `, [ids]
    );

    if (resDb.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send({ error: "No sounds found for the given IDs" });
    }

    // 2. ファイルシステムから関連ファイルを削除
    const filepaths = resDb.rows.map(row => row.filepath);
    for (const filepath of filepaths) {
      const baseName = filepath.split('.')[0];
      const extensions = ['webm', 'pkl', 'wav'];

      for (const ext of extensions) {
        const fullPath = path.join(UPLOAD_ROOT, `${baseName}.${ext}`);
        console.log(`[folder] 消すファイルのパス: ${fullPath}`);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    }

    // 3. データベースからレコードを削除
    await client.query(`DELETE FROM sounds WHERE id = ANY($1::int[])`, [ids]);
    await client.query('COMMIT');

    return res.status(200).send({ message: "Files and database entries deleted successfully" });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error("削除エラー:", err);
    return res.status(500).send({ error: err.message || "Failed to delete files" });
  } finally {
    client.release();
  }
});

module.exports = router;