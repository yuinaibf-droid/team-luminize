// 共通ユーティリティ
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const error = (message, status = 400) => json({ error: message }, status);

export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'JSONで送信してください');
  try { return await request.json(); } catch { throw new HttpError(400, 'JSONの形式が正しくありません'); }
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const parseJson = (s, fallback) => { try { return JSON.parse(s ?? ''); } catch { return fallback; } };

const LINK_TYPES = ['x', 'youtube', 'instagram', 'tiktok', 'twitch', 'niconico', 'note', 'threads', 'bluesky', 'website', 'other'];

export function cleanLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url.trim()))
    .map((l) => ({
      type: LINK_TYPES.includes(l.type) ? l.type : 'other',
      url: l.url.trim().slice(0, 500),
      label: typeof l.label === 'string' ? l.label.trim().slice(0, 40) : '',
    }))
    .slice(0, 20);
}

export const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).slice(0, max));
export const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
export const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);

// 画像URL: http(s) か /api/images/ のみ許可
export const imageUrl = (v) => {
  const s = str(v, 1000);
  return /^https?:\/\//i.test(s) || s.startsWith('/api/images/') ? s : '';
};

export const slugify = (v) =>
  str(v, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

// プロフィール項目（誕生日・趣味・特技など。項目名は自由）
export function cleanProfile(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({ label: str(i?.label, 40), value: str(i?.value, 500) }))
    .filter((i) => i.label && i.value)
    .slice(0, 30);
}
