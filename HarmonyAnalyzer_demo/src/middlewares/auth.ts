import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET_KEY = 'your-secret-key';

export interface AuthRequest extends Request {
  user?: any; // 後で user を参照できるように拡張
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies['auth_token'];
  if (!token) return res.status(401).json({ message: '未ログインです' });

  try {
    const user = jwt.verify(token, SECRET_KEY);
    req.user = user;
    next(); // ここで次のルートに進む
  } catch (err) {
    return res.status(401).json({ message: '無効なトークンです' });
  }
}
