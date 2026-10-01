// Parri Pay mobile web app. Screens render into #screen; flows open as bottom sheets.
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toMinor = (v) => Math.round(Number(String(v).replace(',', '.')) * 100);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const fmt = (amount) => (amount / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Compact form for tiles: drops zero kopecks.
const short = (amount) => (amount % 100 === 0 ? (amount / 100).toLocaleString('ru-RU') : fmt(amount));
const money = (amount, currency) => `${fmt(amount)} ${currency}`;
const signed = (amount, currency) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${money(Math.abs(amount), currency)}`;

// --- Icons (line icons in the SF Symbols spirit) ------------------------------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  send: '<path d="M7 17 17 7M8 7h9v9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  hammer: '<path d="M14 6l4 4M3 21l9-9M12 4l6 6-3 3-6-6z"/>',
  fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 3c-2 2-2 6 0 8v10"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  arrowIn: '<path d="M17 7 7 17M16 17H7V8"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const icon = (name, size = 22, stroke = 1.9) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
const chevron = `<span class="chev">${icon('chevron', 18, 2.2)}</span>`;

// --- Labels -------------------------------------------------------------------
const ORDER_STATUS = {
  awaiting_payment: ['Ожидает оплаты', 'warn'], paid: ['Оплачен', 'ok'], completed: ['Завершён', 'ok'],
  canceled: ['Отменён', ''], refunded: ['Возвращён', ''],
};
const OP_STATUS = { succeeded: ['Выполнено', 'ok'], processing: ['В обработке', 'warn'], failed: ['Не прошло', 'bad'] };
const RESERVATION = { held: ['В резерве', 'warn'], released: ['Резерв снят', 'ok'], returned: ['Резерв возвращён', ''], partially_returned: ['Частичный возврат', 'warn'] };
const SUB_STATUS = { active: ['Активна', 'ok'], incomplete: ['Ждёт оплаты', 'warn'], past_due: ['Просрочена', 'bad'], canceled: ['Отменена', ''] };
const DOC_ICON = { receipt: 'doc', refund_receipt: 'back', act: 'check', income_statement: 'chart', payout_statement: 'bank' };
const pill = (map, key) => (map[key] ? `<span class="pill ${map[key][1]}">${map[key][0]}</span>` : '');

const PRODUCT_ICON = { tasks: 'hammer', food: 'fork', fit: 'heart' };
function opVisual(o) {
  if (o.kind === 'payout') return { cls: 'payout', icon: 'bank' };
  if (o.kind === 'refund') return { cls: 'refund', icon: 'back' };
  if (o.kind === 'income') return { cls: 'income', icon: 'arrowIn' };
  return { cls: o.product ?? 'tasks', icon: PRODUCT_ICON[o.product] ?? 'send' };
}

// --- State & API ----------------------------------------------------------------
const state = { meta: null, me: null, tab: 'home', filter: 'all', pay: { product: 'tasks', currency: null, amount: '15000', description: 'Сборка шкафа', payeeId: null } };
let userId = storageGet('parri.user') ?? 'u_anna';

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }

async function api(path, { method = 'GET', body, idempotent = false, apiKey } = {}) {
  const headers = { 'x-user-id': userId };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (body) headers['content-type'] = 'application/json';
  if (idempotent) headers['idempotency-key'] = idempotent === true ? newKey() : idempotent;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Что-то пошло не так. Попробуйте ещё раз.');
  return data;
}

function toast(text, error = false) {
  const el = $('#toast');
  el.innerHTML = `${error ? '' : `<span style="color:var(--ok)">${icon('check', 18, 2.4)}</span>`}<span>${esc(text)}</span>`;
  el.className = `toast${error ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3800);
}

async function guard(fn) {
  try { return await fn(); } catch (e) { toast(e.message, true); return undefined; }
}

const market = () => state.me?.market;
const cur = () => market()?.settlementCurrency ?? 'AMD';
const isBusiness = () => state.me?.isBusiness;

// --- Sheet ----------------------------------------------------------------------
function openSheet(html, onMount) {
  const sheet = $('#sheet');
  $('#sheet-body').innerHTML = html;
  sheet.classList.remove('closing');
  sheet.hidden = false;
  $('#sheet-backdrop').hidden = false;
  sheet.scrollTop = 0;
  onMount?.($('#sheet-body'));
}
function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.add('closing');
  $('#sheet-backdrop').hidden = true;
  setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
}
const sheetOpen = () => !$('#sheet').hidden;
const sheetHead = (title) => `<div class="sheet-head"><h3>${esc(title)}</h3><button class="close" data-close aria-label="Закрыть">${icon('close', 16, 2.4)}</button></div>`;
$('#sheet-backdrop').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// --- Navigation -------------------------------------------------------------------
document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, 24); });
$('#bell').innerHTML = icon('bell', 22);
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});
function go(tab) {
  state.tab = tab;
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo({ top: 0 });
  render();
}
window.addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', window.scrollY > 40), { passive: true });

async function render() {
  const titles = { home: 'Главная', pay: 'Оплата', history: 'История', more: 'Ещё' };
  $('#topbar-title').textContent = titles[state.tab];
  await guard(() => SCREENS[state.tab]());
}

// --- Home -----------------------------------------------------------------------------
async function renderHome() {
  const [b, ops, subs] = await Promise.all([
    api('/api/me/balance'), api('/api/me/operations'),
    isBusiness() ? Promise.resolve([]) : api('/api/me/subscriptions'),
  ]);
  const c = b.balances.find((x) => x.currency === cur()) ?? b.balances[0];
  const expected = c.expected.pendingSettlement + c.expected.reservedForMyOrders;
  const restricted = c.restricted.reservedInMyPurchases + c.restricted.payoutsInProgress;
  const [int, dec] = fmt(c.available).split(',');
  const l = b.limits;
  const used = l ? Math.min(100, Math.round((l.payoutUsedThisMonth / l.monthlyPayout) * 100)) : 0;
  const activeSub = subs.find((s) => s.status === 'active' || s.status === 'past_due');

  $('#screen').innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">${esc(state.me.name)}${market() ? ` · ${esc(market().name)}` : ' · бизнес-счёт'}</div>
      <h1 class="large-title">Кошелёк</h1>
    </div>

    <section class="hero fade-in" aria-label="Баланс">
      <div class="hero-label">${icon('shield', 16, 2)} Доступно к выводу</div>
      <div class="hero-amount">${int}<small>,${dec} ${c.currency}</small></div>
      <div class="hero-sub">Реальные деньги на счёте у банка-партнёра</div>
      <div class="hero-split">
        <button data-sheet="expected"><div class="k">Ожидается</div><div class="v">${short(expected)}</div></button>
        <button data-sheet="restricted"><div class="k">Недоступно</div><div class="v">${short(restricted)}</div></button>
        <button data-sheet="bonus" class="bonus"><div class="k">Бонусы</div><div class="v">${(b.bonuses.points / 100).toLocaleString('ru-RU')} б.</div></button>
      </div>
    </section>

    <section class="actions">
      ${quickAction('pay', 'send', 'Оплатить')}
      ${quickAction('payout', 'down', 'Вывести')}
      ${quickAction('subs', 'repeat', 'Подписки')}
      ${quickAction('docs', 'doc', 'Документы')}
    </section>

    ${l ? `<section>
      <div class="group glass">
        <button class="row" data-sheet="limits">
          <span class="ico sq" style="background:var(--c-payout)">${icon('lock', 17, 2.2)}</span>
          <div class="main"><div class="title">Лимит выплат · ${esc(l.title)}</div>
            <div class="sub">Осталось ${money(l.payoutRemaining, l.currency)} из ${money(l.monthlyPayout, l.currency)}</div>
            <div class="meter"><i style="width:${used}%"></i></div></div>
          ${chevron}
        </button>
      </div></section>` : ''}

    ${activeSub ? `<section><div class="group glass"><button class="row" data-sheet="subs">
      <span class="ico sq fit">${icon('heart', 17, 2.2)}</span>
      <div class="main"><div class="title">${esc(activeSub.title)}</div><div class="sub">${activeSub.status === 'past_due' ? 'Не удалось продлить' : `Следующее списание ${new Date(activeSub.currentPeriodEnd).toLocaleDateString('ru-RU')}`}</div></div>
      <div class="end">${pill(SUB_STATUS, activeSub.status)}</div></button></div></section>` : ''}

    <section>
      <div class="section-head"><h2>Операции</h2>${ops.length ? '<button class="link" data-go="history">Все</button>' : ''}</div>
      ${ops.length ? `<div class="group glass">${ops.slice(0, 5).map(opRow).join('')}</div>` : emptyOps()}
    </section>`;
  bindOps(ops);
  updateBell();
}

const quickAction = (sheet, ic, label) => `<button class="action" data-sheet="${sheet}"><span class="bubble glass">${icon(ic, 24, 2)}</span>${label}</button>`;
const emptyOps = () => `<div class="group glass"><div class="empty">Здесь появятся оплаты, поступления и выплаты.${isBusiness() ? '' : '<br><br><button class="btn primary" data-go="pay">Сделать первую оплату</button>'}</div></div>`;

function opRow(o, i) {
  const v = opVisual(o);
  const sub = o.kind === 'payment' ? (o.status === 'awaiting_payment' ? 'Ожидает оплаты' : RESERVATION[o.reservation]?.[0] ?? ORDER_STATUS[o.status]?.[0])
    : o.kind === 'income' ? (o.settled ? 'Доступно' : o.status === 'completed' ? 'Ждёт расчёта банка' : 'В резерве до завершения')
      : OP_STATUS[o.status]?.[0];
  const when = new Date(o.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const failed = o.status === 'canceled' || o.status === 'failed';
  return `<button class="row" data-op="${i}">
    <span class="ico ${v.cls}">${icon(v.icon, 20, 2.1)}</span>
    <div class="main"><div class="title">${esc(o.description)}</div><div class="sub">${esc(sub ?? '')} · ${when}</div></div>
    <div class="end"><div class="amount ${o.amount > 0 && o.kind !== 'payment' ? 'in' : ''} ${failed ? 'muted' : ''}">${signed(o.kind === 'payment' ? -Math.abs(o.amount) : o.amount, o.currency)}</div></div>
  </button>`;
}

function bindOps(ops) {
  $('#screen').onclick = (e) => {
    const t = e.target.closest('[data-op],[data-sheet],[data-go],[data-filter]');
    if (!t) return;
    if (t.dataset.op !== undefined) return sheetOperation(ops[Number(t.dataset.op)]);
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.sheet) return openNamedSheet(t.dataset.sheet);
    if (t.dataset.filter) { state.filter = t.dataset.filter; renderHistory(); }
  };
}

function openNamedSheet(name) {
  const map = {
    pay: () => go('pay'), payout: sheetPayout, subs: sheetSubscriptions, docs: sheetDocuments, limits: sheetLimits,
    expected: () => sheetBalanceExplain('expected'), restricted: () => sheetBalanceExplain('restricted'), bonus: () => sheetBalanceExplain('bonus'),
    notifications: sheetNotifications, users: sheetUsers, business: sheetBusiness, markets: sheetMarkets, levels: sheetLevels,
  };
  guard(() => map[name]?.());
}

// --- Pay ----------------------------------------------------------------------------------
async function renderPay() {
  if (isBusiness()) {
    $('#screen').innerHTML = `<h1 class="large-title">Оплата</h1><div class="group glass"><div class="empty">Бизнес-счёт принимает оплату через свой сервис.<br>Чтобы заплатить, выберите покупателя.<br><br><button class="btn" data-sheet="users">Сменить пользователя</button></div></div>`;
    bindOps([]);
    return;
  }
  const p = state.pay;
  const m = market();
  p.currency = m.paymentCurrencies.includes(p.currency) ? p.currency : m.settlementCurrency;
  const executors = state.meta.sandbox.users.filter((u) => u.id !== userId && u.market === m.id);
  if (!executors.some((u) => u.id === p.payeeId)) p.payeeId = executors[0]?.id ?? null;
  if (p.product === 'tasks' && !p.payeeId) p.product = 'food';

  $('#screen').innerHTML = `
    <div><div class="eyebrow">Единая платёжная форма</div><h1 class="large-title">Оплата</h1></div>
    <div class="segmented" role="group" aria-label="Сервис">
      <button data-product="tasks" aria-pressed="${p.product === 'tasks'}" ${executors.length ? '' : 'disabled'}>Parri Tasks</button>
      <button data-product="food" aria-pressed="${p.product === 'food'}">Parri Food</button>
    </div>

    <section class="amount-entry glass">
      <label for="pay-amount">Сумма заказа</label>
      <div class="field"><input id="pay-amount" inputmode="decimal" value="${esc(p.amount)}" aria-label="Сумма"><span class="cur">${m.settlementCurrency}</span></div>
      ${m.paymentCurrencies.length > 1 ? `<div class="seg-wrap"><div class="segmented" role="group" aria-label="Валюта оплаты">
        ${m.paymentCurrencies.map((c) => `<button data-currency="${c}" aria-pressed="${p.currency === c}">Платить в ${c}</button>`).join('')}</div></div>` : ''}
    </section>

    <div class="group glass">
      ${p.product === 'tasks' ? `<div class="field-row"><label for="pay-payee">Исполнитель</label>
        <select id="pay-payee">${executors.map((u) => `<option value="${u.id}" ${u.id === p.payeeId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>` : ''}
      <div class="field-row"><label for="pay-desc">${p.product === 'tasks' ? 'Задача' : 'Заказ'}</label>
        <input id="pay-desc" value="${esc(p.description)}" maxlength="80"></div>
    </div>

    <div id="quote"></div>
    <div class="btn-stack">
      <button class="btn primary" id="pay-go">${icon('lock', 18, 2.2)} <span id="pay-go-label">Оплатить</span></button>
      <p class="hint">${p.product === 'tasks' ? 'Деньги будут в резерве, пока вы не подтвердите выполнение задачи.' : 'Карта вводится на стороне банка-партнёра. Parri видит только статус.'}</p>
    </div>`;

  $('#screen').onclick = (e) => {
    const t = e.target.closest('[data-product],[data-currency],[data-sheet]');
    if (!t) return;
    if (t.dataset.sheet) return openNamedSheet(t.dataset.sheet);
    if (t.dataset.product) { p.product = t.dataset.product; p.description = p.product === 'tasks' ? 'Сборка шкафа' : 'Ужин на двоих'; renderPay(); }
    if (t.dataset.currency) { p.currency = t.dataset.currency; renderPay(); }
  };
  $('#pay-amount').addEventListener('input', (e) => { p.amount = e.target.value; updateQuote(); });
  $('#pay-desc').addEventListener('input', (e) => { p.description = e.target.value; });
  $('#pay-payee')?.addEventListener('change', (e) => { p.payeeId = e.target.value; });
  $('#pay-go').addEventListener('click', submitPayment);
  updateQuote();
}

let quoteTimer;
function updateQuote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(async () => {
    const p = state.pay;
    const amount = toMinor(p.amount);
    const box = $('#quote');
    if (!box) return;
    if (!amount || amount <= 0) { box.innerHTML = ''; $('#pay-go').disabled = true; return; }
    try {
      const q = await api('/api/quote', { method: 'POST', body: { product: p.product, amount, currency: p.currency } });
      const S = q.settlementCurrency;
      const fx = q.payer.currency !== S;
      const rateText = q.payer.rate >= 1 ? `1 ${S} = ${q.payer.rate.toFixed(4)} ${q.payer.currency}` : `1 ${q.payer.currency} = ${(1 / q.payer.rate).toFixed(2)} ${S}`;
      box.innerHTML = `<div class="group glass breakdown">
        <div class="cap">Вы платите</div>
        ${line('Стоимость', money(q.amount, S))}
        ${fx ? line(`По курсу ${rateText}`, money(q.payer.converted, q.payer.currency)) + line('Стоимость конвертации', money(q.payer.fxCost, q.payer.currency)) : ''}
        ${line('К списанию', money(q.payer.total, q.payer.currency), 'total')}
        <div class="cap">${p.product === 'tasks' ? 'Исполнитель получит' : 'Сервис получит'}</div>
        ${line(`Комиссия эквайринга банка · ${q.payee.acquiringFeeBps / 100}%`, `−${money(q.payee.acquiringFee, S)}`)}
        ${line(`Комиссия Parri · ${q.payee.parriFeeBps / 100}%`, `−${money(q.payee.parriFee, S)}`)}
        ${line('Получателю', money(q.payee.net, S), 'total')}
      </div>`;
      $('#pay-go-label').textContent = `Оплатить ${money(q.payer.total, q.payer.currency)}`;
      $('#pay-go').disabled = false;
    } catch (e) {
      box.innerHTML = `<p class="hint" style="color:var(--bad)">${esc(e.message)}</p>`;
      $('#pay-go').disabled = true;
    }
  }, 200);
}
const line = (label, value, cls = '') => `<div class="row plain ${cls}"><div class="main"><div class="title" style="white-space:normal">${esc(label)}</div></div><div class="end amount">${esc(value)}</div></div>`;

async function submitPayment() {
  const p = state.pay;
  const btn = $('#pay-go');
  btn.disabled = true;
  await guard(async () => {
    const order = await api('/api/sandbox/orders', { method: 'POST', body: { product: p.product, payeeId: p.payeeId, amount: toMinor(p.amount), description: p.description || 'Заказ' } });
    const payment = await api(`/api/orders/${order.id}/payments`, { method: 'POST', body: { currency: p.currency }, idempotent: `checkout-${order.id}` });
    await sheetCheckout(payment.confirmationUrl);
  });
  btn.disabled = false;
}

// --- Bank checkout (partner side, sandbox) ----------------------------------------------
async function sheetCheckout(url) {
  const op = await api(`${url}?format=json`);
  openSheet(`
    ${sheetHead('Подтверждение оплаты')}
    <div class="bank glass">
      <div class="who">${icon('bank', 16, 2)} ${esc(op.partner)} · песочница</div>
      <div class="detail-top" style="justify-items:start;text-align:left;padding:0">
        <div class="big">${money(op.amount, op.currency)}</div>
        <div class="eyebrow">${esc(op.description ?? '')}</div>
      </div>
      <div class="card-art"><div class="meta"><span>Тестовая карта</span><span>VISA</span></div>
        <div class="pan">4242 4242 4242 4242</div><div class="meta"><span>PARRI SANDBOX</span><span>12/30</span></div></div>
      ${op.savePaymentMethod ? '<p class="hint" style="text-align:left">Карта сохранится у банка для автопродления подписки.</p>' : ''}
    </div>
    <div class="btn-stack">
      <button class="btn primary" data-outcome="success">${icon('lock', 18, 2.2)} Оплатить</button>
      <button class="btn" data-outcome="decline">Смоделировать отказ банка</button>
      <button class="btn danger" data-outcome="cancel">Отменить</button>
    </div>
    <p class="hint">Это страница банка. Данные карты остаются у банка, Parri получает только подписанное уведомление о статусе.</p>`, (root) => {
    root.addEventListener('click', (e) => {
      const outcome = e.target.closest('[data-outcome]')?.dataset.outcome;
      if (!outcome) return;
      guard(async () => {
        await api(url, { method: 'POST', body: { outcome } });
        closeSheet();
        if (outcome === 'success') toast('Оплата прошла');
        else toast(outcome === 'cancel' ? 'Оплата отменена' : 'Банк отклонил платёж. Можно попробовать снова.', outcome !== 'cancel');
        if (state.tab === 'pay' && outcome === 'success') go('home'); else render();
      });
    });
  });
}

// --- History -------------------------------------------------------------------------------
async function renderHistory() {
  const ops = await api('/api/me/operations');
  const filters = { all: 'Все', payment: 'Оплаты', income: 'Доходы', payout: 'Выплаты' };
  const list = ops.map((o, i) => ({ o, i })).filter(({ o }) => state.filter === 'all' || o.kind === state.filter || (state.filter === 'payment' && o.kind === 'refund'));
  const groups = new Map();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  for (const item of list) {
    const d = new Date(item.o.at);
    const key = d.toDateString() === today ? 'Сегодня' : d.toDateString() === yesterday ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  $('#screen').innerHTML = `
    <h1 class="large-title">История</h1>
    <div class="segmented" role="group" aria-label="Фильтр">${Object.entries(filters).map(([k, v]) => `<button data-filter="${k}" aria-pressed="${state.filter === k}">${v}</button>`).join('')}</div>
    ${list.length ? [...groups].map(([day, items]) => `<section><div class="group-title">${esc(day)}</div>
      <div class="group glass">${items.map(({ o, i }) => opRow(o, i)).join('')}</div></section>`).join('') : emptyOps()}`;
  bindOps(ops);
}

// --- Operation detail -----------------------------------------------------------------------
function sheetOperation(o) {
  const v = opVisual(o);
  const titles = { payment: 'Оплата', income: 'Поступление', refund: 'Возврат', payout: 'Выплата' };
  const statusPills = [];
  if (o.kind === 'payment' || o.kind === 'income') {
    statusPills.push(pill(ORDER_STATUS, o.status));
    if (o.escrow) statusPills.push(pill(RESERVATION, o.reservation));
    if (o.kind === 'income' && o.status === 'completed') statusPills.push(o.settled ? '<span class="pill ok">Доступно</span>' : '<span class="pill warn">Ждёт расчёта банка</span>');
  } else statusPills.push(pill(OP_STATUS, o.status));

  const actions = [];
  if (o.kind === 'payment' && o.status === 'awaiting_payment') {
    actions.push('<button class="btn primary" data-act="pay">Оплатить</button>');
    actions.push('<button class="btn danger" data-act="cancel">Отменить заказ</button>');
  }
  if (o.kind === 'payment' && o.status === 'paid' && o.escrow) actions.push(`<button class="btn primary" data-act="complete">${icon('check', 18, 2.4)} Подтвердить выполнение</button>`);
  if (o.kind === 'income' && ['paid', 'completed'].includes(o.status)) actions.push(`<button class="btn" data-act="refund">${icon('back', 18, 2.2)} Оформить возврат</button>`);

  const rows = [
    infoRow('Тип', titles[o.kind]),
    infoRow('Дата', new Date(o.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })),
  ];
  if (o.orderId) rows.push(infoRow('Заказ', o.orderId));
  if (o.refunded) rows.push(infoRow('Возвращено', money(o.refunded, o.orderCurrency)));
  if (o.kind === 'payment' && o.escrow && o.status === 'paid') rows.push(infoRow('Резерв', 'Исполнитель получит деньги после вашего подтверждения'));

  openSheet(`
    ${sheetHead(titles[o.kind])}
    <div class="detail-top">
      <span class="ico ${v.cls}">${icon(v.icon, 30, 2)}</span>
      <div class="big">${signed(o.kind === 'payment' ? -Math.abs(o.amount) : o.amount, o.currency)}</div>
      <div class="what">${esc(o.description)}</div>
      <div class="pills" style="justify-content:center">${statusPills.join('')}</div>
    </div>
    ${actions.length ? `<div class="btn-stack">${actions.join('')}</div>` : ''}
    <div class="group glass">${rows.join('')}</div>
    ${o.documents?.length ? `<div><div class="group-title">Документы</div><div class="group glass">${o.documents.map(docRow).join('')}</div></div>` : ''}`, (root) => {
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-act],[data-doc]');
      if (!d) return;
      if (d.dataset.doc) { guard(() => sheetDocument(d.dataset.doc)); return; }
      guard(async () => {
        if (d.dataset.act === 'pay') {
          const p = await api(`/api/orders/${o.orderId}/payments`, { method: 'POST', body: {}, idempotent: true });
          return sheetCheckout(p.confirmationUrl);
        }
        if (d.dataset.act === 'refund') return sheetRefund(o);
        if (d.dataset.act === 'cancel') { await api(`/api/orders/${o.orderId}/cancel`, { method: 'POST' }); toast('Заказ отменён'); }
        if (d.dataset.act === 'complete') { await api(`/api/orders/${o.orderId}/complete`, { method: 'POST' }); toast('Готово: исполнитель получит выплату после расчёта банка'); }
        closeSheet();
        return render();
      });
    });
  });
}
const infoRow = (k, v) => `<div class="row plain"><div class="main"><div class="sub">${esc(k)}</div><div class="title" style="white-space:normal;overflow-wrap:anywhere">${esc(v)}</div></div></div>`;
const docRow = (d) => `<button class="row" data-doc="${d.id}"><span class="ico sq">${icon(DOC_ICON[d.type] ?? 'doc', 16, 2.2)}</span><div class="main"><div class="title">${esc(d.title)}</div></div>${chevron}</button>`;

function sheetRefund(o) {
  openSheet(`
    ${sheetHead('Возврат покупателю')}
    <p class="hint" style="text-align:left">${esc(o.description)}. Оставьте поле пустым, чтобы вернуть всю сумму.</p>
    <section class="amount-entry glass">
      <label for="refund-amount">Сумма возврата</label>
      <div class="field"><input id="refund-amount" inputmode="decimal" placeholder="0" aria-label="Сумма возврата"><span class="cur">${o.orderCurrency}</span></div>
    </section>
    <div class="group glass"><div class="field-row"><label for="refund-reason">Причина</label><input id="refund-reason" value="Возврат по запросу" maxlength="120"></div></div>
    <button class="btn primary" id="refund-go">Оформить возврат</button>
    <p class="hint">Пока заказ в резерве, деньги вернутся из резерва. После завершения сумма спишется с вашего баланса, а Parri вернёт вам свою комиссию пропорционально.</p>`, (root) => {
    $('#refund-go', root).addEventListener('click', () => guard(async () => {
      const v = $('#refund-amount', root).value.trim();
      await api(`/api/orders/${o.orderId}/refunds`, { method: 'POST', body: { amount: v ? toMinor(v) : undefined, reason: $('#refund-reason', root).value }, idempotent: true });
      closeSheet();
      toast('Возврат отправлен в банк');
      render();
    }));
  });
}

// --- Payout ---------------------------------------------------------------------------------
async function sheetPayout() {
  const b = await api('/api/me/balance');
  const c = b.balances.find((x) => x.available > 0) ?? b.balances[0];
  const dest = isBusiness() ? `acc_40817810:${c.currency}` : 'card_4242424242424242';
  openSheet(`
    ${sheetHead('Вывод средств')}
    <section class="amount-entry glass">
      <label for="payout-amount">Доступно ${money(c.available, c.currency)}</label>
      <div class="field"><input id="payout-amount" inputmode="decimal" placeholder="0" aria-label="Сумма вывода"><span class="cur">${c.currency}</span></div>
      <div class="seg-wrap"><button class="pill" id="payout-all" style="padding:6px 12px">Вывести всё</button></div>
    </section>
    <div class="group glass"><div class="field-row"><label for="payout-dest">Куда</label><input id="payout-dest" value="${esc(dest)}"></div></div>
    ${b.limits ? `<p class="hint">В этом месяце можно вывести ещё ${money(b.limits.payoutRemaining, b.limits.currency)}. Реквизиты со словом «fail» банк отклонит, и деньги вернутся на баланс.</p>` : ''}
    <button class="btn primary" id="payout-go" ${c.available > 0 ? '' : 'disabled'}>${icon('down', 18, 2.2)} Вывести</button>
    ${c.available > 0 ? '' : '<p class="hint">Пока выводить нечего. Ожидаемые поступления станут доступны после расчёта банка.</p>'}`, (root) => {
    $('#payout-all', root).addEventListener('click', () => { $('#payout-amount', root).value = (c.available / 100).toFixed(2); });
    $('#payout-go', root).addEventListener('click', () => guard(async () => {
      await api('/api/payouts', { method: 'POST', body: { amount: toMinor($('#payout-amount', root).value), destination: $('#payout-dest', root).value }, idempotent: true });
      closeSheet();
      toast('Выплата отправлена в банк');
      render();
    }));
  });
}

// --- Balance explanations -------------------------------------------------------------------
async function sheetBalanceExplain(kind) {
  const b = await api('/api/me/balance');
  const c = b.balances.find((x) => x.currency === cur()) ?? b.balances[0];
  const content = {
    expected: ['Ожидаемые поступления', [
      ['Ждёт расчёта банка', money(c.expected.pendingSettlement, c.currency)],
      ['В резерве по вашим заказам', money(c.expected.reservedForMyOrders, c.currency)],
    ], 'Эти деньги придут к вам, но пока недоступны. Резерв переходит к вам после завершения заказа за вычетом комиссий, затем банк проводит расчёт.'],
    restricted: ['Временно недоступно', [
      ['Резерв по вашим покупкам', money(c.restricted.reservedInMyPurchases, c.currency)],
      ['Выплаты в обработке', money(c.restricted.payoutsInProgress, c.currency)],
    ], 'Ваши деньги, которые сейчас заблокированы: оплаченные заказы ждут подтверждения, выплаты обрабатывает банк.'],
    bonus: ['Бонусы', [['Баланс бонусов', `${(b.bonuses.points / 100).toLocaleString('ru-RU')} баллов`]], `${b.bonuses.note}. Начисляются за заказы в Parri Food.`],
  }[kind];
  openSheet(`${sheetHead(content[0])}<div class="group glass">${content[1].map(([k, v]) => line(k, v)).join('')}</div><p class="hint" style="text-align:left">${esc(content[2])}</p>`);
}

async function sheetLimits() {
  const b = await api('/api/me/balance');
  const l = b.limits;
  const m = market();
  openSheet(`
    ${sheetHead('Лимиты и идентификация')}
    <div class="group glass">
      ${line('Уровень', l.title)}
      ${line('Максимальный платёж', money(l.maxPayment, l.currency))}
      ${line('Выплаты в месяц', money(l.monthlyPayout, l.currency))}
      ${line('Уже выведено', money(l.payoutUsedThisMonth, l.currency))}
      ${line('Осталось', money(l.payoutRemaining, l.currency), 'total')}
    </div>
    <div><div class="group-title">Уровни · ${esc(m.name)}</div><div class="group glass">
      ${Object.entries(m.kyc).map(([k, v]) => `<div class="row"><span class="ico sq" style="background:${k === l.kycLevel ? 'var(--ok)' : 'var(--c-refund)'}">${icon(k === l.kycLevel ? 'check' : 'shield', 16, 2.2)}</span>
        <div class="main"><div class="title">${esc(v.title)}</div><div class="sub" style="white-space:normal">${esc(v.procedure)}</div></div></div>`).join('')}
    </div></div>
    <p class="hint">Процедуры идентификации и лимиты зависят от страны и банка-партнёра.</p>`);
}

// --- Subscriptions, documents, notifications ------------------------------------------------
async function sheetSubscriptions() {
  if (isBusiness()) { openSheet(`${sheetHead('Подписки')}<div class="group glass"><div class="empty">Подписки оформляют покупатели.</div></div>`); return; }
  const subs = await api('/api/me/subscriptions');
  const m = market();
  const plans = state.meta.products.flatMap((p) => Object.entries(p.plans ?? {}).map(([id, plan]) => ({ id, ...plan, product: p.title })));
  const has = (id) => subs.some((s) => s.planId === id && ['active', 'past_due'].includes(s.status) && !s.cancelAtPeriodEnd);
  openSheet(`
    ${sheetHead('Подписки')}
    ${subs.length ? `<div class="group glass">${subs.map((s) => `<div class="row">
      <span class="ico fit">${icon('heart', 20, 2.1)}</span>
      <div class="main"><div class="title">${esc(s.title)}</div><div class="sub">${s.currentPeriodEnd ? `${s.cancelAtPeriodEnd ? 'Действует до' : 'Продление'} ${new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU')}` : 'Оплата не завершена'}</div></div>
      <div class="end">${pill(SUB_STATUS, s.status)}${['active', 'past_due', 'incomplete'].includes(s.status) && !s.cancelAtPeriodEnd ? `<div><button class="link" data-unsub="${s.id}" style="font-size:13px">Отменить</button></div>` : ''}</div></div>`).join('')}</div>` : ''}
    ${plans.map((p) => `<div class="bank glass">
      <div class="who">${icon('heart', 16, 2)} ${esc(p.product)}</div>
      <div><div style="font:700 30px var(--font-round);letter-spacing:-0.02em">${money(p.price[m.id], m.settlementCurrency)}</div><div class="eyebrow">${esc(p.title)} · продление каждые ${p.periodDays} дней</div></div>
      <button class="btn primary" data-plan="${p.id}" ${has(p.id) ? 'disabled' : ''}>${has(p.id) ? 'Подписка оформлена' : 'Оформить'}</button>
    </div>`).join('')}
    <p class="hint">Каждый период оплачивается ровно один раз, даже если списание повторится.</p>`, (root) => {
    root.addEventListener('click', (e) => {
      const plan = e.target.closest('[data-plan]')?.dataset.plan;
      const unsub = e.target.closest('[data-unsub]')?.dataset.unsub;
      if (plan) guard(async () => { const { payment } = await api('/api/subscriptions', { method: 'POST', body: { planId: plan }, idempotent: true }); await sheetCheckout(payment.confirmationUrl); });
      if (unsub) guard(async () => { await api(`/api/subscriptions/${unsub}/cancel`, { method: 'POST' }); toast('Подписка не будет продлена'); await sheetSubscriptions(); render(); });
    });
  });
}

async function sheetDocuments() {
  const docs = await api('/api/me/documents');
  openSheet(`${sheetHead('Документы')}${docs.length ? `<div class="group glass">${docs.map((d) => `<button class="row" data-doc="${d.id}">
    <span class="ico sq">${icon(DOC_ICON[d.type] ?? 'doc', 16, 2.2)}</span>
    <div class="main"><div class="title">${esc(d.title)}</div><div class="sub">${new Date(d.issuedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>${chevron}</button>`).join('')}</div>`
    : '<div class="group glass"><div class="empty">Чеки, акты и подтверждения выплат появятся после первой операции.</div></div>'}`, (root) => {
    root.addEventListener('click', (e) => { const id = e.target.closest('[data-doc]')?.dataset.doc; if (id) guard(() => sheetDocument(id)); });
  });
}

async function sheetDocument(id) {
  const { html } = await api(`/api/documents/${id}?view=html`);
  openSheet(`${sheetHead('Документ')}${html}`);
}

async function sheetNotifications() {
  const list = await api('/api/me/notifications');
  storageSet(`parri.seen.${userId}`, list[0]?.at ?? '');
  updateBell(list);
  openSheet(`${sheetHead('Уведомления')}${list.length ? `<div class="group glass">${list.slice(0, 30).map((n) => `<div class="row">
    <span class="ico sq">${icon('bell', 16, 2.2)}</span>
    <div class="main"><div class="title" style="white-space:normal">${esc(n.text)}</div><div class="sub">${new Date(n.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div></div>`).join('')}</div>`
    : '<div class="group glass"><div class="empty">Новых уведомлений нет</div></div>'}`);
}

async function updateBell(list) {
  const items = list ?? await api('/api/me/notifications').catch(() => []);
  const seen = storageGet(`parri.seen.${userId}`) ?? '';
  $('#bell').innerHTML = icon('bell', 22) + (items[0] && items[0].at > seen ? '<span class="dot"></span>' : '');
}
$('#bell').addEventListener('click', () => guard(sheetNotifications));

// --- More ---------------------------------------------------------------------------------------
function renderMore() {
  const me = state.me;
  const m = market();
  const caps = state.meta.capabilities;
  $('#screen').innerHTML = `
    <h1 class="large-title">Ещё</h1>
    <div class="group glass"><button class="row" data-sheet="users" style="min-height:76px">
      <span class="avatar" style="width:52px;height:52px;font-size:19px">${esc(initials(me.name))}</span>
      <div class="main"><div class="title" style="font-size:18px">${esc(me.name)}</div><div class="sub">${m ? `${esc(m.name)} · ${me.kycLevel === 'verified' ? 'полная идентификация' : 'базовая идентификация'}` : 'Бизнес-счёт'}</div></div>${chevron}
    </button></div>

    <section><div class="group-title">Финансы</div><div class="group glass">
      ${menuRow('subs', 'repeat', 'Подписки', 'var(--c-fit)')}
      ${menuRow('docs', 'doc', 'Документы', 'var(--brand)')}
      ${m ? menuRow('limits', 'lock', 'Лимиты и идентификация', 'var(--c-payout)') : ''}
      ${menuRow('notifications', 'bell', 'Уведомления', 'var(--c-food)')}
    </div></section>

    <section><div class="group-title">Для бизнеса</div><div class="group glass">
      ${menuRow('business', 'chart', 'Кабинет бизнеса и сверка', 'var(--c-tasks)', caps.businessCabinet ? '' : 'Pay Platform')}
    </div></section>

    <section><div class="group-title">Parri Pay</div><div class="group glass">
      ${menuRow('markets', 'globe', 'Страны и банки-партнёры', 'var(--c-fit)')}
      ${menuRow('levels', 'layers', 'Уровни развития', 'var(--c-payout)', state.meta.levels.find((l) => l.id === state.meta.level).title)}
    </div><div class="group-foot">Кредиты, вклады и выпуск карт подключаются только через разрешённую модель.</div></section>

    <section><div class="group-title">Песочница</div><div class="group glass">
      ${sandboxRow('process', 'bolt', 'Обработать операции банков')}
      ${sandboxRow('settle', 'bank', 'Провести расчёт банка')}
      ${sandboxRow('advance', 'calendar', 'Перевести часы на 31 день')}
    </div><div class="group-foot">Банки, карты и курсы тестовые. Сдвиг часов: ${state.meta.sandbox.clockOffsetDays} дн.</div></section>`;
  $('#screen').onclick = (e) => {
    const t = e.target.closest('[data-sheet],[data-sandbox]');
    if (!t) return;
    if (t.dataset.sheet) { openNamedSheet(t.dataset.sheet); return; }
    guard(async () => {
      const action = t.dataset.sandbox;
      const res = await api(`/api/sandbox/${action}`, { method: 'POST', body: action === 'advance' ? { days: 31 } : {} });
      toast(action === 'settle' ? `Расчёт проведён, заказов: ${res.settled.length}` : action === 'advance' ? `Прошёл месяц, продлений: ${res.billed.length}` : 'Операции банков обработаны');
      state.meta = await api('/api/meta');
      renderMore();
    });
  };
}
const menuRow = (sheet, ic, title, color, value = '') => `<button class="row" data-sheet="${sheet}"><span class="ico sq" style="background:${color}">${icon(ic, 17, 2.2)}</span><div class="main"><div class="title">${esc(title)}</div></div>${value ? `<span class="value">${esc(value)}</span>` : ''}${chevron}</button>`;
const sandboxRow = (action, ic, title) => `<button class="row" data-sandbox="${action}"><span class="ico sq" style="background:var(--c-refund)">${icon(ic, 17, 2.2)}</span><div class="main"><div class="title">${esc(title)}</div></div></button>`;
const initials = (name) => name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function sheetUsers() {
  const parties = [
    ...state.meta.sandbox.users.map((u) => ({ id: u.id, name: u.name, sub: `${state.meta.markets.find((m) => m.id === u.market).name} · ${u.kycLevel === 'verified' ? 'полная' : 'базовая'} идентификация` })),
    ...state.meta.sandbox.merchants.map((m) => ({ id: m.id, name: m.name, sub: 'Бизнес-счёт' })),
  ];
  openSheet(`${sheetHead('Пользователь')}<p class="hint" style="text-align:left">Переключайтесь, чтобы увидеть операцию глазами покупателя, исполнителя и бизнеса.</p>
    <div class="group glass">${parties.map((p) => `<button class="row" data-user="${p.id}">
      <span class="avatar" style="width:40px;height:40px">${esc(initials(p.name))}</span>
      <div class="main"><div class="title">${esc(p.name)}</div><div class="sub">${esc(p.sub)}</div></div>
      ${p.id === userId ? `<span style="color:var(--brand)">${icon('check', 20, 2.6)}</span>` : ''}</button>`).join('')}</div>`, (root) => {
    root.addEventListener('click', (e) => {
      const id = e.target.closest('[data-user]')?.dataset.user;
      if (id) guard(async () => { closeSheet(); await selectUser(id); });
    });
  });
}
$('#who').addEventListener('click', () => sheetUsers());

async function sheetBusiness() {
  const caps = state.meta.capabilities;
  if (!caps.businessCabinet) {
    const lvl = state.meta.levels.find((l) => l.id === 'platform');
    openSheet(`${sheetHead('Кабинет бизнеса')}<div class="group glass"><div class="empty">Доступно на уровне ${esc(lvl.title)}.<br>Условие перехода: ${esc(lvl.transition)}.</div></div>`);
    return;
  }
  const keys = Object.entries(state.meta.sandbox.serviceKeys).filter(([, p]) => p !== 'tasks');
  const summaries = await Promise.all(keys.map(([key, product]) => api('/api/business/summary', { apiKey: key }).then((s) => ({ product, s }))));
  const recon = await Promise.all(state.meta.partners.map((p) => api(`/api/business/reconciliation/${p.id}`, { apiKey: 'sk_sandbox_tasks' }).then((r) => ({ p, r }))));
  openSheet(`
    ${sheetHead('Кабинет бизнеса')}
    ${summaries.map(({ product, s }) => {
    const t = s.totals[0];
    const title = state.meta.products.find((p) => p.id === product).title;
    return `<div><div class="group-title">${esc(title)}</div><div class="group glass breakdown">
        ${t ? `${line('Заказы', String(t.orders))}${line('Оборот', money(t.turnover, t.currency))}${line('Комиссия эквайринга', `−${money(t.acquiringFees, t.currency)}`)}${line('Комиссия Parri', `−${money(t.parriFees, t.currency)}`)}${line('Возвраты', `−${money(t.refunds, t.currency)}`)}${line('Чистыми', money(t.net, t.currency), 'total')}`
    : '<div class="empty">Операций пока нет</div>'}</div></div>`;
  }).join('')}
    <div><div class="group-title">Сверка с банками</div><div class="group glass">${recon.map(({ p, r }) => `<div class="row">
      <span class="ico sq" style="background:${r.issues.length ? 'var(--bad)' : 'var(--ok)'}">${icon(r.issues.length ? 'bolt' : 'check', 16, 2.2)}</span>
      <div class="main"><div class="title">${esc(p.title)}</div><div class="sub">У банка ${r.operations} операций, совпало ${r.matched}</div></div>
      <div class="end">${r.issues.length ? `<span class="pill bad">Расхождений: ${r.issues.length}</span>` : '<span class="pill ok">Сходится</span>'}</div></div>`).join('')}</div></div>`);
}

function sheetMarkets() {
  const REG = { lending: 'Кредиты', deposits: 'Вклады', cardIssuing: 'Карты' };
  openSheet(`${sheetHead('Страны и банки')}<p class="hint" style="text-align:left">Интерфейс один, но в каждой стране свой банк-партнёр, валюты и процедуры идентификации.</p>
    ${state.meta.markets.map((m) => {
    const partner = state.meta.partners.find((p) => p.id === m.partner);
    return `<div><div class="group-title">${esc(m.name)}</div><div class="group glass breakdown">
        ${line('Банк-партнёр', partner.title)}${line('Эквайринг', `${partner.acquiringFeeBps / 100}%`)}
        ${line('Валюта расчётов', m.settlementCurrency)}${line('Оплата в', m.paymentCurrencies.join(', '))}
        ${line('Расчёт банка', `${m.settlementDelayDays} дн.`)}
        ${line('Кредиты, вклады, карты', Object.values(m.regulated).some((v) => v.available) ? Object.entries(m.regulated).filter(([, v]) => v.available).map(([k]) => REG[k]).join(', ') : 'Нет разрешённой модели')}
      </div></div>`;
  }).join('')}`);
}

function sheetLevels() {
  openSheet(`${sheetHead('Уровни развития')}${state.meta.levels.map((l) => `<div class="bank glass"${l.active ? ' style="border-color:var(--brand)"' : ''}>
    <div class="who">${icon('layers', 16, 2)} ${l.active ? 'Включён' : l.implemented ? 'Следующий этап' : 'Отдельная программа'}</div>
    <div><div style="font:700 22px var(--font-round)">${esc(l.title)}</div><div class="eyebrow" style="margin-top:4px">${esc(l.summary)}</div></div>
    <div><div class="eyebrow">Условие перехода</div><div style="font-weight:500">${esc(l.transition)}</div></div>
  </div>`).join('')}`);
}

// --- Boot ----------------------------------------------------------------------------------------
const SCREENS = { home: renderHome, pay: renderPay, history: renderHistory, more: renderMore };

async function selectUser(id) {
  userId = id;
  storageSet('parri.user', id);
  state.me = await api('/api/me');
  $('#who').textContent = initials(state.me.name);
  await render();
}

async function boot() {
  state.meta = await api('/api/meta');
  const known = [...state.meta.sandbox.users, ...state.meta.sandbox.merchants].some((p) => p.id === userId);
  await selectUser(known ? userId : 'u_anna');
  const outcome = new URLSearchParams(location.search).get('checkout');
  if (outcome) { history.replaceState(null, '', location.pathname); toast(outcome === 'success' ? 'Оплата прошла' : 'Оплата не завершена', outcome !== 'success'); }
  // Statuses arrive asynchronously from banks; keep read-only screens fresh.
  setInterval(() => {
    if (!document.hidden && !sheetOpen() && (state.tab === 'home' || state.tab === 'history')) render();
  }, 4000);
}

boot().catch((e) => toast(e.message, true));
