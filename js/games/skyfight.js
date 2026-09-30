// Раунд «Небо над городом»: строй захватчиков над ночным городом, затем пикирующие корабли, затем флагман.
(function () {
  const NP = window.NP;
  const W = 480, H = 270;
  const INV = [
    ['..r......r..', '...r....r...', '..rrrrrrrr..', '.rr.rrrr.rr.', 'rrrrrrrrrrrr', 'r.rrrrrrrr.r', 'r.r......r.r', '...rr..rr...'],
    ['..r......r..', 'r..r....r..r', 'r.rrrrrrrr.r', 'rrr.rrrr.rrr', 'rrrrrrrrrrrr', '.rrrrrrrrrr.', '..r......r..', '.r........r.'],
  ];
  const DIVER = ['.....y.....', '....yyy....', '.r..yyy..r.', '.r.yyyyy.r.', 'rrryywyyrrr', 'rr.yyyyy.rr', 'r...y.y...r'];
  const SHIP = ['......w......', '.....www.....', '.....www.....', '..y.wwwww.y..', '.yy.wwrww.yy.', 'yyywwwwwwwyyy', 'yyyyyyyyyyyyy', 'yy..yy.yy..yy'];
  let bg = null;

  function drawBg() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05030f'); gr.addColorStop(1, '#2a0f24');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { g.fillStyle = i % 11 ? '#3a3560' : '#ffffff'; g.fillRect((i * 83) % W, (i * 47) % 170, 1, 1); }
    for (let i = 0; i < 26; i++) {
      const bw = 14 + ((i * 29) % 26), bh = 26 + ((i * 53) % 60), x = i * 19 - 8;
      g.fillStyle = '#120a1c'; g.fillRect(x, H - bh, bw, bh);
      g.fillStyle = 'rgba(255,217,138,0.55)';
      for (let y = H - bh + 4; y < H - 3; y += 6) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if ((wx * 5 + y) % 7 === 0) g.fillRect(wx, y, 1, 2);
    }
    return c;
  }

  NP.Games.skyfight = function (api) {
    let ship, shots, bombs, swarm, dirX, stepT, frame, phase, divers, boss, t, flashT, sweep;
    const k = api.easy ? 0.72 : 1;
    const sprite = (name, rows, pal) => NP.Arcade.sprite(name, rows, pal);
    const newSwarm = () => {
      swarm = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) swarm.push({ x: 60 + c * 34, y: 34 + r * 22, alive: true, row: r });
      dirX = 1; stepT = 0; frame = 0;
    };
    const newDivers = () => {
      divers = [];
      for (let i = 0; i < 12; i++) divers.push({ hx: 60 + (i % 6) * 70, hy: 40 + Math.floor(i / 6) * 26, x: 60 + (i % 6) * 70, y: -30 - i * 12, state: 'enter', t: 0, alive: true });
    };
    return {
      reset(full) {
        if (full) { newSwarm(); phase = 'wave'; t = 0; boss = null; divers = []; }
        ship = { x: W / 2, y: H - 26, cd: 0 }; shots = []; bombs = []; flashT = 0; sweep = null;
        if (phase === 'wave') { const top = Math.min(...swarm.filter((s) => s.alive).map((s) => s.y)); if (top > 50) swarm.forEach((s) => { s.y -= top - 50; }); }
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        ship.x = NP.clamp(ship.x + a.x * 170 * dt, 10, W - 10);
        if (api.pointer.active && api.pointer.x !== null) ship.x += (api.pointer.x - ship.x) * Math.min(1, dt * 10);
        ship.cd -= dt;
        if ((api.held('act') || api.pointer.active) && ship.cd <= 0 && shots.length < 3) { shots.push({ x: ship.x, y: ship.y - 8 }); ship.cd = 0.22; api.sfx('telegraph'); }
        shots.forEach((s) => { s.y -= 360 * dt; });
        shots = shots.filter((s) => s.y > -10);
        bombs.forEach((b) => { b.y += b.vy * dt; b.x += (b.vx || 0) * dt; });
        bombs = bombs.filter((b) => b.y < H + 10 && b.x > -10 && b.x < W + 10);
        if (flashT > 0) flashT -= dt;
        const hitShot = (x0, y0, w, h) => { const s = shots.find((s) => s.x >= x0 && s.x <= x0 + w && s.y >= y0 && s.y <= y0 + h); if (s) s.y = -99; return !!s; };

        if (phase === 'wave') {
          const alive = swarm.filter((s) => s.alive);
          stepT += dt;
          if (stepT >= Math.max(0.06, (0.05 + alive.length * 0.012) / k)) {
            stepT = 0; frame ^= 1;
            const minX = Math.min(...alive.map((s) => s.x)), maxX = Math.max(...alive.map((s) => s.x));
            if ((dirX > 0 && maxX + 16 >= W - 6) || (dirX < 0 && minX <= 6)) { dirX = -dirX; alive.forEach((s) => { s.y += 8; }); }
            else alive.forEach((s) => { s.x += 4 * dirX; });
          }
          if (Math.random() < dt * (api.easy ? 1.1 : 1.9)) { const s = alive[Math.floor(Math.random() * alive.length)]; bombs.push({ x: s.x + 6, y: s.y + 8, vy: 110 * k }); }
          for (const s of alive) if (hitShot(s.x, s.y, 12, 8)) { s.alive = false; api.sfx('blip'); api.boom(s.x + 6, s.y + 4, ['#ff5a5f', '#ff9f43', '#b69cff', '#7fe3ff'][s.row], 22); }
          if (alive.some((s) => s.alive && s.y > H - 60)) return api.die();
          if (!swarm.some((s) => s.alive)) { phase = 'divers'; newDivers(); api.sfx('alarm'); api.shake(0.2); }
        } else if (phase === 'divers') {
          // Корабли занимают места в строю и по очереди пикируют по дуге на игрока.
          for (const d of divers) {
            if (!d.alive) continue;
            d.t += dt;
            if (d.state === 'enter') { d.y += 120 * dt; if (d.y >= d.hy) { d.y = d.hy; d.state = 'home'; d.t = Math.random() * 3; } }
            else if (d.state === 'home') { d.x = d.hx + Math.sin(t * 2 + d.hx) * 6; if (d.t > (api.easy ? 5 : 3.5) && Math.random() < dt * 0.8) { d.state = 'dive'; d.t = 0; d.sx = d.x; d.sy = d.y; d.tx = ship.x; } }
            else if (d.state === 'dive') {
              const k2 = d.t / (1.8 / k);
              d.x = d.sx + (d.tx - d.sx) * k2 + Math.sin(k2 * Math.PI * 2) * 60;
              d.y = d.sy + (H + 20 - d.sy) * k2;
              if (Math.random() < dt * 1.2) bombs.push({ x: d.x, y: d.y + 6, vy: 150 * k, vx: (ship.x - d.x) * 0.3 });
              if (k2 >= 1) { d.state = 'enter'; d.y = -20; d.x = d.hx; }
            }
            if (hitShot(d.x - 6, d.y - 4, 12, 9)) { d.alive = false; api.sfx('blip'); api.boom(d.x, d.y, '#ffd166', 26); }
            if (d.alive && Math.abs(d.x - ship.x) < 10 && Math.abs(d.y - ship.y) < 8) return api.die();
          }
          if (!divers.some((d) => d.alive)) {
            phase = 'boss';
            boss = { x: W / 2, y: 50, hp: api.easy ? 24 : 36, max: api.easy ? 24 : 36, dir: 1, cd: 1.5, warn: 0, beamT: 5 };
            api.sfx('alarm'); api.shake(0.5);
          }
        } else if (phase === 'boss') {
          boss.x += boss.dir * 60 * k * dt;
          if (boss.x > W - 60 || boss.x < 60) boss.dir = -boss.dir;
          boss.cd -= dt; boss.beamT -= dt;
          if (boss.cd <= 0 && boss.warn <= 0) { boss.warn = api.easy ? 0.9 : 0.6; api.sfx('telegraph'); }
          if (boss.warn > 0) { boss.warn -= dt; if (boss.warn <= 0) { [-60, -25, 0, 25, 60].forEach((vx) => bombs.push({ x: boss.x, y: boss.y + 16, vy: 120 * k, vx: vx * k })); boss.cd = api.easy ? 2 : 1.4; } }
          // Луч с предупреждением: штриховая полоса, потом удар.
          if (!sweep && boss.beamT <= 0) { sweep = { x: ship.x, t: api.easy ? 1.4 : 1 }; boss.beamT = 6; api.sfx('telegraph'); }
          if (sweep) {
            sweep.t -= dt;
            if (sweep.t <= 0 && sweep.t > -0.4 && Math.abs(ship.x - sweep.x) < 14) return api.die();
            if (sweep.t < -0.4) sweep = null;
          }
          if (hitShot(boss.x - 42, boss.y - 18, 84, 34)) { boss.hp--; flashT = 0.08; api.sfx('rotate'); api.boom(boss.x + (Math.random() - 0.5) * 60, boss.y + 10, '#ffd166', 10); }
          if (boss.hp <= 0) { for (let i = 0; i < 8; i++) api.boom(boss.x + (i - 4) * 12, boss.y + (i % 3) * 8, i % 2 ? '#ff5a5f' : '#ffd166', 40); api.shake(0.8); return api.win(); }
        }
        for (const b of bombs) if (Math.abs(b.x - ship.x) < 7 && b.y > ship.y - 7 && b.y < ship.y + 7) return api.die();
      },
      draw(g) {
        if (!bg) bg = drawBg();
        g.drawImage(bg, 0, 0);
        // Прожекторы города
        if (!NP.Settings.values.reduceFlash) for (let i = 0; i < 3; i++) {
          const x = 80 + i * 160, a = Math.sin(t * 0.7 + i * 2) * 0.5;
          g.fillStyle = 'rgba(200,220,255,0.05)'; g.beginPath(); g.moveTo(x, H); g.lineTo(x + Math.sin(a) * 300 - 20, 0); g.lineTo(x + Math.sin(a) * 300 + 20, 0); g.fill();
        }
        if (phase === 'wave') swarm.forEach((s) => { if (s.alive) g.drawImage(sprite('sinv' + frame + s.row, INV[frame], { r: ['#ff5a5f', '#ff9f43', '#b69cff', '#7fe3ff'][s.row] }), Math.round(s.x), Math.round(s.y)); });
        if (phase === 'divers') divers.forEach((d) => { if (d.alive) g.drawImage(sprite('diver', DIVER, { y: '#ffd166', r: '#ff5a5f', w: '#ffffff' }), Math.round(d.x - 5), Math.round(d.y - 3)); });
        if (phase === 'boss' && boss) {
          const bx = Math.round(boss.x), by = Math.round(boss.y);
          if (sweep) {
            if (sweep.t > 0) { g.fillStyle = 'rgba(255,90,95,' + (0.15 + 0.15 * Math.sin(t * 30)) + ')'; g.fillRect(sweep.x - 12, by, 24, H); g.strokeStyle = '#ffd0d0'; g.strokeRect(sweep.x - 12.5, by, 25, H); }
            else { g.fillStyle = NP.Settings.values.reduceFlash ? '#ff9aa0' : '#ffffff'; g.fillRect(sweep.x - 8, by, 16, H); g.fillStyle = '#ff5a5f'; g.fillRect(sweep.x - 12, by, 4, H); g.fillRect(sweep.x + 8, by, 4, H); }
          }
          const warn = boss.warn > 0 && Math.floor(t * 30) % 2;
          g.fillStyle = flashT > 0 ? '#ffffff' : warn ? '#ffd166' : '#3a1f4f';
          g.fillRect(bx - 44, by - 10, 88, 22); g.fillRect(bx - 30, by - 18, 60, 10); g.fillRect(bx - 56, by, 112, 8);
          g.fillStyle = '#ff5a5f'; for (let i = 0; i < 7; i++) g.fillRect(bx - 48 + i * 16, by + 2, 6, 4);
          g.fillStyle = '#7fe3ff'; g.fillRect(bx - 12, by - 16, 24, 6);
          g.fillStyle = '#3a1f3f'; g.fillRect(W / 2 - 80, 8, 160, 5);
          g.fillStyle = '#ff5a5f'; g.fillRect(W / 2 - 80, 8, (160 * boss.hp) / boss.max, 5);
        }
        g.fillStyle = '#ffd166'; shots.forEach((s) => { g.fillRect(Math.round(s.x), Math.round(s.y), 1, 8); g.fillStyle = 'rgba(255,209,102,0.3)'; g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 8); g.fillStyle = '#ffd166'; });
        bombs.forEach((b) => { g.fillStyle = Math.sin(t * 30 + b.x) > 0 ? '#ff5a5f' : '#ffd0d0'; g.fillRect(Math.round(b.x) - 1, Math.round(b.y), 3, 6); });
        g.drawImage(sprite('pship', SHIP, { y: '#ffd166', w: '#7fb3ff', r: '#ff5a5f' }), Math.round(ship.x - 6), ship.y - 4);
        g.fillStyle = 'rgba(255,160,60,' + (0.5 + 0.5 * Math.sin(t * 40)) + ')'; g.fillRect(Math.round(ship.x) - 2, ship.y + 4, 4, 3);
      },
      status() {
        if (phase === 'boss') return NP.T('arc.skyfight.boss', { n: boss.hp });
        const n = phase === 'wave' ? swarm.filter((s) => s.alive).length : divers.filter((d) => d.alive).length;
        return NP.T('arc.skyfight.status', { n, w: phase === 'wave' ? 1 : 2 });
      },
    };
  };
  NP.Games.skyfight.size = [W, H];
})();
