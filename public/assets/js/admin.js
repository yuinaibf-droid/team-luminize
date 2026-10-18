// Team Luminize 管理画面
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LINK_TYPES = [
  ['x', 'X (Twitter)'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['twitch', 'Twitch'],
  ['niconico', 'ニコニコ'], ['threads', 'Threads'], ['bluesky', 'Bluesky'], ['note', 'note'], ['website', 'Webサイト'], ['other', 'その他'],
];

/* ---------------- API ---------------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin/${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { showLogin(); throw new Error('ログインが切れました。もう一度ログインしてください'); }
  if (!res.ok) throw new Error(data.error || `エラーが発生しました (${res.status})`);
  return data;
}

function toast(msg, ng = false) {
  const t = $('[data-toast]');
  t.textContent = msg;
  t.className = `toast show${ng ? ' ng' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = 'toast'), ng ? 5000 : 2600);
}

/* ---------------- 画像アップロード（ブラウザで縮小してから送信） ---------------- */
async function uploadImage(file, maxSize = 800) {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください');
  if (file.type === 'image/gif' && file.size < 900_000) {
    const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    return (await api('images', { method: 'POST', body: { dataUrl } })).url;
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  let q = 0.86, dataUrl;
  do { dataUrl = canvas.toDataURL('image/webp', q); q -= 0.12; } while (dataUrl.length > 1_300_000 && q > 0.3);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return (await api('images', { method: 'POST', body: { dataUrl } })).url;
}

/* ---------------- フォーム部品 ---------------- */
const fieldHtml = (f, v) => {
  const id = `f-${f.k}`;
  const cls = `f${f.full ? ' full' : ''}`;
  const hint = f.hint ? `<div class="hint">${f.hint}</div>` : '';
  const req = f.req ? ' required' : '';
  switch (f.type) {
    case 'textarea':
      return `<div class="${cls}"><label for="${id}">${f.label}</label>${f.images ? `
        <div class="body-tools"><label class="b b-sm">🖼 画像を挿入<input type="file" accept="image/*" multiple hidden data-body-file="${f.k}"></label>
        <span class="hint" style="margin:0">カーソルの位置に画像が入ります（複数選択OK）</span></div>` : ''}
        <textarea id="${id}" name="${f.k}" rows="${f.rows || 6}">${esc(v)}</textarea>${hint}</div>`;
    case 'check':
      return `<div class="${cls}"><label class="check"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${f.label}</label>${hint}</div>`;
    case 'color':
      return `<div class="${cls}"><label for="${id}">${f.label}</label><div class="inline"><input type="color" id="${id}" name="${f.k}" value="${esc(v || '#9b4dea')}"><span class="hint" style="margin:0">一覧のリングや個人ページの光の色に使われます</span></div></div>`;
    case 'select':
      return `<div class="${cls}"><label for="${id}">${f.label}</label><select id="${id}" name="${f.k}">${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${hint}</div>`;
    case 'image':
      return `<div class="${cls}"><label>${f.label}</label>
        <div class="img-field" data-img>
          <div class="preview${f.round ? ' round' : ''}" style="${v ? `background-image:url('${esc(v)}')` : ''}"></div>
          <div class="ctrl">
            <div class="inline"><label class="b b-sm" style="margin:0">画像を選ぶ<input type="file" accept="image/*" hidden data-file></label><button type="button" class="b b-sm" data-clear>削除</button></div>
            <input type="url" name="${f.k}" value="${esc(v)}" placeholder="または画像URLを貼り付け">
          </div>
        </div>${hint}</div>`;
    case 'profile':
      return `<div class="${cls}"><label>${f.label}</label><div class="links" data-profile="${f.k}"></div>
        <button type="button" class="b b-sm" data-add-prof="${f.k}" style="margin-top:8px">＋ 項目を追加</button>${hint}</div>`;
    case 'links':
      return `<div class="${cls}"><label>${f.label}</label><div class="links" data-links="${f.k}"></div>
        <button type="button" class="b b-sm" data-add-link="${f.k}" style="margin-top:8px">＋ リンクを追加</button>${hint}</div>`;
    case 'channel':
      return `<div class="${cls}"><label for="${id}">YouTubeチャンネルID</label>
        <div class="inline"><input id="${id}" name="${f.k}" value="${esc(v)}" placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"><button type="button" class="b b-sm" data-resolve>URLから調べる</button></div>
        <div class="hint">チャンネルURL（https://www.youtube.com/@○○）や @ハンドル を入れて「URLから調べる」を押すとIDに変換します。ここに設定したチャンネルの最新「横動画」がサイトに自動表示されます（Shortsは除外）。</div>
        <div class="hint" data-resolve-out></div></div>`;
    case 'creators':
      return `<div class="${cls}"><label>${f.label}</label><div class="checks">${
        state.creators.length
          ? state.creators.map((c) => `<label class="check"><input type="checkbox" name="${f.k}" value="${c.id}" ${(v || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')
          : '<span class="hint">クリエイターが登録されていません</span>'
      }</div>${hint}</div>`;
    default:
      return `<div class="${cls}"><label for="${id}">${f.label}${f.req ? ' <span style="color:var(--pink)">*</span>' : ''}</label><input type="${f.type || 'text'}" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"${req}>${hint}</div>`;
  }
};

const PROFILE_PRESETS = ['誕生日', '身長', '出身地', '趣味', '特技', '好きなもの'];
const profRow = (p = { label: '', value: '' }) => `
  <div class="link-row prof-row">
    <input name="plabel" value="${esc(p.label)}" placeholder="項目名（例：誕生日）" aria-label="項目名" list="prof-presets">
    <input name="pvalue" value="${esc(p.value)}" placeholder="内容（例：4月1日）" aria-label="内容">
    <button type="button" class="b" data-del-link aria-label="この項目を削除">✕</button>
  </div>`;

const linkRow = (l = { type: 'x', url: '', label: '' }) => `
  <div class="link-row">
    <select name="type" aria-label="種類">${LINK_TYPES.map(([k, n]) => `<option value="${k}" ${k === l.type ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <input name="url" type="url" value="${esc(l.url)}" placeholder="https://…" aria-label="URL">
    <input name="label" value="${esc(l.label || '')}" placeholder="表示名（任意）" aria-label="表示名">
    <button type="button" class="b" data-del-link aria-label="このリンクを削除">✕</button>
  </div>`;

function bindFormParts(root, values) {
  $$('[data-profile]', root).forEach((box) => {
    const list = values[box.dataset.profile] || [];
    // 未入力のときは、よく使う項目をあらかじめ並べておく（内容が空の行は保存されません）
    box.innerHTML = (list.length ? list : PROFILE_PRESETS.map((label) => ({ label, value: '' }))).map(profRow).join('')
      + `<datalist id="prof-presets">${PROFILE_PRESETS.map((p) => `<option value="${p}">`).join('')}</datalist>`;
  });
  $$('[data-links]', root).forEach((box) => {
    const list = values[box.dataset.links] || [];
    box.innerHTML = list.map(linkRow).join('');
  });
  root.addEventListener('click', async (e) => {
    const addP = e.target.closest('[data-add-prof]');
    if (addP) $(`[data-profile="${addP.dataset.addProf}"]`, root).insertAdjacentHTML('beforeend', profRow());
    const add = e.target.closest('[data-add-link]');
    if (add) $(`[data-links="${add.dataset.addLink}"]`, root).insertAdjacentHTML('beforeend', linkRow());
    const del = e.target.closest('[data-del-link]');
    if (del) del.closest('.link-row').remove();
    const clr = e.target.closest('[data-clear]');
    if (clr) {
      const box = clr.closest('[data-img]');
      $('input[type=url]', box).value = '';
      $('.preview', box).style.backgroundImage = '';
    }
    const resolve = e.target.closest('[data-resolve]');
    if (resolve) {
      const input = $('[name=youtube_channel_id]', root);
      const out = $('[data-resolve-out]', root);
      if (!input.value.trim()) { input.focus(); return; }
      resolve.disabled = true; out.textContent = '調べています…';
      try {
        const r = await api('youtube/resolve', { method: 'POST', body: { input: input.value } });
        input.value = r.channelId;
        out.innerHTML = r.preview.length
          ? `✓ 見つかりました。最新の横動画: ${r.preview.map((v) => `「${esc(v.title)}」`).join(' ')}`
          : '✓ チャンネルIDを設定しました（動画はまだ取得できていません）';
      } catch (err) { out.textContent = err.message; }
      resolve.disabled = false;
    }
  });
  root.addEventListener('change', async (e) => {
    if (e.target.matches('[data-body-file]')) {
      const ta = $(`[name=${e.target.dataset.bodyFile}]`, root);
      const files = [...e.target.files];
      e.target.value = '';
      for (const [i, file] of files.entries()) {
        try {
          toast(`画像をアップロード中…（${i + 1}/${files.length}）`);
          const url = await uploadImage(file, 1600);
          const pos = ta.selectionStart ?? ta.value.length;
          const before = ta.value.slice(0, pos), after = ta.value.slice(pos);
          const ins = `${before && !before.endsWith('\n') ? '\n' : ''}![](${url})\n`;
          ta.value = before + ins + after;
          ta.selectionStart = ta.selectionEnd = pos + ins.length;
        } catch (err) { toast(err.message, true); return; }
      }
      toast('画像を挿入しました。保存すると反映されます');
      ta.focus();
      return;
    }
    if (!e.target.matches('[data-file]')) return;
    const box = e.target.closest('[data-img]');
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast('アップロード中…');
      const url = await uploadImage(file, box.querySelector('.round') ? 600 : 1280);
      $('input[type=url]', box).value = url;
      $('.preview', box).style.backgroundImage = `url('${url}')`;
      toast('画像をアップロードしました');
    } catch (err) { toast(err.message, true); }
    e.target.value = '';
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-img] input[type=url]')) {
      const v = e.target.value.trim();
      $('.preview', e.target.closest('[data-img]')).style.backgroundImage = v ? `url('${v.replace(/'/g, '%27')}')` : '';
    }
  });
}

function collect(root, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'check') out[f.k] = $(`[name=${f.k}]`, root).checked;
    else if (f.type === 'profile') out[f.k] = $$(`[data-profile="${f.k}"] .prof-row`, root).map((r) => ({
      label: $('[name=plabel]', r).value.trim(), value: $('[name=pvalue]', r).value.trim(),
    })).filter((p) => p.label && p.value);
    else if (f.type === 'links') out[f.k] = $$(`[data-links="${f.k}"] .link-row`, root).map((r) => ({
      type: $('[name=type]', r).value, url: $('[name=url]', r).value.trim(), label: $('[name=label]', r).value.trim(),
    })).filter((l) => l.url);
    else if (f.type === 'creators') out[f.k] = $$(`[name=${f.k}]:checked`, root).map((i) => Number(i.value));
    else out[f.k] = $(`[name=${f.k}]`, root)?.value ?? '';
  }
  return out;
}

/* ---------------- 各セクション定義 ---------------- */
const SECTIONS = {
  creators: {
    title: 'クリエイター', single: 'クリエイター',
    desc: '所属クリエイターのプロフィール・SNSリンク・YouTubeチャンネルを管理します。',
    blank: { color: '#9b4dea', is_published: true, links: [], profile: [], sort_order: 0 },
    fields: [
      { k: 'name', label: '名前', req: true },
      { k: 'name_en', label: '英字表記', ph: 'Hikari' },
      { k: 'slug', label: 'URL用ID', req: true, ph: 'hikari', hint: '半角英小文字・数字・ハイフン。/creators/○○ のURLになります' },
      { k: 'role', label: '肩書', ph: 'ゲーム実況 / 歌ってみた' },
      { k: 'catchphrase', label: 'ひとこと', full: true },
      { k: 'avatar', type: 'image', label: 'アイコン画像', round: true, full: true, hint: '正方形の画像がおすすめです。アップロード時に自動で縮小されます' },
      { k: 'bio', type: 'textarea', label: '紹介文', full: true },
      { k: 'profile', type: 'profile', label: 'プロフィール項目', full: true, hint: '誕生日・趣味・特技など。項目名は自由に変えられます。内容が空の行は表示されません' },
      { k: 'links', type: 'links', label: 'SNSリンク', full: true, hint: '上から順にボタンとして表示されます。URLを変えて保存すればすぐサイトに反映されます' },
      { k: 'youtube_channel_id', type: 'channel', full: true },
      { k: 'color', type: 'color', label: 'メンバーカラー' },
      { k: 'sort_order', type: 'number', label: '表示順', hint: '小さい数字ほど前に表示' },
      { k: 'is_published', type: 'check', label: 'サイトに公開する', full: true },
    ],
    row: (c) => `
      <div class="row" data-edit="${c.id}">
        ${c.avatar ? `<img class="thumb" src="${esc(c.avatar)}" alt="">` : `<span class="thumb" style="background:${esc(c.color)}">${esc((c.name_en || c.name).charAt(0))}</span>`}
        <div><div class="t">${esc(c.name)}</div>
          <div class="m"><span class="dot" style="background:${esc(c.color)}"></span>/creators/${esc(c.slug)}
            <span>SNS ${c.links.length}件</span>${c.youtube_channel_id ? '<span class="tag">YouTube連携</span>' : '<span class="tag">YouTube未設定</span>'}
            ${c.is_published ? '' : '<span class="tag off">非公開</span>'}</div></div>
        <div class="acts"><button class="b b-sm" type="button">編集</button></div>
      </div>`,
  },
  news: {
    title: 'お知らせ', single: 'お知らせ',
    desc: 'トップページの「News」とお知らせ一覧に表示されます。',
    blank: () => ({ category: 'お知らせ', is_published: true, published_at: new Date().toISOString().slice(0, 10) }),
    fields: [
      { k: 'title', label: 'タイトル', req: true, full: true },
      { k: 'category', type: 'select', label: 'カテゴリ', options: ['お知らせ', 'メディア', 'イベント', 'グッズ', '所属', 'その他'] },
      { k: 'published_at', type: 'date', label: '公開日' },
      { k: 'thumbnail', type: 'image', label: 'サムネイル（任意）', full: true },
      { k: 'body', type: 'textarea', label: '本文', full: true, rows: 14, images: true, hint: '改行はそのまま反映されます。URLは自動でリンクになります。![説明](画像URL) の行が画像になり、[ ]の中に書いた文字は画像の下に小さく表示されます' },
      { k: 'is_published', type: 'check', label: 'サイトに公開する', full: true },
    ],
    row: (n) => `
      <div class="row no-thumb" data-edit="${n.id}">
        <div><div class="t">${esc(n.title)}</div>
          <div class="m"><span>${esc(n.published_at)}</span><span class="tag">${esc(n.category)}</span>${n.is_published ? '' : '<span class="tag off">非公開</span>'}</div></div>
        <div class="acts"><button class="b b-sm" type="button">編集</button></div>
      </div>`,
  },
  works: {
    title: '実績', single: '実績',
    desc: 'トップページの「Works」と、関わったクリエイターの個人ページに表示されます。',
    blank: { is_published: true, sort_order: 0, creator_ids: [] },
    fields: [
      { k: 'title', label: 'タイトル', req: true, full: true },
      { k: 'client', label: 'クライアント' },
      { k: 'category', label: 'カテゴリ', ph: 'PR動画 / イベント出演' },
      { k: 'work_date', label: '時期', ph: '2026-09' },
      { k: 'url', type: 'url', label: '関連URL', ph: 'https://' },
      { k: 'thumbnail', type: 'image', label: 'サムネイル（任意）', full: true },
      { k: 'description', type: 'textarea', label: '本文', full: true, rows: 14, images: true, hint: '実績の記事ページに表示されます（一覧には最初の2行だけ表示）。画像も入れられます' },
      { k: 'creator_ids', type: 'creators', label: '関わったクリエイター', full: true },
      { k: 'sort_order', type: 'number', label: '表示順', hint: '小さい数字ほど前に表示' },
      { k: 'is_published', type: 'check', label: 'サイトに公開する' },
    ],
    row: (w) => `
      <div class="row ${w.thumbnail ? 'video' : 'no-thumb'}" data-edit="${w.id}">
        ${w.thumbnail ? `<img class="thumb wide" src="${esc(w.thumbnail)}" alt="">` : ''}
        <div><div class="t">${esc(w.title)}</div>
          <div class="m">${w.client ? `<span>${esc(w.client)}</span>` : ''}${w.work_date ? `<span>${esc(w.work_date)}</span>` : ''}${w.category ? `<span class="tag">${esc(w.category)}</span>` : ''}${w.is_published ? '' : '<span class="tag off">非公開</span>'}</div></div>
        <div class="acts"><button class="b b-sm" type="button">編集</button></div>
      </div>`,
  },
};

const state = { tab: 'creators', items: [], creators: [] };

/* ---------------- 一覧画面 ---------------- */
async function renderList(key) {
  const sec = SECTIONS[key];
  const main = $('[data-main]');
  main.innerHTML = `
    <div class="page-top"><div><h1>${sec.title}</h1><p>${sec.desc}</p></div>
      <button class="b b-primary" type="button" data-new>＋ ${sec.single}を追加</button></div>
    <div class="list" data-list><div class="empty">読み込み中…</div></div>`;
  const [{ items }, cr] = await Promise.all([api(key), key === 'works' ? api('creators') : Promise.resolve(null)]);
  if (key === 'creators') state.creators = items;
  if (cr) state.creators = cr.items;
  state.items = items;
  $('[data-list]').innerHTML = items.length ? items.map(sec.row).join('') : `<div class="empty">まだ登録されていません。「${sec.single}を追加」から作成できます。</div>`;
  $('[data-new]').onclick = () => openEditor(key, null);
  $('[data-list]').onclick = (e) => {
    const r = e.target.closest('[data-edit]');
    if (r) openEditor(key, items.find((x) => String(x.id) === r.dataset.edit));
  };
}

function openEditor(key, item) {
  const sec = SECTIONS[key];
  const blank = typeof sec.blank === 'function' ? sec.blank() : structuredClone(sec.blank);
  const values = item ? { ...item, is_published: !!item.is_published } : blank;
  const dlg = $('[data-drawer]');
  const form = $('[data-drawer-form]');
  $('[data-drawer-title]').textContent = item ? `${sec.single}を編集` : `${sec.single}を追加`;
  const body = $('[data-drawer-body]');
  body.innerHTML = `<div class="fgrid">${sec.fields.map((f) => fieldHtml(f, values[f.k])).join('')}</div>`;
  const fresh = body.cloneNode(true); body.replaceWith(fresh); // 古いイベントを外す
  bindFormParts(fresh, values);

  // 名前の英字表記から URL用ID を自動入力
  const slug = $('[name=slug]', fresh), en = $('[name=name_en]', fresh);
  if (slug && en && !item) en.addEventListener('input', () => { slug.value = en.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });

  const del = $('[data-delete]');
  del.hidden = !item;
  del.onclick = async () => {
    if (!confirm(`「${item.name || item.title}」を削除します。元に戻せません。よろしいですか？`)) return;
    try { await api(`${key}/${item.id}`, { method: 'DELETE' }); dlg.close(); toast('削除しました'); renderList(key); }
    catch (err) { toast(err.message, true); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancel') { dlg.close(); return; }
    const missing = sec.fields.find((f) => f.req && !String($(`[name=${f.k}]`, form).value).trim());
    if (missing) { toast(`${missing.label}を入力してください`, true); $(`[name=${missing.k}]`, form).focus(); return; }
    const data = collect(form, sec.fields);
    const save = $('[data-save]'); save.disabled = true;
    try {
      await api(item ? `${key}/${item.id}` : key, { method: item ? 'PUT' : 'POST', body: data });
      dlg.close(); toast('保存しました'); renderList(key);
    } catch (err) { toast(err.message, true); }
    save.disabled = false;
  };
  dlg.showModal();
  $('input, textarea', $('[data-drawer-body]'))?.focus();
}

/* ---------------- 動画 ---------------- */
async function renderVideos() {
  const main = $('[data-main]');
  main.innerHTML = `
    <div class="page-top"><div><h1>動画</h1><p>各クリエイターのYouTubeから最新の横動画を自動取得しています（Shortsは除外・約3時間ごとに自動更新）。表示したくない動画は「非表示」にできます。</p></div>
      <button class="b b-primary" type="button" data-sync>今すぐ更新</button></div>
    <div data-report></div>
    <div class="list" data-list><div class="empty">読み込み中…</div></div>`;
  const load = async () => {
    const { videos, synced_at } = await api('videos');
    $('[data-list]').innerHTML = videos.length
      ? `<p class="hint" style="color:var(--mist);margin:0 0 8px">最終更新: ${synced_at ? new Date(synced_at).toLocaleString('ja-JP') : '未取得'}</p>` +
        videos.map((v) => `
        <div class="row video">
          <img class="thumb wide" src="https://i.ytimg.com/vi/${esc(v.video_id)}/mqdefault.jpg" alt="">
          <div><a class="t" href="https://www.youtube.com/watch?v=${esc(v.video_id)}" target="_blank" rel="noopener">${esc(v.title)}</a>
            <div class="m"><span>${esc(v.creator_name || '')}</span><span>${esc((v.published_at || '').slice(0, 10))}</span>${v.hidden ? '<span class="tag off">非表示</span>' : ''}</div></div>
          <div class="acts"><button class="b b-sm" type="button" data-toggle="${esc(v.video_id)}" data-hidden="${v.hidden ? 1 : 0}">${v.hidden ? '表示する' : '非表示'}</button></div>
        </div>`).join('')
      : '<div class="empty">動画がまだありません。クリエイター編集画面で YouTubeチャンネルID を設定し、「今すぐ更新」を押してください。</div>';
  };
  await load();
  $('[data-sync]').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = '更新中…';
    try {
      const { report } = await api('videos/sync', { method: 'POST', body: {} });
      $('[data-report]').innerHTML = `<div class="card report">${report.length
        ? report.map((r) => `<div class="${r.ok ? 'ok' : 'ng'}">${r.ok ? '✓' : '✕'} ${esc(r.creator)}：${r.ok ? `${r.count}本の横動画を取得` : esc(r.error)}</div>`).join('')
        : 'YouTubeチャンネルIDが設定されたクリエイターがいません。'}</div>`;
      await load();
      toast('動画を更新しました');
    } catch (err) { toast(err.message, true); }
    e.target.disabled = false; e.target.textContent = '今すぐ更新';
  };
  $('[data-list]').onclick = async (e) => {
    const b = e.target.closest('[data-toggle]');
    if (!b) return;
    try {
      await api(`videos/${encodeURIComponent(b.dataset.toggle)}`, { method: 'PUT', body: { hidden: b.dataset.hidden !== '1' } });
      await load();
    } catch (err) { toast(err.message, true); }
  };
}

/* ---------------- サイト設定 ---------------- */
const SETTING_GROUPS = [
  { title: 'トップページ', fields: [
    { k: 'hero_title', label: 'キャッチコピー', full: true },
    { k: 'hero_sub', type: 'textarea', label: 'サブコピー', full: true, rows: 2 },
  ] },
  { title: '事務所紹介（About）', fields: [
    { k: 'about_title', label: '見出し', full: true },
    { k: 'about_body', type: 'textarea', label: '本文', full: true, rows: 6, hint: '空行で段落が分かれます' },
  ] },
  { title: '公式SNS（フッターに表示）', fields: [
    { k: 'official_links', type: 'links', label: 'リンク', full: true },
  ] },
  { title: 'Movie欄', fields: [
    { k: 'movie_limit', type: 'number', label: 'トップに表示する本数' },
    { k: 'movie_per_creator', type: 'number', label: '1人あたりの最大本数', hint: '特定のクリエイターに偏らないようにします' },
    { k: 'movie_include_live', type: 'check', label: 'ライブ配信のアーカイブも含める', full: true },
  ] },
  { title: 'お問い合わせ', fields: [
    { k: 'contact_note', type: 'textarea', label: 'フォーム横の案内文', full: true, rows: 3, hint: '送信先メールアドレス（teamluminize@gmail.com）は assets/js/config.js の Web3Forms キーで設定します' },
  ] },
];

async function renderSettings() {
  const main = $('[data-main]');
  const { settings } = await api('settings');
  const values = { ...settings, movie_include_live: settings.movie_include_live === '1' };
  main.innerHTML = `
    <div class="page-top"><div><h1>サイト設定</h1><p>トップページの文章や公式SNSを編集します。</p></div></div>
    <form data-settings>
      ${SETTING_GROUPS.map((g) => `<section class="card"><h2>${g.title}</h2><div class="fgrid">${g.fields.map((f) => fieldHtml(f, values[f.k])).join('')}</div></section>`).join('')}
      <button class="b b-primary" type="submit">設定を保存する</button>
    </form>`;
  const form = $('[data-settings]');
  bindFormParts(form, values);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fields = SETTING_GROUPS.flatMap((g) => g.fields);
    const data = collect(form, fields);
    data.movie_include_live = data.movie_include_live ? '1' : '0';
    try { await api('settings', { method: 'PUT', body: data }); toast('設定を保存しました'); }
    catch (err) { toast(err.message, true); }
  };
}

/* ---------------- 画面切り替え ---------------- */
async function go(tab) {
  state.tab = tab;
  $$('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  history.replaceState(null, '', `#${tab}`);
  try {
    if (SECTIONS[tab]) await renderList(tab);
    else if (tab === 'videos') await renderVideos();
    else if (tab === 'settings') await renderSettings();
  } catch (err) { toast(err.message, true); }
}

function showLogin() {
  $('[data-view=app]').hidden = true;
  $('[data-view=login]').hidden = false;
  $('#pw').focus();
}
function showApp() {
  $('[data-view=login]').hidden = true;
  $('[data-view=app]').hidden = false;
  const tab = location.hash.slice(1);
  go(SECTIONS[tab] || tab === 'videos' || tab === 'settings' ? tab : 'creators');
}

$('[data-login]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-login-err]');
  const btn = $('button', e.target); btn.disabled = true; err.hidden = true;
  try { await api('login', { method: 'POST', body: { password: $('#pw').value } }); $('#pw').value = ''; showApp(); }
  catch (ex) { err.textContent = ex.message; err.hidden = false; }
  btn.disabled = false;
});
$('[data-tabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
$('[data-logout]').addEventListener('click', async () => { await api('logout', { method: 'POST', body: {} }).catch(() => {}); showLogin(); });

api('me').then(showApp).catch(showLogin);
