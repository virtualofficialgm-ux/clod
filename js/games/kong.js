// Финальный раунд «Громила»: на корабле пришельцев огромная пиксельная горилла держит Веру на верхней балке
// и швыряет бочки. Илья бежит, прыгает и лезет по лестницам. Кто знает шаблон — побеждает.
(function () {
  const NP = window.NP;
  const W = 480, H = 270;
  // Балки: наклон задан высотой на концах. Бочки катятся вниз по наклону и падают с нижнего конца.
  const G = [
    { x0: 0, x1: 480, y0: 258, y1: 258 },
    { x0: 10, x1: 430, y0: 214, y1: 224 },
    { x0: 50, x1: 470, y0: 182, y1: 172 },
    { x0: 10, x1: 430, y0: 130, y1: 140 },
    { x0: 50, x1: 470, y0: 98, y1: 88 },
    { x0: 10, x1: 300, y0: 52, y1: 52 },
  ];
  const gy = (g, x) => g.y0 + ((g.y1 - g.y0) * (x - g.x0)) / (g.x1 - g.x0);
  const on = (g, x) => x >= g.x0 && x <= g.x1;
  const LADDERS = [[1, 390], [1, 120], [2, 90], [2, 300], [3, 360], [3, 180], [4, 110], [4, 260], [5, 230]].map(([top, x]) => ({ x, top, bot: top - 1 }));
  const APE = [
    '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbbffffffbbb..', '..bbfwkffkwfbb..', '..bbffffffffbb..', '...bbfmmmmfbb...',
    '.bbbbbffffbbbbb.', 'bbbbbbbbbbbbbbbb', 'bbffbbbbbbbbffbb', 'bbffbbbbbbbbffbb', 'bbbbbbffffbbbbbb', '.bbbbffffffbbbb.',
    '..bbbbbbbbbbbb..', '..bbbb....bbbb..', '.bbbbb....bbbbb.', '.bbbb......bbbb.',
  ];
  let bg = null;

  function drawBg() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0616'; g.fillRect(0, 0, W, H);
    // Неоновые рёбра корабля и иллюминаторы со звёздами
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(182,156,255,0.08)'; g.fillRect(i * 64, 0, 3, H); }
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 96, y = 20;
      g.fillStyle = '#1a1030'; g.beginPath(); g.arc(x, y + 14, 14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(x, y + 14, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.fillRect(x - 4, y + 10, 1, 1); g.fillRect(x + 3, y + 17, 1, 1);
    }
    // Балки: красная сталь с заклёпками, лестницы бирюзовые
    for (const l of LADDERS) {
      const t = G[l.top], b = G[l.bot], y0 = gy(t, l.x), y1 = gy(b, l.x);
      g.fillStyle = '#3cc9c9'; g.fillRect(l.x - 6, y0, 2, y1 - y0); g.fillRect(l.x + 4, y0, 2, y1 - y0);
      for (let y = y0 + 4; y < y1; y += 6) g.fillRect(l.x - 6, y, 12, 1);
    }
    for (const gr of G) {
      for (let x = gr.x0; x < gr.x1; x += 8) {
        const y = Math.round(gy(gr, x));
        g.fillStyle = '#d8434a'; g.fillRect(x, y, 8, 6);
        g.fillStyle = '#ff8a8a'; g.fillRect(x, y, 8, 1);
        g.fillStyle = '#7a1f28'; g.fillRect(x + 3, y + 2, 2, 2); g.fillRect(x, y + 5, 8, 1);
      }
    }
    return c;
  }

  NP.Games.kong = function (api) {
    let pl, barrels, throwT, t, apeArm, bonus;
    const k = api.easy ? 0.75 : 1;
    const girderUnder = (x, y) => {
      // Ближайшая балка под ногами (в пределах шага).
      let best = null;
      for (const g of G) if (on(g, x)) { const yy = gy(g, x); if (yy >= y - 4 && (!best || yy < best.y)) best = { g, y: yy }; }
      return best;
    };
    const ladderAt = (x, feetY) => LADDERS.find((l) => Math.abs(l.x - x) < 6 && feetY <= gy(G[l.bot], l.x) + 2 && feetY >= gy(G[l.top], l.x) - 2);
    return {
      reset(full) {
        if (full) { t = 0; bonus = 0; }
        pl = { x: 40, y: 258, vx: 0, vy: 0, ground: true, climb: null, face: 1 };
        barrels = []; throwT = 1.2; apeArm = 0;
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        const jump = api.pressed('act');
        if (pl.climb) {
          // На лестнице: только вверх-вниз.
          const l = pl.climb, top = gy(G[l.top], l.x), bot = gy(G[l.bot], l.x);
          pl.x = l.x; pl.y += a.y * 60 * dt;
          if (pl.y <= top) { pl.y = top; pl.climb = null; pl.ground = true; }
          else if (pl.y >= bot) { pl.y = bot; pl.climb = null; pl.ground = true; }
        } else {
          pl.vx = a.x * 78;
          if (a.x) pl.face = Math.sign(a.x);
          const lad = ladderAt(pl.x, pl.y);
          if (lad && pl.ground && ((a.y < -0.5 && pl.y > gy(G[lad.top], lad.x) + 2) || (a.y > 0.5 && pl.y < gy(G[lad.bot], lad.x) - 2))) { pl.climb = lad; pl.vx = 0; }
          else {
            if (jump && pl.ground) { pl.vy = -165; pl.ground = false; api.sfx('step'); }
            pl.vy += 520 * dt;
            pl.x = NP.clamp(pl.x + pl.vx * dt, 6, W - 6);
            const prevY = pl.y;
            pl.y += pl.vy * dt;
            pl.ground = false;
            if (pl.vy >= 0) {
              for (const g of G) {
                if (!on(g, pl.x)) continue;
                const yy = gy(g, pl.x);
                if (prevY <= yy + 3 && pl.y >= yy - 1) { pl.y = yy; pl.vy = 0; pl.ground = true; break; }
              }
            }
            if (pl.y > H + 20) return api.die();
          }
        }
        // Горилла швыряет бочки.
        throwT -= dt;
        if (apeArm > 0) apeArm -= dt;
        if (throwT <= 0) {
          throwT = (api.easy ? 2.8 : 2) + Math.random() * 0.8;
          apeArm = 0.4;
          barrels.push({ x: 70, y: gy(G[5], 70), g: 5, vx: 60 * k, vy: 0, fall: false, rot: 0, jumped: false });
          api.sfx('door');
        }
        for (const b of barrels) {
          b.rot += dt * 10;
          if (b.fall) {
            b.vy += 400 * dt; b.y += b.vy * dt; b.x += b.vx * 0.3 * dt;
            for (let i = 0; i < G.length; i++) {
              const g = G[i];
              if (i < b.g && on(g, b.x) && b.y >= gy(g, b.x)) { b.y = gy(g, b.x); b.g = i; b.fall = false; b.vy = 0; b.vx = (g.y1 > g.y0 ? 1 : g.y1 < g.y0 ? -1 : (Math.random() < 0.5 ? -1 : 1)) * (70 + Math.random() * 20) * k; api.shake(0.05); break; }
            }
          } else {
            const g = G[b.g];
            if (b.g === 5) b.vx = 70 * k;
            b.x += b.vx * dt;
            // Иногда бочка сворачивает на лестницу вниз.
            const l = LADDERS.find((l) => l.top === b.g && Math.abs(l.x - b.x) < 2);
            if (l && !b.lastL && Math.random() < 0.35) { b.fall = true; b.vx = 0; b.x = l.x; b.lastL = l; }
            else if (!on(g, b.x)) { b.fall = true; }
            else b.y = gy(g, b.x);
          }
          if (!pl.climb && Math.hypot(b.x - pl.x, b.y - 5 - (pl.y - 8)) < 9) return api.die();
          if (pl.climb && Math.abs(b.x - pl.x) < 7 && Math.abs(b.y - 5 - (pl.y - 8)) < 10) return api.die();
          // Перепрыгнул бочку — очки и искры.
          if (!b.jumped && !pl.ground && !pl.climb && Math.abs(b.x - pl.x) < 6 && pl.y < b.y - 10 && pl.y > b.y - 40) { b.jumped = true; bonus += 100; api.fx.emit(pl.x, pl.y - 20, { count: 1, color: '#ffd166', glyph: '+100', speed: 20, angle: -Math.PI / 2, spread: 0, life: 1, drag: 0 }); api.sfx('blip'); }
        }
        barrels = barrels.filter((b) => b.y < H + 20 && b.x > -20 && b.x < W + 20 && !(b.g === 0 && (b.x < 4 || b.x > W - 4)));
        // Победа: добраться до Веры на верхней балке.
        if (pl.ground && pl.y <= gy(G[5], pl.x) + 1 && pl.x > 250) api.win();
      },
      draw(g) {
        if (!bg) bg = drawBg();
        g.drawImage(bg, 0, 0);
        // Горилла
        const ax = 22, ay = 52 - 34 + (Math.floor(t * 3) % 2 && apeArm <= 0 ? 1 : 0);
        const img = NP.Arcade.sprite('ape', APE, { b: '#7a4a2a', f: '#d9a878', w: '#ffffff', k: '#1b1406', m: '#5a2a1a' });
        g.drawImage(img, ax, ay, 32, 32);
        if (apeArm > 0) { g.fillStyle = '#7a4a2a'; g.fillRect(ax + 26, ay - 6, 8, 12); }
        else if (Math.floor(t * 4) % 2) { g.fillStyle = '#d9a878'; g.fillRect(ax + 10, ay + 16, 12, 3); }
        // Вера в плену
        const v = NP.Sprites.person('vera', 'down', Math.floor(t * 3) % 2 ? 'w1' : 'idle');
        g.drawImage(v, 274, 52 - 18);
        if (Math.floor(t * 2) % 2) NP.FX.emote(g, 280, 30, '!', t % 1, 1);
        // Бочки
        for (const b of barrels) {
          const x = Math.round(b.x), y = Math.round(b.y);
          g.fillStyle = '#b8732e'; g.fillRect(x - 5, y - 10, 10, 10);
          g.fillStyle = '#6b3f14'; const s = Math.floor(b.rot) % 2; g.fillRect(x - 5, y - 8 + s * 4, 10, 2); g.fillRect(x - 1 - s * 2, y - 10, 2, 10);
        }
        // Илья
        let frame = 'idle', dir = pl.face > 0 ? 'right' : 'left';
        if (pl.climb) { dir = 'up'; frame = Math.floor(pl.y / 6) % 2 ? 'w1' : 'w2'; }
        else if (Math.abs(pl.vx) > 1 && pl.ground) frame = Math.floor(t * 10) % 2 ? 'w1' : 'w2';
        else if (!pl.ground) frame = 'w1';
        g.drawImage(NP.Sprites.person('ilya', dir, frame), Math.round(pl.x - 6), Math.round(pl.y - 18));
      },
      status() { return NP.T('arc.kong.status', { n: bonus }); },
    };
  };
  NP.Games.kong.size = [W, H];
})();
