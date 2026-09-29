// DialogueRunner: реплики из данных, печать текста, выбор 2–3 ответов, история.
(function () {
  const NP = window.NP;
  const $ = (id) => document.getElementById(id);
  const SPEEDS = { slow: 28, normal: 55, fast: 120, instant: 1e9 };

  let active = null;

  const D = (NP.Dialogue = {
    isOpen() { return !!active; },
    textKey(dlgId, lineId, choiceId) {
      return 'dlg.' + dlgId + '.' + lineId + (choiceId ? '.' + choiceId : '');
    },
    run(dlgId) {
      const dlg = NP.Data.dialogues[dlgId];
      if (!dlg) { console.error('Нет диалога', dlgId); return Promise.resolve(); }
      return new Promise((resolve) => {
        active = { id: dlgId, dlg, resolve, lineId: null, typing: false, shown: 0, full: '', choices: null, sel: 0, autoT: null };
        $('dialogue').hidden = false;
        NP.UI.clearLabels();
        D.go(dlg.start);
      });
    },
    async go(lineId) {
      const a = active;
      clearTimeout(a.autoT);
      // Пропускаем реплики, условие которых не выполнено.
      let line = lineId ? a.dlg.lines[lineId] : null;
      while (line && line.if !== undefined && !NP.cond(line.if)) { lineId = line.next; line = lineId ? a.dlg.lines[lineId] : null; }
      if (!line) return D.close();
      a.lineId = lineId;
      if (line.effects) await NP.Director.run(line.effects, true);
      const key = line.text_key || D.textKey(a.id, lineId);
      const speaker = line.speaker;
      NP.GameState.pushLog(speaker, key);
      a.full = NP.T(key);
      a.shown = 0;
      a.typing = true;
      a.choices = null;
      const box = $('dialogue');
      box.className = 'dlg spk-' + speaker;
      const cv = $('dlg-portrait');
      cv.hidden = speaker === 'sys';
      if (!cv.hidden) NP.Sprites.drawPortrait(cv, line.portrait || speaker, 0);
      $('dlg-name').textContent = speaker === 'sys' ? '' : NP.T('speaker.' + speaker);
      $('dlg-name').hidden = speaker === 'sys';
      $('dlg-text').textContent = '';
      $('dlg-choices').innerHTML = '';
      $('dlg-next').hidden = true;
      NP.Audio.voice(speaker);
      D.tick();
    },
    tick() {
      const a = active;
      if (!a || !a.typing) return;
      const cps = SPEEDS[NP.Settings.values.textSpeed] || 55;
      a.shown = Math.min(a.full.length, a.shown + cps / 60);
      $('dlg-text').textContent = a.full.slice(0, Math.floor(a.shown));
      if (Math.floor(a.shown) % 3 === 0 && cps < 1000) NP.Audio.typeTick();
      if (a.shown >= a.full.length) D.finishTyping();
      else requestAnimationFrame(D.tick);
    },
    finishTyping() {
      const a = active;
      a.typing = false;
      $('dlg-text').textContent = a.full;
      const line = a.dlg.lines[a.lineId];
      const choices = (line.choices || []).filter((c) => NP.cond(c.if));
      if (choices.length) {
        a.choices = choices;
        a.sel = 0;
        const list = $('dlg-choices');
        choices.forEach((c, i) => {
          const b = NP.el('button', { class: 'choice', 'data-i': i }, [
            NP.el('span', { class: 'num', text: String(i + 1) }),
            NP.el('span', { text: NP.T(c.text_key || D.textKey(a.id, a.lineId, c.id)) }),
          ]);
          b.addEventListener('click', (e) => { e.stopPropagation(); D.choose(i); });
          list.appendChild(b);
        });
        D.highlight();
      } else {
        $('dlg-next').hidden = false;
        if (NP.Settings.values.autoAdvance) a.autoT = setTimeout(() => active === a && D.advance(), 1400 + a.full.length * 30);
      }
    },
    highlight() {
      const a = active;
      $('dlg-choices').querySelectorAll('.choice').forEach((b, i) => b.classList.toggle('sel', i === a.sel));
    },
    advance() {
      const a = active;
      if (!a) return;
      if (a.typing) { a.shown = a.full.length; return D.finishTyping(); }
      if (a.choices) return;
      NP.Audio.sfx('blip');
      D.go(a.dlg.lines[a.lineId].next);
    },
    async choose(i) {
      const a = active;
      if (!a || !a.choices || !a.choices[i]) return;
      const c = a.choices[i];
      a.choices = null;
      NP.Audio.sfx('confirm');
      const key = c.text_key || D.textKey(a.id, a.lineId, c.id);
      NP.GameState.pushLog('ilya_choice', key);
      if (c.effects) await NP.Director.run(c.effects, true);
      D.go(c.next);
    },
    close() {
      const a = active;
      active = null;
      $('dialogue').hidden = true;
      NP.Input.clearPressed();
      NP.Director.progress();
      a && a.resolve();
    },
    onKey(e) {
      if (!active || NP.UI.modalOpen() || e.repeat) return;
      const a = active;
      const keys = NP.Settings.values.keys;
      if (a.choices) {
        if (/^Digit[1-9]$/.test(e.code)) { e.preventDefault(); D.choose(+e.code.slice(5) - 1); return; }
        if (keys.up.indexOf(e.code) >= 0) { e.preventDefault(); a.sel = (a.sel + a.choices.length - 1) % a.choices.length; D.highlight(); return; }
        if (keys.down.indexOf(e.code) >= 0) { e.preventDefault(); a.sel = (a.sel + 1) % a.choices.length; D.highlight(); return; }
        if (keys.act.indexOf(e.code) >= 0) { e.preventDefault(); D.choose(a.sel); return; }
        return;
      }
      if (keys.act.indexOf(e.code) >= 0) { e.preventDefault(); D.advance(); }
    },
    init() {
      window.addEventListener('keydown', D.onKey);
      $('dialogue').addEventListener('click', (e) => { if (!e.target.closest('button')) D.advance(); });
      $('dlg-log').addEventListener('click', (e) => { e.stopPropagation(); NP.Journal.open('log'); });
      // Портрет Миры «шумит» — перерисовываем, пока открыт диалог.
      setInterval(() => {
        if (active && active.dlg.lines[active.lineId] && active.dlg.lines[active.lineId].speaker === 'mira') {
          NP.Sprites.drawPortrait($('dlg-portrait'), 'mira', performance.now() / 1000);
        }
      }, 80);
    },
  });
})();
