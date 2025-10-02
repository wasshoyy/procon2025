import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
const router = express.Router();

router.use(express.static(path.join(__dirname, '../frontend/public')));

const loginPath = path.join(__dirname, '../frontend/public', 'login.html');
const loginHtml = fs.readFileSync(loginPath, "utf-8");

router.get('/', (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(loginHtml);
});

module.exports = router;