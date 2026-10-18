// お問い合わせフォーム → Web3Forms 経由で teamluminize@gmail.com に送信
export function setupContact(form) {
  if (!form) return;
  const status = form.querySelector('[data-form-status]');
  const btn = form.querySelector('button[type=submit]');
  const show = (msg, ok) => {
    status.hidden = false;
    status.className = `form-status ${ok ? 'ok' : 'ng'}`;
    status.textContent = msg;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cfg = window.LUMINIZE_CONFIG || {};
    const fd = new FormData(form);
    if (fd.get('botcheck')) return;

    const missing = ['name', 'email', 'message'].filter((k) => !String(fd.get(k) || '').trim());
    if (missing.length) {
      show('お名前・メールアドレス・お問い合わせ内容を入力してください。', false);
      form.querySelector(`[name=${missing[0]}]`).focus();
      return;
    }
    if (!form.querySelector('[name=email]').checkValidity()) {
      show('メールアドレスの形式を確認してください。', false);
      return;
    }
    if (!cfg.WEB3FORMS_ACCESS_KEY || cfg.WEB3FORMS_ACCESS_KEY.startsWith('YOUR_')) {
      show('フォームの送信先が未設定です（assets/js/config.js の WEB3FORMS_ACCESS_KEY を設定してください）。', false);
      return;
    }

    btn.disabled = true;
    btn.textContent = '送信中…';
    try {
      const payload = {
        access_key: cfg.WEB3FORMS_ACCESS_KEY,
        subject: `${cfg.CONTACT_SUBJECT || 'お問い合わせ'}（${fd.get('type')}）`,
        from_name: 'Team Luminize 公式サイト',
        replyto: fd.get('email'),
        'お名前': fd.get('name'),
        '会社名・団体名': fd.get('company') || '-',
        'メールアドレス': fd.get('email'),
        '種類': fd.get('type'),
        'お問い合わせ内容': fd.get('message'),
      };
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || '送信に失敗しました');
      form.reset();
      show('送信しました。内容を確認のうえ、担当者よりご連絡します。', true);
    } catch (err) {
      show(`送信できませんでした（${err.message}）。時間をおいて再度お試しください。`, false);
    } finally {
      btn.disabled = false;
      btn.textContent = '送信する';
    }
  });
}
