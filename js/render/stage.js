// «Мультик»: анимированные сценки катсцен. Актёры ходят, прыгают, машут, у них облачка эмоций;
// камера наезжает и трясётся; фоны живые. Команды приходят из данных катсцен (frame.do).
(function () {
  const NP = window.NP;
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const rnd = (a, b) => a + Math.random() * (b - a);

  let S = null;

  const MONSTER = [
    ['...XXXXXX...', '.XXXXXXXXXX.', 'XXX.XXXX.XXX', 'XXXXXXXXXXXX', '..XX.XX.XX..', '.X........X.'],
    ['...XXXXXX...', 'XXXXXXXXXXXX', 'XXX.XXXX.XXX', '.XXXXXXXXXX.', '..X..XX..X..', '...X....X...'],
  ];

  function tween(obj, props, dur, done) {
    const from = {};
    for (const k in props) from[k] = obj[k];
    S.tweens.push({ obj, from, to: props, dur: Math.max(0.001, dur), t: 0, done });
  }

  const Stage = (NP.Stage = {
    active() { return !!S; },
    start(def) {
      S = {
        bg: def.bg, t: 0, actors: {}, vars: Object.assign({ bites: {} }, def.vars || {}),
        cam: { x: 320, y: 180, z: 1 }, tweens: [], timers: [], fx: new NP.FX.Particles(900), shake: 0, flash: 0, emitT: 0,
      };
      for (const id in def.actors || {}) Stage.spawn(id, def.actors[id]);
      if (def.cam) Object.assign(S.cam, def.cam);
    },
    stop() { S = null; },
    spawn(id, o) {
      S.actors[id] = Object.assign({ id, kind: 'person', who: 'ilya', x: 320, y: 280, dir: 'down', scale: 4, anim: 'idle', alpha: 1, hop: 0, emote: null, squash: 0 }, o);
    },

    run(cmds) {
      for (const c of cmds || []) {
        const [op, a, b, d, e] = c;
        const act = S.actors[a];
        switch (op) {
          case 'spawn': Stage.spawn(a, b); break;
          case 'remove': delete S.actors[a]; break;
          case 'face': act.dir = b; break;
          case 'anim': act.anim = b; break;
          case 'walk': {
            // ['walk', id, x, сек, конечное_направление, y]
            const ty = c[5] === undefined ? act.y : c[5];
            act.dir = Math.abs(ty - act.y) > Math.abs(b - act.x) ? (ty < act.y ? 'up' : 'down') : b < act.x ? 'left' : 'right';
            act.anim = 'walk';
            tween(act, { x: b, y: ty }, d, () => { act.anim = 'idle'; if (e) act.dir = e; });
            break;
          }
          case 'after': S.timers.push({ t: a, cmds: b }); break;
          case 'move': tween(act, { x: b, y: d }, e || 1); break;
          case 'drop': {
            // Падение сверху с приземлением «в лепёшку» и облаком пыли.
            tween(act, { y: b }, d || 0.8, () => {
              act.squash = 0.3; S.shake = 0.25;
              S.fx.emit(act.x, act.y, { count: 30, color: ['#7fb3ff', '#cfe0ff'], speed: 120, life: 0.8, angle: -Math.PI / 2, spread: 1.6, size: 4, gravity: 200 });
              NP.Audio.sfx('hit');
            });
            break;
          }
          case 'jump': act.hop = b || 1; act.hopT = 0; break;
          case 'emote': act.emote = { g: b, t: 0, dur: d || 2 }; break;
          case 'fade': tween(act, { alpha: b }, d || 1); break;
          case 'scale': tween(act, { scale: b }, d || 1); break;
          case 'cam': tween(S.cam, { x: a, y: b, z: d }, e || 0.001); break;
          case 'shake': S.shake = a || 0.4; break;
          case 'flash': if (!NP.Settings.values.reduceFlash) S.flash = 0.4; break;
          case 'set': S.vars[a] = b; break;
          case 'bg': S.bg = a; break;
          case 'burst': Stage.burst(a, b, d); break;
          case 'sfx': NP.Audio.sfx(a); break;
        }
      }
    },
    burst(x, y, kind) {
      if (kind === 'confetti') {
        for (let i = 0; i < 3; i++) S.fx.emit(x + rnd(-80, 80), y, { count: 40, color: ['#ffd166', '#ff5a5f', '#6fe3a1', '#7fe3ff', '#b69cff'], speed: 160, life: 2.6, size: 5, gravity: 130, angle: -Math.PI / 2, spread: 1.2, spin: true, drag: 0.8 });
      } else if (kind === 'sparks') {
        S.fx.emit(x, y, { count: 40, color: ['#ffffff', '#7fe3ff', '#ffd166'], speed: 160, life: 0.8, size: 3, gravity: 100 });
      } else if (kind === 'tears') {
        S.fx.emit(x, y, { count: 6, color: '#7fb3ff', speed: 30, life: 1.2, size: 3, gravity: 200, angle: Math.PI / 2, spread: 0.6 });
      }
    },

    update(dt) {
      if (!S) return;
      S.t += dt;
      S.timers = S.timers.filter((tm) => { tm.t -= dt; if (tm.t <= 0) { Stage.run(tm.cmds); return false; } return true; });
      S.tweens = S.tweens.filter((tw) => {
        tw.t += dt;
        const k = ease(Math.min(1, tw.t / tw.dur));
        for (const p in tw.to) tw.obj[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * k;
        if (tw.t >= tw.dur) { tw.done && tw.done(); return false; }
        return true;
      });
      for (const id in S.actors) {
        const a = S.actors[id];
        if (a.hop > 0) { a.hopT += dt; if (a.hopT > 0.45) { a.hopT = 0; a.hop--; } }
        if (a.squash > 0) a.squash = Math.max(0, a.squash - dt);
        if (a.emote) { a.emote.t += dt; if (a.emote.t > a.emote.dur) a.emote = null; }
        if (a.kind === 'monster' && S.vars.attack) {
          a.x = 320 + Math.sin(S.t * 0.9) * 230; a.y = 70 + Math.sin(S.t * 2.2) * 14;
          S.emitT -= dt;
          if (S.emitT <= 0) {
            S.emitT = 0.07;
            S.fx.emit(a.x, a.y + 24, { count: 2, color: [a.color, '#f4f1ea'], speed: 50, angle: Math.PI / 2, spread: 0.8, life: 3, size: 6, gravity: 260, floor: 322, drag: 0.3 });
            const bi = Math.floor(a.x / 54);
            S.vars.bites[bi] = Math.min(1, (S.vars.bites[bi] || 0) + dt * 2.2);
          }
        }
        // Перенос в систему: пиксели Ильи утягивает в экран ноутбука.
        if (S.vars.suck && a.id === 'ilya') {
          a.alpha = Math.max(0, a.alpha - dt * 0.35);
          for (let i = 0; i < 3; i++) {
            const sx = a.x + rnd(-6, 6) * a.scale, sy = a.y - rnd(0, 18) * a.scale;
            const tx = 320, ty = 150, dd = Math.hypot(tx - sx, ty - sy);
            S.fx.p.push({ x: sx, y: sy, vx: ((tx - sx) / dd) * 160, vy: ((ty - sy) / dd) * 160, life: dd / 160, max: dd / 160, c: ['#8fb3d4', '#e8b995', '#3a2a22', '#7fb3ff'][i], s: 4, g: 0, drag: 0 });
          }
        }
      }
      S.fx.update(dt);
      if (S.shake > 0) S.shake -= dt;
      if (S.flash > 0) S.flash -= dt;
      // Фоновые частицы.
      if (S.bg === 'grid' && Math.random() < dt * 20) S.fx.emit(rnd(0, 640), 360, { count: 1, color: '#7fb3ff', glyph: Math.random() < 0.5 ? '0' : '1', speed: 40, angle: -Math.PI / 2, spread: 0.1, life: 6, drag: 0 });
      if (S.bg === 'desk' && Math.random() < dt * 6) S.fx.emit(470, 262, { count: 1, color: 'rgba(255,255,255,0.5)', speed: 12, angle: -Math.PI / 2, spread: 0.4, life: 2, size: 3, drag: 0 });
    },

    draw(g) {
      if (!S) return;
      const t = S.t, c = S.cam;
      const reduce = NP.Settings.values.reduceFlash;
      g.save();
      let sx = 0, sy = 0;
      if (S.shake > 0 && !reduce) { sx = rnd(-5, 5); sy = rnd(-5, 5); }
      g.translate(320 + sx, 180 + sy); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
      (BG[S.bg] || BG.dark)(g, t, S);
      Object.values(S.actors).sort((p, q) => p.y - q.y).forEach((a) => drawActor(g, a, t));
      if (FRONT[S.bg]) FRONT[S.bg](g, t, S);
      S.fx.draw(g);
      Object.values(S.actors).forEach((a) => { if (a.emote) NP.FX.emote(g, a.x, a.y - 19 * a.scale - 6, a.emote.g, a.emote.t, Math.max(1, Math.round(a.scale / 2))); });
      g.restore();
      if (S.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + S.flash * 2 + ')'; g.fillRect(0, 0, 640, 360); }
      NP.FX.vignette(g, 0.5);
      // Кинематографичные полосы.
      g.fillStyle = '#000'; g.fillRect(0, 0, 640, 22); g.fillRect(0, 338, 640, 22);
    },
  });

  function drawActor(g, a, t) {
    g.globalAlpha = a.alpha;
    const hopY = a.hop > 0 ? -Math.sin((a.hopT / 0.45) * Math.PI) * 10 * a.scale / 2 : 0;
    if (a.kind === 'person') {
      let frame = 'idle', dir = a.dir, bob = 0;
      if (a.anim === 'walk') frame = Math.floor(t * 8) % 2 ? 'w1' : 'w2';
      if (a.anim === 'play') { frame = Math.floor(t * 10) % 2 ? 'w1' : 'w2'; bob = Math.floor(t * 10) % 2; }
      if (a.anim === 'wave') frame = Math.floor(t * 6) % 2 ? 'w1' : 'w2';
      if (a.anim === 'sad') { bob = 2 + Math.round(Math.sin(t * 2)); }
      if (a.anim === 'cheer') { frame = Math.floor(t * 8) % 2 ? 'w1' : 'w2'; }
      const blink = (t + a.x * 0.01) % 3 < 0.12 || a.anim === 'sad';
      const spr = NP.Sprites.person(a.who, dir, frame, blink);
      const sq = a.squash > 0 ? a.squash : 0;
      const w = 12 * a.scale * (1 + sq), h = 18 * a.scale * (1 - sq * 1.2);
      // Тень
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(Math.round(a.x - 5 * a.scale), Math.round(a.y - a.scale), Math.round(10 * a.scale), Math.round(2 * a.scale));
      g.drawImage(spr, Math.round(a.x - w / 2), Math.round(a.y - h + bob * a.scale / 2 + hopY), Math.round(w), Math.round(h));
    } else if (a.kind === 'monster') {
      const rows = MONSTER[Math.floor(t * 5) % 2];
      g.fillStyle = a.color || '#ff5a5f';
      const s = a.scale * 2;
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect(Math.round(a.x - 6 * s + x * s), Math.round(a.y - 3 * s + y * s), s, s); }));
      g.fillStyle = '#10131b';
      g.fillRect(Math.round(a.x - 3 * s), Math.round(a.y - s), s, s); g.fillRect(Math.round(a.x + 2 * s), Math.round(a.y - s), s, s);
    } else if (a.kind === 'face') {
      // Большой живой портрет (Мира на терминале, НУЛЬ).
      const cv = a.cv || (a.cv = document.createElement('canvas'));
      NP.Sprites.drawPortrait(cv, a.who, t, { talk: a.anim === 'talk' && Math.floor(t * 9) % 2 === 0, blink: t % 2.7 < 0.12 });
      const s = a.scale * 6;
      if (S.vars.glitch && !NP.Settings.values.reduceFlash) {
        for (let y = 0; y < 16; y++) g.drawImage(cv, 0, y, 16, 1, Math.round(a.x - 8 * s + (Math.random() < S.vars.glitch * 0.3 ? rnd(-12, 12) : 0)), Math.round(a.y - 8 * s + y * s), 16 * s, s);
      } else g.drawImage(cv, Math.round(a.x - 8 * s), Math.round(a.y - 8 * s), 16 * s, 16 * s);
    } else if (a.kind === 'pix') {
      g.drawImage(NP.Sprites.portraitImg('pix'), Math.round(a.x - 8 * a.scale), Math.round(a.y - 16 * a.scale + hopY), 16 * a.scale, 16 * a.scale);
    }
    g.globalAlpha = 1;
  }

  // Передний план: толпа болельщиков 1996 года подпрыгивает, когда есть повод.
  const FRONT = {
    hall(g, t, S) {
      for (let i = 0; i < 22; i++) {
        const x = -60 + i * 36 + (i % 2) * 10, jump = S.vars.cheer ? Math.abs(Math.sin(t * 7 + i)) * 10 : Math.abs(Math.sin(t * 2 + i)) * 2;
        const y = 318 - jump + (i % 3) * 6;
        g.fillStyle = ['#2a1a3a', '#241634', '#1d1229'][i % 3];
        g.fillRect(x, y, 26, 40); g.beginPath(); g.arc(x + 13, y - 6, 11, 0, Math.PI * 2); g.fill();
        if (S.vars.cheer && i % 3 === 0) { g.fillRect(x - 4, y - 18 - jump, 5, 16); g.fillRect(x + 25, y - 18 - jump, 5, 16); }
      }
    },
  };

  // ------------------------------------------------------------ Фоны
  const rect = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  let officeCache = null;

  const BG = {
    dark(g) { rect(g, '#07080c', -400, -400, 1440, 1160); },

    // Июнь 1996: зал автоматов, табло, толпа, сервер с записью.
    hall(g, t, S) {
      rect(g, '#120c1c', -300, -200, 1240, 760);
      // Прожекторы
      if (!NP.Settings.values.reduceFlash) {
        for (let i = 0; i < 3; i++) {
          const x = 320 + Math.sin(t * 0.8 + i * 2) * 260;
          g.fillStyle = ['rgba(255,209,102,0.07)', 'rgba(127,227,255,0.07)', 'rgba(255,90,95,0.07)'][i];
          g.beginPath(); g.moveTo(x - 10, -20); g.lineTo(x + 10, -20); g.lineTo(x + 90, 340); g.lineTo(x - 90, 340); g.fill();
        }
      }
      // Растяжка
      rect(g, '#6b2a31', 110, 30, 420, 26);
      g.fillStyle = '#ffd166'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
      g.fillText('ГОРОДСКОЙ ЧЕМПИОНАТ · 1996', 320, 48); g.textAlign = 'left';
      // Табло
      rect(g, '#05050a', 250, 64, 140, 50); g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.strokeRect(251, 65, 138, 48);
      g.fillStyle = S.vars.score === '2 : 3' && Math.floor(t * 4) % 2 ? '#ff5a5f' : '#ffd166';
      g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.fillText(S.vars.score || '2 : 2', 320, 100);
      g.font = '9px monospace'; g.fillStyle = '#9aa3b2'; g.fillText('ИЛЬЯ', 270, 76); g.fillText('ГЛЕБ', 370, 76); g.textAlign = 'left';
      // Пол
      for (let y = 250; y < 360; y += 10) for (let x = -300; x < 940; x += 20) rect(g, ((x + y) / 10) % 2 ? '#1a1024' : '#22152e', x + (y % 20), y, 20, 10);
      // Автоматы
      for (let i = 0; i < 6; i++) {
        const x = 60 + i * 90;
        rect(g, '#241634', x, 126, 64, 130);
        rect(g, ['#ff5a5f', '#ffd166', '#7fe3ff', '#6fe3a1'][i % 4], x, 126, 64, 10);
        rect(g, '#05050a', x + 8, 144, 48, 38);
        for (let k = 0; k < 6; k++) rect(g, ['#3cff9a', '#7fe3ff', '#ffd166'][(i + k) % 3], x + 12 + ((k * 13 + Math.floor(t * 24) + i * 7) % 38), 148 + k * 5, 4, 3);
        rect(g, '#3a2a48', x + 4, 188, 56, 16);
        rect(g, '#ff5a5f', x + 14, 192, 6, 6); rect(g, '#ffd166', x + 42, 192, 6, 6);
      }
      // Сервер с записью
      rect(g, '#1b1e2a', 560, 150, 50, 106);
      for (let k = 0; k < 8; k++) rect(g, (Math.floor(t * 6) + k) % 3 ? '#3cff9a' : '#ffd166', 598, 158 + k * 12, 3, 3);
      if (S.vars.rec) { rect(g, Math.floor(t * 2) % 2 ? '#ff5a5f' : '#5a1f35', 566, 136, 8, 8); g.fillStyle = '#ff5a5f'; g.font = 'bold 10px monospace'; g.fillText('REC', 578, 144); }
    },
    // Толпа поверх — рисуется после актёров как передний план через фон «hallFront» (упрощённо — в самом hall снизу).

    // Крупный план стола: окно, ноутбук, кружка.
    desk(g, t, S) {
      rect(g, '#3d3632', -300, -200, 1240, 760);
      rect(g, '#b8ab98', -300, 20, 1240, 200);
      // Окно с городом
      rect(g, '#8f836f', 380, 40, 200, 130); rect(g, S.vars.night ? '#1a2033' : '#9fc4d8', 388, 48, 184, 114);
      for (let i = 0; i < 8; i++) rect(g, '#6b7f94', 392 + i * 23, 162 - (20 + ((i * 37) % 60)), 18, 20 + ((i * 37) % 60));
      rect(g, '#2a2d33', 500, 90, 4, 72); rect(g, '#15171b', 492, 80, 20, 30);
      const off = S.vars.trafficOff;
      ['#ff4d57', '#ffd166', '#5fe08a'].forEach((c, i) => rect(g, !off && Math.floor(t / 1.2) % 3 === i ? c : '#33363d', 498, 84 + i * 8, 8, 6));
      // Стол
      rect(g, '#6b4f3a', -300, 260, 1240, 200); rect(g, '#8a6a4f', -300, 250, 1240, 18);
      // Кружка
      rect(g, '#e9e2d6', 456, 232, 26, 30); rect(g, '#c9c2b6', 482, 240, 8, 14); rect(g, '#5a3a22', 460, 236, 18, 6);
      // Ноутбук
      rect(g, '#9aa0aa', 200, 90, 240, 160); const glow = S.vars.glow || 0;
      rect(g, glow ? (Math.floor(t * 8) % 2 ? '#2a0a10' : '#12060a') : '#1c2c4a', 212, 102, 216, 136);
      if (glow) {
        g.fillStyle = '#ff4d57'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
        g.fillText(S.vars.mirror ? '' : 'СЕАНС ПЕРЕХВАЧЕН', 320, 176); g.textAlign = 'left';
        if (S.vars.mirror) {
          // На экране — сам Илья за этим же столом.
          const spr = NP.Sprites.person('ilya', 'down', 'idle', t % 2 < 0.1);
          g.globalAlpha = 0.85; g.drawImage(spr, 290, 118, 60, 90); g.globalAlpha = 1;
          rect(g, 'rgba(255,77,87,0.15)', 212, 102, 216, 136);
        }
        if (!NP.Settings.values.reduceFlash) { g.fillStyle = 'rgba(255,77,87,' + (0.05 + 0.05 * Math.sin(t * 6)) + ')'; g.fillRect(-300, -200, 1240, 760); }
      }
      rect(g, '#6c717a', 180, 250, 280, 12);
    },

    // Рабочий стол изнутри: синяя бездна с перспективной сеткой.
    grid(g, t) {
      rect(g, '#050914', -300, -200, 1240, 760);
      g.strokeStyle = '#1e3a6e'; g.lineWidth = 1;
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(320, 150); g.lineTo(320 + i * 90, 380); g.stroke(); }
      for (let k = 0; k < 10; k++) {
        const y = 150 + Math.pow(((k + (t * 0.6) % 1) / 10), 2) * 230;
        g.beginPath(); g.moveTo(-300, y); g.lineTo(940, y); g.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 130, y = 40 + Math.sin(t + i) * 8;
        rect(g, '#9dbcf0', x, y, 80, 50); rect(g, '#3e6fd8', x, y, 80, 8); rect(g, '#ff8a8a', x + 70, y + 2, 6, 4);
      }
    },

    // Ночной город: три слоя параллакса, машины, сирены, укусы монстра.
    city(g, t, S) {
      rect(g, '#0a0c18', -300, -200, 1240, 760);
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(540, 60, 22, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 40; i++) rect(g, '#6d7fb0', (i * 97) % 640, (i * 41) % 140, 1, 1);
      for (let i = 0; i < 16; i++) { const h = 60 + ((i * 71) % 90); rect(g, '#141a2c', i * 44 - 20, 330 - h - 60, 42, h + 60); }
      for (let i = 0; i < 12; i++) {
        const x = i * 54, h = 90 + ((i * 53) % 120), bite = (S.vars.bites[i] || 0) * h;
        rect(g, '#1b2033', x, 330 - h + bite, 50, h - bite);
        for (let wy = 330 - h + bite + 8; wy < 318; wy += 14) for (let wx = x + 6; wx < x + 44; wx += 12) if ((wx * 3 + wy + Math.floor(t * 2) * (i % 3 === 0 ? 1 : 0)) % 7) rect(g, '#ffd98a', wx, wy, 5, 6);
        if (bite > 0) for (let k = 0; k < 4; k++) rect(g, S.vars.color || '#ff5a5f', x + k * 12, 330 - h + bite - 6, 6, 6);
      }
      rect(g, '#12141f', -300, 322, 1240, 60);
      for (let x = -300; x < 940; x += 40) rect(g, '#3a3f55', x + ((t * 60) % 40), 340, 20, 2);
      // Машины бегут прочь, фары и сирена
      for (let i = 0; i < 4; i++) {
        const x = ((t * (90 + i * 30) + i * 170) % 900) - 130, y = 326 + (i % 2) * 8;
        rect(g, ['#ff9f43', '#7fe3ff', '#f4f1ea', '#6fe3a1'][i], x, y, 26, 8); rect(g, '#10131b', x + 6, y - 5, 14, 5);
        rect(g, '#fff6c0', x + 26, y + 2, 3, 3);
        if (i === 2 && S.vars.siren) rect(g, Math.floor(t * 8) % 2 ? '#ff4d57' : '#4d7bff', x + 10, y - 8, 6, 3);
      }
    },

    // Экран терминала тихого узла.
    terminal(g, t, S) {
      rect(g, '#120d1f', -300, -200, 1240, 760);
      rect(g, '#2a2745', 150, 30, 340, 290); rect(g, '#0b0914', 166, 46, 308, 258);
      if (S.vars.eat) {
        const r = Math.min(160, S.vars.eatT = (S.vars.eatT || 0) + 1.3);
        g.strokeStyle = '#ff4d57'; g.lineWidth = 14; g.beginPath(); g.ellipse(320, 175, r * 0.7, r, 0, 0, Math.PI * 2); g.stroke();
      }
      for (let y = 46; y < 304; y += 3) rect(g, 'rgba(182,156,255,0.05)', 166, y, 308, 1);
    },

    // Настоящий офис из игровой карты.
    office(g, t, S) {
      rect(g, '#07080c', -300, -200, 1240, 760);
      if (!officeCache) officeCache = NP.Tiles.renderRoom(NP.Data.scenes.e01_office);
      g.drawImage(officeCache, 112, 76);
      const off = S.vars.trafficOff;
      rect(g, '#15171b', 112 + 17 * 16 + 4, 76 + 18, 8, 9);
      ['#ff4d57', '#ffd166', '#5fe08a'].forEach((c, i) => rect(g, !off && (S.vars.green ? i === 2 : Math.floor(t / 1.5) % 3 === i) ? c : '#33363d', 112 + 17 * 16 + 6, 76 + 19 + i * 3, 4, 2));
      g.drawImage(NP.Sprites.get('laptop'), 112 + 3 * 16, 76 + 4 * 16 + 2);
    },
  };
})();
