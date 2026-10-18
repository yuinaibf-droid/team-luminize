import { api, esc, renderChrome, avatar, snsLinks, videoCard, creatorCard, workItem } from './common.js';

renderChrome();
const main = document.querySelector('[data-main]');
const slug = decodeURIComponent(location.pathname.split('/creators/')[1] || new URLSearchParams(location.search).get('id') || '').replace(/\/$/, '');

(async () => {
  try {
    if (!slug) throw new Error('クリエイターが指定されていません');
    const { creator: c, videos, works, others, settings } = await api(`creators/${encodeURIComponent(slug)}`);
    renderChrome(settings.official_links);
    document.title = `${c.name} | Team Luminize`;
    const color = esc(c.color || '#9b4dea');
    const byId = { [c.id]: c, ...Object.fromEntries(others.map((o) => [o.id, o])) };
    const yt = c.youtube_channel_id ? `https://www.youtube.com/channel/${esc(c.youtube_channel_id)}` : '';

    main.innerHTML = `
      <section class="profile" style="--c:${color}">
        <div class="wrap profile-grid">
          <div class="ring">${avatar(c)}</div>
          <div>
            <div class="crumb"><a href="/#creators">Creators</a> / ${esc(c.name)}</div>
            <h1>${esc(c.name)}</h1>
            ${c.name_en ? `<div class="en">${esc(c.name_en)}</div>` : ''}
            ${c.role ? `<span class="role">${esc(c.role)}</span>` : ''}
            ${c.catchphrase ? `<p class="catch">${esc(c.catchphrase)}</p>` : ''}
            <div class="sns">${snsLinks(c.links)}</div>
          </div>
        </div>
      </section>

      ${c.bio || (c.profile || []).length ? `
      <section class="section">
        <div class="wrap">
          <div class="sec-head"><h2 class="sec-title"><span>Profile</span><small>プロフィール</small></h2></div>
          <div class="profile-body">
            ${(c.profile || []).length ? `<dl class="prof-list">${c.profile.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl>` : ''}
            ${c.bio ? `<p class="bio">${esc(c.bio)}</p>` : ''}
          </div>
        </div>
      </section>` : ''}

      <section class="section alt">
        <div class="wrap">
          <div class="sec-head"><h2 class="sec-title"><span>Movie</span><small>最新動画</small></h2>${yt ? `<a class="more" href="${yt}" target="_blank" rel="noopener">YouTubeチャンネルを見る</a>` : ''}</div>
          <div class="movie-grid">${
            videos.length
              ? videos.map((v) => videoCard({ ...v, c_color: c.color }, false)).join('')
              : '<p class="empty" style="grid-column:1/-1">最新動画を準備しています。</p>'
          }</div>
        </div>
      </section>

      ${works.length ? `
      <section class="section">
        <div class="wrap">
          <div class="sec-head"><h2 class="sec-title"><span>Works</span><small>実績</small></h2></div>
          <div class="works-list">${works.map((w) => workItem(w, byId)).join('')}</div>
        </div>
      </section>` : ''}

      ${others.length ? `
      <section class="section">
        <div class="wrap">
          <div class="sec-head"><h2 class="sec-title"><span>Creators</span><small>ほかのクリエイター</small></h2></div>
          <div class="others">${others.map(creatorCard).join('')}</div>
        </div>
      </section>` : ''}
    `;
  } catch (e) {
    main.innerHTML = `<div class="page-head wrap"><p class="empty">${esc(e.message)}</p><p><a class="more" href="/#creators">クリエイター一覧へ戻る</a></p></div>`;
  }
})();
