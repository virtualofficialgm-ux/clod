const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderDocument(doc, format) {
  const rows = doc.lines.map((l) => `<tr class="${l.total ? 'total' : ''}"><td>${esc(l.label)}</td><td class="num">${esc(format(l.amount, l.currency))}</td></tr>`).join('');
  const notes = doc.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('');
  return `<article class="doc">
  <header><strong>Parri Pay</strong><span>${esc(doc.title)}</span></header>
  <dl><dt>Документ</dt><dd>${esc(doc.id)}</dd>${doc.orderId ? `<dt>Заказ</dt><dd>${esc(doc.orderId)}</dd>` : ''}<dt>Дата</dt><dd>${esc(new Date(doc.issuedAt).toLocaleString('ru-RU'))}</dd></dl>
  <table>${rows}</table>${notes}
</article>`;
}

// Hosted checkout page of the sandbox partner. Card data is entered here, on the
// partner side; Parri never receives it.
export function renderCheckout(partnerId, partnerTitle, op, format) {
  const done = op.status !== 'requires_action';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(partnerTitle)} — оплата</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f5f7; --card:#fff; --fg:#1b1d22; --muted:#6a6f7a; --line:#dcdfe5; --accent:#2b59c3; }
  @media (prefers-color-scheme: dark) { :root { --bg:#16181d; --card:#20232a; --fg:#eceef2; --muted:#9aa0ab; --line:#343843; --accent:#7ea2ff; } }
  body { margin:0; font:16px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--fg); display:grid; place-items:center; min-height:100vh; padding:16px; box-sizing:border-box; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; width:100%; max-width:380px; }
  .badge { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .amount { font-size:28px; font-weight:700; margin:8px 0 4px; }
  label { display:block; font-size:13px; color:var(--muted); margin-top:12px; }
  input { width:100%; box-sizing:border-box; padding:10px; border:1px solid var(--line); border-radius:8px; background:transparent; color:inherit; font:inherit; }
  button { width:100%; margin-top:12px; padding:12px; border-radius:8px; border:1px solid var(--line); font:inherit; cursor:pointer; background:transparent; color:inherit; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  .hint { font-size:12px; color:var(--muted); margin-top:16px; }
</style></head><body>
<form class="card" method="post">
  <div class="badge">${esc(partnerTitle)} · песочница</div>
  <div class="amount">${esc(format(op.amount, op.currency))}</div>
  <div>${esc(op.description ?? '')}</div>
  ${done ? `<p>Статус: <strong>${esc(op.status)}</strong></p><a href="/">Вернуться в Parri</a>` : `
  <label>Номер карты (тестовые данные, не вводите настоящую карту)</label><input value="4242 4242 4242 4242" readonly>
  ${op.savePaymentMethod ? '<p class="hint">Карта будет сохранена у партнёра для автоматического продления подписки.</p>' : ''}
  <button class="primary" name="outcome" value="success">Оплатить</button>
  <button name="outcome" value="decline">Смоделировать отказ банка</button>
  <button name="outcome" value="cancel">Отменить</button>`}
  <p class="hint">Страница партнёра ${esc(partnerId)}. Данные карты остаются у партнёра; Parri получает только подписанное уведомление со статусом.</p>
</form></body></html>`;
}
