-- Team Luminize D1 schema
-- 適用: npx wrangler d1 execute luminize-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS creators (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,          -- URL用ID（例: hikari）
  name          TEXT NOT NULL,                 -- 表示名
  name_en       TEXT DEFAULT '',               -- 英字表記
  role          TEXT DEFAULT '',               -- 肩書（例: ゲーム実況 / 歌い手）
  catchphrase   TEXT DEFAULT '',               -- ひとこと
  bio           TEXT DEFAULT '',               -- 紹介文
  avatar        TEXT DEFAULT '',               -- 画像URL（外部URL または /api/images/:id）
  color         TEXT DEFAULT '#9b4dea',        -- メンバーカラー
  youtube_channel_id TEXT DEFAULT '',          -- UCから始まるチャンネルID
  links         TEXT DEFAULT '[]',             -- SNSリンク JSON: [{"type":"x","url":"..."}]
  sort_order    INTEGER DEFAULT 0,
  is_published  INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  category      TEXT DEFAULT 'お知らせ',
  body          TEXT DEFAULT '',
  thumbnail     TEXT DEFAULT '',
  published_at  TEXT DEFAULT (date('now')),
  is_published  INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS works (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  client        TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  work_date     TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  thumbnail     TEXT DEFAULT '',
  url           TEXT DEFAULT '',
  creator_ids   TEXT DEFAULT '[]',             -- 関わったクリエイターID JSON
  sort_order    INTEGER DEFAULT 0,
  is_published  INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- YouTube動画キャッシュ（横動画のみ）
CREATE TABLE IF NOT EXISTS videos (
  video_id      TEXT PRIMARY KEY,
  creator_id    INTEGER NOT NULL,
  title         TEXT DEFAULT '',
  published_at  TEXT DEFAULT '',
  hidden        INTEGER DEFAULT 0,             -- 管理画面で非表示にした動画
  fetched_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_pub ON videos(published_at DESC);

-- アップロード画像（R2不要・D1に保存）
CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,
  mime          TEXT NOT NULL,
  data          TEXT NOT NULL,                 -- base64
  created_at    TEXT DEFAULT (datetime('now'))
);

-- サイト設定（キャッチコピー・事務所紹介・公式SNSなど）
CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);
