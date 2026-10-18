import { api, esc, fmtDate, renderChrome, creatorCard, videoCard, workItem } from './common.js';
import { setupContact } from './contact.js';

renderChrome();
setupContact(document.querySelector('[data-contact]'));

const $ = (s) => document.querySelector(s);

(async () => {
  try {
    const { settings, creators, news, works, videos } = await api('site');
    renderChrome(settings.official_links);

    document.querySelectorAll('[data-s]').forEach((el) => {
      const v = settings[el.dataset.s];
      if (v) el.textContent = v;
    });
    $('[data-about]').innerHTML = (settings.about_body || '')
      .split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');

    $('[data-news]').innerHTML = news.length
      ? news.map((n) => `
        <li><a href="/news/${n.id}">
          <time class="news-date" datetime="${esc(n.published_at)}">${fmtDate(n.published_at)}</time>
          <span class="chip">${esc(n.category)}</span>
          <span class="news-t">${esc(n.title)}</span>
        </a></li>`).join('')
      : '<li class="empty">お知らせはまだありません。</li>';

    $('[data-creators]').innerHTML = creators.length
      ? creators.map(creatorCard).join('')
      : '<p class="empty">クリエイターは管理画面から追加できます。</p>';

    $('[data-movie]').innerHTML = videos.length
      ? videos.map((v) => videoCard(v)).join('')
      : '<p class="empty" style="grid-column:1/-1">最新動画を準備しています。しばらくしてからご覧ください。</p>';

    const byId = Object.fromEntries(creators.map((c) => [c.id, c]));
    $('[data-works]').innerHTML = works.length
      ? works.map((w) => workItem(w, byId)).join('')
      : '<p class="empty">実績は準備中です。</p>';

    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch (e) {
    console.error(e);
    $('[data-news]').innerHTML = `<li class="empty">${esc(e.message)}</li>`;
  }
})();
