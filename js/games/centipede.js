// Раунд «Многоножка на крыше»: гигантская пиксельная многоножка ползёт по крышам вниз, Илья отстреливается световым ружьём.
// Подстреленный сегмент становится кубиком, цепь рвётся, хвост получает свою голову.
(function () {
  const NP = window.NP;
  const W = 480, H = 270, C = 12, COLS = 40, ROWS = 22, OY = 2, ZONE = 16;
  let skyline = null;

  function drawSkyline() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b0620'); gr.addColorStop(1, '#2a1030');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { g.fillStyle = i % 9 ? '#4a4478' : '#e6dcff'; g.fillRect((i * 97) % W, (i * 53) % 120, 1, 1); }
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(400, 40, 16, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 20; i++) {
      const bw = 20 + ((i * 37) % 30), bh = 60 + ((i * 71) % 110), x = i * 26 - 10;
      g.fillStyle = '#150d24'; g.fillRect(x, H - bh, bw, bh);
      g.fillStyle = 'rgba(255,217,138,0.5)';
      for (let y = H - bh + 6; y < H - 6; y += 9) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if ((wx * 7 + y * 3) % 5 === 0) g.fillRect(wx, y, 2, 3);
    }
    // Крыша, на которой стоит Илья
    g.fillStyle = '#1d1430'; g.fillRect(0, OY + ZONE * C - 4, W, 4);
    g.fillStyle = 'rgba(127,227,255,0.06)'; g.fillRect(0, OY + ZONE * C, W, H);
    return c;
  }

  NP.Games.centipede = function (api) {
    let blocks, segs, pl, shots, spider, spiderT, wave, fireT, t, killed;
    const k = api.easy ? 0.75 : 1;
    const key = (c, r) => c + ',' + r;
    const spawnChain = (n, speed) => {
      const chain = [];
      for (let i = 0; i < n; i++) chain.push({ x: -i * C - C, row: 0, dir: 1, down: 1, vy: 0, speed, alive: true, prev: null, next: null });
      for (let i = 0; i < n; i++) { chain[i].prev = chain[i - 1] || null; chain[i].next = chain[i + 1] || null; }
      segs = segs.concat(chain);
    };
    const startWave = () => {
      segs = [];
      spawnChain(wave === 1 ? 12 : 14, (wave === 1 ? 72 : 92) * k);
      if (wave === 2) { const extra = { x: W + C, row: 3, dir: -1, down: 1, vy: 0, speed: 100 * k, alive: true, prev: null, next: null }; segs.push(extra); }
    };
    const blocked = (c, r) => c < 0 || c >= COLS || blocks.has(key(c, r));
    return {
      reset(full) {
        if (full) {
          blocks = new Map(); t = 0; killed = 0; wave = 1;
          for (let i = 0; i < 46; i++) { const c = Math.floor(Math.random() * COLS), r = 2 + Math.floor(Math.random() * (ZONE - 3)); blocks.set(key(c, r), 3); }
          startWave();
        } else {
          // После сбоя многоножка заходит сверху заново с тем же числом сегментов.
          const n = segs.filter((s) => s.alive).length;
          segs = []; spawnChain(Math.max(1, n), (wave === 1 ? 72 : 92) * k);
        }
        pl = { x: W / 2, y: H - 20 }; shots = []; spider = null; spiderT = 3; fireT = 0;
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        pl.x = NP.clamp(pl.x + a.x * 170 * dt, 8, W - 8);
        pl.y = NP.clamp(pl.y + a.y * 140 * dt, OY + ZONE * C + 10, H - 6);
        if (api.pointer.active && api.pointer.x !== null) pl.x += (api.pointer.x - pl.x) * Math.min(1, dt * 10);
        fireT -= dt;
        if ((api.held('act') || api.pointer.active) && fireT <= 0 && shots.length < 3) { shots.push({ x: pl.x, y: pl.y - 16 }); fireT = 0.11; api.sfx('telegraph'); }
        for (const s of shots) s.y -= 520 * dt;
        // Пули по кубикам и сегментам
        shots = shots.filter((s) => {
          if (s.y < 0) return false;
          const c = Math.floor(s.x / C), r = Math.floor((s.y - OY) / C);
          const bk = key(c, r);
          if (blocks.has(bk)) {
            const hp = blocks.get(bk) - 1;
            if (hp <= 0) { blocks.delete(bk); api.boom(c * C + 6, OY + r * C + 6, '#7fe3ff', 10); } else blocks.set(bk, hp);
            return false;
          }
          for (const sg of segs) {
            if (!sg.alive) continue;
            const sy = OY + sg.row * C + sg.vy;
            if (s.x > sg.x - 1 && s.x < sg.x + C + 1 && s.y > sy - 2 && s.y < sy + C + 2) {
              sg.alive = false; killed++;
              if (sg.prev) sg.prev.next = null;
              if (sg.next) sg.next.prev = null;
              const cc = Math.round(sg.x / C);
              if (sg.row < ROWS && cc >= 0 && cc < COLS) blocks.set(key(cc, sg.row), 3);
              api.boom(sg.x + 6, sy + 6, '#6fe3a1', 22); api.shake(0.05); api.sfx('blip');
              return false;
            }
          }
          if (spider && Math.abs(s.x - spider.x) < 9 && Math.abs(s.y - spider.y) < 7) { api.boom(spider.x, spider.y, '#ff5a5f', 30); api.sfx('confirm'); spider = null; spiderT = 4; return false; }
          return true;
        });
        // Движение сегментов по классическим правилам: упёрся — вниз на ряд и назад.
        for (const sg of segs) {
          if (!sg.alive) continue;
          if (sg.vy < 0) sg.vy = Math.min(0, sg.vy + 120 * dt);
          sg.x += sg.dir * sg.speed * dt;
          const lead = sg.dir > 0 ? sg.x + C : sg.x;
          const c = Math.floor((sg.dir > 0 ? lead : lead - 0.01) / C);
          const entering = sg.dir > 0 ? sg.x < 0 : sg.x > W - C;
          if (!entering && (sg.dir > 0 ? lead > W || blocked(c, sg.row) : lead < 0 || blocked(c, sg.row))) {
            sg.x = sg.dir > 0 ? Math.min(W - C, c * C - C) : Math.max(0, (c + 1) * C);
            let nr = sg.row + sg.down;
            if (nr >= ROWS) { sg.down = -1; nr = ROWS - 2; }
            if (nr < ZONE && sg.down < 0) { sg.down = 1; nr = sg.row + 1; }
            sg.row = NP.clamp(nr, 0, ROWS - 1);
            sg.vy = -C;
            sg.dir = -sg.dir;
          }
          const sy = OY + sg.row * C + sg.vy;
          if (Math.abs(sg.x + 6 - pl.x) < 9 && Math.abs(sy + 6 - (pl.y - 8)) < 11) return api.die();
        }
        // Паук скачет по зоне игрока.
        spiderT -= dt;
        if (!spider && spiderT <= 0) spider = { x: Math.random() < 0.5 ? -10 : W + 10, y: H - 40, vx: 0, vy: -80 };
        if (spider) {
          if (!spider.vx) spider.vx = (spider.x < 0 ? 1 : -1) * 70 * k;
          spider.x += spider.vx * dt; spider.y += spider.vy * dt * k;
          if (spider.y < OY + ZONE * C + 6 || spider.y > H - 8) spider.vy = -spider.vy;
          if (spider.x < -20 || spider.x > W + 20) { spider = null; spiderT = 3; }
          else if (Math.abs(spider.x - pl.x) < 10 && Math.abs(spider.y - (pl.y - 8)) < 10) return api.die();
        }
        if (!segs.some((s) => s.alive)) {
          if (wave === 1) { wave = 2; startWave(); api.sfx('alarm'); api.shake(0.3); }
          else api.win();
        }
      },
      draw(g) {
        if (!skyline) skyline = drawSkyline();
        g.drawImage(skyline, 0, 0);
        // Кубики-обломки
        blocks.forEach((hp, bk) => {
          const [c, r] = bk.split(',').map(Number), x = c * C, y = OY + r * C;
          g.fillStyle = hp === 3 ? '#3cc9a0' : hp === 2 ? '#2e9a7c' : '#1f6a55'; g.fillRect(x + 1, y + 1, C - 2, C - 2);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1, y + 1, C - 2, 2);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, y + C - 3, C - 2, 2);
        });
        // Многоножка
        for (const sg of segs) {
          if (!sg.alive) continue;
          const x = Math.round(sg.x), y = Math.round(OY + sg.row * C + sg.vy), head = !sg.prev;
          const leg = Math.floor(t * 12 + sg.x / 10) % 2;
          g.fillStyle = '#1b3a14'; g.fillRect(x + 1, y + 10 + leg, 2, 2); g.fillRect(x + 9, y + 10 + (1 - leg), 2, 2);
          g.fillStyle = head ? '#ffd166' : '#6fe3a1'; g.fillRect(x + 1, y + 2, 10, 8); g.fillRect(x + 2, y + 1, 8, 10);
          g.fillStyle = head ? '#ff9f43' : '#2f8a5a'; g.fillRect(x + 2, y + 7, 8, 3);
          if (head) {
            g.fillStyle = '#ff2d3a'; g.fillRect(x + (sg.dir > 0 ? 7 : 2), y + 3, 3, 3);
            g.fillStyle = '#1b1406'; g.fillRect(x + (sg.dir > 0 ? 11 : -1), y + 1, 2, 1); g.fillRect(x + (sg.dir > 0 ? 12 : -2), y, 1, 1);
          }
        }
        if (spider) {
          const x = Math.round(spider.x), y = Math.round(spider.y), l = Math.floor(t * 14) % 2;
          g.fillStyle = '#ff5a5f'; g.fillRect(x - 5, y - 4, 10, 7);
          g.fillStyle = '#ffd0d0'; g.fillRect(x - 3, y - 3, 2, 2); g.fillRect(x + 1, y - 3, 2, 2);
          g.fillStyle = '#ff5a5f'; for (let i = 0; i < 3; i++) { g.fillRect(x - 9, y - 3 + i * 3 + l, 4, 1); g.fillRect(x + 5, y - 3 + i * 3 + (1 - l), 4, 1); }
        }
        // Лучи
        for (const s of shots) {
          g.fillStyle = 'rgba(255,209,102,0.35)'; g.fillRect(Math.round(s.x) - 2, Math.round(s.y), 5, 12);
          g.fillStyle = '#fff6c0'; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 12);
        }
        // Илья со световым ружьём
        const spr = NP.Sprites.person('ilya', 'up', Math.abs(api.axis().x) > 0.1 ? (Math.floor(t * 8) % 2 ? 'w1' : 'w2') : 'idle');
        g.drawImage(spr, Math.round(pl.x - 6), Math.round(pl.y - 18));
        g.fillStyle = '#ffd166'; g.fillRect(Math.round(pl.x) - 1, Math.round(pl.y) - 24, 3, 9);
        g.fillStyle = '#7fe3ff'; g.fillRect(Math.round(pl.x), Math.round(pl.y) - 26, 1, 2);
      },
      status() { return NP.T('arc.centipede.status', { n: segs.filter((s) => s.alive).length, w: wave }); },
    };
  };
  NP.Games.centipede.size = [W, H];
})();
