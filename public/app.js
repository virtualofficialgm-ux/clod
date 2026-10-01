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
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  finger: '<path d="M8 7.5A5 5 0 0 1 17 11v1.5"/><path d="M5 10a7 7 0 0 1 1.3-3.6"/><path d="M8.5 13v-2a3.5 3.5 0 0 1 7 0v3"/><path d="M12 11v3a6 6 0 0 1-1 3.5"/><path d="M15.5 17.5c-.3 1-.7 2-1.3 2.8"/><path d="M5.2 14.5c.4 1.6.2 3-.4 4.3"/><path d="M9 20.5c.6-.9 1-2 1.2-3"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/>',
  nfc: '<path d="M6 8.5a5 5 0 0 1 0 7M9.5 6a9 9 0 0 1 0 12M13 3.5a13 13 0 0 1 0 17"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
};
const icon = (name, size = 22, stroke = 1.9) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
const chevron = `<span class="chev">${icon('chevron', 18, 2.2)}</span>`;

// --- Labels -------------------------------------------------------------------
const ORDER_STATUS = {
  awaiting_payment: ['Ожидает оплаты', 'warn'], paid: ['Оплачен', 'ok'], completed: ['Завершён', 'ok'],
  canceled: ['Отменён', ''], refunded: ['Возвращён', ''],
};
const OP_STATUS = {
  succeeded: ['Выполнено', 'ok'], processing: ['В обработке', 'warn'], failed: ['Не прошло', 'bad'], canceled: ['Отменено', ''],
  requires_action: ['Ждёт оплаты', 'warn'], awaiting_confirmation: ['Подтвердите на Key', 'warn'],
};
const RESERVATION = { held: ['В резерве', 'warn'], released: ['Резерв снят', 'ok'], returned: ['Резерв возвращён', ''], partially_returned: ['Частичный возврат', 'warn'] };
const SUB_STATUS = { active: ['Активна', 'ok'], incomplete: ['Ждёт оплаты', 'warn'], past_due: ['Просрочена', 'bad'], canceled: ['Отменена', ''] };
const DOC_ICON = { topup_receipt: 'plus', receipt: 'doc', refund_receipt: 'back', act: 'check', income_statement: 'chart', payout_statement: 'bank' };
const pill = (map, key) => (map[key] ? `<span class="pill ${map[key][1]}">${map[key][0]}</span>` : '');

const PRODUCT_ICON = { tasks: 'hammer', food: 'fork', fit: 'heart' };
function opVisual(o) {
  if (o.kind === 'payout') return { cls: 'payout', icon: 'bank' };
  if (o.kind === 'refund') return { cls: 'refund', icon: 'back' };
  if (o.kind === 'income') return { cls: 'income', icon: 'arrowIn' };
  if (o.kind === 'topup') return { cls: 'income', icon: 'plus' };
  if (o.kind === 'transfer') return { cls: 'transfer', icon: o.bank ? 'bank' : null, text: initials(o.counterparty ?? '?') };
  return { cls: o.product ?? 'tasks', icon: PRODUCT_ICON[o.product] ?? 'send' };
}

// --- State & API ----------------------------------------------------------------
const state = {
  meta: null, me: null, tab: 'home', filter: 'all', key: null, payMode: 'transfer', contacts: null, search: '',
  pay: { product: 'tasks', currency: null, amount: '15000', description: 'Сборка шкафа', payeeId: null, source: null },
};
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
  // A fresh body element drops listeners left by the previous sheet.
  const old = $('#sheet-body');
  const body = old.cloneNode(false);
  old.replaceWith(body);
  body.innerHTML = html;
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
  const titles = { home: 'Главная', pay: 'Платежи', key: 'Parri Key', history: 'История', more: 'Профиль' };
  $('#topbar-title').textContent = titles[state.tab];
  await guard(() => SCREENS[state.tab]());
}

// --- Home -----------------------------------------------------------------------------
// Ring chart: segments drawn to scale on one circle.
function ring(size, stroke, segments, total, track = 'var(--fill)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.filter((x) => x.value > 0).map((x) => {
    const len = total > 0 ? (x.value / total) * c : 0;
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${x.color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${Math.max(0, len - (segments.length > 1 ? stroke * 0.6 : 0))} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    offset += len;
    return arc;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>${arcs}</svg>`;
}

function weekStrip(ops) {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const now = new Date();
  const active = new Set(ops.map((o) => new Date(o.at).toDateString()));
  return `<div class="week">${Array.from({ length: 7 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + k);
    const today = k === 6;
    return `<div class="d${today ? ' today' : ''}">${days[d.getDay()]}<span class="c${active.has(d.toDateString()) ? ' has' : ''}">${d.getDate()}</span></div>`;
  }).join('')}</div>`;
}

async function renderHome() {
  const [b, ops, subs] = await Promise.all([
    api('/api/me/balance'), api('/api/me/operations'),
    isBusiness() ? Promise.resolve([]) : api('/api/me/subscriptions'),
    loadKey(),
    isBusiness() ? Promise.resolve(null) : loadContacts(),
  ]);
  const pending = state.key?.confirmations ?? [];
  const c = b.balances.find((x) => x.currency === cur()) ?? b.balances[0];
  const expected = c.expected.pendingSettlement + c.expected.reservedForMyOrders;
  const restricted = c.restricted.reservedInMyPurchases + c.restricted.payoutsInProgress;
  const total = c.available + expected + restricted;
  const [int, dec] = fmt(c.available).split(',');
  const l = b.limits;
  const used = l ? Math.min(100, Math.round((l.payoutUsedThisMonth / l.monthlyPayout) * 100)) : 0;
  const activeSub = subs.find((x) => x.status === 'active' || x.status === 'past_due');
  const people = (state.contacts ?? []).filter((x) => x.match?.sameMarket);
  const stat = (key, label, value, color, ic) => `<button class="stat" data-sheet="${key}">
    <div class="v">${value}</div><div class="k">${label}</div>
    <div class="mini">${ring(46, 5, [{ value: key === 'bonus' ? Number(b.bonuses.points > 0) : (key === 'expected' ? expected : restricted), color }], key === 'bonus' ? 1 : Math.max(total, 1))}<i style="color:${color}">${icon(ic, 16, 2.2)}</i></div></button>`;

  $('#screen').innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">${esc(state.me.name)}${market() ? ` · ${esc(market().name)}` : ' · бизнес-счёт'}</div>
      <h1 class="large-title">Parri Pay</h1>
    </div>
    ${weekStrip(ops)}

    ${pending.map((x) => `<button class="banner glass" data-confirm="${x.id}">
      <span class="ico">${icon('key', 20, 2.1)}</span>
      <div style="flex:1;min-width:0"><div style="font-weight:700">Подтвердите на Parri Key</div><div style="color:var(--muted);font-size:13px">${esc(x.text)}</div></div>${chevron}</button>`).join('')}

    <section class="hero fade-in" aria-label="Баланс">
      <div class="main">
        <div class="hero-amount">${int}<small>${dec !== '00' ? `,${dec}` : ''} ${c.currency}</small></div>
        <div class="hero-label">Доступно · реальные деньги</div>
      </div>
      <div class="ringbox">${ring(96, 10, [
        { value: c.available, color: 'var(--fg)' },
        { value: expected, color: 'var(--c-expected)' },
        { value: restricted, color: 'var(--c-restricted)' },
      ], Math.max(total, 1))}<span class="center">${icon('wallet', 20, 2)}</span></div>
    </section>

    <section class="stats">
      ${stat('expected', 'Ожидается', short(expected), 'var(--c-expected)', 'clock')}
      ${stat('restricted', 'Недоступно', short(restricted), 'var(--c-restricted)', 'lock')}
      ${stat('bonus', 'Бонусы · не деньги', `${(b.bonuses.points / 100).toLocaleString('ru-RU')}`, 'var(--c-bonus)', 'heart')}
    </section>

    <section class="actions">
      ${isBusiness() ? quickAction('docs', 'doc', 'Документы') : quickAction('topup', 'plus', 'Пополнить')}
      ${isBusiness() ? quickAction('payout', 'down', 'Вывести') : quickAction('transfer', 'users', 'Перевести')}
      ${isBusiness() ? quickAction('subs', 'repeat', 'Подписки') : quickAction('pay', 'send', 'Оплатить')}
      ${isBusiness() ? quickAction('more', 'grid', 'Профиль') : quickAction('payout', 'down', 'Вывести')}
    </section>

    ${people.length ? `<section>
      <div class="section-head"><h2>Перевести</h2><button class="link" data-go="pay">Все контакты</button></div>
      <div class="people">${people.map((x) => `<button class="person" data-person="${esc(x.match.userId)}"><span class="pic">${esc(initials(x.name))}<span class="badge">P</span></span><span>${esc(x.name)}</span></button>`).join('')}</div>
    </section>` : ''}

    ${l ? `<section><div class="group glass">
        <button class="row" data-sheet="limits">
          <span class="ico sq">${icon('lock', 17, 2.2)}</span>
          <div class="main"><div class="title">Лимит выплат · ${esc(l.title)}</div>
            <div class="sub">Осталось ${money(l.payoutRemaining, l.currency)}</div>
            <div class="meter"><i style="width:${used}%"></i></div></div>
          ${chevron}
        </button></div></section>` : ''}

    ${activeSub ? `<section><div class="group glass"><button class="row" data-sheet="subs">
      <span class="ico sq fit">${icon('heart', 17, 2.2)}</span>
      <div class="main"><div class="title">${esc(activeSub.title)}</div><div class="sub">${activeSub.status === 'past_due' ? 'Не удалось продлить' : `Следующее списание ${new Date(activeSub.currentPeriodEnd).toLocaleDateString('ru-RU')}`}</div></div>
      <div class="end">${pill(SUB_STATUS, activeSub.status)}</div></button></div></section>` : ''}

    <section>
      <div class="section-head"><h2>Недавние операции</h2>${ops.length ? '<button class="link" data-go="history">Все</button>' : ''}</div>
      ${ops.length ? `<div class="cards">${ops.slice(0, 5).map(opRow).join('')}</div>` : emptyOps()}
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
      : o.kind === 'transfer' ? (o.status === 'succeeded' ? (o.direction === 'in' ? 'Перевод вам' : o.bank ? 'Перевод в банк' : 'Перевод · Parri Pay') : OP_STATUS[o.status]?.[0])
        : OP_STATUS[o.status]?.[0];
  const via = o.kind === 'payment' && o.source === 'balance' ? 'с баланса · ' : '';
  const when = new Date(o.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const failed = ['canceled', 'failed'].includes(o.status);
  return `<button class="row" data-op="${i}">
    <span class="ico ${v.cls}">${v.icon ? icon(v.icon, 20, 2.1) : esc(v.text)}</span>
    <div class="main"><div class="title">${esc(o.description)}</div><div class="sub">${via}${esc(sub ?? '')} · ${when}</div></div>
    <div class="end"><div class="amount ${o.amount > 0 && o.kind !== 'payment' ? 'in' : ''} ${failed ? 'muted' : ''}">${signed(o.kind === 'payment' ? -Math.abs(o.amount) : o.amount, o.currency)}</div></div>
  </button>`;
}

function bindOps(ops) {
  $('#screen').onclick = (e) => {
    const t = e.target.closest('[data-op],[data-sheet],[data-go],[data-filter],[data-confirm],[data-person]');
    if (!t) return;
    if (t.dataset.person) return guard(() => sheetTransferPay(t.dataset.person));
    if (t.dataset.confirm) return guard(() => sheetConfirm(t.dataset.confirm));
    if (t.dataset.op !== undefined) return sheetOperation(ops[Number(t.dataset.op)]);
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.sheet) return openNamedSheet(t.dataset.sheet);
    if (t.dataset.filter) { state.filter = t.dataset.filter; renderHistory(); }
  };
}

function openNamedSheet(name) {
  const map = {
    pay: () => { state.payMode = 'service'; go('pay'); }, transfer: () => { state.payMode = 'transfer'; go('pay'); }, more: () => go('more'),
    payout: sheetPayout, topup: sheetTopup, subs: sheetSubscriptions, docs: sheetDocuments, limits: sheetLimits,
    expected: () => sheetBalanceExplain('expected'), restricted: () => sheetBalanceExplain('restricted'), bonus: () => sheetBalanceExplain('bonus'),
    notifications: sheetNotifications, users: sheetUsers, business: sheetBusiness, markets: sheetMarkets, levels: sheetLevels,
  };
  guard(() => map[name]?.());
}

// --- Pay ----------------------------------------------------------------------------------
async function renderPay() {
  return state.payMode === 'service' ? renderServicePay() : renderTransfers();
}

const payHeader = () => `<h1 class="large-title">Платежи</h1>
  <div class="segmented" role="group" aria-label="Тип платежа">
    <button data-mode="transfer" aria-pressed="${state.payMode === 'transfer'}">Перевод человеку</button>
    <button data-mode="service" aria-pressed="${state.payMode === 'service'}">Оплата услуг</button>
  </div>`;

async function renderServicePay() {
  if (isBusiness()) {
    $('#screen').innerHTML = `<h1 class="large-title">Платежи</h1><div class="group glass"><div class="empty">Бизнес-счёт принимает оплату через свой сервис.<br>Чтобы заплатить, выберите покупателя.<br><br><button class="btn" data-sheet="users">Сменить пользователя</button></div></div>`;
    bindOps([]);
    return;
  }
  const p = state.pay;
  const m = market();
  const [b] = await Promise.all([api('/api/me/balance'), loadKey()]);
  const available = b.balances[0].available;
  p.available = available;
  const key = activeKey();
  // The source chosen with the Key ring is the default in the app too.
  if (p.source === null) p.source = key?.selectedSource === 'balance' && available > 0 ? 'balance' : 'card';
  if (p.source === 'balance') p.currency = m.settlementCurrency;
  p.currency = m.paymentCurrencies.includes(p.currency) ? p.currency : m.settlementCurrency;
  const executors = state.meta.sandbox.users.filter((u) => u.id !== userId && u.market === m.id);
  if (!executors.some((u) => u.id === p.payeeId)) p.payeeId = executors[0]?.id ?? null;
  if (p.product === 'tasks' && !p.payeeId) p.product = 'food';

  $('#screen').innerHTML = `
    ${payHeader()}
    <div class="segmented" role="group" aria-label="Сервис">
      <button data-product="tasks" aria-pressed="${p.product === 'tasks'}" ${executors.length ? '' : 'disabled'}>Parri Tasks</button>
      <button data-product="food" aria-pressed="${p.product === 'food'}">Parri Food</button>
    </div>

    <section class="amount-entry glass">
      <label for="pay-amount">Сумма заказа</label>
      <div class="field"><input id="pay-amount" inputmode="decimal" value="${esc(p.amount)}" aria-label="Сумма"><span class="cur">${m.settlementCurrency}</span></div>
      ${m.paymentCurrencies.length > 1 && p.source === 'card' ? `<div class="seg-wrap"><div class="segmented" role="group" aria-label="Валюта оплаты">
        ${m.paymentCurrencies.map((c) => `<button data-currency="${c}" aria-pressed="${p.currency === c}">Платить в ${c}</button>`).join('')}</div></div>` : ''}
    </section>

    <div><div class="group-title">Источник оплаты${key ? ' · выбирается и кольцом Parri Key' : ''}</div>
    <div class="choice" role="group" aria-label="Источник оплаты" style="grid-template-columns:1fr 1fr">
      <button class="glass" data-source="card" aria-pressed="${p.source === 'card'}">Банковская карта<small>через банк-партнёр</small></button>
      <button class="glass" data-source="balance" aria-pressed="${p.source === 'balance'}">Баланс Parri<small>${money(available, m.settlementCurrency)}</small></button>
    </div></div>

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
    const t = e.target.closest('[data-product],[data-currency],[data-sheet],[data-source],[data-mode]');
    if (!t) return;
    if (t.dataset.mode) { state.payMode = t.dataset.mode; renderPay(); return undefined; }
    if (t.dataset.sheet) return openNamedSheet(t.dataset.sheet);
    if (t.dataset.source) { p.source = t.dataset.source; renderServicePay(); return undefined; }
    if (t.dataset.product) { p.product = t.dataset.product; p.description = p.product === 'tasks' ? 'Сборка шкафа' : 'Ужин на двоих'; renderServicePay(); }
    if (t.dataset.currency) { p.currency = t.dataset.currency; renderServicePay(); }
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
      const q = await api('/api/quote', { method: 'POST', body: { product: p.product, amount, currency: p.currency, source: p.source } });
      const S = q.settlementCurrency;
      const fx = q.payer.currency !== S;
      const rateText = q.payer.rate >= 1 ? `1 ${S} = ${q.payer.rate.toFixed(4)} ${q.payer.currency}` : `1 ${q.payer.currency} = ${(1 / q.payer.rate).toFixed(2)} ${S}`;
      box.innerHTML = `<div class="group glass breakdown">
        <div class="cap">Вы платите</div>
        ${line('Стоимость', money(q.amount, S))}
        ${fx ? line(`По курсу ${rateText}`, money(q.payer.converted, q.payer.currency)) + line('Стоимость конвертации', money(q.payer.fxCost, q.payer.currency)) : ''}
        ${line('К списанию', money(q.payer.total, q.payer.currency), 'total')}
        <div class="cap">${p.product === 'tasks' ? 'Исполнитель получит' : 'Сервис получит'}</div>
        ${p.source === 'balance' ? line('Комиссия эквайринга', 'нет') : line(`Комиссия эквайринга банка · ${q.payee.acquiringFeeBps / 100}%`, `−${money(q.payee.acquiringFee, S)}`)}
        ${line(`Комиссия Parri · ${q.payee.parriFeeBps / 100}%`, `−${money(q.payee.parriFee, S)}`)}
        ${line('Получателю', money(q.payee.net, S), 'total')}
      </div>`;
      if (p.source === 'balance' && amount > p.available) {
        box.insertAdjacentHTML('beforeend', `<p class="hint" style="color:var(--bad);margin-top:10px">На балансе ${money(p.available, S)}. Пополните баланс или выберите карту.</p>`);
        $('#pay-go-label').textContent = 'Недостаточно средств';
        $('#pay-go').disabled = true;
        return;
      }
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
    const payment = await api(`/api/orders/${order.id}/payments`, { method: 'POST', body: { currency: p.currency, source: p.source }, idempotent: `checkout-${order.id}` });
    if (payment.status === 'succeeded') {
      toast('Оплачено с баланса Parri');
      return go('home');
    }
    return sheetCheckout(payment.confirmationUrl);
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
        if (outcome === 'success') toast(op.description === 'Пополнение баланса Parri' ? 'Баланс пополнен' : 'Оплата прошла');
        else toast(outcome === 'cancel' ? 'Оплата отменена' : 'Банк отклонил платёж. Можно попробовать снова.', outcome !== 'cancel');
        if (state.tab === 'pay' && outcome === 'success') go('home'); else render();
      });
    });
  });
}

// --- History -------------------------------------------------------------------------------
async function renderHistory() {
  const ops = await api('/api/me/operations');
  const filters = { all: 'Все', payment: 'Оплаты', transfer: 'Переводы', account: 'Счёт' };
  const groupsOf = { payment: ['payment', 'refund', 'income'], transfer: ['transfer'], account: ['topup', 'payout'] };
  const list = ops.map((o, i) => ({ o, i })).filter(({ o }) => state.filter === 'all' || groupsOf[state.filter]?.includes(o.kind));
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
      <div class="cards">${items.map(({ o, i }) => opRow(o, i)).join('')}</div></section>`).join('') : emptyOps()}`;
  bindOps(ops);
}

// --- Operation detail -----------------------------------------------------------------------
function sheetOperation(o) {
  const v = opVisual(o);
  const titles = { payment: 'Оплата', income: 'Поступление', refund: 'Возврат', payout: 'Выплата', topup: 'Пополнение', transfer: 'Перевод' };
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
  if (o.kind === 'transfer' && o.confirmationId) actions.push(`<button class="btn primary" data-act="confirm">${icon('key', 18, 2.2)} Подтвердить на Parri Key</button>`);
  if (o.kind === 'payout' && o.confirmationId) actions.push(`<button class="btn primary" data-act="confirm">${icon('key', 18, 2.2)} Подтвердить на Parri Key</button>`);
  if (o.kind === 'topup' && o.confirmationUrl) actions.push('<button class="btn primary" data-act="topup-pay">Продолжить оплату</button>');

  const rows = [
    infoRow('Тип', titles[o.kind]),
    infoRow('Дата', new Date(o.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })),
  ];
  if (o.orderId) rows.push(infoRow('Заказ', o.orderId));
  if (o.kind === 'payment') rows.push(infoRow('Источник', o.source === 'balance' ? 'Баланс Parri' : 'Банковская карта'));
  if (o.kind === 'topup') rows.push(infoRow('Комиссия за пополнение', money(o.fee, o.currency)));
  if (o.kind === 'transfer') {
    rows.push(infoRow(o.direction === 'in' ? 'Отправитель' : 'Получатель', o.counterparty));
    rows.push(infoRow('Куда', o.bank ? `${{ phone: 'По номеру телефона', card: 'На карту', account: 'На счёт' }[o.method]} · ${o.destination}` : 'Parri Pay · мгновенно'));
    if (o.bank) rows.push(infoRow('Комиссия', money(o.fee, o.currency)));
    if (o.message) rows.push(infoRow('Сообщение', o.message));
  }
  if (o.refunded) rows.push(infoRow('Возвращено', money(o.refunded, o.orderCurrency)));
  if (o.kind === 'payment' && o.escrow && o.status === 'paid') rows.push(infoRow('Резерв', 'Исполнитель получит деньги после вашего подтверждения'));

  openSheet(`
    ${sheetHead(titles[o.kind])}
    <div class="detail-top">
      <span class="ico ${v.cls}">${v.icon ? icon(v.icon, 30, 2) : esc(v.text)}</span>
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
        if (d.dataset.act === 'confirm') return sheetConfirm(o.confirmationId);
        if (d.dataset.act === 'topup-pay') return sheetCheckout(o.confirmationUrl);
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
      const payout = await api('/api/payouts', { method: 'POST', body: { amount: toMinor($('#payout-amount', root).value), destination: $('#payout-dest', root).value }, idempotent: true });
      if (payout.status === 'awaiting_confirmation') return sheetConfirm(payout.confirmation.id);
      closeSheet();
      toast('Выплата отправлена в банк');
      return render();
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
    <h1 class="large-title">Профиль</h1>
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
$('#who').addEventListener('click', () => go('more'));
$('#fab').addEventListener('click', () => sheetActions());

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

// --- Transfers to people ----------------------------------------------------------------
const METHOD = {
  phone: { title: 'По номеру телефона', icon: 'phone', placeholder: '+374 98 765432', field: 'Телефон' },
  card: { title: 'На карту любого банка', icon: 'card', placeholder: '4242 4242 4242 4242', field: 'Номер карты' },
  account: { title: 'На счёт или IBAN', icon: 'bank', placeholder: 'AM12 3456 7890 1234 5678', field: 'Счёт' },
};

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const normalizePhone = (p) => { const d = String(p).replace(/[^\d+]/g, ''); return d.startsWith('+') ? `+${d.slice(1).replace(/\+/g, '')}` : `+${d}`; };

// The address book stays on the device; only hashes of numbers go to Parri for matching.
async function loadContacts(extra = []) {
  if (state.contacts && !extra.length) return state.contacts;
  const book = [...(state.contacts?.map(({ name, phone }) => ({ name, phone })) ?? await api('/api/sandbox/contacts')), ...extra];
  const withHash = await Promise.all(book.map(async (x) => ({ ...x, hash: await sha256(normalizePhone(x.phone)) })));
  const matches = await api('/api/contacts/match', { method: 'POST', body: { hashes: withHash.map((x) => x.hash) } });
  const byHash = new Map(matches.map((m) => [m.hash, m]));
  const seen = new Set();
  state.contacts = withHash.filter((x) => !seen.has(x.hash) && seen.add(x.hash)).map((x) => ({ ...x, match: byHash.get(x.hash) ?? null }))
    .sort((a, b) => Number(Boolean(b.match)) - Number(Boolean(a.match)) || a.name.localeCompare(b.name, 'ru'));
  return state.contacts;
}

async function renderTransfers() {
  if (isBusiness()) {
    $('#screen').innerHTML = `${payHeader()}<div class="group glass"><div class="empty">Переводы людям доступны личным аккаунтам.</div></div>`;
  } else {
    const contacts = await loadContacts();
    const m = market();
    const q = state.search.trim().toLowerCase();
    const list = contacts.filter((x) => !q || x.name.toLowerCase().includes(q) || x.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§'));
    const withPay = list.filter((x) => x.match);
    const others = list.filter((x) => !x.match);
    const pickerSupported = 'contacts' in navigator && 'select' in navigator.contacts;
    $('#screen').innerHTML = `
      ${payHeader()}
      <label class="search">${icon('search', 20, 2.2)}<input id="t-search" placeholder="Имя или номер телефона" value="${esc(state.search)}" autocomplete="off"></label>

      <section><div class="group-title">С Parri Pay · мгновенно и без комиссии</div>
        ${withPay.length ? `<div class="cards">${withPay.map((x) => contactRow(x)).join('')}</div>` : '<div class="group glass"><div class="empty">Никто из найденных контактов пока не пользуется Parri Pay</div></div>'}
      </section>

      <section><div class="group-title">В любой банк</div><div class="group glass">
        ${m.bankTransfer.methods.map((k) => `<button class="row" data-bank="${k}"><span class="ico">${icon(METHOD[k].icon, 20, 2)}</span>
          <div class="main"><div class="title">${METHOD[k].title}</div><div class="sub">${k === 'phone' ? esc(m.bankTransfer.phoneSystem) : 'через банк-партнёр'} · ${m.bankTransfer.feeBps ? `${m.bankTransfer.feeBps / 100}%, мин. ${money(m.bankTransfer.minFee, m.settlementCurrency)}` : 'без комиссии'}</div></div>${chevron}</button>`).join('')}
      </div></section>

      ${others.length ? `<section><div class="group-title">Контакты без Parri Pay</div><div class="cards">${others.map((x) => contactRow(x)).join('')}</div></section>` : ''}
      ${pickerSupported ? `<button class="btn" id="pick-contacts">${icon('users', 20, 2)} Выбрать из контактов телефона</button>` : ''}
      <p class="hint">Номера сверяются по хешу: ваша адресная книга не загружается в Parri.</p>`;
    const input = $('#t-search');
    input.addEventListener('input', () => { state.search = input.value; clearTimeout(input.t); input.t = setTimeout(() => renderTransfers().then(() => { const el = $('#t-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }), 250); });
    $('#pick-contacts')?.addEventListener('click', () => guard(async () => {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      const extra = picked.flatMap((x) => (x.tel ?? []).map((tel) => ({ name: x.name?.[0] ?? tel, phone: tel })));
      if (extra.length) { await loadContacts(extra); renderTransfers(); }
    }));
  }
  $('#screen').onclick = (e) => {
    const t = e.target.closest('[data-mode],[data-person],[data-bank],[data-contact]');
    if (!t) return;
    if (t.dataset.mode) { state.payMode = t.dataset.mode; renderPay(); return; }
    guard(async () => {
      if (t.dataset.person) return sheetTransferPay(t.dataset.person);
      if (t.dataset.bank) return sheetTransferBank({ method: t.dataset.bank });
      const x = state.contacts.find((c) => c.hash === t.dataset.contact);
      const m = market();
      return sheetTransferBank({ method: m.bankTransfer.methods.includes('phone') ? 'phone' : m.bankTransfer.methods[0], destination: x.phone, recipientName: x.name });
    });
  };
}

function contactRow(x) {
  const pay = x.match;
  const other = pay && !pay.sameMarket;
  return `<button class="row" ${pay && !other ? `data-person="${esc(pay.userId)}"` : `data-contact="${esc(x.hash)}"`}>
    <span class="ico transfer" style="border-radius:50%">${esc(initials(x.name))}</span>
    <div class="main"><div class="title">${esc(x.name)}</div><div class="sub">${esc(x.phone)}</div></div>
    <div class="end">${pay ? (other ? '<span class="pill">Другая страна · в банк</span>' : '<span class="pill ok">Parri Pay</span>') : '<span class="pill">В банк по номеру</span>'}</div></button>`;
}

async function sheetTransferPay(recipientId) {
  const [b] = await Promise.all([api('/api/me/balance'), loadContacts(), loadKey()]);
  const contact = state.contacts.find((x) => x.match?.userId === recipientId);
  const name = contact?.name ?? state.meta.sandbox.users.find((u) => u.id === recipientId)?.name ?? 'Получатель';
  const c = b.balances[0];
  openSheet(`
    ${sheetHead('Перевод')}
    <div class="recipient glass"><span class="pic">${esc(initials(name))}</span>
      <div style="flex:1;min-width:0"><div style="font:700 18px var(--font-round)">${esc(name)}</div><div class="hint" style="text-align:left;padding:0">Parri Pay · мгновенно · без комиссии</div></div></div>
    <section class="amount-entry glass">
      <label for="tr-amount">Сумма</label>
      <div class="field"><input id="tr-amount" inputmode="decimal" placeholder="0" aria-label="Сумма перевода"><span class="cur">${c.currency}</span></div>
      <div class="seg-wrap"><span class="pill">С баланса · ${money(c.available, c.currency)}</span></div>
    </section>
    <div class="group glass"><div class="field-row"><label for="tr-msg">Сообщение</label><input id="tr-msg" placeholder="Необязательно" maxlength="140"></div></div>
    <button class="btn primary" id="tr-go" disabled>Перевести</button>
    ${activeKey() ? '<p class="hint">Перевод нужно будет подтвердить на Parri Key.</p>' : ''}
    ${c.available === 0 ? `<button class="btn" data-topup>${icon('plus', 18, 2.4)} Сначала пополнить баланс</button>` : ''}`, (root) => {
    const input = $('#tr-amount', root);
    const go = $('#tr-go', root);
    input.addEventListener('input', () => {
      const v = toMinor(input.value);
      const ok = v > 0 && v <= c.available;
      go.disabled = !ok;
      go.textContent = v > c.available ? 'Недостаточно средств' : v > 0 ? `Перевести ${money(v, c.currency)}` : 'Перевести';
    });
    root.querySelector('[data-topup]')?.addEventListener('click', () => guard(sheetTopup));
    go.addEventListener('click', () => guard(async () => {
      go.disabled = true;
      const t = await api('/api/transfers', { method: 'POST', body: { type: 'pay', recipientId, amount: toMinor(input.value), message: $('#tr-msg', root).value }, idempotent: true });
      if (t.status === 'awaiting_confirmation') return sheetConfirm(t.confirmation.id);
      closeSheet();
      toast(`Отправлено: ${money(t.amount, t.currency)} · ${name}`);
      return render();
    }));
    input.focus();
  });
}

async function sheetTransferBank({ method, destination = '', recipientName = '' }) {
  const [b] = await Promise.all([api('/api/me/balance'), loadKey()]);
  const c = b.balances[0];
  const m = market();
  let current = method;
  const draw = () => {
    const meta = METHOD[current];
    openSheet(`
      ${sheetHead('Перевод в другой банк')}
      <div class="segmented" role="group" aria-label="Способ">${m.bankTransfer.methods.map((k) => `<button data-method="${k}" aria-pressed="${k === current}">${{ phone: 'Телефон', card: 'Карта', account: 'Счёт' }[k]}</button>`).join('')}</div>
      <div class="group glass">
        <div class="field-row"><label for="bt-dest">${meta.field}</label><input id="bt-dest" value="${esc(destination)}" placeholder="${meta.placeholder}" inputmode="${current === 'account' ? 'text' : 'tel'}"></div>
        <div class="field-row"><label for="bt-name">Получатель</label><input id="bt-name" value="${esc(recipientName)}" placeholder="Имя и фамилия"></div>
        <div class="field-row"><label for="bt-msg">Сообщение</label><input id="bt-msg" placeholder="Необязательно" maxlength="140"></div>
      </div>
      <section class="amount-entry glass">
        <label for="bt-amount">Сумма · с баланса ${money(c.available, c.currency)}</label>
        <div class="field"><input id="bt-amount" inputmode="decimal" placeholder="0" aria-label="Сумма перевода"><span class="cur">${c.currency}</span></div>
      </section>
      <div id="bt-quote"></div>
      <button class="btn primary" id="bt-go" disabled>Перевести</button>
      <p class="hint">${current === 'phone' ? `Через ${esc(m.bankTransfer.phoneSystem)} — получатель увидит перевод в своём банке.` : 'Перевод отправит банк-партнёр Parri. Реквизиты проверяет банк получателя.'}</p>`, (root) => {
      const amount = $('#bt-amount', root);
      const go = $('#bt-go', root);
      let timer;
      const update = () => {
        destination = $('#bt-dest', root).value; recipientName = $('#bt-name', root).value;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const v = toMinor(amount.value);
          if (!v || v <= 0) { $('#bt-quote', root).innerHTML = ''; go.disabled = true; return; }
          const q = await api('/api/transfers/quote', { method: 'POST', body: { type: 'bank', amount: v, method: current } });
          $('#bt-quote', root).innerHTML = `<div class="group glass breakdown">
            ${line('Получатель получит', money(q.amount, q.currency))}
            ${line(`Комиссия за перевод в другой банк${q.feeBps ? ` · ${q.feeBps / 100}%, мин. ${money(q.minFee, q.currency)}` : ''}`, q.fee ? money(q.fee, q.currency) : 'без комиссии')}
            ${line('Спишем с баланса', money(q.total, q.currency), 'total')}
            ${line('Срок', q.arrival)}</div>`;
          const enough = q.total <= c.available;
          go.disabled = !enough || !destination.trim() || !recipientName.trim();
          go.textContent = enough ? `Перевести ${money(q.amount, q.currency)}` : 'Недостаточно средств';
        }, 150);
      };
      root.addEventListener('input', update);
      root.addEventListener('click', (e) => { const k = e.target.closest('[data-method]')?.dataset.method; if (k && k !== current) { current = k; destination = ''; draw(); } });
      go.addEventListener('click', () => guard(async () => {
        go.disabled = true;
        const p = await api('/api/transfers', { method: 'POST', body: { type: 'bank', method: current, destination, recipientName, amount: toMinor(amount.value), message: $('#bt-msg', root).value }, idempotent: true });
        if (p.status === 'awaiting_confirmation') return sheetConfirm(p.confirmation.id);
        closeSheet();
        toast('Перевод отправлен в банк получателя');
        return render();
      }));
      update();
    });
  };
  draw();
}

function sheetActions() {
  const tiles = isBusiness()
    ? [['payout', 'down', 'Вывести'], ['docs', 'doc', 'Документы']]
    : [['transfer', 'users', 'Перевести'], ['pay', 'send', 'Оплатить'], ['topup', 'plus', 'Пополнить'], ['payout', 'down', 'Вывести']];
  openSheet(`${sheetHead('Новая операция')}<div class="tiles">${tiles.map(([k, ic, t]) => `<button class="tile" data-tile="${k}"><span class="ico">${icon(ic, 24, 2)}</span>${t}</button>`).join('')}</div>`, (root) => {
    root.addEventListener('click', (e) => {
      const k = e.target.closest('[data-tile]')?.dataset.tile;
      if (!k) return;
      if (k === 'transfer' || k === 'pay') closeSheet();
      openNamedSheet(k);
    });
  });
}


// --- Top-up ------------------------------------------------------------------------------
async function sheetTopup() {
  if (isBusiness()) { openSheet(`${sheetHead('Пополнение')}<div class="group glass"><div class="empty">Пополнение доступно личным аккаунтам.</div></div>`); return; }
  const b = await api('/api/me/balance');
  const l = b.limits;
  const c = cur();
  openSheet(`
    ${sheetHead('Пополнение баланса')}
    <section class="amount-entry glass">
      <label for="topup-amount">Сумма пополнения</label>
      <div class="field"><input id="topup-amount" inputmode="decimal" value="10000" aria-label="Сумма пополнения"><span class="cur">${c}</span></div>
      <div class="seg-wrap"><div class="pills">${[5000, 10000, 50000].map((v) => `<button class="pill" data-quick="${v}" style="padding:6px 12px">${v.toLocaleString('ru-RU')}</button>`).join('')}</div></div>
    </section>
    <div class="group glass"><div class="row"><span class="ico sq" style="background:var(--c-payout)">${icon('bank', 16, 2.2)}</span>
      <div class="main"><div class="title">Банковская карта</div><div class="sub">Через ${esc(state.meta.partners.find((p) => p.id === market().partner).title)}</div></div></div></div>
    <div id="topup-quote"></div>
    <button class="btn primary" id="topup-go">${icon('plus', 18, 2.4)} <span id="topup-label">Пополнить</span></button>
    <p class="hint">Деньги хранятся на счёте у финансового партнёра. Лимит баланса для уровня «${esc(l.title)}»: можно добавить ещё ${money(l.balanceRemaining, l.currency)}.</p>`, (root) => {
    const input = $('#topup-amount', root);
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const amount = toMinor(input.value);
        if (!amount || amount <= 0) { $('#topup-quote', root).innerHTML = ''; $('#topup-go', root).disabled = true; return; }
        try {
          const q = await api('/api/topups/quote', { method: 'POST', body: { amount } });
          $('#topup-quote', root).innerHTML = `<div class="group glass breakdown">
            ${line('Зачислим на баланс', money(q.amount, q.currency))}
            ${line(`Комиссия за пополнение · ${q.feeBps / 100}%`, q.fee ? money(q.fee, q.currency) : 'без комиссии')}
            ${line('Спишем с карты', money(q.total, q.currency), 'total')}</div>`;
          $('#topup-label', root).textContent = `Пополнить на ${money(q.amount, q.currency)}`;
          $('#topup-go', root).disabled = false;
        } catch (e) { $('#topup-quote', root).innerHTML = `<p class="hint" style="color:var(--bad)">${esc(e.message)}</p>`; }
      }, 150);
    };
    input.addEventListener('input', update);
    root.addEventListener('click', (e) => { const v = e.target.closest('[data-quick]')?.dataset.quick; if (v) { input.value = v; update(); } });
    $('#topup-go', root).addEventListener('click', () => guard(async () => {
      const t = await api('/api/topups', { method: 'POST', body: { amount: toMinor(input.value) }, idempotent: true });
      await sheetCheckout(t.confirmationUrl);
    }));
    update();
  });
}

// --- Parri Key ------------------------------------------------------------------------------
const ui = { ringTurn: 0, einkFlash: false };

async function loadKey() {
  if (isBusiness()) { state.key = null; return null; }
  const k = await api('/api/keys');
  const device = k.devices.find((d) => d.status === 'active') ?? k.devices.find((d) => d.status === 'blocked');
  k.device = device ?? null;
  k.display = device?.status === 'active' ? await api(`/api/keys/${device.id}/display`) : null;
  state.key = k;
  return k;
}
const activeKey = () => (state.key?.device?.status === 'active' ? state.key.device : null);
const modelInfo = (id) => state.key?.models.find((m) => m.id === id);

// The sandbox stands in for the physical key: it signs only when the owner is "present".
async function deviceSign(serial, purpose, message) {
  const res = await api(`/api/sandbox/keys/${serial}/sign`, { method: 'POST', body: { purpose, message, presence: true } });
  return res.signature;
}

function keyArt(model, screen, { small = false, sensorActive = false } = {}) {
  const m = modelInfo(model) ?? { title: model, features: {} };
  const f = m.features;
  const time = screen ? new Date(screen.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  const eink = screen
    ? `<div class="acct">${esc(screen.short)}</div><div class="sum">${screen.amount != null ? esc(money(screen.amount, screen.currency)) : esc(`${screen.address.slice(0, 6)}…${screen.address.slice(-4)}`)}</div><div class="upd">обновлено ${time}</div>`
    : '<div class="acct">PARRI KEY</div><div class="sum">Ключ к миру</div><div class="upd">E-Ink · 0 мВт в покое</div>';
  return `<div class="pkey-stage"><div class="pkey ${model}${small ? ' small' : ''}" role="img" aria-label="${esc(m.title)}">
    <div class="brand-mark">PARRI</div>
    ${f.display ? `<div class="eink${ui.einkFlash ? ' refresh' : ''}">${eink}</div>` : '<div class="chip"></div>'}
    ${f.ring ? `<div class="ring" style="transform:rotate(${ui.ringTurn}deg)"></div>` : ''}
    ${f.biometric ? `<div class="sensor${sensorActive ? ' active' : ''}">${icon('finger', small ? 16 : 22, 1.6)}</div>` : `<div class="button-mark"${sensorActive ? ' style="box-shadow:0 0 0 4px var(--ok)"' : ''}></div>`}
    <div class="model-mark">${esc(m.title)}</div>
  </div></div>`;
}

async function renderKey() {
  if (isBusiness()) {
    $('#screen').innerHTML = `<h1 class="large-title">Parri Key</h1><div class="group glass"><div class="empty">Parri Key привязывается к личному аккаунту.<br><br><button class="btn" data-sheet="users">Сменить пользователя</button></div></div>`;
    bindOps([]);
    return;
  }
  const k = await loadKey();
  const device = k.device;
  const screen = $('#screen');
  if (!device) {
    screen.innerHTML = `
      <div><div class="eyebrow">Флагман Parri · ключ к миру</div><h1 class="large-title">Parri Key</h1></div>
      ${keyArt('signature', null)}
      <p class="hint" style="font-size:15px">Карта-устройство: выбирайте счёт кольцом, смотрите сумму на E-Ink экране и подтверждайте действия отпечатком пальца.</p>
      <button class="btn primary" data-act="link">${icon('nfc', 20, 2)} Привязать Parri Key</button>
      <section><div class="group-title">Версии</div><div class="group glass">${k.models.map((m) => `<div class="row">
        <span class="ico sq" style="background:${m.stage === 'available' ? 'var(--ok)' : 'var(--c-refund)'}">${icon('cpu', 16, 2)}</span>
        <div class="main"><div class="title">${esc(m.title)}</div><div class="sub" style="white-space:normal">${esc(m.summary)}</div>
        <div style="margin-top:6px"><span class="pill ${m.stage === 'available' ? 'ok' : 'warn'}" style="white-space:normal">${esc(m.stageText)}</span></div></div></div>`).join('')}</div>
        <div class="group-foot">Переход между версиями зависит от результатов испытаний и экономики производства.</div></section>
      ${contoursSection()}`;
  } else {
    const disp = k.display;
    const f = device.features;
    const pending = k.confirmations;
    screen.innerHTML = `
      <div><div class="eyebrow">${esc(device.title)} · ${esc(device.serial)}</div><h1 class="large-title">Parri Key</h1></div>
      ${pending.map((c) => `<button class="banner glass" data-confirm="${c.id}"><span class="ico">${icon('finger', 20, 2)}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:600">Подтвердите на ключе</div><div style="color:var(--muted);font-size:13px">${esc(c.text)}</div></div>${chevron}</button>`).join('')}
      ${keyArt(device.model, disp?.screen)}
      ${device.status === 'blocked' ? '<div class="group glass"><div class="empty" style="color:var(--bad)">Ключ заблокирован. Подтверждения с него не принимаются. Отвяжите его и привяжите новый.</div></div>' : f.ring
    ? `<div class="ring-controls">
          <button class="round glass" data-ring="-1" aria-label="Повернуть кольцо влево">${icon('left', 22, 2.4)}</button>
          <div class="label">Повернуть кольцо<br><strong style="color:var(--fg)">${esc(disp.screen.title)}</strong></div>
          <button class="round glass" data-ring="1" aria-label="Повернуть кольцо вправо">${icon('right', 22, 2.4)}</button></div>`
    : `<p class="hint">В ${esc(device.title)} нет кольца и дисплея: выберите счёт ниже и подтвердите ${esc(device.presence)}.</p>`}

      ${disp ? `<section><div class="group-title">Счета на ключе</div><div class="group glass">${disp.sources.map((src) => `<button class="row" data-src="${src.id}">
        <span class="ico" style="background:${src.kind === 'fiat' ? 'var(--brand)' : 'var(--c-payout)'}">${icon(src.kind === 'fiat' ? 'bank' : 'wallet', 19, 2)}</span>
        <div class="main"><div class="title">${esc(src.title)}</div><div class="sub">${esc(src.custody)}</div></div>
        <div class="end">${src.amount != null ? `<div class="amount">${money(src.amount, src.currency)}</div>` : `<div class="mono" style="color:var(--muted)">${esc(src.address.slice(0, 6))}…${esc(src.address.slice(-4))}</div>`}
        ${src.id === disp.screen.sourceId ? `<span class="pill ok">${icon('check', 12, 3)} на экране</span>` : ''}</div></button>`).join('')}</div>
        <div class="group-foot">Фиатный счёт обслуживает банк-партнёр. Цифровыми активами управляете вы: ключ кошелька не покидает Secure Element.</div></section>` : ''}

      <section><div class="group-title">Возможности</div><div class="group glass">
        ${featureRow('finger', 'Подтверждение действий', f.biometric ? 'Отпечаток на сенсоре ключа' : 'Кнопка на ключе', true)}
        ${featureRow('nfc', 'Оплата касанием', modelInfo(device.model).contactlessPayments.available ? 'Доступна' : modelInfo(device.model).contactlessPayments.reason, modelInfo(device.model).contactlessPayments.available)}
        ${featureRow('cpu', 'Статус версии', device.stageText, device.stageText === 'Доступна')}
      </div></section>

      <section><div class="group-title">Безопасность</div><div class="group glass">
        ${infoRow('Платёжный ключ · отпечаток', device.fingerprint)}
        ${infoRow('Ключ кошелька · отпечаток', device.assetsFingerprint)}
      </div><div class="group-foot">Приватные ключи созданы в Secure Element и не передаются Parri. Parri хранит только открытые ключи и проверяет подписи.</div></section>
      ${contoursSection()}
      <div class="btn-stack">
        ${device.status === 'active' ? `<button class="btn danger" data-act="block">${icon('lock', 18, 2.2)} Заблокировать ключ</button>` : ''}
        <button class="btn" data-act="unlink">Отвязать ключ</button>
      </div>`;
  }
  ui.einkFlash = false;
  screen.onclick = (e) => {
    const t = e.target.closest('[data-act],[data-ring],[data-src],[data-confirm],[data-sheet]');
    if (!t) return;
    if (t.dataset.sheet) { openNamedSheet(t.dataset.sheet); return; }
    guard(async () => {
      if (t.dataset.confirm) return sheetConfirm(t.dataset.confirm);
      if (t.dataset.act === 'link') return sheetLink();
      if (t.dataset.ring) return turnRing(Number(t.dataset.ring));
      if (t.dataset.src) {
        if (t.dataset.src === 'assets' && k.display.screen.sourceId === 'assets') return sheetWallet(device);
        if (t.dataset.src === k.display.screen.sourceId) return sheetWallet(device, true);
        return selectSource(t.dataset.src);
      }
      if (t.dataset.act === 'block') { await api(`/api/keys/${device.id}/block`, { method: 'POST' }); toast('Ключ заблокирован'); }
      if (t.dataset.act === 'unlink') { await api(`/api/keys/${device.id}/unlink`, { method: 'POST' }); toast('Ключ отвязан'); }
      return renderKey();
    });
  };
}

const featureRow = (ic, title, sub, ok) => `<div class="row"><span class="ico sq" style="background:${ok ? 'var(--ok)' : 'var(--c-refund)'}">${icon(ic, 16, 2.1)}</span>
  <div class="main"><div class="title">${esc(title)}</div><div class="sub" style="white-space:normal">${esc(sub)}</div></div></div>`;

function contoursSection() {
  return `<section><div class="group-title">Два контура</div><div class="group glass">
    <div class="row"><span class="ico sq" style="background:var(--brand)">${icon('bank', 16, 2.1)}</span><div class="main"><div class="title">Деньги</div>
      <div class="sub" style="white-space:normal">Счёт у финансового партнёра. Страхование зависит от банка, страны, вида счёта и условий программы.</div></div></div>
    <div class="row"><span class="ico sq" style="background:var(--c-payout)">${icon('wallet', 16, 2.1)}</span><div class="main"><div class="title">Цифровые активы</div>
      <div class="sub" style="white-space:normal">Самостоятельное хранение: доступ только с вашего ключа. Страхование фиатных средств на них не распространяется.</div></div></div>
  </div><div class="group-foot">Некастодиальным является только кошелёк и механизм подписи. Банковский счёт остаётся счётом у банка, а при обмене и оплате участвуют посредники.</div></section>`;
}

async function turnRing(direction) {
  const k = state.key;
  const sources = k.display.sources;
  const i = sources.findIndex((x) => x.id === k.display.screen.sourceId);
  const next = sources[(i + direction + sources.length) % sources.length];
  ui.ringTurn += direction * 36;
  await selectSource(next.id);
}

async function selectSource(sourceId) {
  const k = state.key;
  const src = k.display.sources.find((x) => x.id === sourceId);
  const signature = await deviceSign(k.device.serial, 'payment', src.selectMessage);
  k.display = await api(`/api/keys/${k.device.id}/source`, { method: 'POST', body: { sourceId, counter: src.counter, signature } });
  state.pay.source = sourceId === 'balance' ? 'balance' : 'card';
  ui.einkFlash = true;
  await renderKey();
}

function sheetLink() {
  let model = 'signature';
  let session = null;
  const draw = () => {
    const m = modelInfo(model);
    const step = session?.done ? 3 : session ? 2 : 1;
    openSheet(`
      ${sheetHead('Привязка Parri Key')}
      ${keyArt(model, null, { small: true, sensorActive: step === 2 })}
      ${step === 1 ? `<div class="choice" role="group" aria-label="Версия ключа">${state.key.models.map((x) => `<button class="glass" data-model="${x.id}" aria-pressed="${x.id === model}">${esc(x.title.replace('Key ', ''))}<small>${x.stage === 'available' ? 'серийная' : x.stage === 'prototype' ? 'образец' : 'без эмитента'}</small></button>`).join('')}</div>` : ''}
      <div class="steps glass" style="padding:16px;border-radius:var(--radius-l)">
        ${stepRow(1, step, 'Поднесите ключ к телефону', session ? `Подлинность подтверждена · ${esc(session.device.serial)}` : 'Телефон прочитает открытые ключи и подпись производителя по NFC')}
        ${stepRow(2, step, `Подтвердите: ${esc(m.presence)}`, session ? `Отпечаток ключа ${esc(session.device.fingerprint)}` : 'Защищённый чип подпишет одноразовый запрос')}
        ${stepRow(3, step, 'Готово', 'Приватные ключи остаются в ключе')}
      </div>
      ${step === 1 ? `<button class="btn primary" data-step="tap">${icon('nfc', 20, 2)} Поднести к телефону</button>` : ''}
      ${step === 2 ? `<button class="btn primary" data-step="presence">${icon(m.features.biometric ? 'finger' : 'key', 20, 2)} ${m.features.biometric ? 'Приложить палец к сенсору' : 'Нажать кнопку на ключе'}</button>` : ''}
      ${step === 3 ? `<button class="btn primary" data-close>Готово</button>` : ''}
      <p class="hint">Песочница: кнопки изображают действия с устройством в руке.</p>`, (root) => {
      root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-model],[data-step]');
        if (!t) return;
        if (t.dataset.model) { model = t.dataset.model; draw(); return; }
        guard(async () => {
          t.disabled = true;
          if (t.dataset.step === 'tap') {
            const held = await api('/api/sandbox/keys');
            const linked = new Set(state.key.devices.map((d) => d.serial));
            let serial = held.find((h) => h.model === model && !linked.has(h.serial))?.serial;
            if (!serial) serial = (await api('/api/sandbox/keys', { method: 'POST', body: { model } })).serial;
            const identity = await api(`/api/sandbox/keys/${serial}/nfc`);
            session = { ...(await api('/api/keys', { method: 'POST', body: { identity } })), serial };
          } else {
            const signature = await deviceSign(session.serial, 'payment', session.challenge.message);
            await api(`/api/keys/${session.device.id}/activate`, { method: 'POST', body: { signature } });
            session.done = true;
            toast(`${modelInfo(model).title} привязан`);
            if (state.tab === 'key') renderKey();
          }
          draw();
        });
      });
    });
  };
  draw();
}
const stepRow = (n, current, title, sub) => `<div class="step ${n < current ? 'done' : n === current ? 'now' : ''}"><span class="n">${n < current ? icon('check', 14, 3) : n}</span>
  <div><div style="font-weight:600">${title}</div><div class="hint" style="text-align:left;padding:0">${sub}</div></div></div>`;

async function sheetConfirm(confirmationId) {
  await loadKey();
  const conf = state.key?.confirmations.find((c) => c.id === confirmationId);
  if (!conf) { toast('Запрос уже обработан'); return render(); }
  const device = state.key.devices.find((d) => d.id === conf.deviceId);
  const bio = device.features.biometric;
  openSheet(`
    ${sheetHead('Подтверждение на ключе')}
    ${keyArt(device.model, state.key.display?.screen, { small: true, sensorActive: true })}
    <div class="detail-top"><div class="what" style="font-size:20px">${esc(conf.text)}</div>
      <div class="hint">Действие выполнится только после подписи защищённого чипа ключа. Запрос действует до ${new Date(conf.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</div></div>
    <div class="btn-stack">
      <button class="btn primary" data-c="ok">${icon(bio ? 'finger' : 'key', 20, 2)} ${bio ? 'Приложить палец к сенсору' : 'Нажать кнопку на ключе'}</button>
      <button class="btn danger" data-c="no">Отклонить</button>
    </div>`, (root) => {
    root.addEventListener('click', (e) => {
      const c = e.target.closest('[data-c]')?.dataset.c;
      if (!c) return;
      guard(async () => {
        if (c === 'ok') {
          const signature = await deviceSign(device.serial, 'payment', conf.message);
          await api(`/api/keys/confirmations/${conf.id}`, { method: 'POST', body: { signature } });
          toast(conf.type === 'transfer' ? 'Подтверждено ключом. Перевод выполнен' : 'Подтверждено ключом. Деньги отправлены в банк');
        } else {
          await api(`/api/keys/confirmations/${conf.id}`, { method: 'POST', body: { decline: true } });
          toast('Действие отклонено, деньги остались на балансе');
        }
        closeSheet();
        await render();
      });
    });
  });
  return undefined;
}

function sheetWallet(device, fiat = false) {
  if (fiat) {
    openSheet(`${sheetHead('Баланс Parri')}<div class="group glass">${infoRow('Где хранятся деньги', 'Счёт у финансового партнёра на вашем рынке')}${infoRow('Защита', 'Страхование зависит от банка, страны, вида счёта и условий программы')}</div>
      <div class="btn-stack"><button class="btn primary" data-sheet-go="topup">${icon('plus', 18, 2.4)} Пополнить</button></div>`, (root) => {
      root.querySelector('[data-sheet-go]').addEventListener('click', () => guard(sheetTopup));
    });
    return;
  }
  openSheet(`
    ${sheetHead('Цифровой кошелёк')}
    <div class="group glass">${infoRow('Адрес', device.walletAddress)}${infoRow('Хранение', 'Самостоятельное: ключ только в Secure Element вашего Parri Key')}${infoRow('Отпечаток ключа кошелька', device.assetsFingerprint)}</div>
    <div id="own-result"></div>
    <button class="btn primary" id="own-go">${icon('shield', 18, 2.2)} Проверить владение</button>
    <p class="hint">Ключ подпишет одноразовое сообщение ключом кошелька, а Parri сверит подпись с открытым ключом. Сам ключ кошелька Parri не получает. Баланс активов читается из сети, в песочнице сеть не подключена.</p>`, (root) => {
    $('#own-go', root).addEventListener('click', () => guard(async () => {
      const ch = await api(`/api/keys/${device.id}/ownership`, { method: 'POST' });
      const signature = await deviceSign(device.serial, 'assets', ch.message);
      const res = await api(`/api/keys/${device.id}/ownership/verify`, { method: 'POST', body: { signature } });
      $('#own-result', root).innerHTML = `<div class="group glass"><div class="row"><span class="ico sq" style="background:${res.valid ? 'var(--ok)' : 'var(--bad)'}">${icon(res.valid ? 'check' : 'close', 16, 2.6)}</span>
        <div class="main"><div class="title">${res.valid ? 'Вы владеете этим кошельком' : 'Подпись не совпала'}</div><div class="sub">Подписано ключом ${esc(res.keyFingerprint)}</div></div></div></div>`;
    }));
  });
}


// --- Boot ----------------------------------------------------------------------------------------
const SCREENS = { home: renderHome, pay: renderPay, key: renderKey, history: renderHistory, more: renderMore };

async function selectUser(id) {
  userId = id;
  state.pay.source = null;
  state.key = null;
  state.contacts = null;
  state.search = '';
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
    if (!document.hidden && !sheetOpen() && ['home', 'history', 'key'].includes(state.tab)) render();
  }, 4000);
}

boot().catch((e) => toast(e.message, true));
