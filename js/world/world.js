// Исследование и экшен-сцены: комната из данных, игрок, объекты, охрана, сканер.
(function () {
  const NP = window.NP;
  const TS = 16;
  const VIEW_W = 640, VIEW_H = 360;
  const SPEED = 82;

  const W = (NP.World = {
    scene: null, bg: null, bgVersion: -1,
    player: { x: 0, y: 0, dir: 'down', frame: 'idle', animT: 0, moving: false },
    cam: { x: 0, y: 0 },
    checkpoint: null,
    t: 0, scanT: 0, shakeT: 0, fadeHit: 0,
    hz: null, // состояние опасностей экшен-сцены
    target: null,
    firedTriggers: {},
    voidWarned: false,

    enter(scene, checkpointId, pos) {
      W.scene = scene;
      W.bgVersion = -1;
      W.firedTriggers = {};
      const sp = (scene.spawns && (scene.spawns[checkpointId] || scene.spawns.start)) || { x: 2, y: 2, dir: 'down' };
      W.checkpoint = { x: sp.x * TS + 8, y: sp.y * TS + 12, dir: sp.dir || 'down' };
      const p = W.player;
      if (pos) { p.x = pos.x; p.y = pos.y; p.dir = pos.dir || 'down'; }
      else { p.x = W.checkpoint.x; p.y = W.checkpoint.y; p.dir = W.checkpoint.dir; }
      p.frame = 'idle';
      W.resetHazards();
      W.fx = new NP.FX.Particles(500);
      W.emotes = [];
      W.dustT = 0;
      W.snapCamera();
    },

    resetHazards() {
      const h = W.scene.hazards;
      if (!h) { W.hz = null; return; }
      const easy = NP.Settings.values.easyChase;
      W.hz = {
        easy,
        turrets: (h.turrets || []).map((t, i) => ({ ...t, state: 'cool', timer: (t.offset || 0) + 0.8 + i * 0.35, lane: [] })),
        guards: (h.guards || []).map((gd) => ({ ...gd, px: gd.path[0][0] * TS + 8, py: gd.path[0][1] * TS + 8, seg: 0, state: 'move', timer: gd.period || 2.5, frozen: 0, lane: [] })),
        scanner: h.scanner ? { x: h.scanner.startX * TS, speed: h.scanner.speed * (easy ? 0.72 : 1), delay: h.scanner.delay || 0 } : null,
        dead: false,
      };
    },

    snapCamera() {
      const r = W.roomSize();
      W.cam.x = r.w <= VIEW_W ? (r.w - VIEW_W) / 2 : NP.clamp(W.player.x - VIEW_W / 2, 0, r.w - VIEW_W);
      W.cam.y = r.h <= VIEW_H ? (r.h - VIEW_H) / 2 : NP.clamp(W.player.y - VIEW_H / 2, 0, r.h - VIEW_H);
    },
    roomSize() { return { w: W.scene.map[0].length * TS, h: W.scene.map.length * TS }; },

    tileInfo(tx, ty) {
      const m = W.scene.map;
      if (ty < 0 || tx < 0 || ty >= m.length || tx >= m[0].length) return { tile: 'top', solid: true };
      return NP.resolveTile(W.scene.legend, m[ty][tx]);
    },
    solidAt(px, py) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      if (W.tileInfo(tx, ty).solid) return true;
      for (const it of W.visibleInteractables()) {
        if (!it.solid) continue;
        const x0 = it.x * TS, y0 = it.y * TS, x1 = x0 + (it.w || 1) * TS, y1 = y0 + (it.h || 1) * TS;
        if (px >= x0 && px < x1 && py >= y0 && py < y1) return true;
      }
      return false;
    },
    blocked(x, y) {
      return W.solidAt(x - 5, y - 5) || W.solidAt(x + 5, y - 5) || W.solidAt(x - 5, y + 2) || W.solidAt(x + 5, y + 2);
    },
    visibleInteractables() {
      return (W.scene.interactables || []).filter((it) => NP.cond(it.if));
    },

    update(dt, controllable) {
      W.t += dt;
      if (W.fx) { W.fx.update(dt); W.ambient(dt); }
      W.emotes = (W.emotes || []).filter((e) => (e.t += dt) < e.dur);
      if (W.scanT > 0) W.scanT -= dt;
      if (W.shakeT > 0) W.shakeT -= dt;
      if (W.fadeHit > 0) W.fadeHit -= dt;
      const p = W.player;
      p.moving = false;
      if (controllable) {
        const a = NP.Input.axis();
        if (a.x || a.y) {
          const nx = p.x + a.x * SPEED * dt, ny = p.y + a.y * SPEED * dt;
          if (!W.blocked(nx, p.y)) p.x = nx;
          if (!W.blocked(p.x, ny)) p.y = ny;
          p.moving = true;
          // Пыль из-под ног.
          W.dustT -= dt;
          if (W.dustT <= 0 && W.fx) {
            W.dustT = 0.2;
            W.fx.emit(p.x, p.y + 1, { count: 2, color: W.dustColor(), speed: 14, life: 0.45, angle: -Math.PI / 2, spread: 1.4, size: 2, gravity: -10 });
          }
          if (Math.abs(a.x) > Math.abs(a.y)) p.dir = a.x < 0 ? 'left' : 'right';
          else p.dir = a.y < 0 ? 'up' : 'down';
        }
        W.checkVoid();
        W.checkTriggers();
        W.findTarget();
        if (NP.Input.pressed('act') && W.target) NP.Director.interact(W.target);
        if (NP.Input.pressed('scan')) { W.scanT = 2.6; NP.Audio.sfx('blip'); }
      } else {
        W.target = null;
      }
      p.animT += dt;
      // Пиксель, ожившая награда, семенит за Ильёй.
      const pet = W.pet || (W.pet = { x: p.x, y: p.y });
      const petX = p.x + (p.dir === 'left' ? 14 : -14), petY = p.y + 2;
      if (Math.hypot(pet.x - petX, pet.y - petY) > 60) { pet.x = petX; pet.y = petY; }
      pet.x += (petX - pet.x) * Math.min(1, dt * 4); pet.y += (petY - pet.y) * Math.min(1, dt * 4);
      p.frame = p.moving ? (Math.floor(p.animT * 7) % 2 ? 'w1' : 'w2') : 'idle';
      if (W.hz && controllable) W.updateHazards(dt);
      // Камера плавно догоняет игрока.
      const r = W.roomSize();
      const tx = r.w <= VIEW_W ? (r.w - VIEW_W) / 2 : NP.clamp(p.x - VIEW_W / 2, 0, r.w - VIEW_W);
      const ty = r.h <= VIEW_H ? (r.h - VIEW_H) / 2 : NP.clamp(p.y - VIEW_H / 2, 0, r.h - VIEW_H);
      W.cam.x += (tx - W.cam.x) * Math.min(1, dt * 8);
      W.cam.y += (ty - W.cam.y) * Math.min(1, dt * 8);
    },

    // Пустота не убивает: возврат к последнему стабильному узлу.
    checkVoid() {
      const p = W.player;
      const info = W.tileInfo(Math.floor(p.x / TS), Math.floor((p.y - 2) / TS));
      if (info.tile !== 'void') return;
      NP.Audio.sfx('fall');
      W.fadeHit = 0.5;
      p.x = W.checkpoint.x; p.y = W.checkpoint.y;
      if (!W.voidWarned && W.scene.on_void) { W.voidWarned = true; NP.Director.run(W.scene.on_void); }
      else NP.UI.toast(NP.T('ui.returned_to_node'));
    },

    checkTriggers() {
      const p = W.player;
      for (const tr of W.scene.triggers || []) {
        if (W.firedTriggers[tr.id] && tr.once !== false) continue;
        if (!NP.cond(tr.if)) continue;
        const x0 = tr.x * TS, y0 = tr.y * TS, x1 = x0 + tr.w * TS, y1 = y0 + tr.h * TS;
        if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) {
          W.firedTriggers[tr.id] = true;
          NP.Director.run(tr.actions);
        }
      }
    },

    findTarget() {
      const p = W.player;
      let best = null, bestD = 1e9;
      for (const it of W.visibleInteractables()) {
        if (!it.actions) continue;
        const x0 = it.x * TS, y0 = it.y * TS, x1 = x0 + (it.w || 1) * TS, y1 = y0 + (it.h || 1) * TS;
        const cx = NP.clamp(p.x, x0, x1), cy = NP.clamp(p.y - 6, y0, y1);
        const d = Math.hypot(p.x - cx, p.y - 6 - cy);
        if (d < (it.range || 18) && d < bestD) { best = it; bestD = d; }
      }
      W.target = best;
    },

    // --- Экшен: телеграфия атак 0,7–1 с, укрытия, узлы, сканер.
    laneFrom(tx, ty, dir) {
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      const lane = [];
      let x = tx + d[0], y = ty + d[1];
      for (let i = 0; i < 80; i++) {
        const info = W.tileInfo(x, y);
        if (info.solid) break;
        lane.push([x, y]);
        x += d[0]; y += d[1];
      }
      return lane;
    },
    telegraphTime() { return W.hz.easy ? 1.5 : 0.9; },
    playerTile() { return [Math.floor(W.player.x / TS), Math.floor((W.player.y - 3) / TS)]; },
    inLane(lane) {
      const [px, py] = W.playerTile();
      return lane.some(([x, y]) => x === px && y === py);
    },
    updateHazards(dt) {
      const hz = W.hz;
      if (hz.dead) return;
      const [ptx, pty] = W.playerTile();
      for (const t of hz.turrets) {
        t.timer -= dt;
        if (t.state === 'cool' && t.timer <= 0) {
          // Прицел по текущему положению игрока в пределах сектора башни.
          let lx = t.x, ly = t.y;
          if (t.dir === 'down' || t.dir === 'up') lx = NP.clamp(ptx, t.x - (t.reach || 3), t.x + (t.reach || 3));
          else ly = NP.clamp(pty, t.y - (t.reach || 3), t.y + (t.reach || 3));
          t.lx = lx; t.ly = ly;
          t.lane = W.laneFrom(lx, ly, t.dir);
          t.state = 'warn'; t.timer = W.telegraphTime();
          NP.Audio.sfx('telegraph');
        } else if (t.state === 'warn' && t.timer <= 0) {
          t.state = 'fire'; t.timer = 0.32; NP.Audio.sfx('beam');
        } else if (t.state === 'fire') {
          if (W.inLane(t.lane)) return W.hit();
          if (t.timer <= 0) { t.state = 'cool'; t.timer = (t.period || 1.6) * (hz.easy ? 1.35 : 1); t.lane = []; }
        }
      }
      for (const g of hz.guards) {
        if (g.frozen > 0) { g.frozen -= dt; g.state = 'move'; g.lane = []; continue; }
        g.timer -= dt;
        if (g.state === 'move') {
          const tgt = g.path[(g.seg + 1) % g.path.length];
          const tx = tgt[0] * TS + 8, ty = tgt[1] * TS + 8;
          const dx = tx - g.px, dy = ty - g.py, d = Math.hypot(dx, dy);
          const sp = (g.speed || 30) * (hz.easy ? 0.75 : 1);
          if (d < sp * dt) { g.px = tx; g.py = ty; g.seg = (g.seg + 1) % g.path.length; }
          else { g.px += (dx / d) * sp * dt; g.py += (dy / d) * sp * dt; }
          if (g.timer <= 0) {
            const gx = Math.floor(g.px / TS), gy = Math.floor(g.py / TS);
            g.lane = [[gx, gy]].concat(W.laneFrom(gx, gy, 'up'), W.laneFrom(gx, gy, 'down'), W.laneFrom(gx, gy, 'left'), W.laneFrom(gx, gy, 'right'));
            g.state = 'warn'; g.timer = W.telegraphTime();
            NP.Audio.sfx('telegraph');
          }
        } else if (g.state === 'warn' && g.timer <= 0) {
          g.state = 'fire'; g.timer = 0.32; NP.Audio.sfx('beam');
        } else if (g.state === 'fire') {
          if (W.inLane(g.lane)) return W.hit();
          if (g.timer <= 0) { g.state = 'move'; g.timer = (g.period || 2.6) * (hz.easy ? 1.3 : 1); g.lane = []; }
        }
      }
      if (hz.scanner) {
        const s = hz.scanner;
        if (s.delay > 0) s.delay -= dt;
        else s.x += s.speed * TS * dt;
        if (W.player.x - 4 < s.x) return W.hit();
      }
    },
    freezeGuard(id, seconds) {
      if (!W.hz) return;
      for (const g of W.hz.guards) if (g.id === id) { g.frozen = seconds * (W.hz.easy ? 1.4 : 1); g.state = 'move'; g.lane = []; }
    },
    hit() {
      if (W.fx) W.fx.emit(W.player.x, W.player.y - 8, { count: 30, color: ['#ff5a5f', '#ffffff', '#ffd166'], speed: 110, life: 0.7, size: 3, gravity: 120 });
      if (W.hz.dead) return;
      W.hz.dead = true;
      NP.Audio.sfx('hit');
      if (!NP.Settings.values.reduceFlash) W.shakeT = 0.35;
      W.fadeHit = 0.6;
      NP.Director.onActionFail();
    },

    // --- Отрисовка
    draw(g) {
      const sc = W.scene;
      if (W.bgVersion !== NP.GameState.version) { W.bg = NP.Tiles.renderRoom(sc); W.bgVersion = NP.GameState.version; }
      let cx = Math.round(W.cam.x), cy = Math.round(W.cam.y);
      if (W.shakeT > 0) { cx += Math.round((Math.random() - 0.5) * 6); cy += Math.round((Math.random() - 0.5) * 6); }
      g.fillStyle = '#07080c';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.drawImage(W.bg, -cx, -cy);

      const labels = [];
      const objs = [];
      for (const it of W.visibleInteractables()) objs.push({ y: (it.y + (it.h || 1)) * TS, draw: () => W.drawInteractable(g, it, cx, cy) });
      if (W.hz) for (const gd of W.hz.guards) objs.push({ y: gd.py + 8, draw: () => W.drawGuard(g, gd, cx, cy, labels) });
      objs.push({ y: W.player.y, draw: () => W.drawPlayer(g, cx, cy) });
      if (NP.GameState.flag('companion') && W.pet) {
        objs.push({ y: W.pet.y, draw: () => {
          const bob = Math.round(Math.abs(Math.sin(W.t * 6)) * -2);
          g.drawImage(NP.Sprites.portraitImg('pix'), 3, 2, 10, 12, Math.round(W.pet.x - 5 - cx), Math.round(W.pet.y - 12 - cy) + bob, 10, 12);
        } });
      }
      objs.sort((a, b) => a.y - b.y).forEach((o) => o.draw());

      if (W.hz) W.drawHazards(g, cx, cy, labels);
      if (W.fx) W.fx.draw(g, cx, cy);
      W.drawOverlay(g, cx, cy);
      W.drawEmotes(g, cx, cy);

      // Подписанные состояния объектов и подсветка по запросу.
      for (const it of W.visibleInteractables()) {
        const sx = (it.x + (it.w || 1) / 2) * TS - cx, sy = it.y * TS - cy;
        if (it.tag) {
          const tag = it.tag.find((t) => NP.cond(t.if));
          if (tag) labels.push({ x: sx, y: sy - 4, text: NP.T(tag.key), cls: 'tag' + (tag.style ? ' ' + tag.style : '') });
        }
        if (W.scanT > 0 && it.actions) {
          const a = 0.5 + 0.5 * Math.sin(W.t * 10);
          g.strokeStyle = 'rgba(255,209,102,' + (0.4 + a * 0.6) + ')';
          g.lineWidth = 1;
          g.strokeRect(it.x * TS - cx - 1.5, it.y * TS - cy - 1.5, (it.w || 1) * TS + 3, (it.h || 1) * TS + 3);
          if (!it.tag && it.label) labels.push({ x: sx, y: sy - 4, text: NP.T(it.label), cls: 'tag scan' });
        }
      }
      if (W.target && NP.Director.canControl()) {
        const it = W.target;
        const sx = (it.x + (it.w || 1) / 2) * TS - cx, sy = it.y * TS - cy - (it.tag ? 16 : 4);
        labels.push({ x: sx, y: sy, text: NP.UI.actionHint() + ' ' + NP.T(it.label), cls: 'prompt' });
        const bob = Math.round(Math.sin(W.t * 6) * 1.5);
        g.fillStyle = '#ffd166';
        g.fillRect(Math.round(sx) - 2, Math.round(sy) + bob - 1, 5, 2);
        g.fillRect(Math.round(sx) - 1, Math.round(sy) + bob + 1, 3, 1);
      }
      if (W.fadeHit > 0) {
        g.fillStyle = NP.Settings.values.reduceFlash ? 'rgba(10,10,20,' + W.fadeHit + ')' : 'rgba(255,90,95,' + W.fadeHit * 0.5 + ')';
        g.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      NP.UI.setLabels(labels);
    },

    drawPlayer(g, cx, cy) {
      const p = W.player;
      const blink = W.t % 3.4 < 0.12;
      const spr = NP.Sprites.person('ilya', p.dir, p.frame, blink);
      // Шаг подпрыгивает, в покое — дыхание.
      const bob = p.moving && p.frame === 'w1' ? -1 : 0;
      const breathe = !p.moving && W.t % 1.6 < 0.8 ? 1 : 0;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(Math.round(p.x - 5 - cx), Math.round(p.y - 1 - cy), 10, 3);
      g.drawImage(spr, 0, 0, 12, 18, Math.round(p.x - 6 - cx), Math.round(p.y - 18 - cy) + bob + breathe, 12, 18 - breathe);
    },

    // --- Мультяшная жизнь мира
    dustColor() {
      return { office: '#b8ab98', desktop: '#7fb3ff', network: '#3cff9a', cache: '#b69cff', chase: '#ff9aa0', node: '#d9c4e8' }[W.scene.palette] || '#ccc';
    },
    emote(who, glyph, dur) { W.emotes.push({ who, glyph, t: 0, dur: dur || 1.8 }); },
    burst(kind) {
      const p = W.player;
      if (kind === 'evidence') {
        W.fx.emit(p.x, p.y - 12, { count: 26, color: ['#7fe3ff', '#ffffff', '#b69cff'], speed: 70, life: 0.9, size: 2, gravity: 60 });
        W.fx.emit(p.x, p.y - 20, { count: 10, color: '#ffd166', speed: 30, life: 1.2, angle: -Math.PI / 2, spread: 0.7, glyph: '★' });
        W.emote('player', '!', 1.4);
      } else if (kind === 'trophy') {
        W.fx.emit(p.x, p.y - 12, { count: 40, color: ['#ffd166', '#ff5a5f', '#6fe3a1', '#7fe3ff'], speed: 90, life: 1.4, size: 3, gravity: 90, spin: true });
      }
    },
    // Фоновая жизнь: пылинки в лучах окна, всплывающие биты, пакеты по сетке, светлячки.
    ambient(dt) {
      if (NP.Settings.values.reduceFlash && Math.random() < 0.5) return;
      const r = W.roomSize(), pal = W.scene.palette, rnd = NP.FX.rnd;
      const at = () => [rnd(0, r.w), rnd(32, r.h)];
      if (Math.random() > dt * 14) return;
      const [x, y] = at();
      if (pal === 'office') W.fx.emit(x, y, { count: 1, color: 'rgba(255,240,200,0.8)', speed: 4, life: 3, size: 1, drag: 0 });
      else if (pal === 'desktop') W.fx.emit(x, y, { count: 1, color: ['#7fb3ff', '#cfe0ff'], speed: 6, life: 2.5, angle: -Math.PI / 2, spread: 0.3, glyph: Math.random() < 0.5 ? '0' : '1', drag: 0 });
      else if (pal === 'network') W.fx.emit(0, Math.floor(rnd(2, r.h / 16 - 1)) * 16 + 8, { count: 1, color: '#3cff9a', speed: 90, angle: 0, spread: 0, life: 6, size: 2, drag: 0 });
      else if (pal === 'cache') W.fx.emit(x, y, { count: 1, color: ['#b69cff', '#7fe3ff', '#ffd166'], speed: 8, life: 2, size: 1, spin: true, drag: 0 });
      else if (pal === 'node') W.fx.emit(x, y, { count: 1, color: '#e6dcff', speed: 6, life: 3, size: 2, spin: true, drag: 0 });
      else if (pal === 'chase') W.fx.emit(x, 0, { count: 1, color: '#ff5a5f', speed: 60, angle: Math.PI / 2, spread: 0.1, life: 3, size: 1, drag: 0 });
      // Процессы и люди время от времени «думают вслух».
      if (Math.random() < 0.02) {
        const npcs = W.visibleInteractables().filter((it) => it.draw && (it.draw.kind === 'process' || it.draw.kind === 'person'));
        if (npcs.length) {
          const it = npcs[Math.floor(Math.random() * npcs.length)];
          if (!W.emotes.some((e) => e.who === it.id)) W.emote(it.id, it.draw.kind === 'person' ? '…' : ['♪', '?', '#'][Math.floor(Math.random() * 3)], 2.2);
        }
      }
    },
    drawOverlay(g, cx, cy) {
      const pal = W.scene.palette, t = W.t;
      if (pal === 'office') {
        // Солнечные лучи из окон.
        g.globalAlpha = 0.07 + 0.02 * Math.sin(t * 0.7);
        g.fillStyle = '#fff6d8';
        const m = W.scene.map[1];
        for (let x = 0; x < m.length; x++) if (m[x] === 'w') {
          g.beginPath(); g.moveTo(x * 16 - cx, 32 - cy); g.lineTo(x * 16 + 16 - cx, 32 - cy); g.lineTo(x * 16 + 40 - cx, 150 - cy); g.lineTo(x * 16 + 24 - cx, 150 - cy); g.fill();
        }
        g.globalAlpha = 1;
      } else if (pal === 'chase' && !NP.Settings.values.reduceFlash) {
        g.fillStyle = 'rgba(255,40,60,' + (0.08 + 0.08 * Math.sin(t * 5)) + ')';
        g.fillRect(0, 0, 640, 360);
      }
      NP.FX.vignette(g, pal === 'office' ? 0.35 : 0.55);
    },
    drawEmotes(g, cx, cy) {
      for (const e of W.emotes) {
        let x, y;
        if (e.who === 'player') { x = W.player.x; y = W.player.y - 20; }
        else {
          const it = (W.scene.interactables || []).find((i) => i.id === e.who);
          if (!it) continue;
          x = (it.x + (it.w || 1) / 2) * 16; y = it.y * 16 - 2;
        }
        NP.FX.emote(g, x - cx, y - cy, e.glyph, e.t);
      }
    },

    drawInteractable(g, it, cx, cy) {
      const px = it.x * TS - cx, py = it.y * TS - cy;
      const d = it.draw;
      if (!d) return;
      const t = W.t;
      switch (d.kind) {
        case 'person': {
          const spr = NP.Sprites.person(d.who, d.dir || 'down', 'idle', (t + it.x) % 2.9 < 0.12);
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 3, py + 14, 10, 3);
          const br = t % 1.8 < 0.9 ? 1 : 0;
          g.drawImage(spr, 0, 0, 12, 18, px + 2, py - 2 + br, 12, 18 - br);
          break;
        }
        case 'process': {
          const spr = NP.Sprites.get('process', NP.Sprites.processPal(d.who));
          const bob = Math.round(Math.sin(t * 3 + it.x) * 1);
          g.drawImage(spr, px + 2, py + bob);
          break;
        }
        case 'laptop': {
          g.drawImage(NP.Sprites.get('laptop'), px, py + 2);
          const on = NP.cond(d.alert);
          g.fillStyle = on ? (Math.sin(t * 8) > 0 ? '#ff4d57' : '#8a1d24') : '#7fb3ff';
          g.fillRect(px + 3, py + 5, 10, 3);
          break;
        }
        case 'traffic': {
          // Светофор за окном; погасший отмечен крестом, а не только цветом.
          const off = NP.cond(d.off);
          g.fillStyle = '#2a2d33'; g.fillRect(px + 7, py + 3, 2, 12);
          g.fillStyle = '#15171b'; g.fillRect(px + 4, py + 2, 8, 9);
          const phase = Math.floor(t / 1.5) % 3;
          const cols = ['#ff4d57', '#ffd166', '#5fe08a'];
          for (let i = 0; i < 3; i++) {
            g.fillStyle = !off && phase === i ? cols[i] : '#33363d';
            g.fillRect(px + 6, py + 3 + i * 3, 4, 2);
          }
          if (off) { g.fillStyle = '#ff4d57'; g.fillRect(px + 12, py + 2, 1, 1); g.fillRect(px + 14, py + 2, 1, 1); g.fillRect(px + 13, py + 3, 1, 1); g.fillRect(px + 12, py + 4, 1, 1); g.fillRect(px + 14, py + 4, 1, 1); }
          break;
        }
        case 'coffee': g.drawImage(NP.Sprites.get('coffee'), px + 4, py + 4); break;
        case 'shard': {
          const bob = Math.round(Math.sin(t * 3 + it.x) * 2);
          g.fillStyle = 'rgba(127,227,255,0.18)';
          g.fillRect(px + 2, py + 12, 12, 3);
          g.drawImage(NP.Sprites.get('shard', d.pal), px + 4, py + 2 + bob);
          break;
        }
        case 'terminal': {
          g.drawImage(NP.Sprites.get('terminal', d.pal), px + 1, py + 3);
          if (NP.cond(d.blink) && Math.sin(t * 6) > 0) { g.fillStyle = '#ffd166'; g.fillRect(px + 12, py + 4, 2, 2); }
          break;
        }
        case 'port': {
          const open = NP.cond(d.open);
          const r = 5 + ((t * 8) % 6);
          g.strokeStyle = open ? '#ffd166' : '#6b6f7a';
          g.lineWidth = 1;
          g.strokeRect(px + 8 - r + 0.5, py + 8 - r / 2 + 0.5, r * 2, r);
          g.fillStyle = open ? '#ffd166' : '#6b6f7a';
          g.fillRect(px + 5, py + 6, 6, 4);
          if (!open) { g.fillStyle = '#1a1a22'; g.fillRect(px + 7, py + 7, 2, 2); }
          break;
        }
        case 'node': {
          const spr = NP.Sprites.get('node', NP.cond(d.used) ? { o: '#ffd166', l: '#ffd166' } : null);
          g.drawImage(spr, px + 3, py + 3);
          break;
        }
        case 'arcade': {
          // Игровой автомат НУЛЯ: корпус, экран с глифом игры, мигающая надпись.
          const played = NP.GameState.gameResult(d.game);
          g.fillStyle = '#1a1024'; g.fillRect(px + 2, py - 10, 12, 26);
          g.fillStyle = '#ff5a5f'; g.fillRect(px + 2, py - 10, 12, 3);
          g.fillStyle = '#0a0b10'; g.fillRect(px + 4, py - 5, 8, 7);
          const on = !played && Math.sin(t * 5 + it.x) > 0;
          g.fillStyle = played === 'won' ? '#ffd166' : played === 'lost' ? '#5a1f35' : on ? '#7fe3ff' : '#3cff9a';
          g.fillRect(px + 5, py - 4, 6, 5);
          g.fillStyle = '#2a1830'; g.fillRect(px + 3, py + 3, 10, 4);
          g.fillStyle = '#ffd166'; g.fillRect(px + 5, py + 4, 2, 2);
          g.fillStyle = '#ff5a5f'; g.fillRect(px + 9, py + 4, 2, 2);
          g.fillStyle = '#120a18'; g.fillRect(px + 3, py + 8, 10, 8);
          break;
        }
        case 'exit': {
          g.fillStyle = 'rgba(255,209,102,' + (0.25 + 0.2 * Math.sin(t * 4)) + ')';
          g.fillRect(px + 1, py + 1, (it.w || 1) * TS - 2, (it.h || 1) * TS - 2);
          break;
        }
      }
    },

    drawGuard(g, gd, cx, cy, labels) {
      const bob = gd.frozen > 0 ? 0 : Math.round(Math.sin(W.t * 4) * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(Math.round(gd.px - 6 - cx), Math.round(gd.py + 8 - cy), 12, 3);
      g.drawImage(NP.Sprites.get('guard', gd.frozen > 0 ? { r: '#7fe3ff', p: '#7fe3ff' } : null), Math.round(gd.px - 8 - cx), Math.round(gd.py - 10 - cy + bob));
      if (gd.frozen > 0) labels.push({ x: gd.px - cx, y: gd.py - 14 - cy, text: NP.T('ui.frozen', { s: Math.ceil(gd.frozen) }), cls: 'tag cold' });
    },

    drawLane(g, lane, state, cx, cy) {
      if (!lane.length) return;
      const reduce = NP.Settings.values.reduceFlash;
      for (const [x, y] of lane) {
        const px = x * TS - cx, py = y * TS - cy;
        if (state === 'warn') {
          // Штриховка + рамка: зона видна без опоры на цвет.
          g.fillStyle = 'rgba(255,90,95,0.18)';
          g.fillRect(px, py, TS, TS);
          g.fillStyle = 'rgba(255,240,240,0.75)';
          const off = Math.floor(W.t * 20) % 4;
          for (let k = -TS; k < TS; k += 4) {
            for (let j = 0; j < TS; j++) {
              const xx = k + j + off;
              if (xx >= 0 && xx < TS && j % 2 === 0) g.fillRect(px + xx, py + j, 1, 1);
            }
          }
        } else if (state === 'fire') {
          g.fillStyle = reduce ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.95)';
          g.fillRect(px + 2, py, TS - 4, TS);
          g.fillStyle = reduce ? 'rgba(255,90,95,0.5)' : 'rgba(255,90,95,0.8)';
          g.fillRect(px, py, 2, TS); g.fillRect(px + TS - 2, py, 2, TS);
        }
      }
    },

    drawHazards(g, cx, cy, labels) {
      const hz = W.hz;
      for (const t of hz.turrets) {
        W.drawLane(g, t.lane, t.state, cx, cy);
        const px = t.x * TS - cx, py = t.y * TS - cy;
        g.fillStyle = '#2a1520'; g.fillRect(px + 2, py + 2, 12, 12);
        g.fillStyle = t.state === 'warn' ? '#ffd166' : '#ff5a5f';
        g.fillRect(px + 5, py + 5, 6, 6);
        if (t.state === 'warn') labels.push({ x: px + 8, y: py - 2, text: '!', cls: 'tag warn' });
      }
      for (const gd of hz.guards) W.drawLane(g, gd.lane, gd.state, cx, cy);
      if (hz.scanner) {
        const s = hz.scanner, sx = Math.round(s.x - cx);
        const reduce = NP.Settings.values.reduceFlash;
        g.fillStyle = 'rgba(255,60,80,0.35)';
        g.fillRect(-10, 0, sx + 10, VIEW_H);
        for (let y = 0; y < VIEW_H; y += 3) {
          g.fillStyle = (y + Math.floor(W.t * 60)) % 12 < 6 ? 'rgba(255,200,200,0.5)' : 'rgba(255,60,80,0.4)';
          g.fillRect(sx - 6, y, 6, 2);
        }
        g.fillStyle = reduce ? '#ff9aa0' : '#ffffff';
        g.fillRect(sx - 1, 0, 2, VIEW_H);
        labels.push({ x: Math.max(40, sx - 30), y: 44, text: NP.T('ui.scanner'), cls: 'tag warn' });
      }
    },
  });
})();
