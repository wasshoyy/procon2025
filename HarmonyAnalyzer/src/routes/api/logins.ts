import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
const router = express.Router();

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432
});

async function getUser(name: string, password: string) {
  const res = await pool.query(
    `SELECT u.id, u.name, u.password, o.name AS organization_name
     FROM users u
     JOIN organizations o ON u.organizationid = o.id
     WHERE u.name = $1`,
    [name]
  );

  if (res.rowCount === 0) return null;

  const user = res.rows[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) return null;

  // パスワードを除いた情報を返す
  return {
    id: user.id,
    name: user.name,
    organization_name: user.organization_name
  };
}

const SECRET_KEY = 'your-secret-key'; // JWTの署名キー

router.post('/', async (req: Request, res: Response) => {

  const { name, password } = req.body;
  const user = await getUser(name, password);

  if (!user) {
    res.json({ success: false, messsage: "IDまたはパスワードが違います" })
  } else {
    const userInfo = { userId: user.id };

    // JWTトークン化してCookieに保存
    const token = jwt.sign(userInfo, SECRET_KEY, { expiresIn: '1h' });

    res.cookie('auth_token', token, {
      httpOnly: true,      // JSからアクセス不可
      secure: false,       // HTTPSでなくてもOK
      sameSite: 'lax',     // CSRF対策、HTTPでも機能
      maxAge: 3600 * 1000  // 1時間
    });

    res.json({ success: true, user });
    console.log(`[login] ${name}がログインしました`);
  }

});


module.exports = router;