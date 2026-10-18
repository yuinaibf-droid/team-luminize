// 公開サイト共通: ヘッダー/フッター・API・SNSアイコン・小物
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function api(path) {
  const res = await fetch(`/api/${path}`, { headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `読み込みに失敗しました (${res.status})`);
  return data;
}

export const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d)) return esc(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// URLをリンク化（本文用。esc済みテキストに適用）
export const linkify = (escaped) =>
  escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

const ICONS = {
  x: '<path fill="currentColor" d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.25 6.93ZM17.6 20.64h2.04L6.49 3.24H4.3Z"/>',
  youtube: '<path fill="currentColor" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z"/>',
  instagram: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.3"/></g><circle cx="17.6" cy="6.4" r="1.3" fill="currentColor"/>',
  tiktok: '<path fill="currentColor" d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03a10.7 10.7 0 0 1-5.82-1.9c-.01 2.92.01 5.84-.02 8.75a7.6 7.6 0 0 1-1.35 3.94 7.47 7.47 0 0 1-5.91 3.21 7.4 7.4 0 0 1-7.73-6.74c-.02-.5-.03-1-.01-1.49a7.53 7.53 0 0 1 8.73-6.68c.02 1.48-.04 2.96-.04 4.44a3.43 3.43 0 0 0-4.38 2.12c-.21.51-.15 1.07-.14 1.61a3.38 3.38 0 0 0 6.27 1.26c.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"/>',
  twitch: '<path fill="currentColor" d="M11.57 4.71h1.72v5.14h-1.72Zm4.71 0H18v5.14h-1.72ZM6 0 1.71 4.29v15.42h5.15V24l4.28-4.29h3.43L22.29 12V0Zm14.57 11.14-3.43 3.43h-3.43l-3 3v-3H6.86V1.71h13.71Z"/>',
  threads: '<path fill="none" stroke="currentColor" stroke-width="2" d="M17 8.5C16 5 13.5 3.5 11.8 3.5 6.5 3.5 4 7.3 4 12s2.5 8.5 7.8 8.5c4 0 6.7-2.4 6.7-5.3 0-2.6-2.3-4.4-5.8-4.4-2.6 0-4.2 1.3-4.2 3 0 1.6 1.4 2.6 3.1 2.6 3.2 0 4.3-3 3.7-7"/>',
  bluesky: '<path fill="currentColor" d="M5.2 2.6C7.9 4.6 10.8 8.7 12 11c1.2-2.3 4.1-6.4 6.8-8.4 2-1.4 5.2-2.6 5.2 1 0 .7-.4 6-.7 6.8-.9 3-4 3.8-6.7 3.3 4.8.8 6 3.5 3.4 6.2-5 5.1-7.1-1.3-7.7-2.9L12 16l-.3 1c-.6 1.6-2.7 8-7.7 2.9-2.6-2.7-1.4-5.4 3.4-6.2-2.7.5-5.8-.3-6.7-3.3C.4 9.6 0 4.3 0 3.6c0-3.6 3.2-2.4 5.2-1Z"/>',
  link: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></g>',
};
export const LINK_LABELS = {
  x: 'X', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', twitch: 'Twitch',
  niconico: 'ニコニコ', note: 'note', threads: 'Threads', bluesky: 'Bluesky', website: 'Webサイト', other: 'リンク',
};
export const icon = (type) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[type] || ICONS.link}</svg>`;

export const snsLinks = (links = []) =>
  links
    .map(
      (l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.type)}<span>${esc(l.label || LINK_LABELS[l.type] || 'リンク')}</span></a>`
    )
    .join('');

export const avatar = (c) =>
  c.avatar
    ? `<img src="${esc(c.avatar)}" alt="" loading="lazy">`
    : `<span class="avatar-fallback" aria-hidden="true">${esc((c.name_en || c.name || '?').trim().charAt(0).toUpperCase())}</span>`;

export const creatorCard = (c) => `
  <a class="creator-card" href="/creators/${encodeURIComponent(c.slug)}" style="--c:${esc(c.color || '#9b4dea')}">
    <div class="ring">${avatar(c)}</div>
    <h3>${esc(c.name)}</h3>
    ${c.name_en ? `<div class="en">${esc(c.name_en)}</div>` : ''}
    ${c.role ? `<span class="role">${esc(c.role)}</span>` : ''}
  </a>`;

// 動画カード（クリックするまでiframeを読み込まない軽量プレイヤー）
export const videoCard = (v, showCreator = true) => `
  <article class="video" style="--c:${esc(v.c_color || '#9b4dea')}">
    <button class="player" type="button" data-yt="${esc(v.video_id)}" aria-label="${esc(v.title)} を再生">
      <img src="https://i.ytimg.com/vi/${esc(v.video_id)}/hqdefault.jpg" alt="" loading="lazy">
      <span class="play"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M8 5v14l11-7z"/></svg></span>
    </button>
    <div class="v-meta">
      <h3 class="v-title">${esc(v.title)}</h3>
      ${showCreator && v.c_name ? `<a class="v-by" href="/creators/${encodeURIComponent(v.c_slug)}"><i></i>${esc(v.c_name)}</a>` : ''}
      <div class="v-by">${fmtDate(v.published_at)}</div>
    </div>
  </article>`;

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.player[data-yt]');
  if (!btn) return;
  const id = btn.dataset.yt;
  btn.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  btn.removeAttribute('data-yt');
});

export const workItem = (w, creatorsById) => {
  const people = (w.creator_ids || []).map((id) => creatorsById[id]).filter(Boolean);
  return `
  <article class="work">
    <div class="work-thumb">${w.thumbnail ? `<img src="${esc(w.thumbnail)}" alt="" loading="lazy">` : ''}</div>
    <div>
      ${w.category ? `<span class="chip">${esc(w.category)}</span>` : ''}
      <h3>${esc(w.title)}</h3>
      ${w.description ? `<p>${esc(w.description)}</p>` : ''}
      ${people.length ? `<div class="work-people">${people.map((c) => `<a href="/creators/${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join('')}</div>` : ''}
    </div>
    <div class="work-side">
      ${w.client ? `<div>${esc(w.client)}</div>` : ''}
      ${w.work_date ? `<div>${esc(w.work_date)}</div>` : ''}
      ${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">詳しく見る</a>` : ''}
    </div>
  </article>`;
};

/* ---------- ヘッダー/フッター ---------- */
const LOGO = `<img class="brand-mark" src="/assets/img/logo-mark.png" alt="" width="48" height="34">`;

export function renderChrome(officialLinks = []) {
  const header = document.querySelector('[data-header]');
  if (header) {
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/">${LOGO}Team Luminize</a>
        <button class="nav-toggle" type="button" aria-label="メニュー" aria-expanded="false"><span></span><span></span></button>
        <nav class="nav" aria-label="メイン">
          <a href="/#about">About</a><a href="/#news">News</a><a href="/#creators">Creators</a>
          <a href="/#movie">Movie</a><a href="/#works">Works</a><a class="nav-cta" href="/#contact">お問い合わせ</a>
        </nav>
      </div>`;
    const toggle = header.querySelector('.nav-toggle');
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open);
    });
    header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
    const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/">${LOGO}Team Luminize</a>
        <div class="sns">${snsLinks(officialLinks)}</div>
        <small>&copy; ${new Date().getFullYear()} Team Luminize</small>
      </div>`;
  }
}
