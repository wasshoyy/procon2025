import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { authMiddleware, AuthRequest } from '../middlewares/auth';

const router = express.Router();

router.use(express.static(path.join(__dirname, '../frontend/private')));

const settingPath = path.join(__dirname, "../frontend/private", "setting.html");
const settingHtml = fs.readFileSync(settingPath, "utf-8");

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(settingHtml);
});

module.exports = router;