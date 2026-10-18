// YouTube 最新動画の取得（Shorts = 縦動画は除外）
//
// 仕組み:
//   YouTube はチャンネルごとに「長尺動画だけのアップロード再生リスト」を持っています。
//   チャンネルID "UCxxxx" の先頭 "UC" を "UULF" に置き換えたものがその再生リストIDです。
//     UULF… = 通常の横動画（Shorts・ライブを除く）
//     UULV… = ライブ配信アーカイブ（設定で含めることも可能）
//   この再生リストの RSS（APIキー不要・無料）を読むことで、Shorts を自動的に除外します。
//   RSS が取得できない場合はチャンネル全体の RSS を読み、
//   https://www.youtube.com/shorts/{id} にアクセスして Shorts かどうかを1本ずつ判定します。
//   環境変数 YOUTUBE_API_KEY を設定した場合は YouTube Data API v3 を優先して使います（任意）。

const PER_CREATOR = 10;

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function parseFeed(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml))) {
    const e = m[1];
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
    const link = (e.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    if (id) entries.push({ id, title: decode(title.trim()), published, isShortLink: link.includes('/shorts/') });
  }
  return entries;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LuminizeBot/1.0)' }, cf: { cacheTtl: 600 } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function isShort(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, { method: 'HEAD', redirect: 'manual' });
    return res.status === 200; // Shorts は 200、通常動画は /watch へリダイレクト(303)
  } catch {
    return false;
  }
}

async function viaApi(channelId, prefix, apiKey) {
  const pid = prefix + channelId.slice(2);
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${PER_CREATOR}&playlistId=${pid}&key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((it) => ({
    id: it.contentDetails.videoId,
    title: it.snippet.title,
    published: it.contentDetails.videoPublishedAt || it.snippet.publishedAt,
  }));
}

async function viaRss(channelId, prefix) {
  try {
    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?playlist_id=${prefix}${channelId.slice(2)}`);
    return parseFeed(xml);
  } catch (e) {
    if (prefix !== 'UULF') return [];
    // フォールバック: チャンネル全体のRSS → Shorts判定
    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const all = parseFeed(xml).filter((v) => !v.isShortLink);
    const checks = await Promise.all(all.slice(0, PER_CREATOR).map((v) => isShort(v.id)));
    return all.slice(0, PER_CREATOR).filter((_, i) => !checks[i]);
  }
}

export async function fetchLatestVideos(env, channelId, includeLive = false) {
  if (!/^UC[\w-]{22}$/.test(channelId)) throw new Error('チャンネルIDの形式が正しくありません（UCから始まる24文字）');
  const prefixes = includeLive ? ['UULF', 'UULV'] : ['UULF'];
  const lists = await Promise.all(
    prefixes.map((p) => (env.YOUTUBE_API_KEY ? viaApi(channelId, p, env.YOUTUBE_API_KEY) : viaRss(channelId, p)))
  );
  return lists
    .flat()
    .sort((a, b) => (a.published < b.published ? 1 : -1))
    .slice(0, PER_CREATOR);
}

// @ハンドル / チャンネルURL / ID からチャンネルIDを割り出す（管理画面の補助機能）
export async function resolveChannelId(input) {
  const s = String(input || '').trim();
  const direct = s.match(/(UC[\w-]{22})/);
  if (direct) return direct[1];
  let url = s;
  if (s.startsWith('@')) url = `https://www.youtube.com/${s}`;
  else if (!/^https?:\/\//.test(s)) url = `https://www.youtube.com/@${s}`;
  const html = await fetchText(url);
  const m =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/);
  if (!m) throw new Error('チャンネルIDが見つかりませんでした。チャンネルURLを確認してください');
  return m[1];
}

// 全クリエイターの動画をDBに同期
export async function syncAllVideos(env) {
  const { results: creators } = await env.DB.prepare(
    "SELECT id, name, youtube_channel_id FROM creators WHERE youtube_channel_id != ''"
  ).all();
  const live = await env.DB.prepare("SELECT value FROM settings WHERE key='movie_include_live'").first();
  const includeLive = live?.value === '1';
  const report = [];

  for (const c of creators) {
    try {
      const vids = await fetchLatestVideos(env, c.youtube_channel_id, includeLive);
      const stmts = vids.map((v) =>
        env.DB.prepare(
          `INSERT INTO videos (video_id, creator_id, title, published_at, fetched_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(video_id) DO UPDATE SET creator_id=excluded.creator_id, title=excluded.title,
             published_at=excluded.published_at, fetched_at=excluded.fetched_at`
        ).bind(v.id, c.id, v.title, v.published)
      );
      // 古い動画を整理（非表示設定した動画は残す）
      if (vids.length) {
        const keep = vids.map(() => '?').join(',');
        stmts.push(
          env.DB.prepare(`DELETE FROM videos WHERE creator_id = ? AND hidden = 0 AND video_id NOT IN (${keep})`).bind(
            c.id,
            ...vids.map((v) => v.id)
          )
        );
      }
      if (stmts.length) await env.DB.batch(stmts);
      report.push({ creator: c.name, ok: true, count: vids.length });
    } catch (e) {
      report.push({ creator: c.name, ok: false, error: e.message });
    }
  }
  // チャンネルIDを外したクリエイターの動画は削除
  await env.DB.prepare(
    "DELETE FROM videos WHERE creator_id NOT IN (SELECT id FROM creators WHERE youtube_channel_id != '')"
  ).run();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('videos_synced_at', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(new Date().toISOString()).run();
  return report;
}
