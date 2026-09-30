// Раунд «Погоня»: гигантский жёлтый Пожиратель катится по ночным улицам и ест фонари.
// Илья и команда — машины-«призраки»: догнать и протаранить его трижды. Съел энергетик — теперь охотится он.
(function () {
  const NP = window.NP;
  const W = 480, H = 270, TS = 15, GW = 32, GH = 18;

  // Город-сетка: улицы каждые 5 клеток по горизонтали и 4 по вертикали.
  const ROAD = [];
  for (let y = 0; y < GH; y++) {
    ROAD.push([]);
    for (let x = 0; x < GW; x++) {
      const inside = x > 0 && y > 0 && x < GW - 1 && y < GH - 1;
      ROAD[y].push(inside && (x % 5 === 1 || x === GW - 2 || y % 4 === 1 || y === GH - 2));
    }
  }
  const open = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && ROAD[y][x];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let city = null;

  function drawCity() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#12141f'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const px = x * TS, py = y * TS;
      if (ROAD[y][x]) {
        g.fillStyle = '#1c1e2a'; g.fillRect(px, py, TS, TS);
        g.fillStyle = '#3a3f55';
        if (open(x - 1, y) && open(x + 1, y) && !open(x, y - 1)) g.fillRect(px + 2, py + 7, 6, 1);
        if (open(x, y - 1) && open(x, y + 1) && !open(x - 1, y)) g.fillRect(px + 7, py + 2, 1, 6);
      } else {
        // Крыши: у каждого квартала свой цвет, окна-огоньки и кондиционеры.
        const blk = Math.floor(x / 5) * 7 + Math.floor(y / 4);
        g.fillStyle = ['#2a2140', '#26324a', '#3a2432', '#223a34'][blk % 4]; g.fillRect(px, py, TS, TS);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + TS - 2, TS, 2);
        if ((x * 13 + y * 7) % 5 === 0) { g.fillStyle = '#5a5f75'; g.fillRect(px + 4, py + 4, 6, 5); }
        if ((x * 5 + y * 11) % 4 === 0) { g.fillStyle = '#ffd98a'; g.fillRect(px + 9, py + 3, 2, 2); }
      }
    }
    return c;
  }

  NP.Games.chase = function (api) {
    let dots, pellets, player, allies, eater, powerT, t, hp, stun;
    const k = api.easy ? 0.8 : 1;
    const mk = (x, y, speed) => ({ x, y, tx: x, ty: y, px: x * TS, py: y * TS, dir: [0, 0], speed });
    const advance = (e, dt, choose) => {
      const tx = e.tx * TS, ty = e.ty * TS, dx = tx - e.px, dy = ty - e.py, d = Math.hypot(dx, dy), st = e.speed * dt;
      if (d > st) { e.px += (dx / d) * st; e.py += (dy / d) * st; return; }
      e.px = tx; e.py = ty; e.x = e.tx; e.y = e.ty;
      const nd = choose(e);
      if (nd && open(e.x + nd[0], e.y + nd[1])) { e.dir = nd; e.tx = e.x + nd[0]; e.ty = e.y + nd[1]; }
      else if (open(e.x + e.dir[0], e.y + e.dir[1])) { e.tx = e.x + e.dir[0]; e.ty = e.y + e.dir[1]; }
    };
    const optionsFor = (e) => DIRS.filter((d) => open(e.x + d[0], e.y + d[1]) && !(d[0] === -e.dir[0] && d[1] === -e.dir[1]));
    const toward = (e, tx, ty) => {
      const o = optionsFor(e);
      if (!o.length) return [-e.dir[0], -e.dir[1]];
      o.sort((a, b) => Math.hypot(e.x + a[0] - tx, e.y + a[1] - ty) - Math.hypot(e.x + b[0] - tx, e.y + b[1] - ty));
      return Math.random() < 0.85 ? o[0] : o[Math.floor(Math.random() * o.length)];
    };
    const hunters = () => [player].concat(allies.filter((a) => a.out <= 0));
    const eaterChoose = (e) => {
      if (powerT > 0) return toward(e, player.x, player.y);
      const o = DIRS.filter((d) => open(e.x + d[0], e.y + d[1]));
      // Убегает от ближайших охотников, по дороге тянется к фонарям и энергетикам.
      let best = null, bs = -1e9;
      for (const d of o) {
        const nx = e.x + d[0], ny = e.y + d[1];
        let sc = Math.min(...hunters().map((h) => Math.hypot(h.x - nx, h.y - ny))) * 3;
        if (dots.has(nx + ',' + ny)) sc += 1.5;
        if (pellets.has(nx + ',' + ny)) sc += 6;
        if (d[0] === -e.dir[0] && d[1] === -e.dir[1]) sc -= 2;
        sc += Math.random() * 1.2;
        if (sc > bs) { bs = sc; best = d; }
      }
      return best;
    };
    let want = [0, 0];
    return {
      reset(full) {
        if (full) {
          dots = new Set(); pellets = new Set(); t = 0; hp = 3;
          for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (ROAD[y][x] && (x + y) % 2 === 0) dots.add(x + ',' + y);
          ['1,1', GW - 2 + ',1', '1,' + (GH - 2), GW - 2 + ',' + (GH - 2)].forEach((p) => { pellets.add(p); dots.delete(p); });
        }
        player = mk(1, GH - 2, 96 * (api.easy ? 1.05 : 1)); want = [0, 0];
        allies = [Object.assign(mk(GW - 2, GH - 2, 74 * k), { col: '#7fe3ff', out: 0 }), Object.assign(mk(1, 1, 70 * k), { col: '#6fe3a1', out: 0 })];
        eater = mk(16, 9, 88 * k); powerT = 0; stun = 1;
      },
      update(dt) {
        t += dt;
        const a = api.axis();
        if (Math.abs(a.x) > 0.5) want = [Math.sign(a.x), 0]; else if (Math.abs(a.y) > 0.5) want = [0, Math.sign(a.y)];
        if ((want[0] || want[1]) && want[0] === -player.dir[0] && want[1] === -player.dir[1]) { player.dir = want; const ox = player.tx, oy = player.ty; player.tx = player.x; player.ty = player.y; player.x = ox; player.y = oy; }
        advance(player, dt, () => want);
        for (const al of allies) {
          if (al.out > 0) { al.out -= dt; continue; }
          advance(al, dt, (e) => (powerT > 0 ? toward(e, 16 - (eater.x - 16), 9) : toward(e, eater.x, eater.y)));
        }
        if (stun > 0) stun -= dt;
        eater.speed = (powerT > 0 ? 92 : 88) * k;
        if (stun <= 0) advance(eater, dt, eaterChoose);
        const ek = eater.x + ',' + eater.y;
        if (dots.delete(ek) && dots.size % 4 === 0) api.sfx('step');
        if (pellets.delete(ek)) { powerT = api.easy ? 5 : 6.5; api.sfx('alarm'); api.shake(0.25); }
        if (powerT > 0) powerT -= dt;
        // Столкновения
        for (const h of hunters()) {
          if (Math.hypot(h.px - eater.px, h.py - eater.py) > 14 || stun > 0) continue;
          if (powerT > 0) {
            api.boom(h.px + 7, h.py + 7, '#ff5a5f', 30);
            if (h === player) return api.die();
            h.out = 3; Object.assign(h, mk(h === allies[0] ? GW - 2 : 1, h === allies[0] ? GH - 2 : 1, h.speed));
          } else {
            hp--; api.shake(0.4); api.sfx('hit');
            for (let i = 0; i < 3; i++) api.boom(eater.px + 7, eater.py + 7, '#ffd166', 30);
            if (hp <= 0) return api.win();
            Object.assign(eater, mk(16, 9, eater.speed)); stun = 1.5;
          }
        }
      },
      draw(g) {
        if (!city) city = drawCity();
        g.drawImage(city, 0, 0);
        g.fillStyle = '#ffd98a';
        dots.forEach((d) => { const [x, y] = d.split(','); g.fillRect(x * TS + 6, y * TS + 6, 3, 3); });
        if (Math.sin(t * 8) > -0.2) pellets.forEach((d) => { const [x, y] = d.split(','); g.fillStyle = '#ff5a5f'; g.fillRect(x * TS + 3, y * TS + 2, 9, 11); g.fillStyle = '#fff'; g.fillRect(x * TS + 5, y * TS + 5, 5, 2); });
        const car = (e, col, label) => {
          const x = Math.round(e.px), y = Math.round(e.py), hor = e.dir[0] !== 0;
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + 3, 13, 11);
          g.fillStyle = col;
          if (hor) { g.fillRect(x + 1, y + 3, 13, 9); g.fillStyle = '#10131b'; g.fillRect(x + 4, y + 5, 6, 5); g.fillStyle = '#fff6c0'; g.fillRect(e.dir[0] > 0 ? x + 13 : x, y + 4, 2, 2); g.fillRect(e.dir[0] > 0 ? x + 13 : x, y + 9, 2, 2); }
          else { g.fillRect(x + 3, y + 1, 9, 13); g.fillStyle = '#10131b'; g.fillRect(x + 5, y + 4, 5, 6); g.fillStyle = '#fff6c0'; g.fillRect(x + 4, e.dir[1] > 0 ? y + 13 : y, 2, 2); g.fillRect(x + 9, e.dir[1] > 0 ? y + 13 : y, 2, 2); }
          if (label) { g.fillStyle = '#fff'; g.fillRect(x + 7, y + 7, 1, 1); }
        };
        allies.forEach((al) => { if (al.out <= 0) car(al, al.col); });
        car(player, '#ff5a5f', true);
        // Пожиратель: большой круг с ртом, в ярости — красный с бровями.
        const cx = eater.px + 7, cy = eater.py + 7, r = 12;
        const mouth = Math.abs(Math.sin(t * 10)) * 0.9;
        const ang = Math.atan2(eater.dir[1], eater.dir[0] || 1);
        const angry = powerT > 0;
        if (stun > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.4;
        g.fillStyle = angry ? (powerT < 1.5 && Math.floor(t * 10) % 2 ? '#ffd166' : '#ff3b3b') : '#ffd166';
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, ang + mouth / 2, ang + Math.PI * 2 - mouth / 2); g.closePath(); g.fill();
        g.fillStyle = '#1b1406'; g.fillRect(Math.round(cx - 2 + eater.dir[1] * 4), Math.round(cy - 6), 3, 3);
        if (angry) { g.fillRect(Math.round(cx - 5), Math.round(cy - 9), 7, 2); }
        g.globalAlpha = 1;
        if (angry && !NP.Settings.values.reduceFlash) { g.fillStyle = 'rgba(255,40,40,0.08)'; g.fillRect(0, 0, W, H); }
      },
      status() { return NP.T(powerT > 0 ? 'arc.chase.danger' : 'arc.chase.status', { n: hp }); },
    };
  };
  NP.Games.chase.size = [W, H];
})();
