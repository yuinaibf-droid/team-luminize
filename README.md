# Team Luminize 公式サイト + 管理画面

Cloudflare Pages（サイト配信）＋ Pages Functions（API）＋ D1（データベース）で動く、**サーバー代・DB代0円**のクリエイター事務所サイトです。
ビルド不要のHTML / CSS / JavaScriptで作っているので、ファイルをそのまま編集できます。

| 画面 | URL |
|---|---|
| トップページ（About / News / Creators / Movie / Works / Contact） | `/` |
| クリエイター個人ページ | `/creators/{URL用ID}` |
| お知らせ一覧・詳細 | `/news` ・ `/news/{id}` |
| 管理画面（パスワード保護） | `/admin/` |

---

## できること

**公開サイト**
- 事務所紹介・お知らせ・所属クリエイター一覧・実績・お問い合わせフォーム
- **Movie欄**：各クリエイターのYouTubeから最新の**横動画だけ**を自動表示（Shortsは自動除外）。約3時間ごとに自動更新
- クリエイター個人ページ：アイコン、紹介文、SNSボタン（X / YouTube / Instagram / TikTok / Twitch ほか）、最新動画、関わった実績
- スマホ対応・メンバーカラーで光るアイコン

**管理画面**
- クリエイターの追加・編集・削除（名前・アイコン画像・紹介文・メンバーカラー・表示順・公開/非公開）
- **SNSリンクをいつでも追加・変更・削除**（保存すると即サイトに反映）
- YouTubeチャンネルの紐付け（チャンネルURLや @ハンドル から自動でIDに変換）
- お知らせの投稿・編集、実績（Works）の管理
- 取得済み動画の一覧・個別に非表示・「今すぐ更新」
- トップのキャッチコピー・事務所紹介・公式SNSなどのサイト設定

---

## フォルダ構成

```
team-luminize/
├─ public/                    … 公開されるファイル（Pagesの出力ディレクトリ）
│  ├─ index.html              … トップページ
│  ├─ creator.html            … クリエイター個人ページ
│  ├─ news.html / news-detail.html
│  ├─ admin/index.html        … 管理画面
│  ├─ assets/css/style.css    … サイトのデザイン
│  ├─ assets/css/admin.css    … 管理画面のデザイン
│  ├─ assets/js/config.js     … ★ お問い合わせ送信キー（Web3Forms）
│  ├─ assets/js/*.js          … 各ページの処理
│  ├─ _redirects              … /creators/○○ などのURL設定
│  └─ _headers                … セキュリティヘッダー
├─ functions/api/[[path]].js  … API（/api/* をすべて処理）
├─ src/server/                … API用の部品（認証・YouTube取得など）
├─ schema.sql                 … データベースの表の定義
├─ seed.sql                   … 初期データ（サンプル）
├─ wrangler.toml              … Cloudflareの設定
└─ .dev.vars.example          … ローカル用パスワード設定の見本
```

---

## 公開までの手順（はじめの1回だけ・約20分）

事前に用意するもの：[Node.js](https://nodejs.org/)（LTS版）、Cloudflareアカウント（無料）

### 1. 準備
```bash
cd team-luminize
npm install
npx wrangler login          # ブラウザが開くのでCloudflareにログイン
```

### 2. データベースを作る
```bash
npx wrangler d1 create luminize-db
```
表示された `database_id = "xxxxxxxx-...."` を **`wrangler.toml` の `database_id` に貼り付け**て保存します。

```bash
npm run db:init:remote      # 表を作ってサンプルデータを入れる
```

### 3. サイトを公開する
```bash
npx wrangler pages project create team-luminize --production-branch main
npm run deploy
```
`https://team-luminize.pages.dev` のようなURLが発行されます。

### 4. 管理画面のパスワードを設定する
```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name team-luminize
npx wrangler pages secret put SESSION_SECRET --project-name team-luminize
```
- `ADMIN_PASSWORD`：管理画面のログインパスワード（12文字以上推奨）
- `SESSION_SECRET`：ランダムな長い文字列（例：`openssl rand -hex 32` の結果）。変更すると全員ログアウトされます

設定後、もう一度 `npm run deploy` すると反映されます。`/admin/` からログインできます。

> Cloudflareダッシュボード → Workers & Pages → team-luminize → 設定 → 変数とシークレット からも設定できます。

### 5. お問い合わせフォームをつなぐ（teamluminize@gmail.com 宛）
1. [Web3Forms](https://web3forms.com/) を開き、`teamluminize@gmail.com` を入力して Access Key を作成
2. メールで届いたキーを `public/assets/js/config.js` の `WEB3FORMS_ACCESS_KEY` に貼り付け
3. `npm run deploy`

これで送信内容が teamluminize@gmail.com に直接届きます（無料プラン：月250件まで）。返信先は送信者のメールアドレスになるので、Gmailでそのまま「返信」できます。

### 6. 中身を入れ替える
`/admin/` にログインし、サンプルのクリエイター・お知らせ・実績を本番の内容に書き換えてください。
クリエイターの「YouTubeチャンネルID」にチャンネルURLを入れて「URLから調べる」→ 保存 →「動画」タブの「今すぐ更新」で、Movie欄に最新動画が並びます。

### 独自ドメイン（任意）
Cloudflareダッシュボード → team-luminize → カスタムドメイン から設定できます（ドメイン代のみ別途）。

---

## GitHub連携で自動公開したい場合

1. このフォルダをGitHubのリポジトリにpush（`.dev.vars` は含めない）
2. Cloudflareダッシュボード → Workers & Pages → 作成 → Pages → Gitに接続
3. ビルド設定：フレームワーク「なし」、ビルドコマンド「空欄」、出力ディレクトリ `public`
4. 上の手順2（D1作成）と手順4（シークレット）を行う
   - D1 は `wrangler.toml` の設定が使われます。ダッシュボードの「バインディング」で `DB` → `luminize-db` を追加しても構いません

以後は `main` ブランチにpushするだけで自動で更新されます。

---

## パソコン上で動作確認する（ローカル開発）

```bash
cp .dev.vars.example .dev.vars     # パスワードを編集
npm run db:init:local
npm run dev                        # → http://localhost:8788
```

---

## データベースの更新（アップデート時）

| ファイル | いつ実行するか |
|---|---|
| `setup.sql` | 最初の1回だけ（表の作成＋サンプルデータ） |
| `migrate-001-profile.sql` | 「プロフィール項目（誕生日・趣味・特技など）」追加前に setup.sql を実行した場合に1回だけ |

どちらも Cloudflare → D1 → luminize-db → Console に貼り付けて Execute します。

---

## 仕組みのメモ

### YouTubeの横動画だけを取る方法
YouTubeにはチャンネルごとに「通常動画（横動画）だけのアップロード一覧」があり、チャンネルID `UCxxxx` の先頭 `UC` を `UULF` に変えたものがそのIDです。この一覧のRSS（無料・APIキー不要）を読み込むので、**Shortsは最初から含まれません**。
- RSSが取れない場合は、チャンネル全体のRSSを読んで1本ずつShorts判定するフォールバックがあります
- 「サイト設定 → ライブ配信のアーカイブも含める」をオンにすると配信アーカイブ（`UULV`）も表示します
- 更新はサイトにアクセスがあったとき、前回から3時間以上経っていれば裏で自動実行されます（cron不要）
- 任意で `YOUTUBE_API_KEY`（YouTube Data API v3）をシークレットに設定すると、RSSの代わりに公式APIを使います

### 画像
管理画面でアップロードした画像はブラウザ側で縮小（WebP）してからD1に保存し、`/api/images/{id}` で配信します。R2（クレジットカード登録が必要）を使わずに済みます。外部の画像URLを貼り付けることもできます。

### 無料枠の目安（Cloudflare 無料プラン）
| サービス | 無料枠 | このサイトでの使い方 |
|---|---|---|
| Pages | 静的ファイル配信は無制限 | HTML / CSS / JS |
| Pages Functions | 1日10万リクエスト | API（ページ表示1回で1〜2リクエスト） |
| D1 | 保存5GB・1日500万行読み取り | クリエイター・お知らせ・画像など |
| Web3Forms | 月250件 | お問い合わせ |

小〜中規模の事務所サイトなら無料枠に十分収まります。
1回の動画更新で外部への通信は1人あたり1〜2回です（無料プランの上限は1回50回）。クリエイターが25人を超える場合は `YOUTUBE_API_KEY` の設定をおすすめします。

### セキュリティ
- 管理APIは署名付きCookie（HttpOnly / Secure / SameSite=Strict、7日間有効）で保護しています
- 変更系のAPIはJSONのみ受け付け、他サイトからの不正送信を防ぎます
- 管理画面は検索エンジンに載らない設定（noindex）です
- パスワードはコードに書かず、Cloudflareのシークレットに保存します

---

## よくある編集

| やりたいこと | 場所 |
|---|---|
| 色・フォントを変える | `public/assets/css/style.css` の先頭 `:root`（ロゴの紫・黄・オレンジ・青を定義） |
| ロゴを差し替える | `public/assets/img/logo-full.png`（文字入り）・`logo-mark.png`（マークのみ）・`favicon.png` |
| ナビゲーションの項目を変える | `public/assets/js/common.js` の `renderChrome` |
| お知らせのカテゴリを増やす | `public/assets/js/admin.js` の `news` → `category` の `options` |
| SNSの種類を増やす | `admin.js` の `LINK_TYPES`、`common.js` の `ICONS` / `LINK_LABELS`、`src/server/util.js` の `LINK_TYPES` |
| 動画の自動更新間隔 | `functions/api/[[path]].js` の `SYNC_INTERVAL_MS` |
