// Системные загадки: ноутбук (Q01), Маршрут, Очистка, Синхронизация.
// Все управляются касанием или кликом, без перетаскивания мелких объектов.
(function () {
  const NP = window.NP;
  const el = NP.el, T = NP.T;

  const P = (NP.Puzzles = {});

  P.run = function (id) {
    const def = NP.Data.puzzles[id];
    if (!def) { console.error('Нет загадки', id); return Promise.resolve(false); }
    return P[def.type](def, id);
  };

  // ---------- Ноутбук в офисе ----------
  P.laptop = function (def) {
    return new Promise((resolve) => {
      NP.UI.openModal('laptop', (p, close) => {
        const scr = el('div', { class: 'os' });
        p.appendChild(scr);
        if (def.mode === 'source') {
          scr.appendChild(el('div', { class: 'os-bar' }, [el('span', { text: T('os.name') }), el('span', { text: '09:13' })]));
          const body = el('div', { class: 'os-body trace' });
          ['os.trace1', 'os.trace2', 'os.trace3', 'os.trace4'].forEach((k, i) => {
            const line = el('p', { class: 'trace-line', text: T(k) });
            line.style.animationDelay = i * 0.5 + 's';
            body.appendChild(line);
          });
          body.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn primary', text: T('os.close_lid'), onclick: () => close(true) })]));
          scr.appendChild(body);
          return;
        }
        const done = { tasks: false, report: false, popup: false };
        let popupMoves = 0;
        const bar = el('div', { class: 'os-bar' }, [el('span', { text: T('os.name') }), el('span', { class: 'clock', text: '09:10' })]);
        const side = el('div', { class: 'os-side' });
        const main = el('div', { class: 'os-main' });
        const checklist = el('ul', { class: 'os-check' });
        const drawCheck = () => {
          checklist.innerHTML = '';
          [['tasks', 'os.do_tasks'], ['report', 'os.do_report'], ['popup', 'os.do_popup']].forEach(([k, key]) =>
            checklist.appendChild(el('li', { class: done[k] ? 'ok' : '', text: (done[k] ? '☑ ' : '☐ ') + T(key) })));
        };
        const btnTasks = el('button', { class: 'os-app', text: T('os.app_tasks') });
        const btnReport = el('button', { class: 'os-app', text: T('os.app_report') });
        side.append(btnTasks, btnReport, el('h4', { text: T('os.morning') }), checklist);
        const popup = el('div', { class: 'os-popup', role: 'alertdialog' }, [
          el('b', { text: T('os.popup_title') }), el('p', { text: T('os.popup_text') }),
        ]);
        const later = el('button', { class: 'btn small', text: T('os.popup_later') });
        popup.appendChild(later);
        const body = el('div', { class: 'os-body' }, [side, main, popup]);
        scr.append(bar, body);
        main.appendChild(el('p', { class: 'dim', text: T('os.hello') }));

        const check = async () => {
          drawCheck();
          if (done.tasks && done.report && done.popup) {
            await NP.sleep(700);
            scr.innerHTML = '';
            scr.classList.add('hijack');
            NP.Audio.sfx('glitch');
            scr.appendChild(el('div', { class: 'hijack-text', text: T('os.hijacked') }));
            await NP.sleep(1800);
            close(true);
          }
        };
        btnTasks.addEventListener('click', () => {
          NP.Audio.sfx('blip');
          main.innerHTML = '';
          main.appendChild(el('h3', { text: T('os.tasks_title') }));
          ['os.task1', 'os.task2', 'os.task3'].forEach((k) => main.appendChild(el('p', { class: 'task', text: T(k) })));
          if (!done.tasks) { done.tasks = true; NP.Director.run([['evidence', 'ev_tasklist']]); check(); }
        });
        btnReport.addEventListener('click', () => {
          NP.Audio.sfx('blip');
          main.innerHTML = '';
          main.appendChild(el('h3', { text: T('os.report_title') }));
          main.appendChild(el('p', { class: 'file', text: 'Отчёт_поставки_сентябрь.xlsx · 48 КБ' }));
          const send = el('button', { class: 'btn primary', text: done.report ? T('os.sent') : T('os.send') });
          send.disabled = done.report;
          const bar2 = el('div', { class: 'progress' }, [el('i')]);
          send.addEventListener('click', async () => {
            send.disabled = true;
            main.appendChild(bar2);
            requestAnimationFrame(() => bar2.firstChild.style.width = '100%');
            await NP.sleep(900);
            send.textContent = T('os.sent');
            bar.querySelector('.clock').textContent = '09:11';
            NP.Audio.sfx('confirm');
            done.report = true; check();
          });
          main.appendChild(send);
        });
        // Старый софт упрямится: первое «Позже» переносит окно.
        later.addEventListener('click', () => {
          if (popupMoves === 0) {
            popupMoves++;
            popup.classList.add('moved');
            NP.Audio.sfx('error');
            popup.querySelector('p').textContent = T('os.popup_text2');
            return;
          }
          popup.hidden = true;
          NP.Audio.sfx('blip');
          done.popup = true; check();
        });
        drawCheck();
      }, { onClose: (r) => resolve(!!r) });
    });
  };

  // ---------- Маршрут ----------
  const N = 1, E = 2, S = 4, Wd = 8;
  const CH = { '─': E | Wd, '│': N | S, '┌': E | S, '┐': S | Wd, '└': N | E, '┘': N | Wd, '├': N | E | S, '┤': N | S | Wd, '┬': E | S | Wd, '┴': N | E | Wd, '┼': 15 };
  const SRC = { '>': E, '<': Wd, 'v': S, '^': N };
  const rot = (m) => ((m << 1) | (m >> 3)) & 15;
  const DIRS = [[N, 0, -1, S], [E, 1, 0, Wd], [S, 0, 1, N], [Wd, -1, 0, E]];

  function parseLevel(rows) {
    const h = rows.length, w = [...rows[0]].length;
    const cells = [];
    for (let y = 0; y < h; y++) {
      const r = [...rows[y]];
      for (let x = 0; x < w; x++) {
        const ch = r[x];
        let c = { x, y, kind: 'empty', mask: 0, sol: 0, fixed: true };
        if (CH[ch] !== undefined) c = { x, y, kind: 'pipe', mask: CH[ch], sol: CH[ch], fixed: CH[ch] === 15 };
        else if (SRC[ch] !== undefined) c = { x, y, kind: 'src', mask: SRC[ch], sol: SRC[ch], fixed: true };
        else if (ch === 'B') c = { x, y, kind: 'sink', mask: 15, sol: 15, fixed: true };
        else if (ch === 'X') c = { x, y, kind: 'over', mask: 15, sol: 15, fixed: true };
        cells.push(c);
      }
    }
    return { w, h, cells };
  }
  function flow(lv, useSol) {
    const at = (x, y) => (x < 0 || y < 0 || x >= lv.w || y >= lv.h ? null : lv.cells[y * lv.w + x]);
    const src = lv.cells.find((c) => c.kind === 'src');
    const seen = new Set([src]);
    const q = [src];
    let over = false, sink = false;
    while (q.length) {
      const c = q.shift();
      if (c.kind === 'over') { over = true; continue; }
      if (c.kind === 'sink') { sink = true; continue; }
      const m = useSol ? c.sol : c.mask;
      for (const [bit, dx, dy, back] of DIRS) {
        if (!(m & bit)) continue;
        const n = at(c.x + dx, c.y + dy);
        if (!n || seen.has(n) || n.kind === 'empty') continue;
        const nm = useSol ? n.sol : n.mask;
        if (!(nm & back)) continue;
        seen.add(n); q.push(n);
      }
    }
    return { powered: seen, over, sink };
  }

  // Детерминированное перемешивание: решённое состояние никогда не выдаётся сразу.
  function scramble(lv, seed) {
    lv.cells.forEach((c, i) => {
      if (c.kind !== 'pipe' || c.fixed) return;
      let k = 1 + ((i * 7 + seed * 3) % 3);
      const straight = c.sol === (N | S) || c.sol === (E | Wd);
      if (straight && k === 2) k = 1;
      for (let j = 0; j < k; j++) c.mask = rot(c.mask);
    });
  }

  P._route = { parseLevel, flow, rot, scramble };

  function drawCell(cv, c, powered, highlight) {
    const g = cv.getContext('2d');
    cv.width = 20; cv.height = 20;
    g.fillStyle = c.kind === 'empty' ? '#0b1510' : '#12281d';
    g.fillRect(0, 0, 20, 20);
    g.fillStyle = '#1d4a33';
    g.fillRect(0, 0, 20, 1); g.fillRect(0, 0, 1, 20);
    if (c.kind === 'empty') return;
    if (c.kind === 'over') {
      // Перегруз: штриховка и знак «!» — не только красный цвет.
      g.fillStyle = powered ? '#ff5a5f' : '#6b1f28';
      g.fillRect(2, 2, 16, 16);
      g.fillStyle = '#ffd0d0';
      for (let k = 0; k < 20; k += 4) for (let j = 0; j < 16; j++) if ((j + k) % 4 === 0 && j + 2 < 18 && (k + j) % 8 < 4) g.fillRect(2 + j, 2 + ((k + j) % 16), 1, 1);
      g.fillStyle = '#fff';
      g.fillRect(9, 5, 2, 7); g.fillRect(9, 14, 2, 2);
      return;
    }
    const col = powered ? '#3cff9a' : '#5f7d6e';
    g.fillStyle = col;
    const m = c.mask;
    g.fillRect(8, 8, 4, 4);
    if (m & N) g.fillRect(8, 0, 4, 10);
    if (m & S) g.fillRect(8, 10, 4, 10);
    if (m & E) g.fillRect(10, 8, 10, 4);
    if (m & Wd) g.fillRect(0, 8, 10, 4);
    if (powered) { g.fillStyle = '#d9ffe9'; if (m & N) g.fillRect(9, 0, 2, 9); if (m & S) g.fillRect(9, 11, 2, 9); if (m & E) g.fillRect(11, 9, 9, 2); if (m & Wd) g.fillRect(0, 9, 9, 2); }
    if (c.kind === 'src') { g.fillStyle = '#ffd166'; g.fillRect(4, 4, 12, 12); g.fillStyle = '#12281d'; g.fillRect(7, 6, 2, 8); g.fillRect(9, 7, 2, 6); g.fillRect(11, 8, 2, 4); }
    if (c.kind === 'sink') { g.fillStyle = powered ? '#ffd166' : '#8a7a4a'; g.fillRect(4, 4, 12, 12); g.fillStyle = '#12281d'; g.fillRect(6, 6, 8, 8); g.fillStyle = powered ? '#ffd166' : '#8a7a4a'; g.fillRect(8, 8, 4, 4); }
    if (highlight) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.strokeRect(1, 1, 18, 18); }
  }

  P.route = function (def, id) {
    return new Promise((resolve) => {
      const lv = parseLevel(def.level);
      const solPath = flow(lv, true).powered;
      scramble(lv, def.seed || 1);
      let solved = false;
      let hl = null;
      NP.Hints.puzzle = {
        id, keys: ['hint.route.1', 'hint.route.2', 'hint.route.3'],
        step() {
          const c = lv.cells.find((c) => c.kind === 'pipe' && !c.fixed && solPath.has(c) && c.mask !== c.sol);
          if (!c) return T('hint.route.done');
          hl = c; draw();
          let n = 0, m = c.mask; while (m !== c.sol && n < 4) { m = rot(m); n++; }
          return T('hint.route.step', { r: c.y + 1, c: c.x + 1, n });
        },
      };
      let draw = () => {};
      NP.UI.openModal('route', (p, close) => {
        p.appendChild(el('h2', { text: T('pz.' + id + '.title') }));
        p.appendChild(el('p', { class: 'intro', text: T('pz.' + id + '.intro') }));
        const grid = el('div', { class: 'grid', role: 'grid', style: 'grid-template-columns: repeat(' + lv.w + ', var(--cell))' });
        const status = el('p', { class: 'status', 'aria-live': 'polite' });
        const btns = [];
        lv.cells.forEach((c, i) => {
          const b = el('button', { class: 'cell kind-' + c.kind, 'aria-label': T('route.cell', { r: c.y + 1, c: c.x + 1 }) });
          const cv = el('canvas', { width: 20, height: 20 });
          b.appendChild(cv);
          b.disabled = c.fixed || c.kind !== 'pipe';
          b.addEventListener('click', () => {
            if (solved) return;
            c.mask = rot(c.mask);
            if (hl === c) hl = null;
            NP.Audio.sfx('rotate');
            NP.Director.progress();
            draw();
          });
          b.addEventListener('keydown', (e) => {
            const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -lv.w, ArrowDown: lv.w }[e.code];
            if (d !== undefined) {
              e.preventDefault();
              let j = i + d;
              while (j >= 0 && j < btns.length && btns[j].disabled) j += d;
              if (j >= 0 && j < btns.length) btns[j].focus();
            }
          });
          btns.push(b);
          grid.appendChild(b);
        });
        draw = () => {
          const f = flow(lv);
          lv.cells.forEach((c, i) => drawCell(btns[i].firstChild, c, f.powered.has(c), hl === c));
          if (f.over) { status.textContent = T('route.over'); status.className = 'status bad'; }
          else if (f.sink) { status.textContent = T('route.ok'); status.className = 'status good'; }
          else { status.textContent = T('route.nosignal'); status.className = 'status'; }
          if (f.sink && !f.over && !solved) {
            solved = true;
            NP.Audio.sfx('success');
            setTimeout(() => close(true), 1100);
          }
        };
        const legend = el('div', { class: 'legend' }, [
          el('span', { text: T('route.legend_src') }), el('span', { text: T('route.legend_sink') }), el('span', { text: T('route.legend_over') }),
        ]);
        const hintBtn = el('button', { class: 'btn ghost', text: T('ui.hint'), onclick: () => NP.Hints.open() });
        const leave = el('button', { class: 'btn ghost', text: T('ui.leave'), onclick: () => close(false) });
        p.append(el('div', { class: 'route-wrap' }, [grid, el('div', { class: 'route-side' }, [legend, status, hintBtn, leave])]));
        draw();
        setTimeout(() => { const f = btns.find((b) => !b.disabled); f && f.focus(); }, 50);
      }, { onClose: (r) => { NP.Hints.puzzle = null; resolve(!!r); } });
    });
  };

  // ---------- Очистка: найти ложную запись ----------
  P.cleanup = function (def, id) {
    return new Promise((resolve) => {
      NP.Hints.puzzle = { id, keys: ['hint.clean.1', 'hint.clean.2', 'hint.clean.3'] };
      NP.UI.openModal('cleanup', (p, close) => {
        let sel = null, solved = false;
        p.appendChild(el('h2', { text: T('pz.' + id + '.title') }));
        p.appendChild(el('p', { class: 'intro', text: T('pz.' + id + '.intro') }));
        const table = el('div', { class: 'records', role: 'listbox' });
        const fb = el('p', { class: 'feedback', 'aria-live': 'polite' });
        const rows = [];
        def.records.forEach((r) => {
          const b = el('button', { class: 'record', role: 'option', 'aria-selected': 'false' }, [
            el('span', { class: 'time', text: r.time }),
            el('span', { class: 'from', text: T('rec.' + r.id + '.from') }),
            el('span', { class: 'what', text: T('rec.' + r.id + '.what') }),
            el('span', { class: 'route', text: T('rec.' + r.id + '.route') }),
          ]);
          b.addEventListener('click', () => {
            if (solved) return;
            sel = r;
            rows.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
            NP.Audio.sfx('blip');
          });
          rows.push(b);
          table.appendChild(b);
        });
        const head = el('div', { class: 'record head' }, [el('span', { text: T('rec.h.time') }), el('span', { text: T('rec.h.from') }), el('span', { text: T('rec.h.what') }), el('span', { text: T('rec.h.route') })]);
        const evid = el('details', { class: 'ref' }, [el('summary', { text: T('pz.reference') })]);
        (def.reference || []).forEach((eid) => { if (NP.GameState.hasEvidence(eid)) evid.appendChild(el('p', {}, [el('b', { text: T('ev.' + eid + '.title') + ': ' }), T('ev.' + eid + '.text')])); });
        const mark = el('button', { class: 'btn primary', text: T('clean.mark') });
        mark.addEventListener('click', () => {
          if (solved) return;
          if (!sel) { fb.textContent = T('clean.pick'); fb.className = 'feedback bad'; return; }
          fb.textContent = T('rec.' + sel.id + '.why');
          if (sel.id === def.answer) {
            solved = true;
            fb.className = 'feedback good';
            NP.Audio.sfx('success');
            rows.forEach((x, i) => { if (def.records[i].id === def.answer) x.classList.add('struck'); });
            mark.textContent = T('ui.continue');
            mark.onclick = () => close(true);
            setTimeout(() => { mark.disabled = false; mark.focus(); }, 50);
          } else {
            fb.className = 'feedback bad';
            NP.Audio.sfx('error');
            NP.Director.progress();
          }
        });
        p.append(el('div', { class: 'records-wrap' }, [head, table]), evid, fb,
          el('div', { class: 'row' }, [mark, el('button', { class: 'btn ghost', text: T('ui.hint'), onclick: () => NP.Hints.open() }), el('button', { class: 'btn ghost', text: T('ui.leave'), onclick: () => close(false) })]));
      }, { onClose: (r) => { NP.Hints.puzzle = null; resolve(!!r); } });
    });
  };

  // ---------- Синхронизация: восстановить порядок событий ----------
  P.sync = function (def, id) {
    return new Promise((resolve) => {
      const order = def.shuffled.slice();
      NP.Hints.puzzle = {
        id, keys: ['hint.sync.1', 'hint.sync.2', 'hint.sync.3'],
        step() {
          for (let i = 0; i < def.answer.length; i++) if (order[i] !== def.answer[i]) return T('hint.sync.step', { n: i + 1, what: T('sync.' + def.answer[i]) });
          return null;
        },
      };
      NP.UI.openModal('sync', (p, close) => {
        let solved = false;
        p.appendChild(el('h2', { text: T('pz.' + id + '.title') }));
        p.appendChild(el('p', { class: 'intro', text: T('pz.' + id + '.intro') }));
        const list = el('ol', { class: 'sync-list' });
        const fb = el('p', { class: 'feedback', 'aria-live': 'polite' });
        let marks = null;
        const draw = (focusIdx, focusDir) => {
          list.innerHTML = '';
          order.forEach((it, i) => {
            const up = el('button', { class: 'btn small', 'aria-label': T('sync.up'), text: '▲' });
            const dn = el('button', { class: 'btn small', 'aria-label': T('sync.down'), text: '▼' });
            up.disabled = i === 0 || solved; dn.disabled = i === order.length - 1 || solved;
            up.addEventListener('click', () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; marks = null; NP.Audio.sfx('rotate'); draw(i - 1, 'up'); });
            dn.addEventListener('click', () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; marks = null; NP.Audio.sfx('rotate'); draw(i + 1, 'dn'); });
            const mk = marks ? (marks[i] ? '✓' : '·') : '';
            list.appendChild(el('li', { class: marks && marks[i] ? 'ok' : '' }, [el('span', { class: 'mk', text: mk }), el('span', { class: 'txt', text: T('sync.' + it) }), el('span', { class: 'arrows' }, [up, dn])]));
            if (focusIdx === i) setTimeout(() => (focusDir === 'up' ? (up.disabled ? dn : up) : dn.disabled ? up : dn).focus(), 0);
          });
        };
        const check = el('button', { class: 'btn primary', text: T('sync.check') });
        check.addEventListener('click', () => {
          if (solved) return close(true);
          marks = order.map((it, i) => it === def.answer[i]);
          const n = marks.filter(Boolean).length;
          if (n === order.length) {
            solved = true;
            fb.textContent = T('pz.' + id + '.done');
            fb.className = 'feedback good';
            check.textContent = T('ui.continue');
            NP.Audio.sfx('success');
          } else {
            fb.textContent = T('sync.partial', { n, total: order.length });
            fb.className = 'feedback bad';
            NP.Audio.sfx('error');
            NP.Director.progress();
          }
          draw();
        });
        p.append(list, fb, el('div', { class: 'row' }, [check, el('button', { class: 'btn ghost', text: T('ui.hint'), onclick: () => NP.Hints.open() }), el('button', { class: 'btn ghost', text: T('ui.leave'), onclick: () => close(false) })]));
        draw();
      }, { onClose: (r) => { NP.Hints.puzzle = null; resolve(!!r); } });
    });
  };
})();
