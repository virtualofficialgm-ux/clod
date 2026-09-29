// Слой интерфейса поверх холста: масштаб сцены, подписи, уведомления, модальные окна.
(function () {
  const NP = window.NP;
  const $ = (id) => document.getElementById(id);
  let modals = 0;
  const labelPool = [];

  const UI = (NP.UI = {
    scale: 1,
    init() {
      document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = NP.T(e.dataset.t); });
      document.title = NP.T('app.title');
      window.addEventListener('resize', UI.layout);
      window.addEventListener('orientationchange', () => setTimeout(UI.layout, 200));
      UI.layout();
      $('rotate-continue').addEventListener('click', () => { UI.rotateDismissed = true; UI.layout(); });
      $('btn-journal').addEventListener('click', () => NP.Input.trigger('journal'));
      $('btn-hint').addEventListener('click', () => NP.Input.trigger('hint'));
      $('btn-scan').addEventListener('click', () => NP.Input.trigger('scan'));
      $('btn-menu').addEventListener('click', () => NP.Input.trigger('menu'));
      UI.updateTouch();
    },
    layout() {
      const app = $('app');
      const w = app.clientWidth, h = app.clientHeight;
      let s = Math.min(w / 640, h / 360);
      // Целочисленный масштаб, если потеря площади невелика — чётче пиксели.
      if (s >= 2 && Math.floor(s) / s > 0.88) s = Math.floor(s);
      UI.scale = s;
      const st = $('stage');
      st.style.width = Math.floor(640 * s) + 'px';
      st.style.height = Math.floor(360 * s) + 'px';
      document.documentElement.style.setProperty('--u', s + 'px');
      const portrait = h > w * 1.1 && NP.isTouch();
      $('rotate').hidden = !portrait || UI.rotateDismissed;
    },
    updateTouch() {
      const on = NP.isTouch() || NP.Input.usedTouch;
      document.body.classList.toggle('touch', !!on);
    },
    actionHint() {
      return document.body.classList.contains('touch') ? '◉' : '[' + NP.Input.keyName(NP.Settings.values.keys.act[0]) + ']';
    },

    // Подписи мира: DOM поверх холста, системный шрифт — читаемо и локализуемо.
    setLabels(list) {
      const layer = $('labels');
      while (labelPool.length < list.length) { const d = NP.el('div', { class: 'wlabel' }); layer.appendChild(d); labelPool.push(d); }
      for (let i = 0; i < labelPool.length; i++) {
        const d = labelPool[i], l = list[i];
        if (!l) { if (!d.hidden) d.hidden = true; continue; }
        d.hidden = false;
        if (d._text !== l.text) { d.textContent = l.text; d._text = l.text; }
        if (d._cls !== l.cls) { d.className = 'wlabel ' + (l.cls || ''); d._cls = l.cls; }
        d.style.transform = 'translate(' + Math.round(l.x * UI.scale) + 'px,' + Math.round(l.y * UI.scale) + 'px) translate(-50%,-100%)';
      }
    },
    clearLabels() { UI.setLabels([]); },

    toast(text, kind) {
      const t = NP.el('div', { class: 'toast ' + (kind || ''), role: 'status', text });
      $('toasts').appendChild(t);
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3800);
    },

    // Короткая реплика во время исследования; попадает в историю диалогов.
    bark(speaker, key) {
      NP.GameState.pushLog(speaker, key);
      NP.Audio.voice(speaker);
      const box = $('bark');
      box.innerHTML = '';
      const cv = NP.el('canvas', { class: 'portrait mini', width: 16, height: 16 });
      NP.Sprites.drawPortrait(cv, speaker, 0);
      box.appendChild(cv);
      box.appendChild(NP.el('div', {}, [NP.el('b', { class: 'spk-' + speaker, text: NP.T('speaker.' + speaker) }), NP.el('span', { text: NP.T(key) })]));
      box.hidden = false;
      clearTimeout(UI._barkT);
      UI._barkT = setTimeout(() => { box.hidden = true; }, 3800 + NP.T(key).length * 25);
    },

    setObjective(text) {
      const o = $('objective');
      o.hidden = !text;
      if (text) { o.querySelector('span').textContent = text; o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash'); }
    },
    setHud(on) { $('hud').hidden = !on; $('touch').hidden = !on; },
    hintPulse(on) { $('btn-hint').classList.toggle('pulse', !!on); },

    fade(on, ms) {
      const f = $('fade');
      f.style.transitionDuration = (ms || 400) + 'ms';
      f.classList.toggle('on', !!on);
      return NP.sleep(ms || 400);
    },

    modalOpen() { return modals > 0; },
    // Модальная панель поверх игры. build(panel, close) наполняет её.
    openModal(cls, build, opts) {
      modals++;
      const root = $('overlay');
      root.hidden = false;
      const panel = NP.el('div', { class: 'panel ' + (cls || ''), role: 'dialog', 'aria-modal': 'true' });
      const wrap = NP.el('div', { class: 'modal-wrap' }, [panel]);
      root.appendChild(wrap);
      let closed = false;
      const onKey = (e) => {
        if (root.lastChild !== wrap) return; // клавиши обрабатывает только верхнее окно
        if (e.code === 'Escape' && !(opts && opts.noEscape)) { e.stopPropagation(); e.preventDefault(); close(); }
      };
      const close = (result) => {
        if (closed) return;
        closed = true;
        window.removeEventListener('keydown', onKey, true);
        wrap.remove();
        modals--;
        if (!modals) root.hidden = true;
        NP.Input.clearPressed();
        opts && opts.onClose && opts.onClose(result);
      };
      window.addEventListener('keydown', onKey, true);
      build(panel, close);
      setTimeout(() => { const f = panel.querySelector('[autofocus], button, [tabindex]'); if (f) f.focus(); }, 30);
      return close;
    },
    // Подтверждение внутри страницы (confirm() в артефакте недоступен).
    confirm(title, text, yes, no) {
      return new Promise((res) => {
        UI.openModal('small', (p, close) => {
          p.appendChild(NP.el('h2', { text: title }));
          if (text) p.appendChild(NP.el('p', { text }));
          p.appendChild(NP.el('div', { class: 'row' }, [
            NP.el('button', { class: 'btn primary', text: yes, onclick: () => close(true) }),
            NP.el('button', { class: 'btn', text: no, onclick: () => close(false) }),
          ]));
        }, { onClose: (r) => res(!!r) });
      });
    },
  });
})();
