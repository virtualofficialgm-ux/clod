// Ввод: клавиатура с переназначением, виртуальный стик и кнопки на сенсорных экранах.
(function () {
  const NP = window.NP;

  const held = {};       // code -> true
  const pressedQ = {};   // action -> true (на один кадр)
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let listenCb = null;

  function actionForCode(code) {
    const keys = NP.Settings.values.keys;
    for (const a in keys) if (keys[a].indexOf(code) >= 0) return a;
    return null;
  }

  const Input = (NP.Input = {
    usedTouch: false,
    // Ожидание нажатия для переназначения клавиши.
    listenOnce(cb) { listenCb = cb; },
    trigger(action) { pressedQ[action] = true; },
    pressed(action) {
      if (pressedQ[action]) { pressedQ[action] = false; return true; }
      return false;
    },
    clearPressed() { for (const k in pressedQ) pressedQ[k] = false; },
    isHeld(action) {
      const codes = NP.Settings.values.keys[action] || [];
      return codes.some((c) => held[c]);
    },
    axis() {
      let x = 0, y = 0;
      if (Input.isHeld('left')) x -= 1;
      if (Input.isHeld('right')) x += 1;
      if (Input.isHeld('up')) y -= 1;
      if (Input.isHeld('down')) y += 1;
      if (stick.active) {
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
        const len = Math.hypot(dx, dy);
        const r = 28;
        if (len > 6) { x = dx / Math.max(len, r); y = dy / Math.max(len, r); }
      }
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },
    init() {
      window.addEventListener('keydown', (e) => {
        if (listenCb) {
          e.preventDefault();
          const cb = listenCb; listenCb = null; cb(e.code);
          return;
        }
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT') return;
        const a = actionForCode(e.code);
        if (!held[e.code] && a) pressedQ[a] = true;
        held[e.code] = true;
        // Пробел и стрелки не должны прокручивать страницу; Tab — уводить фокус из игры, пока открыт мир.
        if (a && ['up', 'down', 'left', 'right', 'scan'].indexOf(a) >= 0 && !NP.UI.modalOpen()) e.preventDefault();
        if (a === 'act' && e.code === 'Space' && !NP.UI.modalOpen()) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { held[e.code] = false; });
      window.addEventListener('blur', () => { for (const k in held) held[k] = false; stick.active = false; });

      // Виртуальный стик: касание в левой части сцены.
      const zone = document.getElementById('stickzone');
      const knob = document.getElementById('stickknob');
      const base = document.getElementById('stickbase');
      const place = () => {
        const r = zone.getBoundingClientRect();
        base.style.left = stick.ox - r.left + 'px';
        base.style.top = stick.oy - r.top + 'px';
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
        const len = Math.hypot(dx, dy), max = 34;
        const k = len > max ? max / len : 1;
        knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      };
      zone.addEventListener('touchstart', (e) => {
        Input.usedTouch = true;
        const t = e.changedTouches[0];
        stick.active = true; stick.id = t.identifier;
        stick.ox = stick.x = t.clientX; stick.oy = stick.y = t.clientY;
        base.hidden = false; place();
        e.preventDefault();
      }, { passive: false });
      zone.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) if (t.identifier === stick.id) { stick.x = t.clientX; stick.y = t.clientY; place(); }
        e.preventDefault();
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === stick.id) { stick.active = false; base.hidden = true; }
      };
      zone.addEventListener('touchend', end);
      zone.addEventListener('touchcancel', end);

      document.querySelectorAll('[data-action]').forEach((b) => {
        const fire = (e) => { e.preventDefault(); NP.Audio.unlock(); Input.trigger(b.dataset.action); };
        b.addEventListener('touchstart', fire, { passive: false });
        b.addEventListener('click', fire);
      });
      window.addEventListener('touchstart', () => { if (!Input.usedTouch) { Input.usedTouch = true; NP.UI.updateTouch(); } }, { passive: true });
    },
    keyName(code) {
      const names = { Space: 'Пробел', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
      if (names[code]) return names[code];
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      return code;
    },
  });
})();
