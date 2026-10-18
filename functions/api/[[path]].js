// Team Luminize API（Cloudflare Pages Functions）
// /api/* へのリクエストをすべてここで処理します。
import { json, error, readJson, HttpError, parseJson, cleanLinks, cleanProfile, str, bool, int, imageUrl, slugify } from '../../src/server/util.js';
import { checkPassword, createSessionCookie, clearSessionCookie, isAuthed } from '../../src/server/auth.js';
import { syncAllVideos, resolveChannelId, fetchLatestVideos } from '../../src/server/youtube.js';

const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 動画の自動更新間隔（3時間）

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.DB) return error('D1データベース(DB)がバインドされていません。READMEの手順を確認してください', 500);
  const url = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    if (path[0] === 'admin') {
      return await adminRoutes(context, path.slice(1), method, url);
    }
    if (method !== 'GET') return error('Method Not Allowed', 405);
    return await publicRoutes(context, path, url);
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    return error('サーバーでエラーが発生しました: ' + e.message, 500);
  }
}

/* ---------------- 公開API ---------------- */

const CREATOR_LIST_COLS = 'id, slug, name, name_en, role, catchphrase, avatar, color, links, sort_order';

const mapCreator = (c) => c && { ...c, links: parseJson(c.links, []), profile: parseJson(c.profile, []) };
const mapWork = (w) => w && { ...w, creator_ids: parseJson(w.creator_ids, []) };

async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(results.map((r) => [r.key, r.value]));
  s.official_links = parseJson(s.official_links, []);
  return s;
}

function maybeSync(context, settings) {
  const last = Date.parse(settings.videos_synced_at || 0) || 0;
  if (Date.now() - last > SYNC_INTERVAL_MS) {
    // 先に時刻を更新して多重実行を防ぎ、レスポンスを待たせずに裏で同期
    context.waitUntil(
      context.env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('videos_synced_at', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(new Date().toISOString()).run().then(() => syncAllVideos(context.env)).catch((e) => console.error('sync', e))
    );
  }
}

async function movieList(env, settings, creatorId) {
  if (creatorId) {
    const { results } = await env.DB.prepare(
      `SELECT v.video_id, v.title, v.published_at, v.creator_id FROM videos v
       WHERE v.creator_id = ? AND v.hidden = 0 ORDER BY v.published_at DESC LIMIT 6`
    ).bind(creatorId).all();
    return results;
  }
  const per = Math.max(1, int(settings.movie_per_creator, 2));
  const limit = Math.max(1, int(settings.movie_limit, 9));
  const { results } = await env.DB.prepare(
    `SELECT video_id, title, published_at, creator_id, c_name, c_slug, c_color FROM (
       SELECT v.*, c.name AS c_name, c.slug AS c_slug, c.color AS c_color,
         ROW_NUMBER() OVER (PARTITION BY v.creator_id ORDER BY v.published_at DESC) AS rn
       FROM videos v JOIN creators c ON c.id = v.creator_id
       WHERE v.hidden = 0 AND c.is_published = 1
     ) WHERE rn <= ? ORDER BY published_at DESC LIMIT ?`
  ).bind(per, limit).all();
  return results;
}

async function publicRoutes(context, path, url) {
  const { env } = context;
  const [res, id] = path;

  if (res === 'site') {
    const settings = await getSettings(env);
    maybeSync(context, settings);
    const [creators, news, works, videos] = await Promise.all([
      env.DB.prepare(`SELECT ${CREATOR_LIST_COLS} FROM creators WHERE is_published = 1 ORDER BY sort_order, id`).all(),
      env.DB.prepare(
        "SELECT id, title, category, published_at, thumbnail FROM news WHERE is_published = 1 ORDER BY published_at DESC, id DESC LIMIT 5"
      ).all(),
      env.DB.prepare('SELECT * FROM works WHERE is_published = 1 ORDER BY sort_order, work_date DESC, id DESC LIMIT 12').all(),
      movieList(env, settings),
    ]);
    return json({
      settings,
      creators: creators.results.map(mapCreator),
      news: news.results,
      works: works.results.map(mapWork),
      videos,
    });
  }

  if (res === 'creators' && id) {
    const c = await env.DB.prepare('SELECT * FROM creators WHERE slug = ? AND is_published = 1').bind(id).first();
    if (!c) return error('クリエイターが見つかりません', 404);
    const settings = await getSettings(env);
    maybeSync(context, settings);
    const [videos, works, others] = await Promise.all([
      movieList(env, settings, c.id),
      env.DB.prepare(
        "SELECT w.* FROM works w, json_each(w.creator_ids) j WHERE j.value = ? AND w.is_published = 1 ORDER BY w.work_date DESC LIMIT 12"
      ).bind(c.id).all(),
      env.DB.prepare(`SELECT ${CREATOR_LIST_COLS} FROM creators WHERE is_published = 1 AND id != ? ORDER BY sort_order, id`).bind(c.id).all(),
    ]);
    return json({
      creator: mapCreator(c),
      videos,
      works: works.results.map(mapWork),
      others: others.results.map(mapCreator),
      settings: { official_links: settings.official_links },
    });
  }

  if (res === 'news') {
    if (id) {
      const n = await env.DB.prepare('SELECT * FROM news WHERE id = ? AND is_published = 1').bind(int(id)).first();
      return n ? json({ news: n }) : error('お知らせが見つかりません', 404);
    }
    const { results } = await env.DB.prepare(
      'SELECT id, title, category, published_at, thumbnail FROM news WHERE is_published = 1 ORDER BY published_at DESC, id DESC LIMIT 100'
    ).all();
    return json({ news: results });
  }

  if (res === 'works') {
    const { results } = await env.DB.prepare('SELECT * FROM works WHERE is_published = 1 ORDER BY sort_order, work_date DESC, id DESC').all();
    return json({ works: results.map(mapWork) });
  }

  if (res === 'images' && id) {
    const img = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(id).first();
    if (!img) return new Response('Not found', { status: 404 });
    const bin = Uint8Array.from(atob(img.data), (ch) => ch.charCodeAt(0));
    return new Response(bin, {
      headers: { 'content-type': img.mime, 'cache-control': 'public, max-age=31536000, immutable' },
    });
  }

  return error('Not found', 404);
}

/* ---------------- 管理API ---------------- */

const TABLES = {
  creators: {
    order: 'sort_order, id',
    fields: (b) => ({
      slug: slugify(b.slug) || null,
      name: str(b.name, 80),
      name_en: str(b.name_en, 80),
      role: str(b.role, 80),
      catchphrase: str(b.catchphrase, 200),
      bio: str(b.bio, 5000),
      avatar: imageUrl(b.avatar),
      color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#9b4dea',
      youtube_channel_id: /^UC[\w-]{22}$/.test(str(b.youtube_channel_id)) ? str(b.youtube_channel_id) : '',
      links: JSON.stringify(cleanLinks(b.links)),
      profile: JSON.stringify(cleanProfile(b.profile)),
      sort_order: int(b.sort_order),
      is_published: bool(b.is_published),
    }),
    validate: (f) => {
      if (!f.name) throw new HttpError(400, '名前を入力してください');
      if (!f.slug) throw new HttpError(400, 'URL用ID（半角英数字とハイフン）を入力してください');
    },
    out: mapCreator,
  },
  news: {
    order: 'published_at DESC, id DESC',
    fields: (b) => ({
      title: str(b.title, 200),
      category: str(b.category, 40) || 'お知らせ',
      body: str(b.body, 20000),
      thumbnail: imageUrl(b.thumbnail),
      published_at: /^\d{4}-\d{2}-\d{2}/.test(b.published_at || '') ? b.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      is_published: bool(b.is_published),
    }),
    validate: (f) => { if (!f.title) throw new HttpError(400, 'タイトルを入力してください'); },
    out: (x) => x,
  },
  works: {
    order: 'sort_order, work_date DESC, id DESC',
    fields: (b) => ({
      title: str(b.title, 200),
      client: str(b.client, 120),
      category: str(b.category, 60),
      work_date: str(b.work_date, 20),
      description: str(b.description, 5000),
      thumbnail: imageUrl(b.thumbnail),
      url: /^https?:\/\//.test(str(b.url)) ? str(b.url, 500) : '',
      creator_ids: JSON.stringify(Array.isArray(b.creator_ids) ? b.creator_ids.map((x) => int(x)).filter(Boolean) : []),
      sort_order: int(b.sort_order),
      is_published: bool(b.is_published),
    }),
    validate: (f) => { if (!f.title) throw new HttpError(400, 'タイトルを入力してください'); },
    out: mapWork,
  },
};

async function adminRoutes(context, path, method, url) {
  const { request, env } = context;
  const [res, id] = path;

  if (res === 'login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) return error('ADMIN_PASSWORD が設定されていません。READMEの手順で設定してください', 500);
    const body = await readJson(request);
    if (!checkPassword(env, body.password)) {
      await new Promise((r) => setTimeout(r, 800)); // 総当たり対策の遅延
      return error('パスワードが違います', 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': await createSessionCookie(env, url) });
  }
  if (res === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  // ここから先はログイン必須
  if (!(await isAuthed(request, env))) return error('ログインしてください', 401);
  // CSRF対策: 変更系はJSONのみ受け付け（SameSite=Strict Cookieと併用）
  if (method !== 'GET' && method !== 'DELETE') {
    const type = request.headers.get('content-type') || '';
    if (!type.includes('application/json')) return error('JSONで送信してください', 415);
  }

  if (res === 'me') return json({ ok: true });

  if (TABLES[res]) return crud(env, res, id, method, request);

  if (res === 'settings') {
    if (method === 'GET') return json({ settings: await getSettings(env) });
    if (method === 'PUT') {
      const b = await readJson(request);
      const allowed = ['hero_title', 'hero_sub', 'about_title', 'about_body', 'contact_note', 'movie_per_creator', 'movie_limit', 'movie_include_live', 'official_links'];
      const stmts = [];
      for (const k of allowed) {
        if (!(k in b)) continue;
        const v = k === 'official_links' ? JSON.stringify(cleanLinks(b[k])) : str(b[k], 5000);
        stmts.push(env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v));
      }
      if (stmts.length) await env.DB.batch(stmts);
      return json({ settings: await getSettings(env) });
    }
  }

  if (res === 'images' && method === 'POST') {
    const b = await readJson(request);
    const m = String(b.dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new HttpError(400, '画像はPNG・JPEG・WebP・GIFのみアップロードできます');
    if (m[2].length > 1_400_000) throw new HttpError(413, '画像が大きすぎます（1MBまで）');
    const imgId = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare('INSERT INTO images (id, mime, data) VALUES (?, ?, ?)').bind(imgId, m[1], m[2]).run();
    return json({ url: `/api/images/${imgId}` });
  }

  if (res === 'videos') {
    if (id === 'sync' && method === 'POST') return json({ report: await syncAllVideos(env) });
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT v.*, c.name AS creator_name FROM videos v LEFT JOIN creators c ON c.id = v.creator_id ORDER BY v.published_at DESC LIMIT 300`
      ).all();
      const synced = await env.DB.prepare("SELECT value FROM settings WHERE key='videos_synced_at'").first();
      return json({ videos: results, synced_at: synced?.value || null });
    }
    if (id && method === 'PUT') {
      const b = await readJson(request);
      await env.DB.prepare('UPDATE videos SET hidden = ? WHERE video_id = ?').bind(bool(b.hidden), id).run();
      return json({ ok: true });
    }
  }

  if (res === 'youtube' && id === 'resolve' && method === 'POST') {
    const b = await readJson(request);
    const channelId = await resolveChannelId(b.input).catch((e) => { throw new HttpError(400, e.message); });
    const preview = await fetchLatestVideos(env, channelId).catch(() => []);
    return json({ channelId, preview: preview.slice(0, 3) });
  }

  return error('Not found', 404);
}

async function crud(env, table, id, method, request) {
  const t = TABLES[table];
  if (method === 'GET') {
    if (id) {
      const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(int(id)).first();
      return row ? json({ item: t.out(row) }) : error('見つかりません', 404);
    }
    const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${t.order}`).all();
    return json({ items: results.map(t.out) });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(int(id)).run();
    if (table === 'creators') await env.DB.prepare('DELETE FROM videos WHERE creator_id = ?').bind(int(id)).run();
    return json({ ok: true });
  }
  if (method === 'POST' || method === 'PUT') {
    const f = t.fields(await readJson(request));
    t.validate(f);
    const keys = Object.keys(f);
    try {
      let row;
      if (method === 'POST') {
        row = await env.DB.prepare(
          `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) RETURNING *`
        ).bind(...keys.map((k) => f[k])).first();
      } else {
        if (!id) return error('IDがありません', 400);
        row = await env.DB.prepare(
          `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`
        ).bind(...keys.map((k) => f[k]), int(id)).first();
        if (!row) return error('見つかりません', 404);
      }
      return json({ item: t.out(row) });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'そのURL用IDはすでに使われています');
      if (String(e.message).includes('no column named profile') || String(e.message).includes('no such column: profile'))
        throw new HttpError(500, 'データベースに profile 列がありません。D1 の Console で migrate-001-profile.sql を実行してください');
      throw e;
    }
  }
  return error('Method Not Allowed', 405);
}
