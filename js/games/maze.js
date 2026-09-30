// Автомат 4 «Сторожа кэша» — лабиринт с точками и охранниками, в духе классического пожирателя точек.
(function () {
  const NP = window.NP;
  const TS = 8, GW = 36, GH = 20, OX = 16, OY = 10;

  // Лабиринт из «островов» стен с коридорами шириной в клетку: тупиков нет.
  function buildMaze() {
    const g = [];
    for (let y = 0; y < GH; y++) g.push(new Array(GW).fill(y === 0 || y === GH - 1 ? 1 : 0));
    for (let y = 0; y < GH; y++) { g[y][0] = 1; g[y][GW - 1] = 1; }
    const islands = [
      [2, 2, 3, 3], [6, 2, 3, 3], [10, 2, 5, 3],
      [2, 6, 3, 3], [6, 6, 7, 1], [6, 8, 3, 1], [14, 6, 2, 3],
      [2, 10, 3, 3], [6, 10, 3, 3], [10, 10, 3, 1], [10, 12, 5, 1], [14, 10, 1, 2],
      [2, 14, 7, 1], [2, 16, 3, 2], [6, 16, 3, 2], [10, 14, 5, 4],
    ];
    for (const [x, y, w, h] of islands) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { g[yy][xx] = 1; g[yy][GW - 1 - xx] = 1; }
    }
    return g;
  }
  const MAZE = buildMaze();
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const open = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !MAZE[y][x];

  NP.Games.maze = function (api) {
    let dots, pl, ghosts, fright, t, total;
    const sp = (base) => base * (api.easy ? 0.8 : 1);
    const mk = (x, y, speed) => ({ x, y, tx: x, ty: y, px: x * TS, py: y * TS, dir: [0, 0], speed });
    // Движение по клеткам с плавной интерполяцией.
    const advance = (e, dt, choose) => {
      const tx = e.tx * TS, ty = e.ty * TS;
      const dx = tx - e.px, dy = ty - e.py, d = Math.hypot(dx, dy), step = e.speed * dt;
      if (d > step) { e.px += (dx / d) * step; e.py += (dy / d) * step; return; }
      e.px = tx; e.py = ty; e.x = e.tx; e.y = e.ty;
      const nd = choose(e);
      if (nd && open(e.x + nd[0], e.y + nd[1])) { e.dir = nd; e.tx = e.x + nd[0]; e.ty = e.y + nd[1]; }
      else if (open(e.x + e.dir[0], e.y + e.dir[1])) { e.tx = e.x + e.dir[0]; e.ty = e.y + e.dir[1]; }
    };
    const ghostChoose = (gh) => (e) => {
      const opts = DIRS.filter((d) => open(e.x + d[0], e.y + d[1]) && !(d[0] === -e.dir[0] && d[1] === -e.dir[1]));
      if (!opts.length) return [-e.dir[0], -e.dir[1]];
      if (fright > 0 || (gh.mode === 'wander' && Math.random() < 0.5)) return opts[Math.floor(Math.random() * opts.length)];
      let tx = pl.x, ty = pl.y;
      if (gh.mode === 'ahead') { tx += pl.dir[0] * 4; ty += pl.dir[1] * 4; }
      opts.sort((a, b) => Math.hypot(e.x + a[0] - tx, e.y + a[1] - ty) - Math.hypot(e.x + b[0] - tx, e.y + b[1] - ty));
      return opts[0];
    };
    let want = [0, 0];
    return {
      reset(full) {
        if (full) {
          dots = new Set(); t = 0;
          for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!MAZE[y][x]) dots.add(x + ',' + y);
          ['1,1', GW - 2 + ',1', '1,' + (GH - 2), GW - 2 + ',' + (GH - 2)].forEach((k) => dots.delete(k));
          this.power = new Set(['1,1', GW - 2 + ',1', '1,' + (GH - 2), GW - 2 + ',' + (GH - 2)]);
          dots.delete('17,18'); dots.delete('18,18');
          // Победа — 60% данных: лабиринт большой, играть его нужно пару минут, а не пять.
          total = Math.round(dots.size * 0.6);
          this.start = dots.size;
        }
        pl = mk(17, 18, sp(58)); want = [0, 0];
        ghosts = [
          Object.assign(mk(17, 9, sp(44)), { mode: 'chase', col: '#ff5a5f', delay: 0 }),
          Object.assign(mk(18, 9, sp(42)), { mode: 'ahead', col: '#f4a261', delay: 3 }),
          Object.assign(mk(17, 5, sp(40)), { mode: 'wander', col: '#b69cff', delay: 6 }),
        ];
        fright = 0;
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        if (Math.abs(a.x) > 0.5) want = [Math.sign(a.x), 0]; else if (Math.abs(a.y) > 0.5) want = [0, Math.sign(a.y)];
        // Разворот на месте без ожидания центра клетки.
        if (want[0] === -pl.dir[0] && want[1] === -pl.dir[1] && (want[0] || want[1])) { pl.dir = want; const ox = pl.tx, oy = pl.ty; pl.tx = pl.x; pl.ty = pl.y; pl.x = ox; pl.y = oy; }
        advance(pl, dt, () => want);
        const key = pl.tx + ',' + pl.ty;
        if (Math.hypot(pl.px - pl.tx * TS, pl.py - pl.ty * TS) < 4) {
          if (dots.delete(key)) { if (dots.size % 3 === 0) api.sfx('step'); }
          if (this.power.delete(key)) { fright = api.easy ? 8 : 6; api.sfx('evidence'); }
        }
        if (fright > 0) fright -= dt;
        for (const gh of ghosts) {
          if (gh.delay > 0) { gh.delay -= dt; continue; }
          gh.speed = sp(fright > 0 ? 30 : gh.mode === 'chase' ? 46 : 42);
          advance(gh, dt, ghostChoose(gh));
          if (Math.hypot(gh.px - pl.px, gh.py - pl.py) < 6) {
            if (fright > 0) { Object.assign(gh, mk(17, 9, gh.speed), { delay: 2.5 }); api.sfx('confirm'); }
            else return api.die();
          }
        }
        if (this.start - dots.size >= total) api.win();
      },
      draw(g) {
        g.fillStyle = '#05050d'; g.fillRect(0, 0, api.W, api.H);
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          if (!MAZE[y][x]) continue;
          g.fillStyle = '#2c2852'; g.fillRect(OX + x * TS, OY + y * TS, TS, TS);
          g.fillStyle = '#8f7fe0';
          if (!MAZE[y - 1] || !MAZE[y - 1][x]) g.fillRect(OX + x * TS, OY + y * TS, TS, 1);
          if (!MAZE[y + 1] || !MAZE[y + 1][x]) g.fillRect(OX + x * TS, OY + y * TS + TS - 1, TS, 1);
          if (!MAZE[y][x - 1]) g.fillRect(OX + x * TS, OY + y * TS, 1, TS);
          if (!MAZE[y][x + 1]) g.fillRect(OX + x * TS + TS - 1, OY + y * TS, 1, TS);
        }
        g.fillStyle = '#ffd9a8';
        dots.forEach((k) => { const [x, y] = k.split(','); g.fillRect(OX + x * TS + 3, OY + y * TS + 3, 2, 2); });
        if (Math.sin(t * 8) > -0.3) this.power.forEach((k) => { const [x, y] = k.split(','); g.fillStyle = '#7fe3ff'; g.fillRect(OX + x * TS + 1, OY + y * TS + 1, 6, 6); });
        // Илья-пожиратель: круг с ртом по направлению.
        const cx = OX + pl.px + 4, cy = OY + pl.py + 4;
        const mouth = Math.abs(Math.sin(t * 14)) * 0.8;
        const ang = Math.atan2(pl.dir[1], pl.dir[0] || (pl.dir[1] ? 0 : 1));
        g.fillStyle = '#ffd166';
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 4, ang + mouth / 2, ang + Math.PI * 2 - mouth / 2); g.closePath(); g.fill();
        for (const gh of ghosts) {
          const x = Math.round(OX + gh.px), y = Math.round(OY + gh.py);
          const blink = fright > 0 && fright < 2 && Math.sin(t * 20) > 0;
          g.fillStyle = fright > 0 ? (blink ? '#f4f1ea' : '#3050d0') : gh.col;
          if (gh.delay > 0) g.globalAlpha = 0.4;
          g.fillRect(x, y + 1, 8, 6); g.fillRect(x + 1, y, 6, 1);
          g.fillRect(x, y + 7, 2, 1); g.fillRect(x + 3, y + 7, 2, 1); g.fillRect(x + 6, y + 7, 2, 1);
          g.fillStyle = '#fff'; g.fillRect(x + 1, y + 2, 2, 2); g.fillRect(x + 5, y + 2, 2, 2);
          g.fillStyle = '#10182a'; g.fillRect(x + 2 + gh.dir[0], y + 3, 1, 1); g.fillRect(x + 6 + gh.dir[0], y + 3, 1, 1);
          g.globalAlpha = 1;
        }
      },
      status() { return NP.T('arc.maze.status', { n: this.start - dots.size, total }); },
    };
  };
})();
