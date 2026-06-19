import express, { Request, Response } from 'express';
import os from 'os';
import { Pool } from 'pg';
import cookieParser from 'cookie-parser';

const app = express();
const port = 3000;
app.use(cookieParser());

const pool = new Pool({
  user: 'student',
  host: 'db',
  database: 'database',
  password: 'student',
  port: 5432
});


async function initDb() {
  // テーブルを作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      invite_code VARCHAR(50) UNIQUE NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(100) NOT NULL,
      organizationId INTEGER,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      folderPath TEXT UNIQUE NOT NULL,
      organizationId INTEGER,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sounds (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      userId INTEGER,
      songId INTEGER,
      date DATE NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE SET NULL
    );
  `);

  // 初期データ
  await pool.query(`
    INSERT INTO organizations (name, invite_code)
    VALUES ('宇部高専吹奏楽部', '12345')
    ON CONFLICT (name) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO users (name, password, organizationid)
    VALUES (
      'test',
      '$2b$10$8InveIzlKjDSm8cT4VizQOeDa/PTr6FKHBSavcmFOeKqV6ju7WZfO',
      (SELECT id FROM organizations WHERE name = '宇部高専吹奏楽部')
    )
    ON CONFLICT (name) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO songs (folderpath, organizationid)
    SELECT
      v.folderpath,
      (SELECT id FROM organizations WHERE name='宇部高専吹奏楽部')
    FROM (
      VALUES
        ('宇部高専吹奏楽部/クラリネット/テスト_120_4-4'),
        ('宇部高専吹奏楽部/フルート/マーチ_70_6-8')
    ) AS v(folderpath)
    ON CONFLICT (folderpath) DO NOTHING;
  `);
  /*
  await pool.query(`
    INSERT INTO sounds (filename, userid, songid, date)
    SELECT
      v.filename,
      (SELECT id FROM users WHERE name='test'),
      (SELECT id FROM songs WHERE folderpath='宇部高専吹奏楽部/クラリネット/マーチ_120_4-4'),
      v.date
    FROM (
      VALUES
        ('test_20250912_000000.webm', DATE '2025-09-12'),
        ('test_20250912_111111.webm', DATE '2025-09-12'),
        ('test_20250912_123456.webm', DATE '2025-09-12')
    ) AS v(filename, date)
    ON CONFLICT (filename) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO sounds (filename, userid, songid, date)
    VALUES (
      'test_20250912_000001.webm',
      (SELECT id FROM users WHERE name='test'),
      (SELECT id FROM songs WHERE folderpath='宇部高専吹奏楽部/フルート/マーチ_70_6-8'),
      DATE '2025-09-12'
    )
    ON CONFLICT (filename) DO NOTHING;
  `);
  */
}


app.use(express.json());

// api用ルート
const loginApiRouter = require("./routes/api/logins");
const make_accountApiRouter = require("./routes/api/make_accounts");
const make_account1ApiRouter = require("./routes/api/make_accounts1");
const recordingApiRouter = require("./routes/api/recordings");
const folderApiRouter = require("./routes/api/folders");
const feedbackApiRouter = require("./routes/api/feedbacks");
const settingApiRouter = require("./routes/api/settings");

app.use("/api/login", loginApiRouter);
app.use("/api/make_account", make_accountApiRouter);
app.use("/api/make_account1", make_account1ApiRouter);
app.use("/api/recording", recordingApiRouter);
app.use("/api/folder", folderApiRouter);
app.use("/api/feedback", feedbackApiRouter);
app.use("/api/setting", settingApiRouter);


// 画面用ルート
const loginRouter = require("./routes/login");
const make_accountRouter = require("./routes/make_account");
const make_account1Router = require("./routes/make_account1");
const recordingRouter = require("./routes/recording");
const folderRouter = require("./routes/folder");
const feedbackRouter = require("./routes/feedback");
const settingRouter = require("./routes/setting");

app.use("/login", loginRouter);
app.use("/make_account", make_accountRouter);
app.use("/make_account1", make_account1Router);
app.use("/recording", recordingRouter);
app.use("/folder", folderRouter);
app.use("/feedback", feedbackRouter);
app.use("/setting", settingRouter);


// DB初期化後にサーバー起動
initDb()
  .then(() => {
    app.listen(port,'0.0.0.0', () => {
      console.log(`[backend] listening on:`);
      console.log(`  Local:   http://localhost:${port}/login`);
    });
  })
  .catch(err => {
    console.error('[backend] init error:', err);
    process.exit(1);
  });