// /sitemap.xml … Google に知らせるページ一覧（クリエイターやお知らせを追加すると自動で増えます）
export async function onRequest({ request, env }) {
  const origin = new URL(request.url).origin;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = [
    { loc: `${origin}/`, priority: '1.0' },
    { loc: `${origin}/news`, priority: '0.6' },
  ];
  try {
    const [creators, news, works] = await Promise.all([
      env.DB.prepare('SELECT slug, updated_at FROM creators WHERE is_published = 1 ORDER BY sort_order, id').all(),
      env.DB.prepare('SELECT id, published_at FROM news WHERE is_published = 1 ORDER BY published_at DESC LIMIT 200').all(),
      env.DB.prepare('SELECT id, updated_at FROM works WHERE is_published = 1 ORDER BY id DESC LIMIT 200').all(),
    ]);
    for (const c of creators.results) urls.push({ loc: `${origin}/creators/${encodeURIComponent(c.slug)}`, lastmod: (c.updated_at || '').slice(0, 10), priority: '0.8' });
    urls.push({ loc: `${origin}/works`, priority: '0.6' });
    for (const w of works.results) urls.push({ loc: `${origin}/works/${w.id}`, lastmod: (w.updated_at || '').slice(0, 10), priority: '0.5' });
    for (const n of news.results) urls.push({ loc: `${origin}/news/${n.id}`, lastmod: (n.published_at || '').slice(0, 10), priority: '0.5' });
  } catch (e) {
    console.error('sitemap', e);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
