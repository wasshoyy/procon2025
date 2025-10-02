import express, { Request, Response } from 'express';
const router = express.Router();


router.post('/logout', (req, res) => {
  // auth_token という名前のクッキーを削除
  res.clearCookie('auth_token', {
    httpOnly: true,  // 元の設定と同じオプションを付ける
    secure: true,    // HTTPS環境でのみ有効
    sameSite: 'strict'
  });
  
  // レスポンス送信
  res.json({ success: true, message: 'ログアウトしました' });
});

module.exports = router;