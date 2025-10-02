import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import cookieParser from 'cookie-parser';
import { authMiddleware, AuthRequest } from '../middlewares/auth';

const router = express.Router();

router.use(cookieParser());
// フロントエンドの静的ファイル
router.use(express.static(path.join(__dirname, '../frontend/private')));

const recordingPath = path.join(__dirname, "../frontend/private", "recording.html");
const recordingHtml = fs.readFileSync(recordingPath, "utf-8");

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(recordingHtml);
});

module.exports = router;