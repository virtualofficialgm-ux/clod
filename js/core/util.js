// Общие утилиты: локализация, хранилище, мелкая математика.
(function () {
  const NP = (window.NP = window.NP || {});

  NP.lang = 'ru';

  // Строка по ключу локализации. Параметры подставляются как {name}.
  NP.T = function (key, params) {
    const dict = (NP.locales && NP.locales[NP.lang]) || {};
    let s = dict[key];
    if (s === undefined) return '[' + key + ']';
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  };
  NP.hasT = function (key) {
    const dict = (NP.locales && NP.locales[NP.lang]) || {};
    return dict[key] !== undefined;
  };

  NP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  NP.lerp = (a, b, t) => a + (b - a) * t;
  NP.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // localStorage может отсутствовать (приватный режим, превью) — любые ошибки глушим.
  NP.store = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* нет хранилища */ }
    },
  };

  NP.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return e;
  };

  NP.isTouch = function () {
    try {
      return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    } catch (e) { return false; }
  };

  NP.formatTime = function (sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + ' ч ' + m + ' мин' : m + ' мин';
  };
})();
