// Автоматы НУЛЯ: каждый узел сети — пиксельная аркада.
// Три попытки. Победа — трофей. Три попытки проиграны — НУЛЬ «наводит порядок» в реальном городе.
(function () {
  const NP = window.NP;
  const el = NP.el, T = NP.T;
  const W = 320, H = 180;

  NP.Games = NP.Games || {};

  const spriteCache = {};
  const Arcade = (NP.Arcade = {
    W, H,
    // Спрайт из текстовой сетки: '.' — прозрачно, остальные символы — из палитры.
    sprite(key, rows, pal) {
      if (spriteCache[key]) return spriteCache[key];
      const c = document.createElement('canvas');
      c.width = rows[0].length; c.height = rows.length;
      const g = c.getContext('2d');
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
      return (spriteCache[key] = c);
    },
    // Значок трофея для итогов и журнала.
    drawTrophy(canvas, id) {
      const def = NP.Data.arcades[id];
      const g = canvas.getContext('2d');
      canvas.width = 16; canvas.height = 16;
      g.fillStyle = '#1b1406'; g.fillRect(0, 0, 16, 16);
      g.drawImage(Arcade.sprite('trophy:' + id, def.icon, def.iconPal), 0, 0);
    },

    run(id) {
      const def = NP.Data.arcades[id];
      const game = NP.Games[def.game];
      if (!def || !game) { console.error('Нет автомата', id); return Promise.resolve('quit'); }
      // Размер холста задаёт сама игра: старые автоматы 320×180, уровни кампании 480×270.
      const [W, H] = game.size || [320, 180];
      const spk = def.speaker || 'nul';
      const k = (name) => (NP.hasT('arc.' + id + '.' + name) ? 'arc.' + id + '.' + name : 'arc.' + name);
      return new Promise((resolve) => {
        NP.UI.openModal('arcade', (p, close) => {
          let lives = 3, state = 'intro', inst = null, raf = 0, last = 0, msgT = 0, result = null;
          const easy = NP.Settings.values.easyChase;
          const title = el('b', { class: 'arc-title', text: T('arc.' + id + '.title') });
          const hearts = el('span', { class: 'arc-lives', 'aria-label': '' });
          const status = el('span', { class: 'arc-status' });
          const head = el('div', { class: 'arc-head' }, [title, hearts, status]);
          const cv = el('canvas', { class: 'arc-canvas', width: W, height: H, tabindex: '0', 'aria-label': T('arc.' + id + '.title') });
          const g = cv.getContext('2d');
          g.imageSmoothingEnabled = false;
          const banner = el('div', { class: 'arc-banner', hidden: true });
          const screen = el('div', { class: 'arc-screen' }, [cv, banner]);
          const card = el('div', { class: 'arc-card' });
          const pad = el('div', { class: 'arc-pad' });
          p.append(head, screen, pad, card);

          // Сенсорная крестовина и кнопка действия (только на касаниях).
          const padBtn = (action, label, cls) => {
            const b = el('button', { class: 'arc-btn ' + (cls || ''), 'aria-label': label, text: label });
            const on = (e) => { e.preventDefault(); NP.Input.setVirtual(action, true); };
            const off = (e) => { e.preventDefault(); NP.Input.setVirtual(action, false); };
            b.addEventListener('pointerdown', on);
            b.addEventListener('pointerup', off);
            b.addEventListener('pointerleave', off);
            b.addEventListener('pointercancel', off);
            return b;
          };
          pad.append(
            el('div', { class: 'arc-dpad' }, [padBtn('up', '▲', 'u'), padBtn('left', '◀', 'l'), padBtn('right', '▶', 'r'), padBtn('down', '▼', 'd')]),
            padBtn('act', T('arc.fire'), 'fire'),
          );

          // Указатель по холсту (ракетка в «Кирпичах» ведётся пальцем или мышью).
          const pointer = { x: null, active: false };
          const toLocal = (e) => { const r = cv.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
          cv.addEventListener('pointerdown', (e) => { pointer.active = true; pointer.x = toLocal(e); NP.Input.trigger('act'); });
          cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || pointer.active) { pointer.x = toLocal(e); pointer.t = performance.now(); } });
          window.addEventListener('pointerup', () => { pointer.active = false; });

          const fx = new NP.FX.Particles(600);
          let shakeT = 0;
          const api = {
            W, H, easy, pointer, fx,
            shake(t) { if (!NP.Settings.values.reduceFlash) shakeT = Math.max(shakeT, t || 0.2); },
            boom(x, y, color, n) { fx.emit(x, y, { count: n || 18, color: [color || '#ffd166', '#ffffff'], speed: 90, life: 0.6, size: 2, gravity: 80 }); },
            sfx: (n) => NP.Audio.sfx(n),
            axis: () => NP.Input.axis(),
            held: (a) => NP.Input.isHeld(a),
            pressed: (a) => NP.Input.pressed(a),
            win() { if (state === 'play') { state = 'won'; finish('won'); } },
            die() {
              if (state !== 'play') return;
              lives--;
              NP.Audio.sfx('hit');
              api.shake(0.45);
              drawHearts();
              if (lives <= 0) { state = 'lost'; finish('lost'); return; }
              state = 'dead';
              showBanner(T('arc.life_lost', { n: 4 - lives }), 1.4);
            },
          };

          Arcade._cur = { api, get inst() { return inst; }, get state() { return state; } }; // для автотестов
          const drawHearts = () => {
            hearts.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives));
            hearts.setAttribute('aria-label', T('arc.lives', { n: lives }));
          };
          const showBanner = (text, secs) => { banner.textContent = text; banner.hidden = false; msgT = secs; };

          const loop = (ts) => {
            const dt = Math.min(0.04, (ts - last) / 1000 || 0);
            last = ts;
            if (state === 'play' || state === 'dead' || state === 'paused') {
              if (state !== 'paused' && NP.Input.pressed('menu')) pause();
              if (state === 'play') inst.update(dt);
              if (state === 'dead') {
                msgT -= dt;
                if (msgT <= 0) { banner.hidden = true; inst.reset(false); state = 'play'; NP.Input.clearPressed(); }
              } else if (msgT > 0) { msgT -= dt; if (msgT <= 0) banner.hidden = true; }
              fx.update(dt);
              if (shakeT > 0) shakeT -= dt;
              g.save();
              if (shakeT > 0) g.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 6));
              inst.draw(g);
              fx.draw(g);
              g.restore();
              // ЭЛТ-полосы — атмосфера старого автомата.
              if (!NP.Settings.values.reduceFlash) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1); }
              status.textContent = inst.status ? inst.status() : '';
            }
            if (state !== 'closed') raf = requestAnimationFrame(loop);
          };

          const pause = () => {
            state = 'paused';
            NP.Input.clearVirtual();
            card.innerHTML = '';
            card.hidden = false;
            card.append(
              el('h2', { text: T('arc.paused') }),
              el('p', { class: 'dim', text: T('arc.paused_text') }),
              el('div', { class: 'row' }, [
                el('button', { class: 'btn primary', text: T('arc.resume'), onclick: () => { card.hidden = true; state = 'play'; NP.Input.clearPressed(); cv.focus(); } }),
                el('button', { class: 'btn ghost', text: T('arc.quit'), onclick: () => { result = 'quit'; stop(); } }),
              ]),
            );
            setTimeout(() => card.querySelector('.btn').focus(), 20);
          };

          const start = () => {
            NP.Audio.unlock();
            card.hidden = true;
            head.hidden = false;
            lives = 3; drawHearts();
            inst = game(api);
            inst.reset(true);
            state = 'play';
            NP.Audio.music(def.music || 'chase');
            if (document.activeElement) document.activeElement.blur();
            cv.focus();
            NP.Input.clearPressed();
            showBanner(T('arc.go'), 1);
          };

          const finish = (r) => {
            result = r;
            NP.Input.clearVirtual();
            NP.Audio.sfx(r === 'won' ? 'success' : 'glitch');
            if (r === 'lost' && !NP.Settings.values.reduceFlash) NP.Director.flash();
            setTimeout(() => showResult(r), 700);
          };

          const showResult = (r) => {
            state = 'result';
            card.innerHTML = '';
            card.hidden = false;
            card.className = 'arc-card result ' + r;
            if (r === 'won') {
              const icon = el('canvas', { class: 'trophy-icon', width: 16, height: 16 });
              Arcade.drawTrophy(icon, id);
              card.append(
                el('p', { class: 'eyebrow', text: T(k('trophy_got')) }),
                el('div', { class: 'trophy' }, [icon, el('div', {}, [el('h2', { text: T('arc.' + id + '.trophy') }), el('p', { text: T('arc.' + id + '.trophy_desc') })])]),
                el('p', { class: 'nul-line' }, [el('b', { class: 'spk-' + spk, text: T('speaker.' + spk) + ': ' }), T('arc.' + id + '.nul_win')]),
              );
            } else {
              card.append(
                el('p', { class: 'eyebrow', text: T(k('lost')) }),
                el('p', { class: 'nul-line' }, [el('b', { class: 'spk-' + spk, text: T('speaker.' + spk) + ': ' }), T('arc.' + id + '.nul_lose')]),
                el('div', { class: 'news' }, [el('small', { text: T('arc.news', { t: def.newsTime }) }), el('p', { text: T('arc.' + id + '.news') })]),
              );
            }
            const b = el('button', { class: 'btn primary', text: T('ui.continue'), onclick: () => stop() });
            card.append(el('div', { class: 'row' }, [b]));
            setTimeout(() => b.focus(), 30);
          };

          const stop = () => { state = 'closed'; cancelAnimationFrame(raf); NP.Input.clearVirtual(); close(result); };

          // Экран правил и ставок
          head.hidden = true;
          card.append(
            el('p', { class: 'eyebrow', text: T(k('machine'), { n: def.number }) }),
            el('h2', { text: T('arc.' + id + '.title') }),
            el('p', { class: 'genre', text: T('arc.' + id + '.genre') }),
            el('p', { class: 'nul-line' }, [el('b', { class: 'spk-' + spk, text: T('speaker.' + spk) + ': ' }), T('arc.' + id + '.nul_intro')]),
            el('p', { text: T('arc.' + id + '.rules') }),
            el('p', { class: 'dim small', text: T(NP.UI.isTouchUI() ? 'arc.' + id + '.touch' : 'arc.' + id + '.keys') }),
            el('ul', { class: 'stakes' }, [
              el('li', { class: 'win', text: T('arc.stake_win', { t: T('arc.' + id + '.trophy') }) }),
              el('li', { class: 'lose', text: T(k('stake_lose')) }),
            ]),
            el('div', { class: 'row' }, [
              el('button', { class: 'btn primary', text: T('arc.play'), onclick: start }),
              el('button', { class: 'btn ghost', text: T('ui.leave'), onclick: () => { result = 'quit'; stop(); } }),
            ]),
          );
          if (easy) card.appendChild(el('p', { class: 'dim small', text: T('arc.easy_on') }));
          NP.Audio.sfx('confirm');
          raf = requestAnimationFrame(loop);
        }, { noEscape: true, onClose: (r) => resolve(r || 'quit') });
      });
    },
  });
})();
