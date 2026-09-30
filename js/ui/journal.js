// Журнал (цели, улики, показания, доска расследования, история) и трёхступенчатые подсказки.
(function () {
  const NP = window.NP;
  const el = NP.el, T = NP.T;
  const GS = NP.GameState;

  const TABS = ['goals', 'evidence', 'testimony', 'board', 'log'];

  function evidenceCard(id, selectable, selected, onToggle) {
    const ev = NP.Data.evidence[id];
    const card = el(selectable ? 'button' : 'div', { class: 'card kind-' + ev.kind + (selected ? ' sel' : ''), 'aria-pressed': selectable ? String(!!selected) : null }, [
      el('span', { class: 'kind', text: T('kind.' + ev.kind) }),
      el('b', { text: T('ev.' + id + '.title') }),
      el('p', { text: T('ev.' + id + '.text') }),
    ]);
    if (selectable) card.addEventListener('click', onToggle);
    return card;
  }

  const J = (NP.Journal = {
    open(tab) {
      if (NP.UI.modalOpen()) return;
      tab = tab || 'goals';
      NP.UI.openModal('journal', (p, close) => {
        const head = el('div', { class: 'tabs', role: 'tablist' });
        const body = el('div', { class: 'tab-body' });
        const render = (t) => {
          tab = t;
          head.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
          body.innerHTML = '';
          J['render_' + t](body, close);
          body.scrollTop = t === 'log' ? body.scrollHeight : 0;
        };
        TABS.forEach((t) => {
          const b = el('button', { role: 'tab', 'data-tab': t, text: T('journal.' + t) });
          b.addEventListener('click', () => render(t));
          head.appendChild(b);
        });
        p.appendChild(el('div', { class: 'journal-top' }, [el('h2', { text: T('journal.title') }), el('button', { class: 'btn ghost close', text: T('ui.close'), onclick: () => close() })]));
        p.appendChild(head);
        p.appendChild(body);
        render(tab);
      });
    },
    render_goals(b) {
      const cur = GS.data.objective;
      b.appendChild(el('h3', { text: T('journal.current') }));
      b.appendChild(el('p', { class: 'goal-now', text: cur ? NP.Director.objectiveText(cur) : T('journal.no_goal') }));
      if (GS.data.objectives_done.length) {
        b.appendChild(el('h3', { text: T('journal.done') }));
        const ul = el('ul', { class: 'done' });
        GS.data.objectives_done.slice().reverse().forEach((id) => ul.appendChild(el('li', { text: '✓ ' + T('obj.' + id) })));
        b.appendChild(ul);
      }
      J.renderGames(b);
      const tv = GS.data.trust_values;
      b.appendChild(el('h3', { text: T('journal.trust') }));
      const row = el('div', { class: 'trust' });
      [['trust_zero', 'nul'], ['trust_mira', 'mira']].forEach(([k, who]) => {
        if (who === 'mira' && !GS.flag('met_mira')) return;
        row.appendChild(J.trustMeter(T('speaker.' + who), tv[k]));
      });
      b.appendChild(row);
    },
    // Трофеи за выигранные автоматы и последствия проигранных.
    renderGames(b) {
      const games = GS.data.games;
      const won = Object.keys(games).filter((k) => games[k] === 'won');
      const lost = Object.keys(games).filter((k) => games[k] === 'lost');
      b.appendChild(el('h3', { text: T('journal.trophies') + ' · ' + won.length + '/' + Object.keys(NP.Data.arcades).length }));
      if (!won.length) b.appendChild(el('p', { class: 'dim', text: T('journal.no_trophies') }));
      else {
        const shelf = el('div', { class: 'shelf' });
        won.forEach((id) => {
          const cv = el('canvas', { class: 'trophy-icon', width: 16, height: 16 });
          NP.Arcade.drawTrophy(cv, id);
          shelf.appendChild(el('div', { class: 'trophy' }, [cv, el('div', {}, [el('b', { text: T('arc.' + id + '.trophy') }), el('small', { text: T('arc.' + id + '.title') })])]));
        });
        b.appendChild(shelf);
      }
      if (lost.length) {
        b.appendChild(el('h3', { text: T('journal.incidents') + ' · ' + lost.length + '/3' }));
        lost.forEach((id) => b.appendChild(el('p', { class: 'incident', text: T('arc.news', { t: NP.Data.arcades[id].newsTime }) + ' — ' + T('arc.' + id + '.news') })));
      }
    },
    trustMeter(name, v) {
      const cells = el('div', { class: 'meter', 'aria-label': name + ': ' + v });
      for (let i = -2; i <= 2; i++) cells.appendChild(el('i', { class: (i === 0 ? 'zero ' : '') + ((v > 0 && i > 0 && i <= v) || (v < 0 && i < 0 && i >= v) ? 'on' : '') }));
      return el('div', { class: 'trust-item' }, [el('span', { text: name }), cells, el('small', { text: T('trust.' + v) })]);
    },
    listByKind(b, kinds, emptyKey) {
      const ids = GS.data.evidence_ids.filter((id) => kinds.indexOf(NP.Data.evidence[id].kind) >= 0);
      if (!ids.length) { b.appendChild(el('p', { class: 'dim', text: T(emptyKey) })); return; }
      const grid = el('div', { class: 'cards' });
      ids.forEach((id) => grid.appendChild(evidenceCard(id)));
      b.appendChild(grid);
    },
    render_evidence(b) { J.listByKind(b, ['evidence', 'key'], 'journal.no_evidence'); },
    render_testimony(b) { J.listByKind(b, ['testimony'], 'journal.no_testimony'); },
    render_log(b) {
      const log = GS.data.log;
      if (!log.length) { b.appendChild(el('p', { class: 'dim', text: T('journal.no_log') })); return; }
      log.forEach((l) => {
        const who = l.s === 'ilya_choice' ? 'ilya' : l.s;
        b.appendChild(el('p', { class: 'logline spk-' + who + (l.s === 'ilya_choice' ? ' choice' : '') }, [
          who !== 'sys' ? el('b', { text: T('speaker.' + who) + (l.s === 'ilya_choice' ? ' ▸' : ':') + ' ' }) : null,
          el('span', { text: T(l.k) }),
        ]));
      });
    },
    render_board(b, close) {
      const cases = NP.Data.cases;
      let any = false;
      for (const id in cases) {
        const c = cases[id];
        if (!NP.cond(c.available)) continue;
        any = true;
        const solved = GS.data.conclusions.indexOf(c.conclusion) >= 0;
        const sec = el('section', { class: 'case' + (solved ? ' solved' : '') });
        sec.appendChild(el('h3', { text: T('case.' + id + '.title') }));
        if (solved) {
          sec.appendChild(el('p', { class: 'conclusion', text: '✓ ' + T('concl.' + c.conclusion) }));
        } else if (!NP.cond(c.ready)) {
          sec.appendChild(el('p', { class: 'dim', text: T('case.' + id + '.notready') }));
        } else {
          J.boardUI(sec, id, close);
        }
        b.appendChild(sec);
      }
      if (!any) b.appendChild(el('p', { class: 'dim', text: T('journal.no_cases') }));
      if (GS.data.refuted.length) {
        b.appendChild(el('h3', { text: T('journal.versions') }));
        GS.data.refuted.forEach((r) => b.appendChild(el('p', { class: 'refuted' }, [el('s', { text: T(r + '') }), el('br'), el('small', { text: T(r + '.why') })])));
      }
    },
    // Доска: выбрать 2–3 записи и тезис; неверная версия не сжигает улики.
    boardUI(sec, caseId, close) {
      const c = NP.Data.cases[caseId];
      const picked = new Set();
      let thesis = null;
      sec.appendChild(el('p', { class: 'dim', text: T('board.instructions') }));
      const grid = el('div', { class: 'cards pick' });
      const ids = GS.data.evidence_ids.filter((id) => NP.Data.evidence[id].kind !== 'key');
      const renderCards = () => {
        grid.innerHTML = '';
        ids.forEach((id) => grid.appendChild(evidenceCard(id, true, picked.has(id), () => {
          if (picked.has(id)) picked.delete(id);
          else if (picked.size < 3) picked.add(id);
          else NP.UI.toast(T('board.max3'));
          NP.Audio.sfx('blip');
          renderCards();
        })));
      };
      renderCards();
      sec.appendChild(grid);
      sec.appendChild(el('h4', { text: T('board.thesis') }));
      const th = el('div', { class: 'theses', role: 'radiogroup' });
      c.theses.forEach((t) => {
        const b = el('button', { class: 'thesis', role: 'radio', 'aria-checked': 'false', text: T('case.' + caseId + '.' + t.id) });
        b.addEventListener('click', () => {
          thesis = t;
          th.querySelectorAll('.thesis').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          NP.Audio.sfx('blip');
        });
        th.appendChild(b);
      });
      sec.appendChild(th);
      const fb = el('p', { class: 'feedback', 'aria-live': 'polite' });
      const check = el('button', { class: 'btn primary', text: T('board.check') });
      check.addEventListener('click', async () => {
        if (picked.size < 2) { fb.textContent = T('board.need2'); fb.className = 'feedback bad'; NP.Audio.sfx('error'); return; }
        if (!thesis) { fb.textContent = T('board.needthesis'); fb.className = 'feedback bad'; NP.Audio.sfx('error'); return; }
        if (!thesis.correct) {
          fb.textContent = T('case.' + caseId + '.' + thesis.id + '.why');
          fb.className = 'feedback bad';
          GS.addRefuted('case.' + caseId + '.' + thesis.id);
          NP.Audio.sfx('error');
          NP.Director.progress();
          return;
        }
        const ok = c.required.every((group) => group.some((id) => picked.has(id)));
        if (!ok) { fb.textContent = T('case.' + caseId + '.missing'); fb.className = 'feedback bad'; NP.Audio.sfx('error'); return; }
        GS.addConclusion(c.conclusion);
        NP.Audio.sfx('success');
        close();
        await NP.Director.interact({ actions: c.onSolve });
      });
      sec.appendChild(el('div', { class: 'row' }, [check]));
      sec.appendChild(fb);
    },
  });

  // --- Подсказки: направление → принцип → конкретный шаг. Не влияют на исход.
  const H = (NP.Hints = {
    puzzle: null, // {id, keys:[3], step: fn -> string|null}
    open() {
      if (NP.UI.modalOpen() && !H.puzzle) return;
      const ctx = H.puzzle;
      const id = ctx ? 'pz_' + ctx.id : GS.data.objective;
      if (!id) { NP.UI.toast(T('hint.none')); return; }
      const keys = ctx ? ctx.keys : ((NP.Data.objectives[GS.data.objective] || {}).hints || []);
      if (!keys.length) { NP.UI.toast(T('hint.none')); return; }
      NP.UI.hintPulse(false);
      NP.UI.openModal('small hint', (p, close) => {
        const lvl = () => GS.data.hint_levels[id] || 1;
        if (!GS.data.hint_levels[id]) GS.data.hint_levels[id] = 1;
        const list = el('ol', { class: 'hints' });
        const more = el('button', { class: 'btn', text: T('hint.more') });
        const draw = () => {
          list.innerHTML = '';
          for (let i = 0; i < lvl() && i < keys.length; i++) {
            let text = T(keys[i]);
            if (i === 2 && ctx && ctx.step) text = ctx.step() || text;
            list.appendChild(el('li', {}, [el('small', { text: T('hint.tier' + (i + 1)) }), el('span', { text })]));
          }
          more.hidden = lvl() >= keys.length;
        };
        more.addEventListener('click', () => { GS.data.hint_levels[id] = lvl() + 1; draw(); NP.Audio.sfx('blip'); });
        if (GS.flag('companion')) {
          const cv = el('canvas', { class: 'portrait mini', width: 16, height: 16 });
          NP.Sprites.drawPortrait(cv, 'pix', 0);
          p.appendChild(el('div', { class: 'hint-head' }, [cv, el('h2', { text: T('hint.title_pix') })]));
        } else p.appendChild(el('h2', { text: T('hint.title') }));
        p.appendChild(list);
        p.appendChild(el('div', { class: 'row' }, [more, el('button', { class: 'btn primary', text: T('ui.close'), onclick: () => close() })]));
        p.appendChild(el('p', { class: 'dim small', text: T('hint.note') }));
        draw();
      });
    },
  });
})();
