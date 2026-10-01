/* Parri Travel — release 1 prototype: itinerary + budget, no own booking. */
'use strict';

/* ---------------- Utilities ---------------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('ru-RU');
const rub = (n) => NF.format(Math.round(n)) + ' ₽';
const kRub = (n) => (Math.abs(n) >= 100000 ? NF.format(Math.round(n / 1000)) + ' тыс. ₽' : rub(n));
const kShort = (n) => NF.format(Math.round(n / 1000)) + 'к ₽';
const round100 = (n) => Math.round(n / 100) * 100;
const uid = () => Math.random().toString(36).slice(2, 9);
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toISO(d); };
const todayISO = () => toISO(new Date());
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const DF = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const DFW = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtD = (iso) => DF.format(toDate(iso)).replace('.', '');
const fmtRange = (s, e) => {
  const a = toDate(s), b = toDate(e);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${fmtD(e)}` : `${fmtD(s)} – ${fmtD(e)}`;
};
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

const I = {
  trips: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12.5h18"/>',
  todo: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.4 1.4L7.5 4.8M3.5 12l1.4 1.4 2.6-2.6M3.5 18l1.4 1.4 2.6-2.6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3.5"/><path d="M3 10.5h18M16 15h2"/><path d="M6.5 6l8.5-3 1.6 3"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/>',
  sparkles: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.4L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.6 4.4l1.4-1.9M20 20v-4.5h-4.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  doc: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  compare: '<path d="M4 7h9M17 7h3M4 17h4M12 17h8"/><circle cx="15" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  plane: '<path d="M3 13l7-1.5L13.5 4h2l-1.5 7.5 5-1 1.5-2H22l-1 5-10 2.5-4 4.5H5l2.5-5-4 .5z"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
  fork: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
  bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v2.5M16 18v2.5"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0zM12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3v0"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3M15 7v2"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4"/>',
};
const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
const CAT_ICON = { flights: 'plane', lodging: 'bed', food: 'fork', transport: 'bus', activities: 'ticket', buffer: 'umbrella', other: 'coins' };

/* ---------------- State ---------------- */
const STORE = 'parri-travel-v1';
function seedState() {
  const t = todayISO();
  return {
    tab: 'trips', tripId: null, section: 'route', sheet: null, draft: null, chat: [],
    plan: 'free', planPeriod: 'year',
    providers: { flights: false, hotels: false, checkedAt: null },
    profile: { home: 'Москва', passport: 'RU', interests: ['food', 'museums', 'views'], lowWalking: false, kids: false, diet: 'none' },
    trips: [
      {
        id: 'demo-tyo', dest: 'TYO', start: addDays(t, 44), nights: 7, travelers: 2, budget: 560000, pace: 'normal',
        interests: ['food', 'museums', 'views'], lowWalking: false, kids: false, variant: 'bal', seed: 3,
        docs: { passport: 'done', entry: 'progress', insurance: 'todo', tickets: 'done', stay: 'todo' },
        done: { compare: true, flights: true },
        expenses: [
          { id: uid(), cat: 'flights', amount: 158400, note: 'Билеты Москва — Токио, 2 пассажира', date: addDays(t, -9), src: 'pay' },
          { id: uid(), cat: 'other', amount: 9800, note: 'Визовое агентство, сбор', date: addDays(t, -2), src: 'manual' },
        ],
        payImported: false, example: true,
      },
      {
        id: 'demo-tbs', dest: 'TBS', start: addDays(t, 95), nights: 4, travelers: 1, budget: 85000, pace: 'calm',
        interests: ['food', 'architecture', 'relax'], lowWalking: true, kids: false, variant: 'eco', seed: 1,
        docs: { passport: 'done' }, done: {}, expenses: [], payImported: false, example: true,
      },
    ],
  };
}
let state;
try { state = JSON.parse(localStorage.getItem(STORE)) || seedState(); } catch (e) { state = seedState(); }
state.sheet = null; state.chat = state.chat || []; state.typing = false; state.fab = false; state.confirmReset = false; state.confirmDel = false;
const save = () => {
  try {
    const { sheet, draft, ...rest } = state;
    localStorage.setItem(STORE, JSON.stringify(rest));
  } catch (e) { /* storage blocked: the app keeps working in memory */ }
};
const trip = (id = state.tripId) => state.trips.find((t) => t.id === id);

/* ---------------- Planning engine ---------------- */
function buildItinerary(t, variant = t.variant) {
  const d = DEST[t.dest];
  const v = VARIANTS[variant];
  const perDay = { calm: 2, normal: 3, intense: 4 }[t.pace];
  const rand = rng(t.seed * 7919 + t.dest.charCodeAt(1));
  const excluded = [];
  const pool = d.acts.map((x, i) => ({ ...x, i })).filter((x) => {
    if (t.lowWalking && x.walk >= 3) { excluded.push([x, 'много ходьбы']); return false; }
    if (t.kids && !x.kids) { excluded.push([x, 'не для детей']); return false; }
    return true;
  });
  // Partner status never enters the score: ranking is the same with or without commission.
  pool.forEach((x) => {
    const match = x.tags.filter((g) => t.interests.includes(g)).length;
    x.match = match;
    x.score = match * 3 + rand() * 1.6
      - (x.price > v.priceCap ? 4 : 0)
      - (variant === 'eco' ? x.price / 2500 : 0)
      + (variant === 'comf' && x.price >= 3000 ? 0.8 : 0);
  });
  pool.sort((p, q) => q.score - p.score);

  const used = new Set();
  const days = [];
  const n = t.nights + 1;
  for (let k = 0; k < n; k++) {
    const first = k === 0, last = k === n - 1 && n > 1;
    const items = [];
    let clock = first ? 15 : 10;
    if (first) { items.push({ fixed: true, name: 'Прилёт и заселение', sub: VARIANTS[variant].lodging, time: 12 }); }
    const slots = first || last ? 1 : perDay;
    let lastArea = null;
    for (let s = 0; s < slots; s++) {
      let cand = pool.filter((x) => !used.has(x.i) && (first || last ? x.h <= 3 : true));
      if (items.some((x) => !x.fixed)) cand = cand.filter((x) => x.h < 5);
      if (!cand.length) break;
      let pick = cand[0], near = false;
      if (lastArea) {
        const nb = cand.find((x) => x.area === lastArea && x.score >= cand[0].score - 3.5);
        if (nb) { pick = nb; near = true; }
      }
      used.add(pick.i);
      const why = pick.tags.filter((g) => t.interests.includes(g)).map((g) => INTERESTS.find((x) => x[0] === g)[1].toLowerCase());
      if (near) why.push('рядом с предыдущей точкой');
      if (pick.price === 0) why.push('бесплатно');
      if (t.lowWalking && pick.walk === 1) why.push('мало ходьбы');
      if (t.kids) why.push('подходит детям');
      if (pick.h >= 5) why.push('выезд на день');
      items.push({ ...pick, time: clock, why });
      clock += pick.h + 0.5;
      lastArea = pick.area;
      if (pick.h >= 5) break;
    }
    if (!items.some((x) => !x.fixed)) items.push({ fixed: true, name: 'Свободное время', sub: 'Мест по вашим условиям больше нет — отдых или прогулка', time: clock });
    if (last) items.push({ fixed: true, name: 'Выезд в аэропорт', sub: 'Заложите 3 часа до вылета', time: Math.max(clock, 15) });
    days.push({ date: addDays(t.start, k), items });
  }
  return { days, excluded };
}

function quoteFactor(t, key) {
  let h = 0; for (const c of t.id + key + t.start) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 1 + ((Math.abs(h) % 11) - 4) / 100;
}

function costs(t, variant = t.variant) {
  const d = DEST[t.dest], v = VARIANTS[variant];
  const p = t.travelers, nights = t.nights, days = nights + 1, rooms = Math.ceil(p / 2);
  const prov = state.providers;
  const homeK = state.profile.home === 'Санкт-Петербург' ? 1.06 : 1;
  const it = buildItinerary(t, variant);
  const paid = it.days.flatMap((x) => x.items).filter((x) => !x.fixed);
  const actPer = paid.reduce((s, x) => s + x.price, 0);

  const flightPer = round100(d.flight * v.flightK * homeK * (prov.flights ? quoteFactor(t, 'fl' + variant) : 1));
  const night = round100(d.lodging[variant] * (prov.hotels ? quoteFactor(t, 'ht' + variant) : 1));
  const diet = { veg: ' Учтено вегетарианское меню.', halal: ' Учтена халяльная кухня.', gf: ' Учтено меню без глютена.' }[state.profile.diet] || '';
  const lines = [
    { cat: 'flights', amount: flightPer * p, status: prov.flights ? 'quote' : 'estimate',
      how: [`${p} × ${rub(flightPer)}`, `Из города ${state.profile.home === 'Москва' ? 'Москва' : 'Санкт-Петербург'}: ${d.flightNote}.`, `${v.flight[0].toUpperCase() + v.flight.slice(1)}.`] },
    { cat: 'lodging', amount: night * nights * rooms, status: prov.hotels ? 'quote' : 'estimate',
      how: [`${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')} × ${rooms} ${plural(rooms, 'номер', 'номера', 'номеров')} × ${rub(night)}`, `${v.lodging[0].toUpperCase() + v.lodging.slice(1)}.`] },
    { cat: 'food', amount: d.food[variant] * days * p, status: 'estimate',
      how: [`${days} ${plural(days, 'день', 'дня', 'дней')} × ${p} чел. × ${rub(d.food[variant])}`, `${v.food[0].toUpperCase() + v.food.slice(1)}.${diet}`] },
    { cat: 'transport', amount: d.transport[variant] * days * p, status: 'estimate',
      how: [`${days} ${plural(days, 'день', 'дня', 'дней')} × ${p} чел. × ${rub(d.transport[variant])}`, `${v.transport[0].toUpperCase() + v.transport.slice(1)}. Трансфер из аэропорта входит.`] },
    { cat: 'activities', amount: actPer * p, status: 'estimate',
      how: [`${paid.length} ${plural(paid.length, 'пункт', 'пункта', 'пунктов')} маршрута, ${paid.filter((x) => x.price > 0).length} платных × ${p} чел.`, 'Входные билеты по последним известным ценам.'] },
  ];
  const sub = lines.reduce((s, l) => s + l.amount, 0);
  lines.push({ cat: 'buffer', amount: round100(sub * 0.07), status: 'estimate', how: ['7% от суммы выше', 'Чаевые, сувениры, рост цен до оплаты.'] });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, it };
}

function bestFit(t) {
  const order = ['comf', 'bal', 'eco'];
  for (const k of order) if (costs(t, k).total <= t.budget) return k;
  return 'eco';
}

function actionsFor(t) {
  const d = DEST[t.dest];
  const entry = d.entry[state.profile.passport];
  const list = [
    { id: 'compare', title: 'Сравнить варианты поездки', due: addDays(t.start, -60) },
    { id: 'flights', title: 'Купить билеты у перевозчика', due: addDays(t.start, -45), hint: 'Parri показывает оценку, покупка — на сайте поставщика' },
  ];
  if (!entry) list.push({ id: 'entry', title: 'Проверить правила въезда для вашего паспорта', due: addDays(t.start, -40) });
  else if (entry.need === 'visa') list.push({ id: 'entry', title: 'Подать документы на визу', due: addDays(t.start, -entry.lead) });
  list.push(
    { id: 'stay', title: 'Забронировать жильё', due: addDays(t.start, -30) },
    { id: 'insurance', title: 'Оформить страховку', due: addDays(t.start, -14) },
    { id: 'pay', title: 'Проверить способы оплаты в Key', due: addDays(t.start, -10) },
    { id: 'limit', title: 'Поставить лимит трат в Pay', due: addDays(t.start, -7) },
    { id: 'maps', title: 'Скачать офлайн-карты', due: addDays(t.start, -2) },
  );
  return list.map((x) => ({ ...x, done: !!t.done[x.id] }));
}

const DOC_STATUS = { todo: ['Не начато', 'mute'], progress: ['В процессе', 'warn'], done: ['Готово', 'ok'] };
function docsFor(t) {
  const d = DEST[t.dest];
  const end = addDays(t.start, t.nights);
  const entry = d.entry[state.profile.passport];
  return [
    { id: 'passport', title: 'Загранпаспорт', sub: `Должен действовать минимум до ${DFW.format(toDate(addDays(end, 182)))}` },
    { id: 'entry', title: entry ? entry.title : 'Правила въезда', sub: entry ? entry.text : 'Для вашего гражданства правил в Parri пока нет. Проверьте на сайте консульства.', pill: entry ? (entry.need === 'visa' ? ['Виза', 'warn'] : ['Без визы', 'ok']) : ['Проверить', 'mute'] },
    { id: 'insurance', title: 'Медицинская страховка', sub: d.insurance },
    { id: 'tickets', title: 'Билеты', sub: 'Добавьте номер заказа после покупки у перевозчика' },
    { id: 'stay', title: 'Подтверждение жилья', sub: 'Номер брони от отеля или платформы' },
  ];
}

/* ---------------- Rendering helpers ---------------- */
const artBg = (code) => { const g = DEST[code].grad; return `background: radial-gradient(120% 90% at 85% 0%, ${g[2]} 0%, transparent 60%), linear-gradient(160deg, ${g[0]} 0%, ${g[1]} 100%)`; };
const art = (code) => `<div class="art" style="${artBg(code)}"><span class="code">${code}</span><span class="route"></span></div>`;
const statusBadge = (s) => s === 'quote'
  ? `<span class="badge quote" title="Цена от подключённого поставщика">Цена поставщика</span>`
  : `<span class="badge est" title="Расчёт Parri, не предложение">Оценка</span>`;
const sw = (on, action, extra = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-a="${action}" ${extra}></button>`;
const nav = ({ title, left = '', right = '' }) => `<header class="nav"><div class="nav-left">${left}</div><div class="nav-title">${esc(title)}</div><div class="nav-right">${right}</div></header>`;

const ring = (pct, size, stroke, color, inner = '') => {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  const m = size / 2;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}" transform="rotate(-90 ${m} ${m})"/></svg><span class="ring-in">${inner}</span></span>`;
};
const thumb = (code, size) => `<span class="thumb" style="${artBg(code)};width:${size}px;height:${size}px"><b>${code}</b></span>`;
const daysLeft = (t) => { const n = daysBetween(todayISO(), t.start); return n > 0 ? `через ${n} дн.` : n === 0 ? 'сегодня' : 'прошла'; };
const homeTrip = () => { const L = state.trips.slice().sort((p, q) => p.start.localeCompare(q.start)); return L.find((t) => t.id === state.homeTrip) || L[0]; };

function summaryCards(t, c) {
  const fit = c.total <= t.budget;
  return `<div class="card hero-stat">
      <div class="hero-stat-txt"><div class="mega num">${NF.format(Math.round(Math.abs(t.budget - c.total)))}<small>₽</small></div>
        <div class="hero-lbl">${fit ? 'Запас бюджета' : 'Не хватает до бюджета'}</div>
        <div class="hero-sub">${VARIANTS[t.variant].name}: ${NF.format(c.total)} из ${rub(t.budget)}</div></div>
      ${ring(c.total / t.budget, 96, 10, fit ? 'var(--ink)' : 'var(--red)', ic('wallet'))}
    </div>
    <div class="macro-row">${['flights', 'lodging', 'food'].map((k) => {
      const l = c.lines.find((x) => x.cat === k);
      return `<div class="card macro"><b class="num">${kShort(l.amount)}</b><span>${CATS[k].name}</span>
        ${ring(l.amount / c.total, 66, 7, CATS[k].color, `<span style="color:${CATS[k].color}">${ic(CAT_ICON[k])}</span>`)}</div>`;
    }).join('')}</div>`;
}

function tripRow(t) {
  const d = DEST[t.dest], c = costs(t);
  const get = (k) => c.lines.find((l) => l.cat === k).amount;
  const fit = c.total <= t.budget;
  return `<button class="card log" data-a="open-trip" data-id="${t.id}">
    ${thumb(t.dest, 92)}
    <span class="log-body">
      <span class="log-top"><b>${d.city}</b><span class="time-chip">${fmtRange(t.start, addDays(t.start, t.nights))}</span></span>
      <span class="log-num"><b class="num">${rub(c.total)}</b><span class="pill ${fit ? 'ok' : 'bad'}">${fit ? 'в бюджете' : 'выше'}</span></span>
      <span class="log-macros">${['flights', 'lodging', 'activities'].map((k) => `<span><i style="color:${CATS[k].color}">${ic(CAT_ICON[k])}</i>${kShort(get(k))}</span>`).join('')}</span>
    </span>
  </button>`;
}

/* ---------------- Screens ---------------- */
function screenTrips() {
  const list = state.trips.slice().sort((p, q) => p.start.localeCompare(q.start));
  const sel = homeTrip();
  return `<header class="home-head"><span class="logo"><span class="logo-mark">${ic('plane')}</span>Parri</span><span class="streak">${ic('trips')}<b>${list.length}</b></span></header>
    ${list.length ? `<div class="strip" role="tablist" aria-label="Поездки">${list.map((t) => `<button class="strip-day ${t === sel ? 'on' : ''}" data-a="home-trip" data-id="${t.id}" aria-selected="${t === sel}"><span class="strip-code">${t.dest}</span><span class="strip-circ num">${toDate(t.start).getDate()}</span><span class="strip-m">${fmtD(t.start).split(' ')[1]}</span></button>`).join('')}
      <button class="strip-day add" data-a="new-trip" aria-label="Новая поездка"><span class="strip-code">новая</span><span class="strip-circ">${ic('plus')}</span><span class="strip-m">&nbsp;</span></button></div>
    <div class="section">
      <div class="section-h"><h2>${DEST[sel.dest].city} <span class="h-sub">${daysLeft(sel)}</span></h2><button data-a="open-trip" data-id="${sel.id}">Открыть</button></div>
      ${summaryCards(sel, costs(sel))}
    </div>
    <div class="section"><div class="section-h"><h2>Мои поездки</h2></div>${list.map(tripRow).join('')}</div>`
    : `<div class="card empty">${ic('trips')}<b style="color:var(--label)">Поездок пока нет</b>Расскажите, куда и на сколько хотите поехать, — Parri соберёт маршрут и посчитает бюджет.<button class="btn primary" data-a="new-trip">${ic('plus')} Новая поездка</button></div>`}
    <div class="notice">${ic('shield')}<div><b>Оценка — не бронь.</b> Суммы в Parri — это расчёт по средним ценам или цена подключённого поставщика на момент проверки. Подтверждённой считается только бронь с номером от поставщика. В этой версии Parri не бронирует.</div></div>`;
}

function screenTrip(t) {
  const d = DEST[t.dest];
  const c = costs(t);
  const end = addDays(t.start, t.nights);
  const sec = state.section;
  const body = { route: secRoute, budget: secBudget, docs: secDocs, todo: secTodo }[sec](t, c);
  return `${nav({ title: d.city, left: `<button class="glass-btn" data-a="back" aria-label="Назад">${ic('chevL')}</button>`, right: `<button class="glass-btn" data-a="edit-trip">Изменить</button>` }).replace('class="nav"', 'class="nav on-hero"')}
    <section class="hero" style="${artBg(t.dest)}"><span class="hero-code">${t.dest}</span></section>
    <div class="over">
      <div class="trip-title">
        <span class="time-chip">${fmtRange(t.start, end)} · ${t.nights + 1} ${plural(t.nights + 1, 'день', 'дня', 'дней')}</span>
        <h1>${d.city}</h1>
        <p>${d.country} · ${t.travelers} чел. · ${{ calm: 'спокойный темп', normal: 'обычный темп', intense: 'насыщенный темп' }[t.pace]}</p>
      </div>
      ${summaryCards(t, c)}
      <div class="seg sticky" role="tablist">
        ${[['route', 'Маршрут'], ['budget', 'Бюджет'], ['docs', 'Документы'], ['todo', 'Дела']].map(([k, n]) => `<button role="tab" aria-selected="${sec === k}" class="${sec === k ? 'on' : ''}" data-a="section" data-k="${k}">${n}</button>`).join('')}
      </div>
      ${body}
    </div>`;
}

function secRoute(t, c) {
  const it = c.it;
  const fit = c.total <= t.budget;
  const entry = DEST[t.dest].entry[state.profile.passport];
  const left = daysBetween(todayISO(), t.start);
  const visaWarn = entry && entry.need === 'visa' && left < entry.lead && (t.docs.entry || 'todo') !== 'done'
    ? `<div class="notice">${ic('info')}<div><b>Мало времени на визу.</b> До вылета ${left} ${plural(left, 'день', 'дня', 'дней')}, а на оформление обычно нужно около ${entry.lead}. Подайте документы как можно скорее или перенесите даты.</div></div>` : '';
  return `${visaWarn}<div class="list">
      <button class="row variant-card" data-a="compare">
        <span class="ico" style="background:var(--ink);color:var(--on-tint)">${ic('compare')}</span>
        <span class="grow"><span class="t" style="font-weight:600">Вариант «${VARIANTS[t.variant].name}»</span><span class="s" style="display:block">${fit ? `В бюджете, запас ${rub(t.budget - c.total)}` : `Выше бюджета на ${rub(c.total - t.budget)}`} · сравнить 3 варианта</span></span>
        ${ic('chevR', 'chev')}
      </button>
    </div>
    <div class="chips">${t.interests.map((g) => `<span class="tag">${INTERESTS.find((x) => x[0] === g)[1]}</span>`).join('')}${t.lowWalking ? '<span class="tag">мало ходьбы</span>' : ''}${t.kids ? '<span class="tag">с детьми</span>' : ''}</div>
    ${it.days.map((day, k) => {
      const sum = day.items.filter((x) => !x.fixed).reduce((s, x) => s + x.price, 0) * t.travelers;
      return `<article class="day">
        <div class="day-h"><b>День ${k + 1}</b><span>${DFW.format(toDate(day.date))}${sum ? ' · ' + rub(sum) : ''}</span></div>
        ${day.items.map((x) => `<div class="stop ${x.fixed ? 'fixed' : ''}">
          <span class="time">${hhmm(x.time)}</span><span class="rail"><span class="dot"></span></span>
          <div class="body">
            <span class="name">${esc(x.name)}</span>
            ${x.fixed ? `<span class="sub">${esc(x.sub || '')}</span>` : `<span class="sub">${esc(x.area)} · ${x.h} ч · ${x.price ? rub(x.price) + ' / чел.' : 'бесплатно'} ${x.price ? statusBadge('estimate') : ''} ${x.partner ? '<span class="badge partner" title="Parri получит вознаграждение, если вы купите билет по ссылке">Партнёр</span>' : ''}</span>
            ${x.why.length ? `<span class="why">${x.why.map((w) => `<span class="tag">${esc(w)}</span>`).join('')}</span>` : ''}`}
          </div>
        </div>`).join('')}
      </article>`;
    }).join('')}
    ${it.excluded.length ? `<p class="foot">Не вошли из-за ваших ограничений: ${it.excluded.map(([x, r]) => `${esc(x.name)} (${r})`).join(', ')}.</p>` : ''}
    <button class="btn block" data-a="rebuild">${ic('refresh')} Собрать другой маршрут</button>
    <p class="foot">Пометка «Партнёр» значит, что Parri получит вознаграждение, если вы купите билет по ссылке. На порядок мест в маршруте это не влияет: он строится по вашим интересам, ограничениям и бюджету.</p>`;
}

function secBudget(t, c) {
  const fit = c.total <= t.budget;
  const spent = t.expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  t.expenses.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const max = Math.max(c.total, t.budget);
  return `<div class="card pad stack">
      <div class="kv"><span>Оценка «${VARIANTS[t.variant].name}»</span><b>${rub(c.total)}</b></div>
      <div class="bar" style="height:12px;border-radius:6px">${c.lines.map((l) => `<i style="width:${(l.amount / max) * 100}%;background:${CATS[l.cat].color}"></i>`).join('')}</div>
      <div class="legend">${c.lines.map((l) => `<span><i style="background:${CATS[l.cat].color}"></i>${CATS[l.cat].name}</span>`).join('')}</div>
      <div class="kv"><span>Бюджет</span><b>${rub(t.budget)}</b></div>
      <div class="kv"><span>${fit ? 'Запас' : 'Не хватает'}</span><b style="color:${fit ? 'var(--green)' : 'var(--red)'}">${rub(Math.abs(t.budget - c.total))}</b></div>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Из чего складывается</span><button data-a="compare">Сравнить</button></div>
      <div class="list">
        ${c.lines.map((l) => `<details class="line"><summary>
          <span class="ico" style="background:${CATS[l.cat].color}">${ic(CAT_ICON[l.cat])}</span>
          <span class="grow"><span class="t">${CATS[l.cat].name}</span><span class="s" style="display:flex;gap:6px;align-items:center">${statusBadge(l.status)} ${Math.round((l.amount / c.total) * 100)}%</span></span>
          <span class="v">${rub(l.amount)}</span>${ic('chevR', 'chev')}
        </summary><div class="how">${l.how.map((h, i) => `<span${i === 0 ? ' class="num" style="color:var(--label)"' : ''}>${esc(h)}</span>`).join('')}${l.status === 'quote' ? `<span>Получено от поставщика (демо) в ${state.providers.checkedAt || '—'}. Может измениться до оплаты.</span>` : ''}</div></details>`).join('')}
      </div>
      <p class="foot">«Оценка» — расчёт Parri по средним ценам. «Цена поставщика» — предложение подключённого поставщика на момент проверки. Ни то ни другое не бронь.</p>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Расходы · Pay</span><button data-a="add-expense">Добавить</button></div>
      <div class="card pad stack">
        <div class="kv"><span>Потрачено</span><b>${rub(spent)} из ${rub(c.total)}</b></div>
        ${Object.keys(CATS).filter((k) => byCat[k] || c.lines.find((l) => l.cat === k)).map((k) => {
          const plan = (c.lines.find((l) => l.cat === k) || {}).amount || 0;
          const s = byCat[k] || 0;
          const over = plan && s > plan;
          return `<div style="display:grid;gap:6px"><div class="kv" style="font-size:14px"><span>${CATS[k].name}</span><b style="${over ? 'color:var(--red)' : ''}">${rub(s)}${plan ? ` <span style="color:var(--label-2);font-weight:400">/ ${rub(plan)}</span>` : ''}</b></div>
            <div class="bar"><i style="width:${plan ? Math.min(100, (s / plan) * 100) : s ? 100 : 0}%;background:${over ? 'var(--red)' : CATS[k].color}"></i></div></div>`;
        }).join('')}
      </div>
      ${t.expenses.length ? `<div class="list">${t.expenses.slice().sort((p, q) => q.date.localeCompare(p.date)).map((e) => `<div class="row" style="--inset:60px">
        <span class="ico" style="background:${CATS[e.cat].color}">${ic(CAT_ICON[e.cat])}</span>
        <span class="grow"><span class="t" style="font-size:16px">${esc(e.note || CATS[e.cat].name)}</span><span class="s" style="display:block">${fmtD(e.date)} · ${e.src === 'pay' ? 'из Pay' : 'вручную'}</span></span>
        <span class="v" style="color:var(--label)">${rub(e.amount)}</span>
        <button class="glass-btn" style="height:32px;min-width:32px;padding:0;box-shadow:none;background:var(--fill)" data-a="del-expense" data-id="${e.id}" aria-label="Удалить расход">${ic('close')}</button>
      </div>`).join('')}</div>` : ''}
      <button class="btn block" data-a="import-pay" ${t.payImported ? 'disabled style="opacity:.5"' : ''}>${ic('card')} ${t.payImported ? 'Операции из Pay загружены' : 'Подтянуть операции из Pay'}</button>
      <p class="foot">Pay присылает операции, которые вы пометили этой поездкой. В прототипе загружаются демо-операции.</p>
    </div>`;
}

function secDocs(t) {
  const docs = docsFor(t);
  const ready = docs.filter((x) => (t.docs[x.id] || 'todo') === 'done').length;
  return `<div class="card pad stack">
      <div class="kv"><span>Готово документов</span><b>${ready} из ${docs.length}</b></div>
      <div class="bar"><i style="width:${(ready / docs.length) * 100}%;background:var(--green)"></i></div>
    </div>
    <div class="list">
      ${docs.map((x) => {
        const st = t.docs[x.id] || 'todo';
        return `<button class="row tap" style="--inset:60px;align-items:flex-start" data-a="doc" data-id="${x.id}">
          <span class="ico" style="background:${st === 'done' ? 'var(--green)' : st === 'progress' ? 'var(--orange)' : 'var(--c-buffer)'}">${ic(st === 'done' ? 'check' : 'doc')}</span>
          <span class="grow"><span class="t" style="font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(x.title)}${x.pill ? `<span class="pill ${x.pill[1]}">${x.pill[0]}</span>` : ''}</span><span class="s" style="display:block">${esc(x.sub)}</span></span>
          <span class="pill ${DOC_STATUS[st][1]}">${DOC_STATUS[st][0]}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="foot">Нажмите на документ, чтобы сменить статус. Правила въезда — справка для паспорта ${state.profile.passport === 'RU' ? 'РФ' : 'вашей страны'}, не юридическая консультация. Сверьте их на сайте консульства перед поездкой.</p>`;
}

function secTodo(t) {
  const acts = actionsFor(t);
  const today = todayISO();
  return `<div class="list">
      ${acts.map((x) => {
        const late = !x.done && x.due < today;
        return `<button class="row tap" style="--inset:54px" data-a="toggle-todo" data-trip="${t.id}" data-id="${x.id}">
          <span class="check ${x.done ? 'on' : ''}">${ic('check')}</span>
          <span class="grow"><span class="t" style="${x.done ? 'color:var(--label-2);text-decoration:line-through' : ''}">${esc(x.title)}</span>${x.hint ? `<span class="s" style="display:block">${esc(x.hint)}</span>` : ''}</span>
          <span class="v" style="${late ? 'color:var(--red)' : ''}">до ${fmtD(x.due)}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="foot">Сроки рассчитаны от даты вылета. Для визы срок берётся из правил страны.</p>`;
}

function screenTodo() {
  const today = todayISO();
  const all = state.trips.flatMap((t) => actionsFor(t).filter((x) => !x.done).map((x) => ({ ...x, t })));
  all.sort((p, q) => p.due.localeCompare(q.due));
  const groups = [
    ['Просрочено', all.filter((x) => x.due < today)],
    ['Ближайшие 2 недели', all.filter((x) => x.due >= today && x.due <= addDays(today, 14))],
    ['Позже', all.filter((x) => x.due > addDays(today, 14))],
  ].filter((g) => g[1].length);
  const doneN = state.trips.reduce((s, t) => s + actionsFor(t).filter((x) => x.done).length, 0);
  return `${nav({ title: 'Дела' })}
    <h1 class="large-title">Дела</h1>
    <p class="subhead">${all.length} ${plural(all.length, 'дело', 'дела', 'дел')} по всем поездкам · ${doneN} готово</p>
    ${groups.length ? groups.map(([name, items]) => `<div class="section">
      <div class="section-h"><span class="cap" style="${name === 'Просрочено' ? 'color:var(--red)' : ''}">${name}</span></div>
      <div class="list">${items.map((x) => `<button class="row tap" style="--inset:54px" data-a="toggle-todo" data-trip="${x.t.id}" data-id="${x.id}">
        <span class="check">${ic('check')}</span>
        <span class="grow"><span class="t">${esc(x.title)}</span><span class="s" style="display:block">${DEST[x.t.dest].city} · до ${fmtD(x.due)}</span></span>
      </button>`).join('')}</div></div>`).join('') : `<div class="card empty">${ic('check')}<b style="color:var(--label)">Всё сделано</b>Новые дела появятся, когда вы добавите поездку.</div>`}`;
}

function screenWallet() {
  const spent = state.trips.reduce((s, t) => s + t.expenses.reduce((x, e) => x + e.amount, 0), 0);
  const planned = state.trips.reduce((s, t) => s + costs(t).total, 0);
  const dests = [...new Set(state.trips.map((t) => t.dest))];
  const sel = dests.includes(state.walletDest) ? state.walletDest : dests[0];
  const d = sel && DEST[sel];
  return `${nav({ title: 'Кошелёк' })}
    <h1 class="large-title">Кошелёк</h1>
    <div class="pay-card">
      <div class="brand">Pay <span>траты на поездки</span></div>
      <div><small>Потрачено</small><div class="big-num">${rub(spent)}</div><small>из запланированных ${rub(planned)}</small></div>
      <div class="bar"><i style="width:${planned ? Math.min(100, (spent / planned) * 100) : 0}%"></i></div>
      <div style="display:grid;gap:8px;position:relative;z-index:1">${state.trips.map((t) => {
        const s = t.expenses.reduce((x, e) => x + e.amount, 0);
        return `<div class="kv" style="color:rgba(255,255,255,.8)"><span>${DEST[t.dest].city}</span><b style="color:#fff">${rub(s)}</b></div>`;
      }).join('')}</div>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Key · чем платить на месте</span></div>
      ${dests.length > 1 ? `<div class="seg">${dests.map((k) => `<button class="${k === sel ? 'on' : ''}" data-a="wallet-dest" data-k="${k}">${DEST[k].city}</button>`).join('')}</div>` : ''}
      ${d ? `<div class="list">${d.pay.map(([name, st, note]) => `<div class="row" style="align-items:flex-start;--inset:40px">
        <span class="status-dot" style="background:${PAY_STATUS[st][2]};margin-top:6px"></span>
        <span class="grow"><span class="t">${esc(name)}</span><span class="s" style="display:block">${esc(note)}</span></span><span class="pill ${PAY_STATUS[st][1]}">${PAY_STATUS[st][0]}</span>
      </div>`).join('')}</div>
      <p class="foot">Валюта: ${d.cur} (${d.curName}). Статусы — демо-данные. В релизе они приходят из Key для вашего направления и обновляются перед поездкой.</p>` : '<div class="card empty">Добавьте поездку, чтобы увидеть способы оплаты.</div>'}
    </div>`;
}

function screenProfile() {
  const p = state.profile;
  const plus = state.plan === 'plus';
  return `${nav({ title: 'Профиль' })}
    <h1 class="large-title">Профиль</h1>
    <div class="plan">
      <div class="kv" style="align-items:center"><h3>Parri ${plus ? 'Plus' : 'Free'}</h3>${plus ? '<span class="pill ok">Активна · демо</span>' : '<span class="pill mute">Текущий план</span>'}</div>
      <ul>
        <li>${ic('check')}<span>Free: до 3 поездок, маршрут, бюджет, сравнение вариантов, документы</span></li>
        <li>${ic('check')}<span>Plus: без лимита поездок, автозагрузка трат из Pay, напоминания о сроках, совместное планирование</span></li>
      </ul>
      ${plus ? `<button class="btn block" data-a="plan-free">Вернуться на Free</button>` : `<div class="price-row">
        <button class="${state.planPeriod === 'month' ? 'on' : ''}" data-a="period" data-k="month"><b>349 ₽</b><span>в месяц</span></button>
        <button class="${state.planPeriod === 'year' ? 'on' : ''}" data-a="period" data-k="year"><b>2 990 ₽</b><span>в год · −29%</span></button>
      </div><button class="btn primary block" data-a="plan-plus">Попробовать Plus</button>`}
      <p class="foot" style="padding:0">Прототип: оплата не списывается.</p>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Интересы для новых поездок</span></div>
      <div class="chips">${INTERESTS.map(([k, n]) => `<button class="chip ${p.interests.includes(k) ? 'on' : ''}" data-a="p-interest" data-k="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Ограничения</span></div>
      <div class="list">
        <div class="row"><span class="grow"><span class="t">Меньше ходьбы</span></span>${sw(p.lowWalking, 'p-toggle', 'data-k="lowWalking"')}</div>
        <div class="row"><span class="grow"><span class="t">Путешествую с детьми</span></span>${sw(p.kids, 'p-toggle', 'data-k="kids"')}</div>
        <label class="row"><span class="grow t">Питание</span>
          <select id="p-diet" class="inline-input" data-f="diet" style="width:auto">${[['none', 'Без ограничений'], ['veg', 'Вегетарианское'], ['halal', 'Халяль'], ['gf', 'Без глютена']].map(([k, n]) => `<option value="${k}" ${p.diet === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="row"><span class="grow t">Паспорт</span>
          <select id="p-passport" class="inline-input" data-f="passport" style="width:auto"><option value="RU" ${p.passport === 'RU' ? 'selected' : ''}>Россия</option><option value="OTHER" ${p.passport !== 'RU' ? 'selected' : ''}>Другая страна</option></select></label>
        <label class="row"><span class="grow t">Город вылета</span>
          <select id="p-home" class="inline-input" data-f="home" style="width:auto">${['Москва', 'Санкт-Петербург'].map((c) => `<option ${p.home === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Поставщики цен</span></div>
      <div class="list">
        <div class="row" style="--inset:60px"><span class="ico" style="background:var(--c-flights)">${ic('plane')}</span><span class="grow"><span class="t">Авиабилеты</span><span class="s" style="display:block">${state.providers.flights ? 'Подключено (демо) · ' + state.providers.checkedAt : 'Не подключено — показываем оценку'}</span></span>${sw(state.providers.flights, 'provider', 'data-k="flights"')}</div>
        <div class="row" style="--inset:60px"><span class="ico" style="background:var(--c-lodging)">${ic('bed')}</span><span class="grow"><span class="t">Отели</span><span class="s" style="display:block">${state.providers.hotels ? 'Подключено (демо) · ' + state.providers.checkedAt : 'Не подключено — показываем оценку'}</span></span>${sw(state.providers.hotels, 'provider', 'data-k="hotels"')}</div>
      </div>
      <p class="foot">С подключённым поставщиком Parri показывает его цену и время проверки. Цена может измениться до оплаты. Покупка и бронь — на стороне поставщика.</p>
    </div>
    <div class="section">
      <div class="section-h"><span class="cap">Как Parri зарабатывает</span></div>
      <div class="notice">${ic('coins')}<div><b>Подписка Plus и партнёрское вознаграждение.</b> Если вы покупаете билет или экскурсию по ссылке с пометкой «Партнёр», поставщик платит Parri комиссию. Цена для вас не меняется, а маршрут строится без учёта комиссии.</div></div>
    </div>
    ${state.confirmReset ? `<div class="card pad stack"><span>Удалить свои поездки и вернуть примеры?</span><div class="btn-row"><button class="btn" data-a="reset-cancel">Отмена</button><button class="btn danger" data-a="reset-yes">Сбросить</button></div></div>` : `<button class="btn block danger" data-a="reset">Сбросить данные прототипа</button>`}`;
}

/* ---------------- Sheets ---------------- */
function sheetNewTrip() {
  const d = state.draft;
  const free = state.plan === 'free' && !d.editId && state.trips.length >= 3;
  return {
    title: d.editId ? 'Изменить поездку' : 'Новая поездка',
    left: `<button class="glass-btn" data-a="close">Отмена</button>`,
    body: `${free ? `<div class="notice">${ic('info')}<div><b>В Free — до 3 поездок.</b> Удалите старую поездку или попробуйте Plus в профиле.</div></div>` : ''}
      <div class="section"><div class="section-h"><span class="cap">Куда</span></div>
        <div class="dest-grid">${Object.values(DEST).map((x) => `<button class="dest ${d.dest === x.code ? 'on' : ''}" style="${artBg(x.code)}" data-a="d-dest" data-k="${x.code}"><span class="code">${x.code}</span><b>${x.city}</b><span>${x.country}</span></button>`).join('')}</div>
        <p class="foot">В первом выпуске — 5 направлений с проверенными данными.</p></div>
      <div class="section"><div class="section-h"><span class="cap">Когда и кто</span></div>
        <div class="list">
          <label class="row"><span class="grow t">Вылет</span><input id="d-start" type="date" class="inline-input" data-d="start" value="${d.start}" min="${todayISO()}"></label>
          <div class="row"><span class="grow"><span class="t">Ночей</span></span><span class="v num" style="color:var(--label)">${d.nights}</span><span class="stepper"><button data-a="d-step" data-k="nights" data-n="-1" aria-label="Меньше">−</button><button data-a="d-step" data-k="nights" data-n="1" aria-label="Больше">+</button></span></div>
          <div class="row"><span class="grow"><span class="t">Путешественников</span></span><span class="v num" style="color:var(--label)">${d.travelers}</span><span class="stepper"><button data-a="d-step" data-k="travelers" data-n="-1" aria-label="Меньше">−</button><button data-a="d-step" data-k="travelers" data-n="1" aria-label="Больше">+</button></span></div>
          <label class="row"><span class="grow t">Бюджет, ₽</span><input id="d-budget" class="inline-input" inputmode="numeric" data-d="budget" value="${NF.format(d.budget)}"></label>
        </div></div>
      <div class="section"><div class="section-h"><span class="cap">Темп</span></div>
        <div class="seg">${[['calm', 'Спокойно'], ['normal', 'Обычно'], ['intense', 'Насыщенно']].map(([k, n]) => `<button class="${d.pace === k ? 'on' : ''}" data-a="d-pace" data-k="${k}">${n}</button>`).join('')}</div>
        <p class="foot">${{ calm: '2 места в день', normal: '3 места в день', intense: '4 места в день' }[d.pace]}, в дни перелётов — одно.</p></div>
      <div class="section"><div class="section-h"><span class="cap">Интересы</span></div>
        <div class="chips">${INTERESTS.map(([k, n]) => `<button class="chip ${d.interests.includes(k) ? 'on' : ''}" data-a="d-interest" data-k="${k}">${n}</button>`).join('')}</div></div>
      <div class="section"><div class="section-h"><span class="cap">Ограничения</span></div>
        <div class="list">
          <div class="row"><span class="grow"><span class="t">Меньше ходьбы</span><span class="s" style="display:block">Без долгих пеших маршрутов и подъёмов</span></span>${sw(d.lowWalking, 'd-toggle', 'data-k="lowWalking"')}</div>
          <div class="row"><span class="grow"><span class="t">С детьми</span><span class="s" style="display:block">Только места, куда пускают детей</span></span>${sw(d.kids, 'd-toggle', 'data-k="kids"')}</div>
        </div></div>
      ${d.editId ? `<button class="btn block danger" data-a="del-trip">Удалить поездку</button>` : ''}`,
    foot: `<button class="btn primary block" data-a="d-submit" ${free || !d.interests.length ? 'disabled style="opacity:.45"' : ''}>${ic('sparkles')} ${d.editId ? 'Пересчитать' : 'Составить план'}</button>`,
  };
}

function sheetCompare() {
  const t = trip(state.cmpTrip) || trip();
  const all = Object.keys(VARIANTS).map((k) => ({ k, c: costs(t, k) }));
  const best = bestFit(t);
  const cur = all.find((x) => x.k === t.variant);
  const explain = all.filter((x) => x.k !== t.variant).map((x) => {
    const diff = x.c.total - cur.c.total;
    const top = x.c.lines.map((l) => ({ cat: l.cat, d: l.amount - cur.c.lines.find((m) => m.cat === l.cat).amount })).sort((p, q) => Math.abs(q.d) - Math.abs(p.d))[0];
    return `«${VARIANTS[x.k].name}» ${diff > 0 ? 'дороже' : 'дешевле'} на ${rub(Math.abs(diff))}, больше всего за счёт статьи «${CATS[top.cat].name}» (${top.d > 0 ? '+' : '−'}${rub(Math.abs(top.d))}).`;
  });
  return {
    title: 'Сравнение вариантов',
    right: `<button class="glass-btn" data-a="close" aria-label="Закрыть">${ic('close')}</button>`,
    body: `<div class="cmp">${all.map(({ k, c }) => `<button class="cmp-col ${t.variant === k ? 'on' : ''}" data-a="pick-variant" data-k="${k}">
        <span class="n">${VARIANTS[k].name}</span>
        <span class="tot">${kShort(c.total)}</span>
        ${c.total <= t.budget ? '<span class="pill ok" style="justify-self:start">в бюджете</span>' : '<span class="pill bad" style="justify-self:start">выше</span>'}
        ${c.lines.map((l) => `<span class="ln"><span>${l.cat === 'activities' ? 'Билеты' : CATS[l.cat].name}</span><b>${NF.format(Math.round(l.amount / 1000))}к</b></span>`).join('')}
      </button>`).join('')}</div>
      <div class="notice">${ic('sparkles')}<div><b>Рекомендация Parri: «${VARIANTS[best].name}».</b> ${best === 'eco' && costs(t, 'eco').total > t.budget ? `Даже самый экономный вариант выше бюджета на ${rub(costs(t, 'eco').total - t.budget)}. Сократите поездку на ночь-две или поднимите бюджет.` : `Самый комфортный вариант, который укладывается в ваш бюджет ${rub(t.budget)}.`}<br><br>${explain.join('<br>')}</div></div>
      <p class="foot">Все суммы — ${state.providers.flights || state.providers.hotels ? 'оценка Parri и цены подключённых поставщиков на момент проверки' : 'оценка Parri по средним ценам'}. Подтверждённой брони здесь нет.</p>`,
  };
}

function sheetExpense() {
  const e = state.expDraft;
  return {
    title: `Расход · ${DEST[trip(e.trip).dest].city}`,
    left: `<button class="glass-btn" data-a="close">Отмена</button>`,
    body: `<div class="list">
        <label class="row"><span class="grow t">Сумма, ₽</span><input id="e-amount" class="inline-input" inputmode="numeric" data-e="amount" value="${e.amount ? NF.format(e.amount) : ''}" placeholder="0"></label>
        <label class="row"><span class="grow t">Описание</span><input id="e-note" class="inline-input" data-e="note" value="${esc(e.note)}" placeholder="Например, ужин" style="width:170px"></label>
      </div>
      <div class="section"><div class="section-h"><span class="cap">Категория</span></div>
        <div class="chips">${Object.entries(CATS).filter(([k]) => k !== 'buffer').map(([k, c]) => `<button class="chip ${e.cat === k ? 'on' : ''}" data-a="e-cat" data-k="${k}">${c.name}</button>`).join('')}</div></div>`,
    foot: `<button class="btn primary block" data-a="e-save">Добавить</button>`,
  };
}

function sheetAssistant() {
  const t = trip() || state.trips[0];
  return {
    title: 'Parri',
    right: `<button class="glass-btn" data-a="close" aria-label="Закрыть">${ic('close')}</button>`,
    body: `<div class="notice" style="padding:12px 14px">${ic('sparkles')}<div>${t ? `Отвечаю про поездку в <b>${DEST[t.dest].city}</b>.` : 'Добавьте поездку, и я смогу отвечать по ней.'} В прототипе ответы строятся из данных поездки на устройстве.</div></div>
      <div class="chat" id="chat">${state.chat.map((m) => `<div class="msg ${m.me ? 'me' : 'ai'}">${esc(m.text)}${m.act ? `<div class="act"><button class="btn small primary" data-a="${m.act.a}" data-k="${m.act.k || ''}">${esc(m.act.label)}</button></div>` : ''}</div>`).join('')}${state.typing ? '<div class="msg ai typing">Parri думает…</div>' : ''}</div>`,
    foot: `<div class="suggest">${['Почему столько стоит?', 'Сделай дешевле', 'Что с визой?', 'Чем платить на месте?', 'Это уже бронь?'].map((q) => `<button class="chip" data-a="ask" data-q="${q}">${q}</button>`).join('')}</div>
      <form class="composer" data-form="ask"><input id="ask-input" placeholder="Спросите о поездке" autocomplete="off" aria-label="Вопрос"><button type="submit" aria-label="Отправить">${ic('up')}</button></form>`,
  };
}

function answer(q, t) {
  const s = q.toLowerCase();
  if (!t) return { text: 'Сначала создайте поездку: выберите направление, даты и бюджет. Потом я объясню стоимость и подскажу, что сделать.', act: { a: 'new-trip', label: 'Новая поездка' } };
  const d = DEST[t.dest], c = costs(t);
  if (/брон|подтвер|забронир/.test(s)) return { text: 'Нет. В этой версии Parri не бронирует. Все суммы — оценка Parri или цена подключённого поставщика на момент проверки. Подтверждённой считается только бронь с номером от поставщика. Билеты и жильё покупайте на сайте поставщика, а номер заказа добавьте в «Документы».' };
  if (/дешев|эконом|сократ|сэконом/.test(s)) {
    if (t.variant === 'eco') {
      const top = c.lines.slice().sort((p, q2) => q2.amount - p.amount)[0];
      const tip = t.nights > 1
        ? ` Если сократить поездку на одну ночь, выйдет ${rub(costs({ ...t, nights: t.nights - 1 }, 'eco').total)} — экономия ${rub(c.total - costs({ ...t, nights: t.nights - 1 }, 'eco').total)}.`
        : '';
      return { text: `Вы уже на самом экономном варианте. Больше всего уходит на «${CATS[top.cat].name}» — ${rub(top.amount)}.${tip}` };
    }
    const lower = t.variant === 'comf' ? 'bal' : 'eco';
    const lc = costs(t, lower);
    return { text: `Вариант «${VARIANTS[lower].name}» обойдётся в ${rub(lc.total)} — на ${rub(c.total - lc.total)} меньше. Что изменится: жильё — ${VARIANTS[lower].lodging}; транспорт — ${VARIANTS[lower].transport}.`, act: { a: 'pick-variant', k: lower, label: `Перейти на «${VARIANTS[lower].name}»` } };
  }
  if (/виз|въезд|паспорт|документ/.test(s)) {
    const e = d.entry[state.profile.passport];
    if (!e) return { text: `Для вашего гражданства у меня нет правил въезда в ${d.country}. Проверьте на сайте консульства и отметьте статус в «Документах».` };
    return { text: `${d.country}: ${e.title.toLowerCase()}. ${e.text}${e.need === 'visa' ? ` Подать документы стоит до ${DFW.format(toDate(addDays(t.start, -e.lead)))}.` : ''}\n\nЭто справка, не юридическая консультация.`, act: { a: 'goto-docs', label: 'Открыть документы' } };
  }
  if (/плат|карт|налич|валют|key|pay/.test(s)) {
    const ok = d.pay.filter((x) => x[1] === 'ok').map((x) => x[0]);
    return { text: `В ${d.country} без ограничений работают: ${ok.join(', ')}. Валюта — ${d.cur}. Подробности по каждому способу в Кошельке.`, act: { a: 'goto-wallet', k: t.dest, label: 'Открыть Кошелёк' } };
  }
  if (/маршрут|день|дня|програм|план/.test(s)) {
    const n = c.it.days.reduce((x, day) => x + day.items.filter((i) => !i.fixed).length, 0);
    return { text: `В маршруте ${n} ${plural(n, 'место', 'места', 'мест')} на ${c.it.days.length} ${plural(c.it.days.length, 'день', 'дня', 'дней')}. Я подбирал их по интересам (${t.interests.map((g) => INTERESTS.find((x) => x[0] === g)[1].toLowerCase()).join(', ')}) и старался ставить соседние места в один день.${c.it.excluded.length ? ` Исключил ${c.it.excluded.length} из-за ограничений.` : ''}`, act: { a: 'rebuild', label: 'Собрать другой маршрут' } };
  }
  if (/стоит|дорог|цен|бюджет|сколько|почему/.test(s)) {
    const top = c.lines.slice().sort((p, q2) => q2.amount - p.amount).slice(0, 3);
    return { text: `Вариант «${VARIANTS[t.variant].name}» — ${rub(c.total)} на ${t.travelers} ${plural(t.travelers, 'человека', 'человек', 'человек')}. Больше всего:\n${top.map((l) => `• ${CATS[l.cat].name} — ${rub(l.amount)} (${Math.round((l.amount / c.total) * 100)}%): ${l.how[0]}`).join('\n')}\n\n${c.total <= t.budget ? `Укладываемся в бюджет, запас ${rub(t.budget - c.total)}.` : `Выше бюджета на ${rub(c.total - t.budget)}.`} Это оценка, не цена бронирования.`, act: { a: 'goto-budget', label: 'Открыть бюджет' } };
  }
  return { text: 'Пока я умею отвечать про стоимость, маршрут, документы и способы оплаты для этой поездки. Попробуйте один из вопросов ниже.' };
}

/* ---------------- Render loop ---------------- */
const $phone = document.getElementById('phone');
const $scroller = document.getElementById('scroller');
const $tabs = document.getElementById('tabbar');
const $sheet = document.getElementById('sheet-layer');
let lastKey = '', lastSheet = null;

function render() {
  const t = state.tab === 'trips' && trip();
  if (state.tab === 'trips' && state.tripId && !t) state.tripId = null;
  const key = state.tab + '/' + (t ? t.id : '');
  const html = t ? screenTrip(t) : { trips: screenTrips, todo: screenTodo, wallet: screenWallet, profile: screenProfile }[state.tab]();
  const keepScroll = key === lastKey ? $scroller.scrollTop : 0;
  $scroller.innerHTML = `<div class="screen ${key !== lastKey && t ? 'enter' : ''}">${html}</div>`;
  $scroller.scrollTop = keepScroll;
  if (key !== lastKey) onScroll();
  lastKey = key;

  const tabs = [['trips', 'Поездки', 'trips'], ['todo', 'Дела', 'todo'], ['wallet', 'Кошелёк', 'wallet'], ['profile', 'Профиль', 'person']];
  const menu = [['new-trip', 'Новая поездка', 'plane'], ['add-expense', 'Добавить расход', 'coins'], ['assistant', 'Спросить Parri', 'sparkles'], ['compare', 'Сравнить варианты', 'compare']];
  $tabs.innerHTML = `${state.fab ? `<div class="fab-scrim" data-a="fab"></div><div class="fab-menu">${menu.map(([a, n, i]) => `<button class="card fab-item" data-a="${a}" ${state.trips.length || a === 'new-trip' || a === 'assistant' ? '' : 'disabled'}>${ic(i)}<span>${n}</span></button>`).join('')}</div>` : ''}
    <nav class="tabbar" aria-label="Разделы">${tabs.map(([k, n, i]) => `<button class="tab ${state.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}" aria-current="${state.tab === k}">${ic(i)}<span>${n}</span></button>`).join('')}</nav>
    <button class="fab ${state.fab ? 'open' : ''}" data-a="fab" aria-label="${state.fab ? 'Закрыть меню' : 'Добавить'}" aria-expanded="${!!state.fab}">${ic('plus')}</button>`;

  renderSheet();
  save();
}

function renderSheet() {
  const name = state.sheet;
  if (!name) { $sheet.className = 'sheet-layer'; $sheet.innerHTML = '<div class="scrim"></div>'; lastSheet = null; return; }
  const s = { new: sheetNewTrip, compare: sheetCompare, expense: sheetExpense, assistant: sheetAssistant }[name]();
  const prevBody = $sheet.querySelector('.sheet-body');
  const keep = lastSheet === name && prevBody ? prevBody.scrollTop : 0;
  $sheet.className = 'sheet-layer open';
  $sheet.innerHTML = `<div class="scrim" data-a="close"></div>
    <div class="sheet ${lastSheet !== name ? 'enter' : ''}" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
      <div class="sheet-head"><span class="l">${s.left || ''}</span><h2>${esc(s.title)}</h2><span class="r">${s.right || ''}</span></div>
      <div class="sheet-body">${s.body}</div>
      ${s.foot ? `<div class="sheet-foot">${s.foot}</div>` : ''}
    </div>`;
  const body = $sheet.querySelector('.sheet-body');
  body.scrollTop = name === 'assistant' ? body.scrollHeight : keep;
  lastSheet = name;
}

function onScroll() { $phone.classList.toggle('scrolled', $scroller.scrollTop > (state.tripId && state.tab === 'trips' ? 200 : 36)); }
$scroller.addEventListener('scroll', onScroll, { passive: true });

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = `${ic('check')}<span>${esc(msg)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function newDraft(t) {
  const p = state.profile;
  return t
    ? { editId: t.id, dest: t.dest, start: t.start, nights: t.nights, travelers: t.travelers, budget: t.budget, pace: t.pace, interests: [...t.interests], lowWalking: t.lowWalking, kids: t.kids }
    : { dest: 'IST', start: addDays(todayISO(), 30), nights: 5, travelers: 2, budget: 200000, pace: 'normal', interests: [...p.interests], lowWalking: p.lowWalking, kids: p.kids };
}

function ask(q) {
  q = q.trim();
  if (!q || state.typing) return;
  const t = trip() || state.trips[0];
  state.chat.push({ me: true, text: q });
  state.typing = true;
  renderSheet();
  setTimeout(() => {
    state.typing = false;
    state.chat.push(answer(q, t));
    if (state.sheet === 'assistant') renderSheet();
  }, 650);
}

/* ---------------- Events ---------------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const a = el.dataset.a, k = el.dataset.k;
  const t = trip() || (['compare', 'add-expense'].includes(el.dataset.a) ? homeTrip() : null);
  const d = state.draft;
  if (a !== 'fab') state.fab = false;
  switch (a) {
    case 'fab': state.fab = !state.fab; break;
    case 'home-trip': state.homeTrip = el.dataset.id; break;
    case 'tab': state.tab = k; state.tripId = null; break;
    case 'open-trip': state.tripId = el.dataset.id; state.section = 'route'; break;
    case 'back': state.tripId = null; break;
    case 'section': state.section = k; break;
    case 'new-trip': state.draft = newDraft(); state.sheet = 'new'; break;
    case 'edit-trip': state.draft = newDraft(t); state.sheet = 'new'; break;
    case 'close': state.sheet = null; state.confirmDel = false; break;
    case 'compare': state.sheet = 'compare'; state.cmpTrip = t.id; t.done.compare = true; break;
    case 'pick-variant': {
      const tt = (state.sheet === 'compare' && trip(state.cmpTrip)) || t || state.trips[0];
      tt.variant = k; state.sheet = state.sheet === 'assistant' ? 'assistant' : null;
      toast(`Выбран вариант «${VARIANTS[k].name}»`); break;
    }
    case 'rebuild': { const tt = t || state.trips[0]; tt.seed += 1; if (state.sheet === 'assistant') state.sheet = null; state.tab = 'trips'; state.tripId = tt.id; state.section = 'route'; toast('Маршрут пересобран'); break; }
    case 'doc': { const order = ['todo', 'progress', 'done']; const cur = t.docs[el.dataset.id] || 'todo'; t.docs[el.dataset.id] = order[(order.indexOf(cur) + 1) % 3]; if (el.dataset.id === 'entry' || el.dataset.id === 'insurance' || el.dataset.id === 'stay') t.done[el.dataset.id] = t.docs[el.dataset.id] === 'done'; break; }
    case 'toggle-todo': { const tt = trip(el.dataset.trip); tt.done[el.dataset.id] = !tt.done[el.dataset.id]; break; }
    case 'add-expense': state.expDraft = { amount: 0, note: '', cat: 'food', trip: t.id }; state.sheet = 'expense'; break;
    case 'e-cat': state.expDraft.cat = k; break;
    case 'e-save': {
      const e = state.expDraft;
      if (!e.amount) { toast('Введите сумму'); return; }
      trip(e.trip).expenses.push({ id: uid(), cat: e.cat, amount: e.amount, note: e.note.trim(), date: todayISO(), src: 'manual' });
      state.sheet = null; toast(`Расход добавлен · ${DEST[trip(e.trip).dest].city}`); break;
    }
    case 'del-expense': t.expenses = t.expenses.filter((e) => e.id !== el.dataset.id); break;
    case 'import-pay': {
      const dd = DEST[t.dest];
      t.expenses.push(
        { id: uid(), cat: 'other', amount: 4200, note: 'Страховка, полис на поездку', date: addDays(todayISO(), -1), src: 'pay' },
        { id: uid(), cat: 'activities', amount: round100(dd.acts.find((x) => x.price > 1000).price * t.travelers), note: dd.acts.find((x) => x.price > 1000).name + ', билеты', date: todayISO(), src: 'pay' },
      );
      t.payImported = true; toast('Загружено 2 операции из Pay'); break;
    }
    case 'wallet-dest': state.walletDest = k; break;
    case 'assistant': state.sheet = 'assistant'; break;
    case 'ask': ask(el.dataset.q); return;
    case 'goto-docs': state.sheet = null; state.tab = 'trips'; state.tripId = (t || state.trips[0]).id; state.section = 'docs'; break;
    case 'goto-budget': state.sheet = null; state.tab = 'trips'; state.tripId = (t || state.trips[0]).id; state.section = 'budget'; break;
    case 'goto-wallet': state.sheet = null; state.tab = 'wallet'; state.tripId = null; state.walletDest = k; break;
    case 'plan-plus': state.plan = 'plus'; toast('Plus включён (демо)'); break;
    case 'plan-free': state.plan = 'free'; break;
    case 'period': state.planPeriod = k; break;
    case 'p-interest': { const L = state.profile.interests; state.profile.interests = L.includes(k) ? L.filter((x) => x !== k) : [...L, k]; break; }
    case 'p-toggle': state.profile[k] = !state.profile[k]; break;
    case 'provider': {
      state.providers[k] = !state.providers[k];
      state.providers.checkedAt = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      if (state.providers[k]) toast('Поставщик подключён (демо)');
      break;
    }
    case 'reset': state.confirmReset = true; break;
    case 'reset-cancel': state.confirmReset = false; break;
    case 'reset-yes': state = seedState(); toast('Данные сброшены'); break;
    case 'd-dest': d.dest = k; break;
    case 'd-step': {
      const lim = { nights: [1, 21], travelers: [1, 8] }[k];
      d[k] = Math.min(lim[1], Math.max(lim[0], d[k] + Number(el.dataset.n))); break;
    }
    case 'd-pace': d.pace = k; break;
    case 'd-interest': d.interests = d.interests.includes(k) ? d.interests.filter((x) => x !== k) : [...d.interests, k]; break;
    case 'd-toggle': d[k] = !d[k]; break;
    case 'del-trip':
      if (!state.confirmDel) { state.confirmDel = true; el.textContent = 'Нажмите ещё раз, чтобы удалить'; return; }
      state.trips = state.trips.filter((x) => x.id !== d.editId); state.tripId = null; state.sheet = null; state.confirmDel = false; toast('Поездка удалена'); break;
    case 'd-submit': submitDraft(); return;
    default: return;
  }
  render();
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.d) {
    state.draft[el.dataset.d] = el.dataset.d === 'budget' ? Number(el.value.replace(/\D/g, '')) || 0 : el.value;
  } else if (el.dataset.e) {
    state.expDraft[el.dataset.e] = el.dataset.e === 'amount' ? Number(el.value.replace(/\D/g, '')) || 0 : el.value;
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.f) { state.profile[el.dataset.f] = el.value; render(); }
  if (el.dataset.d === 'budget') el.value = NF.format(state.draft.budget);
  if (el.dataset.e === 'amount' && state.expDraft.amount) el.value = NF.format(state.expDraft.amount);
});
document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.dataset.form === 'ask') {
    const inp = document.getElementById('ask-input');
    const q = inp.value; inp.value = '';
    ask(q);
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (state.sheet || state.fab)) { state.sheet = null; state.fab = false; render(); } });

function submitDraft() {
  const d = state.draft;
  if (!d.start || d.start < todayISO()) { toast('Выберите дату вылета не раньше сегодня'); return; }
  if (d.budget < 10000) { toast('Укажите бюджет от 10 000 ₽'); return; }
  const loader = document.createElement('div');
  loader.className = 'loading';
  loader.innerHTML = `<div class="box"><svg class="i spin" viewBox="0 0 24 24">${I.sparkles}</svg><b>Parri собирает план</b><p>Подбираю места по интересам и считаю три варианта бюджета</p></div>`;
  $phone.appendChild(loader);
  setTimeout(() => {
    loader.remove();
    let t;
    if (d.editId) {
      t = trip(d.editId);
      Object.assign(t, { dest: d.dest, start: d.start, nights: d.nights, travelers: d.travelers, budget: d.budget, pace: d.pace, interests: d.interests, lowWalking: d.lowWalking, kids: d.kids });
      t.variant = bestFit(t);
    } else {
      t = { id: uid(), dest: d.dest, start: d.start, nights: d.nights, travelers: d.travelers, budget: d.budget, pace: d.pace, interests: d.interests, lowWalking: d.lowWalking, kids: d.kids, variant: 'bal', seed: 1, docs: {}, done: {}, expenses: [], payImported: false };
      t.variant = bestFit(t);
      state.trips.push(t);
    }
    state.sheet = null; state.tab = 'trips'; state.tripId = t.id; state.section = 'route';
    render();
    toast(`План готов · вариант «${VARIANTS[t.variant].name}»`);
  }, 1100);
}

render();
