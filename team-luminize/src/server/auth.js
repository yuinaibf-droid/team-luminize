// 管理画面のパスワード認証（署名付きCookieセッション）
// 必要な環境変数（Cloudflare の Secret として登録）:
//   ADMIN_PASSWORD  … 管理画面のログインパスワード
//   SESSION_SECRET  … セッション署名用のランダム文字列（32文字以上推奨）

const COOKIE = 'tl_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7日

const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function timingSafeEqual(a, b) {
  const ab = enc.encode(a), bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

const secretOf = (env) => env.SESSION_SECRET || `fallback:${env.ADMIN_PASSWORD}`;

export function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD) return false;
  return timingSafeEqual(String(password || ''), env.ADMIN_PASSWORD);
}

export async function createSessionCookie(env, url) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  const token = `${payload}.${await hmac(secretOf(env), payload)}`;
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [who, exp, sig] = m[1].split('.');
  if (who !== 'admin' || !exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sig, await hmac(secretOf(env), `${who}.${exp}`));
}
