// Автомат 3 «Магистраль» — переправа через поток пакетов и реку данных, в духе аркадной классики с лягушкой.
(function () {
  const NP = window.NP;
  const TS = 16, COLS = 20, OY = 2, HOMES = [2, 6, 10, 14, 18], NEED = 3;
  // Полосы: row, тип (river — плоты, road — машины), скорость px/с, длина в тайлах, шаг между объектами.
  const LANES = [
    { row: 1, kind: 'river', speed: -28, len: 3, gap: 6 },
    { row: 2, kind: 'river', speed: 42, len: 2, gap: 5 },
    { row: 3, kind: 'river', speed: -24, len: 4, gap: 7 },
    { row: 4, kind: 'river', speed: 34, len: 3, gap: 6 },
    { row: 6, kind: 'road', speed: -58, len: 1, gap: 5 },
    { row: 7, kind: 'road', speed: 38, len: 2, gap: 7 },
    { row: 8, kind: 'road', speed: -78, len: 1, gap: 6 },
    { row: 9, kind: 'road', speed: 48, len: 2, gap: 8 },
  ];
  const CAR_COL = ['#ff5a5f', '#ffd166', '#7fe3ff', '#f4a261'];
  const FROG = ['..gg..gg..', '.gKgggKg..', '.gggggggg.', 'gggYYYYggg', 'g.gYYYYg.g', '..gggggg..', '.gg....gg.', 'gg......gg'];

  NP.Games.crossing = function (api) {
    let frog, homes, t, hopCd, squash;
    const k = api.easy ? 0.7 : 1;
    const period = (l) => Math.ceil((COLS + l.len) / l.gap + 1) * l.gap * TS;
    const objects = (l) => {
      const P = period(l), out = [];
      for (let x = 0; x < P; x += l.gap * TS) {
        let px = (x + l.speed * k * t) % P;
        if (px < 0) px += P;
        out.push(px - l.len * TS);
      }
      return out;
    };
    const startFrog = () => { frog = { x: 9 * TS, row: 10 }; };
    const hop = (dx, dy) => {
      const nx = frog.x + dx * TS, nr = frog.row + dy;
      if (nx < 0 || nx > (COLS - 1) * TS || nr > 10 || nr < 0) return;
      frog.x = nx; frog.row = nr; hopCd = 0.16; squash = 0.1;
      api.sfx('step');
    };
    return {
      reset(full) {
        if (full) { homes = HOMES.map(() => false); t = 0; }
        startFrog(); hopCd = 0; squash = 0;
      },
      update(dt) {
        t += dt;
        hopCd -= dt; squash -= dt;
        const a = api.axis();
        const p = { l: api.pressed('left'), r: api.pressed('right'), u: api.pressed('up'), d: api.pressed('down') };
        if (p.u) hop(0, -1); else if (p.d) hop(0, 1); else if (p.l) hop(-1, 0); else if (p.r) hop(1, 0);
        else if (hopCd <= 0) {
          if (a.y < -0.6) hop(0, -1); else if (a.y > 0.6) hop(0, 1); else if (a.x < -0.6) hop(-1, 0); else if (a.x > 0.6) hop(1, 0);
        }
        const lane = LANES.find((l) => l.row === frog.row);
        const fx0 = frog.x + 3, fx1 = frog.x + TS - 3;
        if (lane && lane.kind === 'road') {
          for (const ox of objects(lane)) if (fx1 > ox + 1 && fx0 < ox + lane.len * TS - 1) return api.die();
        } else if (lane && lane.kind === 'river') {
          const on = objects(lane).some((ox) => frog.x + TS / 2 > ox && frog.x + TS / 2 < ox + lane.len * TS);
          if (!on) return api.die();
          frog.x += lane.speed * k * dt;
          if (frog.x < -4 || frog.x > (COLS - 1) * TS + 4) return api.die();
        } else if (frog.row === 0) {
          const i = HOMES.findIndex((h) => Math.abs(h * TS - frog.x) <= 7);
          if (i < 0 || homes[i]) return api.die();
          homes[i] = true;
          api.sfx('evidence');
          api.fx.emit(HOMES[i] * TS + 8, OY + 8, { count: 30, color: ['#3cff9a', '#ffd166', '#ffffff'], speed: 80, life: 0.9, size: 2, gravity: 60 });
          if (homes.filter(Boolean).length >= NEED) return api.win();
          startFrog();
        }
      },
      draw(g) {
        const W = api.W;
        g.fillStyle = '#05060c'; g.fillRect(0, 0, W, api.H);
        const Y = (r) => OY + r * TS;
        // Цель: стена с гнёздами
        g.fillStyle = '#1f5c3a'; g.fillRect(0, Y(0), W, TS);
        HOMES.forEach((h, i) => {
          g.fillStyle = '#0b1a12'; g.fillRect(h * TS - 1, Y(0) + 1, TS + 2, TS - 1);
          g.strokeStyle = '#3cff9a'; g.lineWidth = 1; g.strokeRect(h * TS - 0.5, Y(0) + 1.5, TS + 1, TS - 2);
          if (homes[i]) g.drawImage(NP.Arcade.sprite('frog', FROG, { g: '#3cff9a', K: '#0b1a12', Y: '#d9ffe9' }), h * TS + 3, Y(0) + 4);
        });
        // Река данных
        g.fillStyle = '#0a1840'; g.fillRect(0, Y(1), W, TS * 4);
        g.fillStyle = '#1d3a8a';
        for (let i = 0; i < 40; i++) g.fillRect((i * 37 + t * (i % 2 ? 20 : -14)) % W < 0 ? ((i * 37 + t * (i % 2 ? 20 : -14)) % W) + W : (i * 37 + t * (i % 2 ? 20 : -14)) % W, Y(1 + (i % 4)) + 3 + (i % 3) * 4, 3, 1);
        // Безопасная полоса и старт
        [5, 10].forEach((r) => { g.fillStyle = '#2a2140'; g.fillRect(0, Y(r), W, TS); g.fillStyle = '#3a2f58'; for (let x = 0; x < W; x += 8) g.fillRect(x, Y(r) + (x / 8) % 2 * 8, 4, 4); });
        // Дорога
        g.fillStyle = '#141318'; g.fillRect(0, Y(6), W, TS * 4);
        g.fillStyle = '#4a4a55';
        for (let r = 7; r <= 9; r++) for (let x = 0; x < W; x += 16) g.fillRect(x + 2, Y(r) - 1, 8, 1);
        for (const l of LANES) {
          for (const ox of objects(l)) {
            const x = Math.round(ox), y = Y(l.row);
            if (l.kind === 'river') {
              g.fillStyle = '#6fe3a1'; g.fillRect(x + 1, y + 3, l.len * TS - 2, TS - 6);
              g.fillStyle = '#2f8a5a'; for (let j = 0; j < l.len; j++) g.fillRect(x + j * TS + 6, y + 6, 4, 4);
            } else {
              const col = CAR_COL[l.row % CAR_COL.length];
              g.fillStyle = col; g.fillRect(x + 1, y + 3, l.len * TS - 2, TS - 6);
              g.fillStyle = '#0b0d1a'; g.fillRect(x + 4, y + 5, l.len * TS - 8, 3);
              g.fillStyle = '#fff'; const front = l.speed > 0 ? x + l.len * TS - 3 : x + 1; g.fillRect(front, y + 4, 2, 2); g.fillRect(front, y + 10, 2, 2);
            }
          }
        }
        const s = squash > 0 ? 1 : 0;
        g.drawImage(NP.Arcade.sprite('frog', FROG, { g: '#3cff9a', K: '#0b1a12', Y: '#d9ffe9' }), Math.round(frog.x) + 3, Y(frog.row) + 4 + s);
      },
      status() { return NP.T('arc.crossing.status', { n: homes.filter(Boolean).length, total: NEED }); },
    };
  };
})();
