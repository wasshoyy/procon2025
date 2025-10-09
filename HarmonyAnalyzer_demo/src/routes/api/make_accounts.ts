import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from "bcryptjs";
const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432,
});

//###0908
async function getOrganizationId(invite_code: string) {
  const res = await pool.query(
    'SELECT id FROM organizations WHERE invite_code = $1',
    [invite_code]
  );
  return (res.rowCount ?? 0) > 0 ? res.rows[0].id : null;
}
//###0908

async function createUser(name: string, password: string, organization_id: number) {
  const saltRounds = 10; // 計算コスト（大きいほど安全だが遅くなる）
  // ハッシュ化
  const hashed = await bcrypt.hash(password, saltRounds);
  const res = await pool.query('INSERT INTO users (name, password, organizationid) VALUES ($1, $2, $3) RETURNING *', [name, hashed, organization_id]);
  return res.rows[0];
}

async function existUser(name: string) {
  const res = await pool.query('SELECT EXISTS ( SELECT 1 FROM users WHERE name = $1)', [name]);
  return res.rows[0].exists;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, password, invite_code } = req.body;

    // 同じ名前のユーザーがすでに存在するかチェック
    if (await existUser(name)) {
      return res.json({ success: false, message: "このIDはすでに使われています" });
    }

    // 団体コードからorganization_idを取得
    const orgId = await getOrganizationId(invite_code);
    if (!orgId) {
      return res.json({ success: false, message: "団体コードが正しくありません" });
    }

    // ユーザー作成（団体IDと紐付け）
    await createUser(name, password, orgId);

    res.json({ success: true });
    console.log(`[make_account] アカウント、${name}が作成されました`);
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "サーバーエラーが発生しました" });
  }
});

module.exports = router;