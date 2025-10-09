import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
const router = express.Router();

router.use(express.static(path.join(__dirname, '../frontend/public')));

const make_accountPath = path.join(__dirname, "../frontend/public", "make_account.html");
const make_accountHtml = fs.readFileSync(make_accountPath, "utf-8");

router.get('/', (_req: Request, res: Response) => {

  res.setHeader("Content-Type", "text/html");
  res.send(make_accountHtml);

});

module.exports = router;