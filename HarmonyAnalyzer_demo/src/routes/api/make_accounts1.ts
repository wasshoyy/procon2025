import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { Pool, QueryResult } from 'pg';
import bcrypt from "bcryptjs";

const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432,
});

// POST: 団体作成
router.post('/', async (req: Request, res: Response) => {
  const {orgName, inviteCode } = req.body;

  if (!orgName || !inviteCode) {
    return res.json({ success: false, message: "すべての項目を入力してください" });
  }



  //同じ名前を付けないようにするか、コードで管理するか、、、
  //すでに同じ団体名が存在するか確認
try {
    const nameRes: QueryResult<{ id: number }> = await pool.query(
      'SELECT id FROM organizations WHERE name = $1',
      [orgName]
    );
    if (nameRes.rowCount && nameRes.rowCount > 0) {
      return res.json({ success: false, message: "この団体名は既に登録されています" });
    }

    // すでに同じ団体コードが存在するか確認
    const orgRes: QueryResult<{ id: number }> = await pool.query(
      'SELECT id FROM organizations WHERE invite_code = $1',
      [inviteCode]
    );
    if (orgRes && orgRes.rowCount && orgRes.rowCount > 0) {
      return res.json({ success: false, message: "団体コードは既に使われています" });
    }

    // 団体作成
    const insertOrg: QueryResult<{ id: number }> = await pool.query(
      'INSERT INTO organizations (name, invite_code) VALUES ($1, $2) RETURNING id',
      [orgName, inviteCode]
    );
    const orgId = insertOrg.rows[0]?.id;
    if (!orgId) throw new Error("団体作成に失敗しました");

    // 団体フォルダ作成
    const uploadsDir = path.join(__dirname, "../../uploads");
    const safeOrgName = orgName.replace(/[^a-zA-Z0-9_\u3000-\u9FFF]/g, "_");
    const orgDir = path.join(uploadsDir, safeOrgName);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir);
    }


    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error instanceof Error ? error.message : "サーバーエラーが発生しました" });
  }
});

module.exports = router;
