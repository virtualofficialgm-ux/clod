// Автомат 5 «Вторжение охраны» — стрелялка в духе классических космических захватчиков, с боссом-Сканером.
(function () {
  const NP = window.NP;
  const INV = [
    ['..r....r..', '...rrrr...', '..rwrrwr..', '.rrrrrrrr.', '.r.rrrr.r.', 'r..r..r..r'],
    ['..r....r..', 'r..rrrr..r', 'r.rwrrwr.r', '.rrrrrrrr.', '...r..r...', '..r....r..'],
  ];
  const SHIP = ['....yy....', '...yyyy...', '...ywwy...', '.yyyyyyyy.', 'yyyyyyyyyy', 'yy.y..y.yy'];
  const BOSS = ['.....rrrrrrrrrr.....', '...rrrrrrrrrrrrrr...', '.rrrwwrrwwrrwwrrwwr.', 'rrrrrrrrrrrrrrrrrrrr', '.rr..rr..rr..rr..rr.', '..r...r...r...r...r.'];
  const COLS = 8, ROWS = 4;

  NP.Games.invaders = function (api) {
    let ship, shots, bombs, swarm, dirX, stepT, frame, bunkers, phase, boss, t, flashT, killed;
    const k = api.easy ? 0.72 : 1;
    const newSwarm = () => {
      swarm = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) swarm.push({ x: 40 + c * 24, y: 22 + r * 15, alive: true, row: r });
      dirX = 1; stepT = 0; frame = 0;
    };
    const newBunkers = () => {
      bunkers = [];
      [50, 125, 200, 275].forEach((bx) => { for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) if (!(y === 4 && x > 2 && x < 6)) bunkers.push({ x: bx - 9 + x * 2, y: 138 + y * 2, hp: 2 }); });
    };
    const hitBunker = (b) => {
      for (const bl of bunkers) {
        if (bl.hp > 0 && b.x >= bl.x - 1 && b.x <= bl.x + 2 && b.y >= bl.y - 1 && b.y <= bl.y + 3) { bl.hp--; return true; }
      }
      return false;
    };
    return {
      reset(full) {
        if (full) { newSwarm(); newBunkers(); phase = 'wave'; boss = null; t = 0; killed = 0; }
        ship = { x: api.W / 2, y: 164, cd: 0 };
        shots = []; bombs = []; flashT = 0;
        // После потери жизни рой отступает, чтобы не проиграть сразу снова.
        if (swarm) { const top = Math.min(...swarm.filter((s) => s.alive).map((s) => s.y)); if (top > 40) swarm.forEach((s) => { s.y -= top - 40; }); }
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        ship.x = NP.clamp(ship.x + a.x * 120 * dt, 8, api.W - 8);
        if (api.pointer.active && api.pointer.x !== null) ship.x += (api.pointer.x - ship.x) * Math.min(1, dt * 10);
        ship.cd -= dt;
        if ((api.held('act') || api.pressed('act') || api.pointer.active) && ship.cd <= 0 && shots.length < 2) {
          shots.push({ x: ship.x, y: ship.y - 6 }); ship.cd = 0.32; api.sfx('telegraph');
        }
        shots.forEach((s) => { s.y -= 240 * dt; });
        bombs.forEach((b) => { b.y += b.vy * dt; b.x += (b.vx || 0) * dt; });
        shots = shots.filter((s) => s.y > 0 && !hitBunker(s));
        bombs = bombs.filter((b) => b.y < api.H && !hitBunker(b));
        if (flashT > 0) flashT -= dt;

        if (phase === 'wave') {
          const alive = swarm.filter((s) => s.alive);
          stepT += dt;
          const interval = Math.max(0.08, (0.05 + alive.length * 0.018) / k);
          if (stepT >= interval) {
            stepT = 0; frame ^= 1;
            const minX = Math.min(...alive.map((s) => s.x)), maxX = Math.max(...alive.map((s) => s.x));
            if ((dirX > 0 && maxX + 12 >= api.W - 4) || (dirX < 0 && minX <= 4)) { dirX = -dirX; alive.forEach((s) => { s.y += 6; }); }
            else alive.forEach((s) => { s.x += 3 * dirX; });
          }
          // Стреляет нижний в случайной колонке.
          if (Math.random() < dt * (api.easy ? 0.9 : 1.5)) {
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            const lowest = alive.filter((s) => Math.abs(s.x - shooter.x) < 4).sort((p, q) => q.y - p.y)[0];
            bombs.push({ x: lowest.x + 5, y: lowest.y + 7, vy: 70 * k + 20 });
          }
          for (const s of shots) for (const inv of alive) {
            if (s.x >= inv.x && s.x <= inv.x + 10 && s.y >= inv.y && s.y <= inv.y + 6) { inv.alive = false; s.y = -99; killed++; api.sfx('blip'); }
          }
          if (alive.some((s) => s.alive && s.y + 6 >= 136)) return api.die();
          if (!swarm.some((s) => s.alive)) {
            phase = 'boss';
            boss = { x: api.W / 2, y: 28, hp: api.easy ? 12 : 18, max: api.easy ? 12 : 18, dir: 1, cd: 1.5, warn: 0 };
            api.sfx('alarm');
          }
        } else if (phase === 'boss') {
          boss.x += boss.dir * 50 * k * dt;
          if (boss.x > api.W - 30 || boss.x < 30) boss.dir = -boss.dir;
          boss.cd -= dt;
          // Телеграфия залпа: босс мигает перед выстрелом веером.
          if (boss.cd <= 0 && boss.warn <= 0) { boss.warn = api.easy ? 1 : 0.7; api.sfx('telegraph'); }
          if (boss.warn > 0) {
            boss.warn -= dt;
            if (boss.warn <= 0) {
              [-40, -15, 15, 40].forEach((vx) => bombs.push({ x: boss.x, y: boss.y + 8, vy: 80 * k + 10, vx: vx * k }));
              boss.cd = api.easy ? 2.4 : 1.7;
            }
          }
          for (const s of shots) if (Math.abs(s.x - boss.x) < 20 && s.y < boss.y + 6 && s.y > boss.y - 6) { s.y = -99; boss.hp--; flashT = 0.08; api.sfx('rotate'); }
          if (boss.hp <= 0) return api.win();
        }
        for (const b of bombs) if (Math.abs(b.x - ship.x) < 5 && b.y > ship.y - 5 && b.y < ship.y + 5) return api.die();
      },
      draw(g) {
        g.fillStyle = '#07060e'; g.fillRect(0, 0, api.W, api.H);
        for (let i = 0; i < 50; i++) { g.fillStyle = i % 7 ? '#2a2745' : '#8f7fe0'; g.fillRect((i * 71) % api.W, (i * 43 + t * (4 + (i % 3) * 3)) % api.H, 1, 1); }
        g.fillStyle = '#3a1f3f'; g.fillRect(0, 172, api.W, 1);
        bunkers.forEach((bl) => { if (bl.hp > 0) { g.fillStyle = bl.hp > 1 ? '#6fe3a1' : '#2f8a5a'; g.fillRect(bl.x, bl.y, 2, 2); } });
        if (phase === 'wave') {
          swarm.forEach((s) => { if (s.alive) g.drawImage(NP.Arcade.sprite('inv' + frame + s.row, INV[frame], { r: ['#ff5a5f', '#ff9f43', '#b69cff', '#7fe3ff'][s.row], w: '#fff' }), s.x, s.y); });
        } else if (boss) {
          const warn = boss.warn > 0 && Math.sin(t * 30) > 0;
          const img = NP.Arcade.sprite(warn ? 'bossw' : flashT > 0 ? 'bossf' : 'boss', BOSS, { r: warn ? '#ffd166' : flashT > 0 ? '#ffffff' : '#ff5a5f', w: '#10182a' });
          g.drawImage(img, Math.round(boss.x - 10), Math.round(boss.y - 3));
          g.fillStyle = '#3a1f3f'; g.fillRect(api.W / 2 - 50, 6, 100, 4);
          g.fillStyle = '#ff5a5f'; g.fillRect(api.W / 2 - 50, 6, (100 * boss.hp) / boss.max, 4);
        }
        g.fillStyle = '#ffd166'; shots.forEach((s) => g.fillRect(Math.round(s.x), Math.round(s.y), 1, 5));
        bombs.forEach((b) => { g.fillStyle = Math.sin(t * 30 + b.x) > 0 ? '#ff5a5f' : '#ffd0d0'; g.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 4); });
        g.drawImage(NP.Arcade.sprite('ship', SHIP, { y: '#ffd166', w: '#7fb3ff' }), Math.round(ship.x - 5), ship.y - 3);
      },
      status() { return phase === 'boss' ? NP.T('arc.invaders.boss', { n: boss.hp }) : NP.T('arc.invaders.status', { n: killed, total: COLS * ROWS }); },
    };
  };
})();
