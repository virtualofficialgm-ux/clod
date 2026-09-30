// Главное меню, пауза, настройки (доступность, звук, клавиши), итог эпизода.
(function () {
  const NP = window.NP;
  const el = NP.el, T = NP.T;
  const $ = (id) => document.getElementById(id);

  const M = (NP.Menus = {
    title() {
      const box = $('title');
      box.hidden = false;
      const menu = $('title-menu');
      menu.innerHTML = '';
      const save = NP.SaveManager.latest();
      if (save) {
        const sc = NP.Data.scenes[save.scene_id];
        const where = save.campaign ? T('camp.saved', { h: save.campaign.h, a: save.campaign.a }) : sc ? T('scene.' + save.scene_id) : '';
        menu.appendChild(el('button', { class: 'btn primary', onclick: () => NP.Director.continueGame(save) }, [
          T('menu.continue'), el('small', { text: where + ' · ' + NP.formatTime(save.playtime_seconds) }),
        ]));
      }
      menu.appendChild(el('button', { class: 'btn' + (save ? '' : ' primary'), text: T('menu.new'), onclick: async () => {
        if (save && !(await NP.UI.confirm(T('menu.new_confirm_title'), T('menu.new_confirm'), T('menu.new'), T('ui.cancel')))) return;
        NP.Audio.unlock();
        NP.Director.newGame();
      } }));
      menu.appendChild(el('button', { class: 'btn', text: T('menu.settings'), onclick: () => M.settings() }));
      menu.appendChild(el('button', { class: 'btn', text: T('menu.about'), onclick: () => M.about() }));
      NP.Audio.music('title');
      setTimeout(() => { const b = menu.querySelector('button'); b && b.focus(); }, 50);
    },
    closeTitle() { $('title').hidden = true; },

    pause() {
      if (NP.UI.modalOpen()) return;
      NP.UI.openModal('small pause', (p, close) => {
        p.appendChild(el('h2', { text: T('menu.pause') }));
        const col = el('div', { class: 'col' });
        const canSave = NP.Director.scene && !NP.Director.scene.action && !NP.Dialogue.isOpen();
        col.append(
          el('button', { class: 'btn primary', text: T('menu.resume'), onclick: () => close() }),
          el('button', { class: 'btn', text: T('menu.journal'), onclick: () => { close(); NP.Journal.open(); } }),
          el('button', { class: 'btn', text: canSave ? T('menu.save') : T('menu.save_blocked'), disabled: !canSave, onclick: () => {
            const pl = NP.World.player;
            NP.GameState.data.pos = { x: pl.x, y: pl.y, dir: pl.dir };
            NP.UI.toast(NP.SaveManager.save('manual') ? T('menu.saved') : T('menu.save_failed'));
            close();
          } }),
          el('button', { class: 'btn', text: T('menu.load'), onclick: () => { close(); M.load(); } }),
          el('button', { class: 'btn', text: T('menu.settings'), onclick: () => { close(); M.settings(); } }),
          el('button', { class: 'btn ghost', text: T('menu.to_title'), onclick: async () => {
            close();
            if (await NP.UI.confirm(T('menu.to_title'), T('menu.to_title_text'), T('menu.to_title'), T('ui.cancel'))) NP.Director.toTitle();
          } }),
        );
        p.appendChild(col);
        p.appendChild(el('p', { class: 'dim small', text: T('menu.playtime') + ': ' + NP.formatTime(NP.GameState.data.playtime_seconds) }));
      });
    },

    load() {
      NP.UI.openModal('small', (p, close) => {
        p.appendChild(el('h2', { text: T('menu.load') }));
        const col = el('div', { class: 'col' });
        let any = false;
        for (const slot of ['auto', 'manual']) {
          const d = NP.SaveManager.read(slot);
          if (!d) continue;
          any = true;
          const when = new Date(d.saved_at);
          col.appendChild(el('button', { class: 'btn', onclick: () => { close(); NP.Director.continueGame(d); } }, [
            T('save.' + slot), el('small', { text: T('scene.' + d.scene_id) + ' · ' + when.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) }),
          ]));
        }
        if (!any) col.appendChild(el('p', { class: 'dim', text: T('save.none') }));
        col.appendChild(el('button', { class: 'btn ghost', text: T('ui.close'), onclick: () => close() }));
        p.appendChild(col);
      });
    },

    about() {
      NP.UI.openModal('small about', (p, close) => {
        p.appendChild(el('h2', { text: T('about.title') }));
        ['about.p1', 'about.p2', 'about.p3'].forEach((k) => p.appendChild(el('p', { text: T(k) })));
        p.appendChild(el('button', { class: 'btn primary', text: T('ui.close'), onclick: () => close() }));
      });
    },

    settings() {
      const S = NP.Settings;
      NP.UI.openModal('settings', (p, close) => {
        p.appendChild(el('div', { class: 'journal-top' }, [el('h2', { text: T('menu.settings') }), el('button', { class: 'btn ghost close', text: T('ui.close'), onclick: () => close() })]));
        const body = el('div', { class: 'tab-body settings-grid' });
        const slider = (key) => {
          const id = 'set-' + key;
          const inp = el('input', { type: 'range', id, min: 0, max: 1, step: 0.05, value: S.values[key] });
          inp.addEventListener('input', () => { S.values[key] = +inp.value; S.save(); });
          inp.addEventListener('change', () => NP.Audio.sfx('blip'));
          return el('div', { class: 'set' }, [el('label', { for: id, text: T('set.' + key) }), inp]);
        };
        const choice = (key, opts) => {
          const group = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': T('set.' + key) });
          opts.forEach((o) => {
            const b = el('button', { role: 'radio', 'aria-checked': String(S.values[key] === o), text: T('set.' + key + '.' + o) });
            b.addEventListener('click', () => {
              S.values[key] = o; S.save();
              group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
              NP.Audio.sfx('blip');
            });
            group.appendChild(b);
          });
          return el('div', { class: 'set' }, [el('span', { class: 'lbl', text: T('set.' + key) }), group]);
        };
        const toggle = (key) => {
          const id = 'set-' + key;
          const inp = el('input', { type: 'checkbox', id });
          inp.checked = !!S.values[key];
          inp.addEventListener('change', () => { S.values[key] = inp.checked; S.save(); NP.Audio.sfx('blip'); });
          return el('div', { class: 'set toggle' }, [inp, el('label', { for: id }, [T('set.' + key), el('small', { text: T('set.' + key + '.desc') })])]);
        };
        body.append(
          el('h3', { text: T('set.sound') }), slider('music'), slider('sfx'), slider('voice'),
          el('h3', { text: T('set.text') }), choice('textSpeed', ['slow', 'normal', 'fast', 'instant']), choice('textSize', ['s', 'm', 'l', 'xl']), toggle('autoAdvance'),
          el('h3', { text: T('set.access') }), toggle('reduceFlash'), toggle('easyChase'),
          el('h3', { text: T('set.keys') }),
        );
        const keys = el('div', { class: 'keys' });
        const drawKeys = () => {
          keys.innerHTML = '';
          ['up', 'down', 'left', 'right', 'act', 'journal', 'hint', 'scan', 'menu'].forEach((a) => {
            const b = el('button', { class: 'btn small', text: S.values.keys[a].map(NP.Input.keyName).join(' / ') });
            b.addEventListener('click', () => {
              b.textContent = T('set.press_key');
              NP.Input.listenOnce((code) => {
                if (code !== 'Escape' || a === 'menu') {
                  // Клавиша закрепляется за одним действием.
                  for (const k in S.values.keys) S.values.keys[k] = S.values.keys[k].filter((c) => c !== code);
                  S.values.keys[a] = [code].concat(S.values.keys[a].filter((c) => c !== code)).slice(0, 2);
                  S.save();
                }
                drawKeys();
              });
            });
            keys.appendChild(el('div', { class: 'keyrow' }, [el('span', { text: T('key.' + a) }), b]));
          });
          keys.appendChild(el('button', { class: 'btn ghost small', text: T('set.reset_keys'), onclick: () => { S.resetKeys(); drawKeys(); } }));
        };
        drawKeys();
        body.appendChild(keys);
        p.appendChild(body);
      });
    },

    // Три раунда за пришельцами: переиграть последний раунд или выйти.
    gameOver() {
      return new Promise((res) => {
        NP.UI.openModal('small gameover', (p, close) => {
          p.appendChild(el('p', { class: 'eyebrow', text: T('camp.over.eyebrow') }));
          p.appendChild(el('h2', { text: T('camp.over.title') }));
          p.appendChild(el('p', { text: T('camp.over.text') }));
          p.appendChild(el('div', { class: 'row' }, [
            el('button', { class: 'btn primary', text: T('camp.over.retry'), onclick: () => close(true) }),
            el('button', { class: 'btn ghost', text: T('menu.to_title'), onclick: () => close(false) }),
          ]));
        }, { noEscape: true, onClose: (r) => res(!!r) });
      });
    },
    campaignEnd() {
      const GS = NP.GameState, c = GS.data.campaign;
      const box = $('summary');
      box.hidden = false;
      box.innerHTML = '';
      const shelf = el('div', { class: 'shelf' });
      ['centipede', 'chase', 'skyfight', 'kong'].forEach((id) => {
        const won = GS.gameResult(id) === 'won';
        const cv = el('canvas', { class: 'trophy-icon' + (won ? '' : ' dim'), width: 16, height: 16 });
        NP.Arcade.drawTrophy(cv, id);
        shelf.appendChild(el('div', { class: 'trophy' }, [cv, el('div', {}, [el('b', { text: T('arc.' + id + '.trophy') }), el('small', { text: won ? T('arc.' + id + '.title') : T('camp.end.no_trophy') })])]));
      });
      box.appendChild(el('div', { class: 'summary-inner' }, [
        el('p', { class: 'eyebrow', text: T('camp.end.eyebrow') }),
        el('h1', { text: T('camp.end.title', { h: c.h, a: c.a }) }),
        el('p', { text: T(c.a === 0 ? 'camp.end.flawless' : 'camp.end.text', { a: c.a }) }),
        el('section', { class: 'games-box' }, [el('h3', { text: T('journal.trophies') }), shelf]),
        el('p', { class: 'dim', text: T('end.time', { t: NP.formatTime(GS.data.playtime_seconds) }) }),
        el('div', { class: 'row' }, [el('button', { class: 'btn primary', text: T('menu.to_title'), onclick: () => { box.hidden = true; NP.Director.toTitle(); } })]),
      ]));
      setTimeout(() => { const b = box.querySelector('.btn.primary'); b && b.focus(); }, 50);
    },

    episodeSummary() {
      const GS = NP.GameState;
      const box = $('summary');
      box.hidden = false;
      box.innerHTML = '';
      const shared = GS.flag('shared_with_zero');
      const evTotal = Object.keys(NP.Data.evidence).filter((id) => NP.Data.evidence[id].episode === 'e01').length;
      const evGot = GS.data.evidence_ids.filter((id) => NP.Data.evidence[id].episode === 'e01').length;
      const lostN = GS.countGames('lost');
      const gamesBox = el('section', { class: 'games-box' });
      NP.Journal.renderGames(gamesBox);
      const inner = el('div', { class: 'summary-inner' }, [
        el('p', { class: 'eyebrow', text: T('end.eyebrow') }),
        el('h1', { text: T('end.title') }),
        el('div', { class: 'summary-grid' }, [
          el('section', {}, [
            el('h3', { text: T('end.choice') }),
            el('p', { text: T(shared ? 'end.choice_shared' : 'end.choice_hidden') }),
            el('h3', { text: T('end.trust') }),
            NP.Journal.trustMeter(T('speaker.nul'), GS.trust('trust_zero')),
            NP.Journal.trustMeter(T('speaker.mira'), GS.trust('trust_mira')),
            el('h3', { text: T('end.stats') }),
            el('p', { text: T('end.evidence', { n: evGot, total: evTotal }) + ' · ' + T('end.time', { t: NP.formatTime(GS.data.playtime_seconds) }) }),
          ]),
          el('section', { class: 'office-msg' }, [
            el('h3', { text: T('end.office') }),
            el('p', { class: 'msg' }, [el('b', { text: T('speaker.vera') + ': ' }), T(lostN >= 3 ? 'end.vera_blackout' : shared ? 'end.vera_shared' : 'end.vera_hidden')]),
            el('p', { class: 'dim', text: T(lostN >= 3 ? 'end.city_blackout' : lostN ? 'end.city_hurt' : 'end.city', { n: lostN }) }),
          ]),
          gamesBox,
        ]),
        el('div', { class: 'next' }, [el('p', { class: 'eyebrow', text: T('end.next_eyebrow') }), el('h2', { text: T('end.next') }), el('p', { text: T('end.next_hook') })]),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn', text: T('end.replay'), onclick: () => {
            const d = NP.SaveManager.read('prechoice');
            box.hidden = true;
            if (d) NP.Director.continueGame(d); else NP.Director.toTitle();
          } }),
          el('button', { class: 'btn primary', text: T('menu.to_title'), onclick: () => { box.hidden = true; NP.Director.toTitle(); } }),
        ]),
      ]);
      box.appendChild(inner);
      setTimeout(() => { const b = box.querySelector('.btn.primary'); b && b.focus(); }, 50);
    },
  });
})();
