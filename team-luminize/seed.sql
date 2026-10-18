-- 初期データ（サンプル）。管理画面から自由に書き換え・削除できます。
-- 適用: npx wrangler d1 execute luminize-db --remote --file=./seed.sql

INSERT OR IGNORE INTO settings (key, value) VALUES
 ('hero_title', '光る個性を、もっと遠くへ。'),
 ('hero_sub', 'Team Luminize は、配信・動画・音楽で活動するクリエイターが集まるチームです。'),
 ('about_title', 'ひとりの「好き」が、誰かの光になる'),
 ('about_body', 'Team Luminize（チーム・ルミナイズ）は、YouTube・TikTok・ライブ配信などで活動するクリエイターをサポートするクリエイターチームです。
企画・編集・ブランディング・企業案件の窓口まで、クリエイターが創作に集中できる環境をつくり、それぞれの個性がもっと多くの人に届くよう伴走します。'),
 ('official_links', '[{"type":"x","url":"https://x.com/"},{"type":"youtube","url":"https://www.youtube.com/"}]'),
 ('contact_note', '企業案件・コラボ・取材・所属に関するご相談は、こちらのフォームからお送りください。通常3営業日以内にご返信します。'),
 ('movie_per_creator', '2'),
 ('movie_limit', '9');

INSERT OR IGNORE INTO creators (id, slug, name, name_en, role, catchphrase, bio, color, youtube_channel_id, links, sort_order) VALUES
 (1, 'sample-a', 'サンプル 光', 'Hikari', 'ゲーム実況', '夜ふかしゲーム配信、毎日更新中。', 'ここに紹介文が入ります。管理画面の「クリエイター」から名前・画像・紹介文・SNSリンク・YouTubeチャンネルIDを編集してください。', '#9b4dea', '', '[{"type":"x","url":"https://x.com/"},{"type":"youtube","url":"https://www.youtube.com/"},{"type":"tiktok","url":"https://www.tiktok.com/"}]', 1),
 (2, 'sample-b', 'サンプル 桜', 'Sakura', '歌ってみた / 作詞', '歌で、いちばん近くに。', 'ここに紹介文が入ります。', '#ff7a2f', '', '[{"type":"x","url":"https://x.com/"},{"type":"instagram","url":"https://www.instagram.com/"}]', 2),
 (3, 'sample-c', 'サンプル 蒼', 'Ao', 'Vlog / 旅', '見たことのない景色を、毎週。', 'ここに紹介文が入ります。', '#3d7bf5', '', '[{"type":"youtube","url":"https://www.youtube.com/"}]', 3);

INSERT OR IGNORE INTO news (id, title, category, body, published_at) VALUES
 (1, '公式サイトをリニューアルしました', 'お知らせ', 'Team Luminize の公式サイトをリニューアルしました。
所属クリエイターの最新動画や活動情報をこちらでお届けします。', date('now')),
 (2, 'お問い合わせフォームを開設しました', 'お知らせ', '企業案件・コラボのご相談はお問い合わせフォームからお送りください。', date('now'));

INSERT OR IGNORE INTO works (id, title, client, category, work_date, description, creator_ids, sort_order) VALUES
 (1, 'サンプル実績：ゲームタイトルPR動画', 'サンプル株式会社', 'PR動画', '2026-09', 'ここに実績の説明が入ります。', '[1]', 1),
 (2, 'サンプル実績：コラボ配信', 'サンプルブランド', '配信', '2026-08', 'ここに実績の説明が入ります。', '[2,3]', 2);
