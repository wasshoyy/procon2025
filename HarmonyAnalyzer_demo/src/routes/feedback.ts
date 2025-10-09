import express, { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import { authMiddleware, AuthRequest } from '../middlewares/auth';

const router = express.Router();

router.use(express.static(path.join(__dirname, '../frontend/private')));

const feedbackPath = path.join(__dirname, "../frontend/private", "feedback.html");
const feedbackHtml = fs.readFileSync(feedbackPath, "utf-8");

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(feedbackHtml);
});

module.exports = router;