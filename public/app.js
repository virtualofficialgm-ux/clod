const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (amount, currency) => `${(amount / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const toMinor = (v) => Math.round(Number(v) * 100);
const newKey = () => crypto.randomUUID();

const STATUS = {
  awaiting_payment: ['Ожидает оплаты', 'warn'], paid: ['Оплачен', 'ok'], completed: ['Завершён', 'ok'], canceled: ['Отменён', ''],
  refunded: ['Возвращён', ''], succeeded: ['Успешно', 'ok'], processing: ['В обработке', 'warn'], failed: ['Не прошёл', 'bad'],
  requires_action: ['Ждёт подтверждения', 'warn'], created: ['Создан', ''],
};
const RESERVATION = { held: ['В резерве', 'warn'], released: ['Резерв снят', 'ok'], returned: ['Резерв возвращён', ''], partially_returned: ['Частично возвращён', 'warn'] };
const SUB_STATUS = { active: ['Активна', 'ok'], incomplete: ['Ожидает оплаты', 'warn'], past_due: ['Просрочена', 'bad'], canceled: ['Отменена', ''] };
const tag = (map, key) => (map[key] ? `<span class="tag ${map[key][1]}">${map[key][0]}</span>` : '');

let meta;
let me;
let userId = localStorageGet('parri.user') ?? 'u_anna';
let quoteTimer;

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

async function api(path, { method = 'GET', body, idempotent = false } = {}) {
  const headers = { 'x-user-id': userId };
  if (body) headers['content-type'] = 'application/json';
  if (idempotent) headers['idempotency-key'] = idempotent === true ? newKey() : idempotent;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Ошибка');
  return data;
}

function flash(text, error = false) {
  const el = $('#flash');
  el.textContent = text;
  el.className = `flash${error ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { el.hidden = true; }, 6000);
}

async function guard(fn) {
  try { await fn(); } catch (e) { flash(e.message, true); }
}

// --- Tabs -------------------------------------------------------------------
$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.dataset.tab;
  if (!tab) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === e.target));
  document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${tab}`; });
  refresh();
});

// --- Wallet -----------------------------------------------------------------
async function renderWallet() {
  const b = await api('/api/me/balance');
  const cards = [];
  for (const c of b.balances) {
    const expected = c.expected.pendingSettlement + c.expected.reservedForMyOrders;
    const restricted = c.restricted.reservedInMyPurchases + c.restricted.payoutsInProgress;
    cards.push(`
      <div class="card money"><div class="label">Доступно</div><div class="value">${money(c.available, c.currency)}</div><div class="sub">Реальные деньги, можно вывести</div></div>
      <div class="card expected"><div class="label">Ожидаемые поступления</div><div class="value">${money(expected, c.currency)}</div>
        <div class="sub">Ждёт расчёта партнёра: ${money(c.expected.pendingSettlement, c.currency)}<br>В резерве по вашим заказам: ${money(c.expected.reservedForMyOrders, c.currency)}</div></div>
      <div class="card restricted"><div class="label">Временно недоступно</div><div class="value">${money(restricted, c.currency)}</div>
        <div class="sub">Резерв по вашим покупкам: ${money(c.restricted.reservedInMyPurchases, c.currency)}<br>Выплаты в обработке: ${money(c.restricted.payoutsInProgress, c.currency)}</div></div>`);
  }
  cards.push(`<div class="card bonus"><div class="label">Бонусы</div><div class="value">${(b.bonuses.points / 100).toLocaleString('ru-RU')} баллов</div><div class="sub">${esc(b.bonuses.note)}</div></div>`);
  $('#balance').innerHTML = cards.join('');

  const l = b.limits;
  $('#limits').innerHTML = l ? `
    <p class="big">Идентификация: ${esc(l.title)}</p>
    <p class="hint">Процедура: ${esc(l.procedure)}</p>
    <table class="quote"><tr><td>Максимальный платёж</td><td class="num">${money(l.maxPayment, l.currency)}</td></tr>
    <tr><td>Лимит выплат в месяц</td><td class="num">${money(l.monthlyPayout, l.currency)}</td></tr>
    <tr><td>Выплачено в этом месяце</td><td class="num">${money(l.payoutUsedThisMonth, l.currency)}</td></tr>
    <tr class="total"><td>Осталось для выплат</td><td class="num">${money(l.payoutRemaining, l.currency)}</td></tr></table>`
    : '<p class="empty">Для бизнеса лимиты устанавливаются договором с партнёром.</p>';

  const n = await api('/api/me/notifications');
  $('#notifications').innerHTML = n.length ? n.slice(0, 15).map((x) => `<li><div class="main"><div>${esc(x.text)}</div><div class="meta">${new Date(x.at).toLocaleString('ru-RU')}</div></div></li>`).join('') : '<li class="empty">Уведомлений нет</li>';
}

// --- Pay --------------------------------------------------------------------
const payForm = $('#pay-form');

function setupPayForm() {
  const market = me.market;
  payForm.hidden = !market;
  $('#pay-business').hidden = Boolean(market);
  if (!market) return;
  payForm.currency.innerHTML = (market?.paymentCurrencies ?? []).map((c) => `<option>${c}</option>`).join('');
  const executors = meta.sandbox.users.filter((u) => u.id !== userId && u.market === market?.id);
  payForm.payeeId.innerHTML = executors.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('') || '<option value="">Нет исполнителей на вашем рынке</option>';
  $('#amount-label').textContent = `Сумма, ${market?.settlementCurrency ?? ''}`;
  togglePayee();
  updateQuote();
}

function togglePayee() {
  payForm.querySelector('[data-for="tasks"]').hidden = payForm.product.value !== 'tasks';
}

async function updateQuote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(() => guard(async () => {
    const amount = toMinor(payForm.amount.value);
    if (!amount || amount <= 0) { $('#quote').innerHTML = ''; return; }
    const q = await api('/api/quote', { method: 'POST', body: { product: payForm.product.value, amount, currency: payForm.currency.value } });
    const S = q.settlementCurrency;
    const fx = q.payer.currency !== S;
    $('#quote').innerHTML = `<table>
      <tr class="group"><td colspan="2">Вы платите</td></tr>
      <tr><td>Стоимость</td><td class="num">${money(q.amount, S)}</td></tr>
      ${fx ? `<tr><td>По курсу ${q.payer.rate >= 1 ? `1 ${S} = ${q.payer.rate.toFixed(4)} ${q.payer.currency}` : `1 ${q.payer.currency} = ${(1 / q.payer.rate).toFixed(2)} ${S}`}</td><td class="num">${money(q.payer.converted, q.payer.currency)}</td></tr>
      <tr><td>Стоимость конвертации</td><td class="num">${money(q.payer.fxCost, q.payer.currency)}</td></tr>` : ''}
      <tr class="total"><td>К списанию</td><td class="num">${money(q.payer.total, q.payer.currency)}</td></tr>
      <tr class="group"><td colspan="2">Получатель получит</td></tr>
      <tr><td>Комиссия эквайринга (${q.payee.acquiringFeeBps / 100}%)</td><td class="num">−${money(q.payee.acquiringFee, S)}</td></tr>
      <tr><td>Комиссия Parri (${q.payee.parriFeeBps / 100}%)</td><td class="num">−${money(q.payee.parriFee, S)}</td></tr>
      <tr class="total"><td>Получателю</td><td class="num">${money(q.payee.net, S)}</td></tr></table>`;
  }), 250);
}

payForm.addEventListener('input', (e) => { if (e.target.name === 'product') togglePayee(); updateQuote(); });
payForm.addEventListener('submit', (e) => {
  e.preventDefault();
  guard(async () => {
    const button = payForm.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const order = await api('/api/sandbox/orders', { method: 'POST', body: {
        product: payForm.product.value, payeeId: payForm.payeeId.value, amount: toMinor(payForm.amount.value), description: payForm.description.value,
      } });
      const payment = await api(`/api/orders/${order.id}/payments`, { method: 'POST', body: { currency: payForm.currency.value }, idempotent: `checkout-${order.id}` });
      goToCheckout(payment.confirmationUrl);
    } finally {
      button.disabled = false;
    }
  });
});

// --- History ----------------------------------------------------------------
const DOC_SHORT = { receipt: 'Чек', refund_receipt: 'Чек возврата', act: 'Акт', income_statement: 'Отчёт', payout_statement: 'Подтверждение' };
const KIND = { payment: 'Оплата', income: 'Поступление', refund: 'Возврат', payout: 'Выплата' };

async function renderHistory() {
  const ops = await api('/api/me/operations');
  $('#operations').innerHTML = ops.length ? ops.map((o) => {
    const actions = [];
    if (o.kind === 'payment' && o.confirmationUrl) actions.push(`<button class="small primary" data-go="${esc(o.confirmationUrl)}">Оплатить</button>`);
    if (o.kind === 'payment' && o.status === 'awaiting_payment') actions.push(`<button class="small" data-retry="${o.orderId}">Новая попытка</button><button class="small" data-cancel="${o.orderId}">Отменить</button>`);
    if (o.kind === 'payment' && o.status === 'paid' && o.escrow) actions.push(`<button class="small primary" data-complete="${o.orderId}">Подтвердить выполнение</button>`);
    if (o.kind === 'income' && ['paid', 'completed'].includes(o.status)) actions.push(`<button class="small" data-refund="${o.orderId}">Вернуть</button>`);
    for (const d of o.documents ?? []) actions.push(`<button class="small" data-doc="${d.id}" title="${esc(d.title)}">${DOC_SHORT[d.type] ?? 'Документ'}</button>`);
    const sign = o.amount > 0 && o.kind !== 'payment' ? '+' : '';
    const income = o.kind === 'income' ? (o.settled ? '<span class="tag ok">Доступно</span>' : o.status === 'completed' ? '<span class="tag warn">Ждёт расчёта</span>' : '') : '';
    return `<li>
      <div class="main"><div class="title">${KIND[o.kind]} · ${esc(o.description)}</div>
        <div class="meta">${new Date(o.at).toLocaleString('ru-RU')} ${o.orderId ? `· ${o.orderId}` : ''}</div>
        <div>${tag(STATUS, o.status)}${o.paymentStatus && o.paymentStatus !== 'succeeded' && o.status === 'awaiting_payment' ? tag(STATUS, o.paymentStatus) : ''}${tag(RESERVATION, o.reservation)}${income}${o.refunded ? `<span class="tag">Возвращено ${money(o.refunded, o.orderCurrency)}</span>` : ''}</div></div>
      <div class="amount ${o.amount > 0 && o.kind !== 'payment' ? 'in' : ''}">${sign}${money(o.amount, o.currency)}</div>
      <div class="actions">${actions.join('')}</div></li>`;
  }).join('') : '<li class="empty">Операций пока нет</li>';
}

$('#operations').addEventListener('click', (e) => guard(async () => {
  const d = e.target.dataset;
  if (d.go) return goToCheckout(d.go);
  if (d.doc) return showDocument(d.doc);
  if (d.retry) {
    const p = await api(`/api/orders/${d.retry}/payments`, { method: 'POST', body: {}, idempotent: true });
    if (p.confirmationUrl) return goToCheckout(p.confirmationUrl);
  }
  if (d.cancel) { await api(`/api/orders/${d.cancel}/cancel`, { method: 'POST' }); flash('Заказ отменён'); }
  if (d.complete) { await api(`/api/orders/${d.complete}/complete`, { method: 'POST' }); flash('Заказ завершён: резерв снят, исполнитель получит выплату после расчёта партнёра'); }
  if (d.refund) return askRefund(d.refund);
  refresh();
}));
$('#refresh').addEventListener('click', () => refresh());

function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal').showModal();
}

// Refund form inside the page (system prompt dialogs are not used).
function askRefund(orderId) {
  openModal(`<form id="refund-form" class="form">
    <p class="big">Возврат по заказу</p>
    <label>Сумма возврата
      <input id="refund-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="Пусто — вернуть всё">
    </label>
    <label>Причина
      <input id="refund-reason" name="reason" value="Возврат по запросу" maxlength="120">
    </label>
    <button class="primary" type="submit">Оформить возврат</button>
  </form>`);
  $('#refund-form').addEventListener('submit', (e) => {
    e.preventDefault();
    guard(async () => {
      const f = e.target;
      await api(`/api/orders/${orderId}/refunds`, { method: 'POST', body: { amount: f.amount.value ? toMinor(f.amount.value) : undefined, reason: f.reason.value }, idempotent: true });
      $('#modal').close();
      flash('Возврат отправлен партнёру');
      refresh();
    });
  });
}

// The payer confirms the payment on the partner's page. In the standalone build
// the partner page is shown as a dialog instead of a separate page.
function goToCheckout(url) {
  if (!window.PARRI_EMBEDDED) {
    location.href = url;
    return;
  }
  guard(async () => {
    const op = await api(`${url}?format=json`);
    openModal(`<div class="checkout">
      <div class="badge">${esc(op.partner)} · страница банка (песочница)</div>
      <div class="value">${money(op.amount, op.currency)}</div>
      <div>${esc(op.description ?? '')}</div>
      <label>Номер карты (тестовый)<input id="card" value="4242 4242 4242 4242" readonly></label>
      ${op.savePaymentMethod ? '<p class="hint">Карта будет сохранена у банка для автопродления подписки.</p>' : ''}
      <div class="checkout-actions">
        <button class="primary" data-outcome="success">Оплатить</button>
        <button data-outcome="decline">Смоделировать отказ банка</button>
        <button data-outcome="cancel">Отменить</button>
      </div>
      <p class="hint">Данные карты остаются у банка. Parri получает только подписанное уведомление со статусом.</p>
    </div>`);
    $('#modal-body .checkout-actions').addEventListener('click', (e) => {
      const outcome = e.target.dataset.outcome;
      if (!outcome) return;
      guard(async () => {
        await api(url, { method: 'POST', body: { outcome } });
        $('#modal').close();
        showCheckoutOutcome(outcome);
        refresh();
      });
    });
  });
}

function showCheckoutOutcome(outcome) {
  if (outcome === 'success') flash('Банк подтвердил оплату');
  else flash(outcome === 'cancel' ? 'Оплата отменена' : 'Банк отклонил платёж — можно попробовать снова', outcome !== 'cancel');
}

async function showDocument(id) {
  const { html } = await api(`/api/documents/${id}?view=html`);
  openModal(html);
}

// --- Subscriptions ------------------------------------------------------------
async function renderSubs() {
  const plans = meta.products.flatMap((p) => Object.entries(p.plans ?? {}).map(([id, plan]) => ({ id, ...plan, product: p.title })));
  const market = me.market;
  $('#plans').innerHTML = market ? plans.map((p) => `<p class="big">${esc(p.title)} · ${money(p.price[market.id], market.settlementCurrency)}</p>
    <p class="hint">${esc(p.product)}. Продление каждые ${p.periodDays} дней, карта сохраняется у партнёра.</p>
    <button class="primary" data-plan="${p.id}">Оформить</button>`).join('') : '<p class="empty">Подписки доступны пользователям</p>';
  const subs = market ? await api('/api/me/subscriptions') : [];
  $('#subscriptions').innerHTML = subs.map((s) => `<li><div class="main"><div class="title">${esc(s.title)}</div>
    <div class="meta">Период ${s.period}${s.currentPeriodEnd ? ` · оплачено до ${s.currentPeriodEnd.slice(0, 10)}` : ''}${s.cancelAtPeriodEnd ? ' · не будет продлена' : ''}</div>
    <div>${tag(SUB_STATUS, s.status)}</div></div><div class="amount">${money(s.price, s.currency)}</div>
    <div class="actions">${['active', 'incomplete', 'past_due'].includes(s.status) && !s.cancelAtPeriodEnd ? `<button class="small" data-unsub="${s.id}">Отменить</button>` : ''}</div></li>`).join('');
}

$('#tab-subs').addEventListener('click', (e) => guard(async () => {
  if (e.target.dataset.plan) {
    const { payment } = await api('/api/subscriptions', { method: 'POST', body: { planId: e.target.dataset.plan }, idempotent: true });
    goToCheckout(payment.confirmationUrl);
  }
  if (e.target.dataset.unsub) {
    await api(`/api/subscriptions/${e.target.dataset.unsub}/cancel`, { method: 'POST' });
    flash('Подписка не будет продлена');
    renderSubs();
  }
}));

// --- Payouts ----------------------------------------------------------------
const payoutForm = $('#payout-form');
async function renderPayouts() {
  const b = await api('/api/me/balance');
  $('#payout-available').textContent = b.balances.map((c) => `Доступно к выводу: ${money(c.available, c.currency)}`).join(' · ');
  if (me.isBusiness && !payoutForm.destination.value.includes(':')) payoutForm.destination.value = 'acc_40817810:AMD';
}
payoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  guard(async () => {
    await api('/api/payouts', { method: 'POST', body: { amount: toMinor(payoutForm.amount.value), destination: payoutForm.destination.value }, idempotent: true });
    flash('Выплата отправлена партнёру');
    payoutForm.amount.value = '';
    renderPayouts();
  });
});

// --- Documents --------------------------------------------------------------
async function renderDocs() {
  const docs = await api('/api/me/documents');
  $('#documents').innerHTML = docs.length ? docs.map((d) => `<li><div class="main"><div class="title">${esc(d.title)}</div>
    <div class="meta">${new Date(d.issuedAt).toLocaleString('ru-RU')}${d.orderId ? ` · ${d.orderId}` : ''}</div></div>
    <div class="actions"><button class="small" data-doc="${d.id}">Открыть</button></div></li>`).join('') : '<li class="empty">Документов пока нет</li>';
}
$('#documents').addEventListener('click', (e) => e.target.dataset.doc && guard(() => showDocument(e.target.dataset.doc)));

// --- Business (Pay Platform) --------------------------------------------------
async function renderBusiness() {
  const el = $('#business');
  if (!meta.capabilities.businessCabinet) {
    const lvl = meta.levels.find((l) => l.id === 'platform');
    el.innerHTML = `<div class="panel"><p class="big">Кабинет бизнеса — уровень ${esc(lvl.title)}</p><p class="hint">Условие перехода: ${esc(lvl.transition)}. Запустите сервер командой <code>npm run start:platform</code>, чтобы посмотреть.</p></div>`;
    return;
  }
  // Businesses with their own account: Fit and Food (Tasks pays out to individual executors).
  const keys = Object.entries(meta.sandbox.serviceKeys).filter(([, p]) => p !== 'tasks');
  const parts = [];
  for (const [key, product] of keys) {
    const res = await fetch('/api/business/summary', { headers: { 'x-api-key': key } }).then((r) => r.json());
    const rows = res.totals?.length ? res.totals.map((t) => `<tr><td>${t.currency}</td><td class="num">${t.orders}</td><td class="num">${money(t.turnover, t.currency)}</td><td class="num">${money(t.acquiringFees, t.currency)}</td><td class="num">${money(t.parriFees, t.currency)}</td><td class="num">${money(t.refunds, t.currency)}</td><td class="num">${money(t.net, t.currency)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Операций нет</td></tr>';
    parts.push(`<h2>${esc(meta.products.find((p) => p.id === product).title)}</h2><div class="panel" style="overflow-x:auto"><table class="quote">
      <tr class="group"><td>Валюта</td><td class="num">Заказы</td><td class="num">Оборот</td><td class="num">Эквайринг</td><td class="num">Комиссия Parri</td><td class="num">Возвраты</td><td class="num">Чистыми</td></tr>${rows}</table></div>`);
  }
  const recon = [];
  for (const p of meta.partners) {
    const r = await fetch(`/api/business/reconciliation/${p.id}`, { headers: { 'x-api-key': 'sk_sandbox_tasks' } }).then((x) => x.json());
    recon.push(`<li><div class="main"><div class="title">${esc(p.title)}</div><div class="meta">Операций у партнёра: ${r.operations}, совпало: ${r.matched}</div>
      ${r.issues.map((i) => `<div class="meta">⚠ ${esc(i.type)} ${esc(i.id ?? i.partnerOperation)} ${esc(i.parri ?? '')} / ${esc(i.partner ?? '')}</div>`).join('')}</div>
      <div>${r.issues.length ? `<span class="tag bad">Расхождений: ${r.issues.length}</span>` : '<span class="tag ok">Сходится</span>'}</div></li>`);
  }
  el.innerHTML = `${parts.join('')}<h2>Сверка с партнёрами</h2><ul class="list">${recon.join('')}</ul>`;
}

// --- About ------------------------------------------------------------------
function renderAbout() {
  $('#levels').innerHTML = meta.levels.map((l) => `<div class="panel ${l.active ? 'active' : ''}">
    <div class="name">${esc(l.title)}</div><div>${esc(l.summary)} ${l.active ? '<span class="tag ok">Включён</span>' : l.implemented ? '<span class="tag">Доступен при переходе</span>' : '<span class="tag">Отдельная программа</span>'}</div>
    <div class="hint">Условие перехода</div><div class="hint">${esc(l.transition)}</div></div>`).join('');
  const REG = { lending: 'Кредитование', deposits: 'Приём вкладов', cardIssuing: 'Выпуск карт' };
  $('#markets').innerHTML = meta.markets.map((m) => `<div class="card"><div class="label">${esc(m.id)}</div><div class="value">${esc(m.name)}</div>
    <div class="sub">Партнёр: ${esc(meta.partners.find((p) => p.id === m.partner).title)} (эквайринг ${meta.partners.find((p) => p.id === m.partner).acquiringFeeBps / 100}%)<br>
    Расчёты: ${m.settlementCurrency}, оплата: ${m.paymentCurrencies.join(', ')}<br>Расчёт партнёра: ${m.settlementDelayDays} дн.<br>
    Идентификация: ${Object.values(m.kyc).map((k) => `${esc(k.title)} — ${esc(k.procedure)}`).join('; ')}<br>
    ${Object.entries(m.regulated).map(([k, v]) => `${REG[k]}: ${v.available ? 'да' : 'нет'}`).join(' · ')}</div></div>`).join('');
  $('#clock').textContent = `Сдвиг часов песочницы: ${meta.sandbox.clockOffsetDays} дн. Регулярные задачи (продление подписок, расчёты) запускаются при сдвиге.`;
}

document.querySelector('.sandbox').addEventListener('click', (e) => guard(async () => {
  const action = e.target.dataset.sandbox;
  if (!action) return;
  const res = await api(`/api/sandbox/${action}`, { method: 'POST', body: action === 'advance' ? { days: 31 } : {} });
  flash(action === 'settle' ? `Расчёт проведён по заказам: ${res.settled.length}` : action === 'advance' ? `Часы сдвинуты: продлений ${res.billed.length}` : 'Операции партнёров обработаны');
  meta = await api('/api/meta');
  renderAbout();
}));

// --- Boot -------------------------------------------------------------------
async function refresh() {
  const active = document.querySelector('#tabs button.active').dataset.tab;
  await guard(async () => {
    if (active === 'wallet') await renderWallet();
    if (active === 'history') await renderHistory();
    if (active === 'subs') await renderSubs();
    if (active === 'payouts') await renderPayouts();
    if (active === 'docs') await renderDocs();
    if (active === 'business') await renderBusiness();
    if (active === 'about') renderAbout();
  });
}

async function selectUser(id) {
  userId = id;
  localStorageSet('parri.user', id);
  me = await api('/api/me');
  setupPayForm();
  refresh();
}

async function boot() {
  meta = await api('/api/meta');
  const lvl = meta.levels.find((l) => l.id === meta.level);
  $('#level').textContent = lvl.title;
  const parties = [...meta.sandbox.users.map((u) => ({ id: u.id, label: `${u.name} · ${u.market}` })), ...meta.sandbox.merchants.map((m) => ({ id: m.id, label: `${m.name} (бизнес)` }))];
  $('#user').innerHTML = parties.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  if (!parties.some((p) => p.id === userId)) userId = 'u_anna';
  $('#user').value = userId;
  $('#user').addEventListener('change', (e) => guard(() => selectUser(e.target.value)));
  await selectUser(userId);

  const outcome = new URLSearchParams(location.search).get('checkout');
  if (outcome) {
    history.replaceState(null, '', '/');
    showCheckoutOutcome(outcome);
  }
  // Statuses arrive asynchronously from partners; keep the active view fresh.
  setInterval(() => { if (!document.hidden && !$('#modal').open) refresh(); }, 5000);
}

boot().catch((e) => flash(e.message, true));
