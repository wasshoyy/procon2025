import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { authMiddleware, AuthRequest } from '../middlewares/auth';

const router = express.Router();

router.use(express.static(path.join(__dirname, '../frontend/private')));

const folderPath = path.join(__dirname, "../frontend/private", "folder.html");
const folderHtml = fs.readFileSync(folderPath, "utf-8");

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(folderHtml);
});

module.exports = router;