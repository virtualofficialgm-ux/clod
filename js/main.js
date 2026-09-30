// EpisodeDirector: игровой цикл, исполнение эффектов из данных, переходы сцен, катсцены.
(function () {
  const NP = window.NP;
  const GS = NP.GameState;
  const T = NP.T, el = NP.el;
  const $ = (id) => document.getElementById(id);

  let canvas, ctx;
  let last = 0;
  const fails = {};
  const easyOffered = {};

  const Dir = (NP.Director = {
    mode: 'boot',
    busy: 0,
    scene: null,
    lastProgress: performance.now(),
    pulsed: false,
    cut: null,

    canControl() {
      return Dir.mode === 'world' && !Dir.busy && !NP.Dialogue.isOpen() && !NP.UI.modalOpen();
    },
    progress() {
      Dir.lastProgress = performance.now();
      if (Dir.pulsed) { Dir.pulsed = false; NP.UI.hintPulse(false); }
    },

    objectiveText(id) {
      const o = NP.Data.objectives[id] || {};
      const params = {};
      if (o.count) { params.n = GS.countEvidence(o.count); params.total = o.total; }
      if (o.flags) { params.n = o.flags.filter((f) => GS.flag(f)).length; params.total = o.total; }
      return T('obj.' + id, params);
    },
    refreshObjective() {
      NP.UI.setObjective(GS.data.objective ? Dir.objectiveText(GS.data.objective) : '');
    },

    // --- Эффекты. Возвращает false, если цепочка остановлена (например, загадка отложена).
    async run(actions) {
      if (!actions) return true;
      for (const a of actions) {
        const r = await Dir.exec(a);
        if (r === false) return false;
      }
      return true;
    },
    async exec(a) {
      const [op, x, y, z] = a;
      switch (op) {
        case 'flag': GS.setFlag(x, y === undefined ? true : y); break;
        case 'trust': GS.addTrust(x, y); break;
        case 'evidence': {
          if (GS.addEvidence(x)) {
            const ev = NP.Data.evidence[x];
            NP.Audio.sfx('evidence');
            if (Dir.mode === 'world' && NP.World.fx) NP.World.burst('evidence');
            NP.UI.toast(T('toast.new_' + ev.kind) + ': ' + T('ev.' + x + '.title'), 'ev');
            Dir.refreshObjective();
          }
          break;
        }
        case 'dialogue': await NP.Dialogue.run(x); break;
        case 'bark': NP.UI.bark(x, y); break;
        case 'toast': NP.UI.toast(T(x), y); break;
        case 'puzzle': {
          const ok = await NP.Puzzles.run(x);
          Dir.progress();
          if (!ok) return false;
          break;
        }
        case 'objective': {
          const prev = GS.data.objective;
          if (prev && prev !== x && GS.data.objectives_done.indexOf(prev) < 0) GS.data.objectives_done.push(prev);
          GS.data.objective = x;
          Dir.progress();
          Dir.refreshObjective();
          break;
        }
        case 'scene': await Dir.gotoScene(x, y); return false; // старая сцена закончилась
        case 'cutscene': await Dir.playCutscene(x); break;
        case 'save': if (!Dir.scene || !Dir.scene.action) Dir.autosave(); break;
        case 'sfx': NP.Audio.sfx(x); break;
        case 'music': NP.Audio.music(x); break;
        case 'wait': await NP.sleep(x); break;
        case 'if': return Dir.run(NP.cond(x) ? y : z);
        case 'freeze': NP.World.freezeGuard(x, y); break;
        case 'emote': if (NP.World.emotes) NP.World.emote(x, y, z); break;
        case 'shake': if (!NP.Settings.values.reduceFlash) NP.World.shakeT = x || 0.4; break;
        case 'flash': Dir.flash(); break;
        case 'episode_end': await Dir.episodeEnd(); return false;
        case 'journal': NP.Journal.open(x); break;
        case 'arcade': {
          // Автомат уже сыгран — исход окончательный, повторно не запускается.
          if (GS.gameResult(x)) break;
          const r = await NP.Arcade.run(x);
          NP.Audio.music(Dir.scene ? Dir.scene.music : 'title');
          Dir.progress();
          if (r === 'quit') return false;
          GS.setGameResult(x, r);
          if (r === 'won') {
            NP.UI.toast(T('toast.trophy') + ': ' + T('arc.' + x + '.trophy'), 'ev');
            if (NP.World.fx) NP.World.burst('trophy');
            // Первый трофей оживает и становится спутником-подсказчиком.
            if (!GS.flag('companion')) { GS.setFlag('companion'); await NP.Dialogue.run('e01_companion'); }
          } else {
            await Dir.playInvasion(x);
            NP.UI.toast(T('toast.incident') + ': ' + T('arc.' + x + '.news_short'), 'warn');
            if (GS.countGames('lost') === 3) await NP.Dialogue.run('e01_nul_three');
          }
          if (!Dir.scene || !Dir.scene.action) Dir.autosave();
          break;
        }
        case 'save_prechoice': NP.SaveManager.save('prechoice'); break;
        case 'checkpoint': {
          // Новая стабильная точка внутри сцены (например, после моста).
          const sp = Dir.scene.spawns[x];
          if (sp) { NP.World.checkpoint = { x: sp.x * 16 + 8, y: sp.y * 16 + 12, dir: sp.dir || 'down' }; GS.data.checkpoint_id = x; }
          break;
        }
        default: console.warn('Неизвестный эффект', a);
      }
      return true;
    },

    async interact(it) {
      Dir.busy++;
      try { await Dir.run(it.actions); } finally { Dir.busy--; }
      Dir.refreshObjective();
    },

    autosave() {
      const p = NP.World.player;
      GS.data.pos = { x: p.x, y: p.y, dir: p.dir };
      if (NP.SaveManager.save('auto')) {
        const s = $('saving');
        s.hidden = false;
        clearTimeout(Dir._saveT);
        Dir._saveT = setTimeout(() => (s.hidden = true), 1400);
      }
    },

    async gotoScene(id, checkpoint, pos) {
      const sc = NP.Data.scenes[id];
      if (!sc) { console.error('Нет сцены', id); return; }
      Dir.busy++;
      await NP.UI.fade(true, 350);
      NP.UI.clearLabels();
      Dir.scene = sc;
      GS.data.scene_id = id;
      GS.data.episode_id = sc.episode_id;
      GS.data.checkpoint_id = checkpoint || 'start';
      (sc.reset_flags || []).forEach((f) => { GS.data.flags[f] = false; });
      GS.version++;
      NP.World.enter(sc, checkpoint || 'start', pos);
      Dir.mode = 'world';
      NP.UI.setHud(true);
      NP.Audio.music(sc.music);
      Dir.refreshObjective();
      $('scene-name').textContent = T('scene.' + id);
      if (!sc.action && !pos) Dir.autosave();
      await NP.UI.fade(false, 350);
      Dir.busy--;
      Dir.progress();
      const first = !GS.flag('visited_' + id);
      if (first) GS.setFlag('visited_' + id);
      if (first && sc.on_first_enter) { Dir.busy++; try { await Dir.run(sc.on_first_enter); } finally { Dir.busy--; } }
      if (sc.on_enter) { Dir.busy++; try { await Dir.run(sc.on_enter); } finally { Dir.busy--; } }
      Dir.refreshObjective();
    },

    // После поражения: возврат на контрольную точку сцены (не далее 2–3 минут).
    async onActionFail() {
      const sc = Dir.scene;
      Dir.busy++;
      fails[sc.id] = (fails[sc.id] || 0) + 1;
      await NP.sleep(450);
      NP.UI.toast(T('ui.crash_return'), 'warn');
      if (fails[sc.id] >= 2 && !NP.Settings.values.easyChase && !easyOffered[sc.id]) {
        easyOffered[sc.id] = true;
        const yes = await NP.UI.confirm(T('easy.title'), T('easy.text'), T('easy.yes'), T('easy.no'));
        if (yes) { NP.Settings.values.easyChase = true; NP.Settings.save(); NP.UI.toast(T('easy.on')); }
      }
      await NP.UI.fade(true, 300);
      (sc.reset_flags || []).forEach((f) => { GS.data.flags[f] = false; });
      GS.version++;
      NP.World.enter(sc, 'start');
      await NP.UI.fade(false, 300);
      Dir.busy--;
    },

    flash() {
      if (NP.Settings.values.reduceFlash) return;
      const f = $('flash');
      f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    },

    // --- Катсцены: подписи поверх процедурного фона, пропуск в любой момент.
    playCutscene(id) {
      const cs = typeof id === 'string' ? NP.Data.cutscenes[id] : id;
      return new Promise((resolve) => {
        const prevMode = Dir.mode;
        Dir.mode = 'cutscene';
        Dir.cut = { id, fx: cs.fx, t: 0, color: cs.color, stage: !!cs.stage };
        if (cs.stage) NP.Stage.start(cs.stage);
        NP.UI.setHud(false);
        NP.UI.clearLabels();
        if (cs.music) NP.Audio.music(cs.music);
        const box = $('cutscene');
        box.hidden = false;
        const cap = $('cut-caption');
        const title = $('cut-title');
        let i = -1, timer = null, done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          window.removeEventListener('keydown', onKey, true);
          box.removeEventListener('click', onClick);
          box.hidden = true;
          Dir.cut = null;
          NP.Stage.stop();
          Dir.mode = prevMode === 'world' ? 'world' : 'blank';
          if (Dir.mode === 'world') NP.UI.setHud(true);
          NP.Input.clearPressed();
          resolve();
        };
        const next = () => {
          clearTimeout(timer);
          i++;
          if (i >= cs.frames.length) return finish();
          const f = cs.frames[i];
          if (f.title) { title.textContent = T(f.key); title.hidden = false; cap.hidden = true; }
          else {
            title.hidden = true; cap.hidden = false;
            cap.innerHTML = '';
            if (f.speaker) cap.appendChild(el('b', { class: 'spk-' + f.speaker, text: T('speaker.' + f.speaker) }));
            cap.appendChild(el('span', { text: T(f.key) }));
            GS.pushLog(f.speaker || 'sys', f.key);
            if (f.speaker) NP.Audio.voice(f.speaker);
          }
          if (f.sfx) NP.Audio.sfx(f.sfx);
          if (f.fx) { Dir.cut.fx = f.fx; Dir.cut.stage = false; }
          if (f.stage) {
            if (!NP.Stage.active()) NP.Stage.start({ bg: f.stage });
            NP.Stage.run([['bg', f.stage]]);
            Dir.cut.stage = true;
          }
          if (f.do && NP.Stage.active()) NP.Stage.run(f.do);
          timer = setTimeout(next, f.ms || 3200);
        };
        const onKey = (e) => {
          if (e.repeat) return;
          if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
          else if (NP.Settings.values.keys.act.indexOf(e.code) >= 0) { e.preventDefault(); e.stopPropagation(); next(); }
        };
        const onClick = (e) => { if (e.target.id === 'cut-skip') finish(); else next(); };
        window.addEventListener('keydown', onKey, true);
        box.addEventListener('click', onClick);
        next();
      });
    },
    drawCutscene(g, dt) {
      const c = Dir.cut;
      c.t += dt;
      const t = c.t;
      if (c.stage) { NP.Stage.update(dt); NP.Stage.draw(g); return; }
      if (c.fx === 'transfer') {
        // Пиксели офиса «перетекают» в синюю сетку рабочего стола.
        const k = Math.min(1, t / 9);
        for (let y = 0; y < 360; y += 8) {
          for (let x = 0; x < 640; x += 8) {
            const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
            const on = Math.abs(h) < k;
            g.fillStyle = on ? ((x + y) % 16 ? '#1e3a6e' : '#2e5aa6') : ((x + y) % 16 ? '#8d8173' : '#857a6c');
            g.fillRect(x, y, 8, 8);
          }
        }
        const spr = NP.Sprites.person('ilya', 'down', 'idle');
        g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
        g.drawImage(spr, 314, 150, 12 * 3, 18 * 3);
        g.globalAlpha = 1;
      } else if (c.fx === 'hall') {
        // Июнь 1996: зал игровых автоматов, табло финала.
        g.fillStyle = '#0d0a14'; g.fillRect(0, 0, 640, 360);
        g.fillStyle = '#1a1024'; g.fillRect(0, 250, 640, 110);
        for (let i = 0; i < 7; i++) {
          const x = 30 + i * 88, on = Math.sin(t * 3 + i * 1.3) > -0.2;
          g.fillStyle = '#241634'; g.fillRect(x, 120, 56, 140);
          g.fillStyle = ['#ff5a5f', '#ffd166', '#7fe3ff', '#6fe3a1'][i % 4]; g.fillRect(x, 120, 56, 10);
          g.fillStyle = '#05050a'; g.fillRect(x + 8, 140, 40, 34);
          g.fillStyle = on ? ['#3cff9a', '#7fe3ff', '#ffd166'][i % 3] : '#10301f';
          for (let k = 0; k < 5; k++) g.fillRect(x + 12 + ((k * 13 + Math.floor(t * 20)) % 30), 146 + k * 5, 4, 3);
          g.fillStyle = '#ff5a5f'; g.fillRect(x + 14, 190, 6, 6); g.fillStyle = '#ffd166'; g.fillRect(x + 34, 190, 6, 6);
        }
        g.fillStyle = '#05050a'; g.fillRect(220, 24, 200, 70);
        g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.strokeRect(221, 25, 198, 68);
        g.fillStyle = '#ffd166'; g.font = 'bold 34px monospace'; g.textAlign = 'center';
        g.fillText(t > 11 ? '2 : 3' : '2 : 2', 320, 72); g.textAlign = 'left';
        g.fillStyle = '#9aa3b2'; g.font = '11px monospace'; g.fillText('ИЛЬЯ', 232, 42); g.fillText('ГЛЕБ', 380, 42);
      } else if (c.fx === 'invasion') {
        // Ночной город: пиксельная тварь из автомата рассыпает дома на кубики.
        const reduce = NP.Settings.values.reduceFlash;
        g.fillStyle = '#0a0c18'; g.fillRect(0, 0, 640, 360);
        const col = c.color || '#ff5a5f';
        for (let i = 0; i < 12; i++) {
          const x = i * 54, h = 90 + ((i * 53) % 120), bite = Math.max(0, Math.min(h, (t - i * 0.18) * 60));
          g.fillStyle = '#1b2033'; g.fillRect(x, 330 - h + bite, 50, h - bite);
          g.fillStyle = '#ffd98a';
          for (let wy = 330 - h + bite + 8; wy < 320; wy += 14) for (let wx = x + 6; wx < x + 44; wx += 12) if ((wx + wy) % 5) g.fillRect(wx, wy, 5, 6);
          for (let k = 0; k < Math.floor(bite / 12); k++) {
            const cy = 330 - h + ((k * 29 + t * 90 * (1 + (k % 3))) % (h + 30));
            g.fillStyle = k % 2 ? col : '#f4f1ea'; g.fillRect(x + (k * 17) % 46, cy, 6, 6);
          }
        }
        g.fillStyle = '#12141f'; g.fillRect(0, 330, 640, 30);
        const mx = 320 + Math.sin(t * 1.3) * 180, my = 60 + Math.sin(t * 2) * 12;
        g.fillStyle = col;
        const body = ['..XXXXXX..', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', 'X.X....X.X', '.X......X.'];
        body.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect(mx - 40 + x * 8, my + y * 8 + (reduce ? 0 : Math.round(Math.sin(t * 8 + x) * 1)), 8, 8); }));
      } else if (c.fx === 'erase') {
        g.fillStyle = '#0b0914'; g.fillRect(0, 0, 640, 360);
        const reduce = NP.Settings.values.reduceFlash;
        for (let i = 0; i < 60; i++) {
          const y = (i * 37 + Math.floor(t * (reduce ? 20 : 120))) % 360;
          g.fillStyle = i % 3 ? '#2a2140' : '#b69cff';
          g.fillRect((i * 97) % 640, y, 40 + (i % 5) * 20, 2);
        }
      } else {
        // Заставка: падающие нули и единицы в палитре главы.
        g.fillStyle = '#07080c'; g.fillRect(0, 0, 640, 360);
        g.font = '10px monospace';
        for (let i = 0; i < 70; i++) {
          const x = (i * 53) % 640, y = (i * 97 + t * (20 + (i % 7) * 8)) % 380 - 10;
          g.fillStyle = i % 9 === 0 ? '#ff4d57' : 'rgba(143,179,212,' + (0.15 + (i % 5) * 0.08) + ')';
          g.fillText(i % 4 ? '0' : '1', x, y);
        }
      }
    },

    // Проигрыш: игра вырывается в настоящий город и рассыпает его на кубики.
    playInvasion(id) {
      const def = NP.Data.arcades[id];
      return Dir.playCutscene({
        fx: 'invasion', color: def.color,
        stage: { bg: 'city', vars: { color: def.color, siren: 1 }, actors: { mon: { kind: 'monster', color: def.color, x: 760, y: 70, scale: 3 } } },
        frames: [
          { key: 'cut.invasion.' + id, ms: 4200, sfx: 'alarm', do: [['move', 'mon', 420, 70, 1.2], ['after', 1.2, [['set', 'attack', 1], ['shake', 0.3]]]] },
          { key: 'arc.' + id + '.news', ms: 4800, do: [['cam', 320, 220, 1.25, 3], ['shake', 0.5]] },
        ],
      });
    },

    // --- Итог эпизода
    async episodeEnd() {
      GS.setFlag('episode_complete');
      Dir.autosave();
      await Dir.playCutscene('e01_outro');
      Dir.mode = 'end';
      NP.UI.setHud(false);
      NP.Audio.music('title');
      NP.Menus.episodeSummary();
    },

    loop(ts) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0);
      last = ts;
      if (Dir.mode === 'world') {
        const control = Dir.canControl();
        NP.World.update(dt, control);
        NP.World.draw(ctx);
        if (control || NP.Dialogue.isOpen()) GS.data.playtime_seconds += dt;
        if (!NP.UI.modalOpen()) {
          if (NP.Input.pressed('journal')) NP.Journal.open();
          if (NP.Input.pressed('hint')) NP.Hints.open();
          if (NP.Input.pressed('menu')) NP.Menus.pause();
        }
        if (control && !Dir.pulsed && performance.now() - Dir.lastProgress > 90000 && GS.data.objective) {
          Dir.pulsed = true;
          NP.UI.hintPulse(true);
          NP.UI.toast(T('hint.available'));
        }
      } else if (Dir.mode === 'blank') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 360);
        if (GS.data.campaign) GS.data.playtime_seconds += dt;
      } else if (Dir.mode === 'cutscene' && Dir.cut) {
        Dir.drawCutscene(ctx, dt);
        GS.data.playtime_seconds += dt;
      } else if (Dir.mode === 'title' || Dir.mode === 'end') {
        Dir.cut = Dir.cut || { fx: 'title', t: 0 };
        Dir.drawCutscene(ctx, dt);
        if (Dir.mode === 'title' || Dir.mode === 'end') { /* фон меню */ }
      }
      requestAnimationFrame(Dir.loop);
    },

    newGame() {
      Dir.cut = null;
      NP.Campaign.start();
    },
    continueGame(d) {
      d = d || NP.SaveManager.latest();
      if (d && d.campaign) { Dir.cut = null; NP.Campaign.resume(d); return; }
      NP.SaveManager.load(d);
      Dir.cut = null;
      NP.Menus.closeTitle();
      const sc = NP.Data.scenes[GS.data.scene_id];
      // Экшен-сцены не сохраняются: продолжаем с безопасной точки перед ними.
      if (!sc || sc.action) {
        Dir.gotoScene(sc && sc.safe_scene ? sc.safe_scene : 'e01_office', sc && sc.safe_checkpoint);
        return;
      }
      Dir.gotoScene(GS.data.scene_id, GS.data.checkpoint_id, GS.data.pos);
    },
    toTitle() {
      Dir.mode = 'title';
      Dir.cut = null;
      NP.UI.setHud(false);
      NP.UI.clearLabels();
      $('bark').hidden = true;
      NP.Menus.title();
    },

    init() {
      canvas = $('screen');
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      NP.Settings.load();
      NP.Settings.apply();
      NP.Input.init();
      NP.UI.init();
      NP.Dialogue.init();
      document.addEventListener('pointerdown', () => NP.Audio.unlock(), { once: false });
      document.addEventListener('keydown', () => NP.Audio.unlock());
      document.addEventListener('visibilitychange', () => {
        // Сворачивание: пауза и сохранение последней безопасной точки.
        if (document.hidden && Dir.mode === 'world' && Dir.canControl() && Dir.scene && !Dir.scene.action) Dir.autosave();
      });
      Dir.toTitle();
      requestAnimationFrame(Dir.loop);
    },
  });

  window.addEventListener('DOMContentLoaded', () => Dir.init());
})();
